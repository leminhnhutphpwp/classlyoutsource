<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Resources\PaymentRequestResource;
use App\Models\ClassRoom;
use App\Models\Payment;
use App\Models\PaymentRequest;
use App\Models\Student;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class PaymentRequestController extends BaseController
{
    /**
     * Get payment requests for a class.
     */
    public function index(Request $request, ClassRoom $classRoom): JsonResponse
    {
        // Defensive check: ensure class room was properly resolved
        if (! $classRoom || ! $classRoom->exists || ! $classRoom->id) {
            return $this->errorResponse('Không tìm thấy lớp học', null, 'NOT_FOUND', 404);
        }
        $classId = $classRoom->id;
        $class = $classRoom;

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Fail closed: owning tutor / enrolled student / super admin only. An org accountant reads a
        // class's payment-requests as a FINANCE read (billing) without gaining teaching access — so it
        // bypasses guardClassAccess (which fails accountants closed) via the dedicated finance gate.
        if (! $this->callerIsOrgFinanceForClass($class) && ($denied = $this->guardClassAccess($class))) {
            return $denied;
        }

        $query = PaymentRequest::where('class_id', $classId)
            ->with(['class', 'creator', 'payments.student']);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by period_month
        if ($request->has('period_month')) {
            $query->where('period_month', $request->period_month);
        }

        // Sorting (default: newest requests first)
        $sortable = ['created_at', 'due_date', 'period_month', 'status', 'amount_per_student'];
        $sortBy = $request->get('sort', 'created_at');
        if (! in_array($sortBy, $sortable, true)) {
            $sortBy = 'created_at';
        }
        $sortOrder = strtolower($request->get('order', 'desc')) === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sortBy, $sortOrder)->orderBy('id', 'desc');

        $perPage = min($request->get('per_page', 15), 100);
        $paymentRequests = $query->paginate($perPage);

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('payment_requests.manage');

        return response()->json([
            'success' => true,
            'data' => PaymentRequestResource::collection($paymentRequests),
            'meta' => [
                'current_page' => $paymentRequests->currentPage(),
                'per_page' => $paymentRequests->perPage(),
                'total' => $paymentRequests->total(),
                'last_page' => $paymentRequests->lastPage(),
            ],
            'permissions' => $permissions,
        ]);
    }

    /**
     * Get payment request detail with statistics.
     */
    public function show(PaymentRequest $paymentRequest): JsonResponse
    {
        // Defensive check: ensure payment request was properly resolved
        if (! $paymentRequest || ! $paymentRequest->exists || ! $paymentRequest->id) {
            return $this->errorResponse('Không tìm thấy yêu cầu thanh toán', null, 'NOT_FOUND', 404);
        }
        $paymentRequest->load(['class', 'creator', 'payments.student']);

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Check access. An org accountant may read this billing record (finance) even though the
        // teaching class guard fails them closed — the finance gate is org-scoped and read-only.
        if (! $this->callerIsOrgFinanceForClass($paymentRequest->class)
            && ! $this->callerCanViewClass($paymentRequest->class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        $summary = $paymentRequest->getStatusSummary();

        return $this->successResponse([
            'payment_request' => new PaymentRequestResource($paymentRequest),
            'summary' => $summary,
        ]);
    }

    /**
     * Create a payment request for a class.
     * Optionally auto-create pending payments for all active students.
     */
    public function store(Request $request, ClassRoom $classRoom): JsonResponse
    {
        // Defensive check: ensure class room was properly resolved
        if (! $classRoom || ! $classRoom->exists || ! $classRoom->id) {
            return $this->errorResponse('Không tìm thấy lớp học', null, 'NOT_FOUND', 404);
        }
        $classId = $classRoom->id;
        $class = $classRoom->load('students');

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        if ($planError = $this->requirePlanCapability('payment_requests.manage')) {
            return $planError;
        }

        // Check access
        if (! $this->canManageResource($class)) {
            return $this->errorResponse('Không có quyền tạo yêu cầu đóng học phí cho lớp này', null, 'UNAUTHORIZED', 403);
        }

        $validator = Validator::make($request->all(), [
            'period_name' => 'required|string|max:100',
            'period_month' => 'nullable|string|max:20',
            'amount_per_student' => 'required|numeric|min:0',
            'due_date' => 'required|date',
            'description' => 'nullable|string|max:1000',
            'status' => 'nullable|in:pending,active,cancelled',
            'auto_create_payments' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        DB::beginTransaction();
        try {
            // Create payment request
            $paymentRequest = PaymentRequest::create([
                'class_id' => $classId,
                'created_by' => $user->id,
                'period_name' => $request->period_name,
                'period_month' => $request->period_month,
                'amount_per_student' => $request->amount_per_student,
                'due_date' => $request->due_date,
                'description' => $request->description,
                'status' => $request->get('status', 'pending'), // Default: pending
            ]);

            // Auto-create pending payments for all active students if requested
            $autoCreate = $request->get('auto_create_payments', true);
            if ($autoCreate) {
                $activeStudents = $class->students()
                    ->wherePivot('status', 'active')
                    ->wherePivot('is_paused', false)
                    ->get();

                foreach ($activeStudents as $student) {
                    Payment::create([
                        'student_id' => $student->id,
                        'class_id' => $classId,
                        'payment_request_id' => $paymentRequest->id,
                        'amount' => $request->amount_per_student,
                        'month' => $request->period_month ?? date('Y-m'),
                        'due_date' => $request->due_date,
                        'status' => 'pending',
                        'payment_method' => 'bank', // Default
                    ]);
                }
            }

            DB::commit();

            return $this->successResponse(
                new PaymentRequestResource($paymentRequest->load(['class', 'creator', 'payments'])),
                'Tạo yêu cầu đóng học phí thành công',
                201
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->errorResponse('Lỗi khi tạo yêu cầu đóng học phí: '.$e->getMessage(), null, 'SERVER_ERROR', 500);
        }
    }

    /**
     * Create multiple payment requests at once (bulk create).
     * Example: Create 6 requests for 6 months.
     */
    public function bulkCreate(Request $request, ClassRoom $classRoom): JsonResponse
    {
        $classId = $classRoom->id;
        $class = $classRoom;

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        if ($planError = $this->requirePlanCapability('payment_requests.manage')) {
            return $planError;
        }

        // Check access
        if (! $this->canManageResource($class)) {
            return $this->errorResponse('Không có quyền tạo yêu cầu đóng học phí cho lớp này', null, 'UNAUTHORIZED', 403);
        }

        $validator = Validator::make($request->all(), [
            'amount_per_student' => 'required|numeric|min:0',
            'start_date' => 'required|date',
            'number_of_periods' => 'required|integer|min:1|max:24',
            'period_type' => 'required|in:monthly,weekly,custom',
            'period_name_template' => 'nullable|string|max:100',
            'description' => 'nullable|string|max:1000',
            'status' => 'nullable|in:pending,active,cancelled',
            'auto_create_payments' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        $amountPerStudent = $request->amount_per_student;
        $startDate = Carbon::parse($request->start_date);
        $numberOfPeriods = $request->number_of_periods;
        $periodType = $request->period_type;
        $periodNameTemplate = $request->period_name_template ?? 'Đợt {number}';
        $description = $request->description;
        $autoCreate = $request->get('auto_create_payments', true);

        DB::beginTransaction();
        try {
            $createdRequests = [];

            for ($i = 1; $i <= $numberOfPeriods; $i++) {
                // Calculate due date based on period type
                $dueDate = match ($periodType) {
                    'monthly' => $startDate->copy()->addMonths($i - 1),
                    'weekly' => $startDate->copy()->addWeeks($i - 1),
                    'custom' => $startDate->copy()->addDays(($i - 1) * 30), // Default: 30 days per period
                };

                $periodMonth = $dueDate->format('Y-m');
                $periodName = str_replace('{number}', $i, $periodNameTemplate);

                // Create payment request
                $paymentRequest = PaymentRequest::create([
                    'class_id' => $classId,
                    'created_by' => $user->id,
                    'period_name' => $periodName,
                    'period_month' => $periodMonth,
                    'amount_per_student' => $amountPerStudent,
                    'due_date' => $dueDate->toDateString(),
                    'description' => $description,
                    'status' => $request->get('status', 'pending'), // Default: pending
                    'metadata' => [
                        'period_number' => $i,
                        'total_periods' => $numberOfPeriods,
                        'period_type' => $periodType,
                    ],
                ]);

                // Auto-create pending payments
                if ($autoCreate) {
                    $activeStudents = $class->students()
                        ->wherePivot('status', 'active')
                        ->wherePivot('is_paused', false)
                        ->get();

                    foreach ($activeStudents as $student) {
                        Payment::create([
                            'student_id' => $student->id,
                            'class_id' => $classId,
                            'payment_request_id' => $paymentRequest->id,
                            'amount' => $amountPerStudent,
                            'month' => $periodMonth,
                            'due_date' => $dueDate->toDateString(),
                            'status' => 'pending',
                            'payment_method' => 'bank',
                        ]);
                    }
                }

                $createdRequests[] = $paymentRequest;
            }

            DB::commit();

            return $this->successResponse(
                PaymentRequestResource::collection(collect($createdRequests)->load(['class', 'creator'])),
                "Đã tạo {$numberOfPeriods} yêu cầu đóng học phí thành công",
                201
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->errorResponse('Lỗi khi tạo yêu cầu đóng học phí: '.$e->getMessage(), null, 'SERVER_ERROR', 500);
        }
    }

    /**
     * Update payment request.
     */
    public function update(Request $request, PaymentRequest $paymentRequest): JsonResponse
    {
        // Defensive check: ensure payment request was properly resolved
        if (! $paymentRequest || ! $paymentRequest->exists || ! $paymentRequest->id) {
            return $this->errorResponse('Không tìm thấy yêu cầu thanh toán', null, 'NOT_FOUND', 404);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        if ($planError = $this->requirePlanCapability('payment_requests.manage')) {
            return $planError;
        }

        // Check access
        if (! $this->canManageResource($paymentRequest->class)) {
            return $this->errorResponse('Không có quyền cập nhật yêu cầu này', null, 'UNAUTHORIZED', 403);
        }

        $validator = Validator::make($request->all(), [
            'period_name' => 'sometimes|string|max:100',
            'period_month' => 'nullable|string|max:20',
            'amount_per_student' => 'sometimes|numeric|min:0',
            'due_date' => 'sometimes|date',
            'description' => 'nullable|string|max:1000',
            'status' => 'sometimes|in:pending,active,cancelled',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        $paymentRequest->update($request->only([
            'period_name',
            'period_month',
            'amount_per_student',
            'due_date',
            'description',
            'status',
        ]));

        return $this->successResponse(
            new PaymentRequestResource($paymentRequest->fresh(['class', 'creator'])),
            'Cập nhật yêu cầu đóng học phí thành công'
        );
    }

    /**
     * Delete payment request.
     */
    public function destroy(PaymentRequest $paymentRequest): JsonResponse
    {
        // Defensive check: ensure payment request was properly resolved
        if (! $paymentRequest || ! $paymentRequest->exists || ! $paymentRequest->id) {
            return $this->errorResponse('Không tìm thấy yêu cầu thanh toán', null, 'NOT_FOUND', 404);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Check access
        if (! $this->canManageResource($paymentRequest->class)) {
            return $this->errorResponse('Không có quyền xóa yêu cầu này', null, 'UNAUTHORIZED', 403);
        }

        // Check if there are any paid payments
        $paidCount = $paymentRequest->paidPayments()->count();
        if ($paidCount > 0) {
            return $this->errorResponse('Không thể xóa yêu cầu đã có thanh toán', null, 'INVALID_OPERATION', 400);
        }

        $paymentRequest->delete();

        return $this->successResponse(null, 'Xóa yêu cầu đóng học phí thành công');
    }

    /**
     * Get statistics for a payment request.
     */
    public function statistics(PaymentRequest $paymentRequest): JsonResponse
    {
        $paymentRequest->load(['class', 'payments.student']);

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Check access. An org accountant may read this billing record (finance) even though the
        // teaching class guard fails them closed — the finance gate is org-scoped and read-only.
        if (! $this->callerIsOrgFinanceForClass($paymentRequest->class)
            && ! $this->callerCanViewClass($paymentRequest->class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        $summary = $paymentRequest->getStatusSummary();

        return $this->successResponse([
            'payment_request' => [
                '_id' => $paymentRequest->hash_id,
                'period_name' => $paymentRequest->period_name,
                'amount_per_student' => $paymentRequest->amount_per_student,
                'due_date' => $paymentRequest->due_date->toDateString(),
            ],
            'statistics' => $summary,
        ]);
    }
}
