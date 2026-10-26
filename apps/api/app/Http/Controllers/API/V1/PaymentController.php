<?php

namespace App\Http\Controllers\API\V1;

use App\Actions\ImportPaymentAction;
use App\Http\Requests\ImportPaymentsRequest;
use App\Http\Resources\PaymentResource;
use App\Http\Resources\StudentResource;
use App\Models\ClassRoom;
use App\Models\Enrollment;
use App\Models\Payment;
use App\Models\PaymentRequest;
use App\Models\Setting;
use App\Models\Student;
use App\Models\UserNotificationPreference;
use App\Notifications\StudentPaymentFailedNotification;
use App\Notifications\StudentPaymentSuccessNotification;
use App\Rules\ExistsHashId;
use App\Services\DataJobService;
use App\Services\ImportService;
use App\Services\PaymentTokenService;
use App\Support\CacheHelper;
use App\Support\CacheKeys;
use App\Support\CacheTtl;
use App\Support\CurrencyHelper;
use App\Support\ReferenceCode;
use App\Traits\DecodesHashIds;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class PaymentController extends BaseController
{
    use DecodesHashIds;

    /**
     * Get validation rules for payment.
     */
    private function getValidationRules(bool $isUpdate = false): array
    {
        $rules = [
            'student_id' => array_merge(
                $isUpdate ? ['sometimes'] : [],
                ['required', new ExistsHashId(Student::class)]
            ),
            // Money is whole VND (decimal(12,0)) — a fractional input would silently round, so reject it.
            'amount' => ($isUpdate ? 'sometimes|' : '').'required|integer|min:1|max:999999999999',
            'payment_date' => 'nullable|date',
            'payment_method' => ($isUpdate ? 'sometimes|' : '').'required|in:cash,bank,other',
            'transaction_id' => 'nullable|string|max:255',
            'month' => ($isUpdate ? 'sometimes|' : '').'required|string|max:20',
            'due_date' => 'nullable|date',
            'note' => 'nullable|string',
            'status' => 'nullable|in:paid,pending,failed,refunded',
            'payment_request_id' => ['nullable', new ExistsHashId(PaymentRequest::class)],
        ];

        if (! $isUpdate) {
            $rules['class_id'] = ['nullable', new ExistsHashId(ClassRoom::class)];
        }

        return $rules;
    }

    /**
     * Accountant is FINANCE-READ + expense-entry ONLY (design §5 QĐ 3): they may view payments and
     * record expenses, but NEVER mutate/approve/refund/import payments. This gate closes every payment
     * mutation endpoint for the accountant role before any capability/access logic runs.
     */
    private function checkMutationAllowed($user): ?JsonResponse
    {
        if ($user->isOrgAccountant() && ! $user->isSuperAdmin()) {
            return $this->errorResponse('Kế toán chỉ được xem, không được thay đổi thanh toán', null, 'ACCOUNTANT_READONLY', 403);
        }

        return null;
    }

    /**
     * Check if user can access a specific payment.
     */
    private function checkAccess($payment, $user): ?JsonResponse
    {
        // Student: chỉ có thể xem payments của chính họ
        if ($user->isStudent()) {
            $student = $this->getCurrentStudent();
            if (! $student || $payment->student_id !== $student->id) {
                return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }

            return null;
        }

        // Org owner/manager (whole org) AND accountant (finance-only) may read any payment that belongs
        // to a class of THEIR org. MUST be checked BEFORE isTutor() — all three share User.role=tutor,
        // so falling through to the tutor branch would deny an owner/manager/accountant on a co-member's
        // payment (the `else → deny` at design §6 risk 2 that this fix closes). Fail-closed cross-org.
        if ($user->isOrgViewerAll() || $user->isOrgAccountant()) {
            $orgId = $user->currentOrganization()?->id;
            $inOrg = $orgId
                && $payment->class
                && (int) $payment->class->organization_id === (int) $orgId;

            return $inOrg
                ? null
                : $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Access check: a plain tutor can only see payments in their own classes.
        if ($user->isTutor()) {
            if (! $payment->class || $payment->class->tutor_id !== $user->id) {
                return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }

            return null;
        }

        // Everyone else → fail-closed.
        return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
    }

    /**
     * Apply filters (class_id, student_id, status, payment_method, date, sort) to query.
     */
    private function applyFilters($query, Request $request)
    {
        if ($request->has('class_id')) {
            $query->where('class_id', $request->class_id);
        }

        if ($request->has('student_id')) {
            $query->where('student_id', $request->student_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('payment_method')) {
            $query->where('payment_method', $request->payment_method);
        }

        if ($request->has('date_from')) {
            $query->whereDate('payment_date', '>=', $request->date_from);
        }

        if ($request->has('date_to')) {
            $query->whereDate('payment_date', '<=', $request->date_to);
        }

        // Search by invoice_number, transaction_id, note, month, student name, student code, class name
        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', "%{$search}%")
                    ->orWhere('transaction_id', 'like', "%{$search}%")
                    ->orWhere('note', 'like', "%{$search}%")
                    ->orWhere('month', 'like', "%{$search}%")
                    ->orWhereHas('student', function ($studentQuery) use ($search) {
                        $studentQuery->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%")
                            ->orWhere('phone', 'like', "%{$search}%")
                            ->orWhere('student_code', 'like', "%{$search}%");
                    })
                    ->orWhereHas('class', function ($classQuery) use ($search) {
                        $classQuery->where('name', 'like', "%{$search}%")
                            ->orWhere('subject', 'like', "%{$search}%");
                    });
            });
        }

        // Sort (default: latest created first to surface newly logged payments)
        $sortable = ['created_at', 'updated_at', 'payment_date', 'due_date', 'amount', 'status', 'month'];
        $sortBy = $request->get('sort', 'created_at');
        if (! in_array($sortBy, $sortable, true)) {
            $sortBy = 'created_at';
        }
        $sortOrder = strtolower($request->get('order', 'desc')) === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sortBy, $sortOrder);

        return $query;
    }

    public function index(Request $request): JsonResponse
    {
        // Decode filter IDs
        $this->decodeHashId($request, 'class_id', ClassRoom::class);
        $this->decodeHashId($request, 'student_id', Student::class);

        $user = $this->getAuthUser();
        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Học viên: có thể xem payments của chính họ (không cần capability)
        // Giáo viên: cần capability payments.manage để xem payments
        if (! $user->isStudent()) {
            if ($capabilityError = $this->requirePlanCapability('payments.manage')) {
                return $capabilityError;
            }
        }

        $query = Payment::query()->with(['class.organization.bankAccounts', 'class', 'student', 'paymentRequest']);

        $query = $this->applyDataIsolation($query, 'payments');

        // Apply filters
        $query = $this->applyFilters($query, $request);

        $perPage = min($request->get('per_page', 15), 100);
        $page = $request->get('page', 1);

        $filters = [
            'status' => $request->get('status'),
            'payment_method' => $request->get('payment_method'),
            'date_from' => $request->get('date_from'),
            'date_to' => $request->get('date_to'),
            'class_id' => $request->get('class_id'),
            'student_id' => $request->get('student_id'),
            'search' => $request->get('search'),
            'sort' => $request->get('sort', 'created_at'),
            'order' => $request->get('order', 'desc'),
            'per_page' => $perPage,
            'page' => $page,
        ];

        $cacheKey = CacheKeys::paymentsList($user->id, $filters);
        $payments = Cache::remember($cacheKey, CacheTtl::LIST, function () use ($query, $perPage) {
            return $query->paginate($perPage);
        });

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('payments.manage');

        return response()->json([
            'success' => true,
            'data' => PaymentResource::collection($payments),
            'meta' => [
                'current_page' => $payments->currentPage(),
                'per_page' => $payments->perPage(),
                'total' => $payments->total(),
                'last_page' => $payments->lastPage(),
            ],
            'permissions' => $permissions,
        ]);
    }

    public function show(Payment $payment): JsonResponse
    {
        $payment->load(['class.organization.bankAccounts', 'class', 'student', 'paymentRequest']);

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $accessError = $this->checkAccess($payment, $user);
        if ($accessError) {
            return $accessError;
        }

        return $this->successResponse(new PaymentResource($payment));
    }

    public function store(Request $request): JsonResponse
    {
        if ($planError = $this->requirePlanCapability('payments.manage')) {
            return $planError;
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        if ($mutationError = $this->checkMutationAllowed($user)) {
            return $mutationError;
        }

        $validator = Validator::make($request->all(), $this->getValidationRules());

        if ($validator->fails()) {
            return $this->errorResponse('Dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        // Decode HashIDs
        $idsToDecode = $request->only(['class_id', 'student_id', 'payment_request_id']);
        $this->decodeHashId($idsToDecode, 'class_id', ClassRoom::class);
        $this->decodeHashId($idsToDecode, 'student_id', Student::class);
        $this->decodeHashId($idsToDecode, 'payment_request_id', PaymentRequest::class);
        $request->merge($idsToDecode);

        $paymentData = $request->only([
            'class_id', 'student_id', 'amount', 'payment_date', 'payment_method',
            'transaction_id', 'month', 'due_date', 'note', 'status', 'payment_request_id',
        ]);

        // Validate class belongs to tutor (if class_id provided)
        if (isset($paymentData['class_id'])) {
            $class = ClassRoom::find($paymentData['class_id']);
            if (! $class) {
                return $this->errorResponse('Lớp học không tồn tại', null, 'NOT_FOUND', 404);
            }
            if ($user->isTutor() && $class->tutor_id !== $user->id) {
                return $this->errorResponse('Bạn không có quyền tạo thanh toán cho lớp học này', null, 'UNAUTHORIZED', 403);
            }
        }

        // Validate student belongs to class (if both provided)
        if (isset($paymentData['class_id']) && isset($paymentData['student_id'])) {
            $student = Student::find($paymentData['student_id']);
            if (! $student) {
                return $this->errorResponse('Học viên không tồn tại', null, 'NOT_FOUND', 404);
            }
            // Check if student is enrolled in the class
            $enrollment = Enrollment::where('student_id', $paymentData['student_id'])
                ->where('class_id', $paymentData['class_id'])
                ->where('status', 'active')
                ->exists();
            if (! $enrollment) {
                return $this->errorResponse('Học viên chưa đăng ký vào lớp học này', null, 'VALIDATION_ERROR', 422);
            }

            if ($student->isPausedInClass($paymentData['class_id'])) {
                return $this->errorResponse(
                    'Học viên đang tạm dừng trong lớp này, không thể ghi nhận thanh toán',
                    null,
                    'STUDENT_PAUSED',
                    422
                );
            }
        }

        // Auto-find payment_request_id if not provided and class_id is available
        if (empty($paymentData['payment_request_id']) && ! empty($paymentData['class_id'])) {
            $paymentRequest = $this->findMatchingPaymentRequest(
                $paymentData['class_id'],
                $paymentData['month'] ?? null,
                $paymentData['due_date'] ?? null,
                $paymentData['amount'] ?? null
            );

            if ($paymentRequest) {
                $paymentData['payment_request_id'] = $paymentRequest->id;
            }
        }

        // Validate payment_request_id if provided
        if (! empty($paymentData['payment_request_id'])) {
            $paymentRequest = PaymentRequest::find($paymentData['payment_request_id']);
            if (! $paymentRequest) {
                return $this->errorResponse('Yêu cầu đóng học phí không tồn tại', null, 'NOT_FOUND', 404);
            }
            // Validate payment_request belongs to the same class
            if (! empty($paymentData['class_id']) && $paymentRequest->class_id != $paymentData['class_id']) {
                return $this->errorResponse('Yêu cầu đóng học phí không thuộc lớp học này', null, 'VALIDATION_ERROR', 422);
            }
        }

        // customer_id removed - no longer needed
        $paymentData['status'] = $paymentData['status'] ?? 'pending';

        $payment = Payment::create($paymentData);

        Log::channel('payments')->info('Payment created', [
            'payment_id' => $payment->id,
            'student_id' => $payment->student_id,
            'class_id' => $payment->class_id,
            'amount' => $payment->amount,
            'status' => $payment->status,
            'payment_request_id' => $payment->payment_request_id,
        ]);

        CacheHelper::forgetPayments($payment->student_id);

        return $this->successResponse(
            new PaymentResource($payment->load(['class', 'student', 'paymentRequest'])),
            'Ghi nhận thanh toán thành công',
            201
        );
    }

    public function update(Request $request, Payment $payment): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        if ($planError = $this->requirePlanCapability('payments.manage')) {
            return $planError;
        }

        if ($mutationError = $this->checkMutationAllowed($user)) {
            return $mutationError;
        }

        $accessError = $this->checkAccess($payment, $user);
        if ($accessError) {
            return $accessError;
        }

        $validator = Validator::make($request->all(), $this->getValidationRules(true));

        if ($validator->fails()) {
            return $this->errorResponse('Dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        // Decode HashIDs
        $idsToDecode = $request->only(['class_id', 'student_id', 'payment_request_id']);
        $this->decodeHashId($idsToDecode, 'class_id', ClassRoom::class);
        $this->decodeHashId($idsToDecode, 'student_id', Student::class);
        $this->decodeHashId($idsToDecode, 'payment_request_id', PaymentRequest::class);
        $request->merge($idsToDecode);

        $updateData = $request->only([
            'amount', 'payment_date', 'payment_method', 'transaction_id',
            'month', 'due_date', 'note', 'status', 'payment_request_id',
        ]);

        // Validate student belongs to class if updating student_id or class_id
        if ($request->has('student_id') || $request->has('class_id')) {
            $studentId = $request->get('student_id', $payment->student_id);
            $classId = $request->get('class_id', $payment->class_id);

            if ($studentId && $classId) {
                $enrollment = Enrollment::where('student_id', $studentId)
                    ->where('class_id', $classId)
                    ->where('status', 'active')
                    ->exists();
                if (! $enrollment) {
                    return $this->errorResponse('Học viên chưa đăng ký vào lớp học này', null, 'VALIDATION_ERROR', 422);
                }
            }
        }

        // Auto-find payment_request_id if:
        // 1. Payment doesn't have payment_request_id yet, OR
        // 2. User explicitly sets payment_request_id to null, OR
        // 3. User changes class_id/month/due_date/amount and payment doesn't have payment_request_id
        $classId = $request->get('class_id', $payment->class_id);
        $currentPaymentRequestId = $payment->payment_request_id;
        $requestedPaymentRequestId = $request->get('payment_request_id');

        // Only auto-find if payment doesn't have payment_request_id or user wants to update it
        $shouldAutoFind = empty($currentPaymentRequestId) ||
                         ($request->has('payment_request_id') && empty($requestedPaymentRequestId)) ||
                         ($request->has('class_id') || $request->has('month') || $request->has('due_date') || $request->has('amount'));

        if ($shouldAutoFind && empty($updateData['payment_request_id']) && ! empty($classId)) {
            $month = $request->get('month', $payment->month);
            $dueDate = $request->get('due_date', $payment->due_date);
            $amount = $request->get('amount', $payment->amount);

            $paymentRequest = $this->findMatchingPaymentRequest(
                $classId,
                $month,
                $dueDate,
                $amount
            );

            if ($paymentRequest) {
                $updateData['payment_request_id'] = $paymentRequest->id;
            }
        }

        // If user doesn't provide payment_request_id and payment already has one, keep it
        if (! $request->has('payment_request_id') && ! empty($currentPaymentRequestId) && ! isset($updateData['payment_request_id'])) {
            // Keep existing payment_request_id
            $updateData['payment_request_id'] = $currentPaymentRequestId;
        }

        // Validate payment_request_id if provided
        if (! empty($updateData['payment_request_id'])) {
            $paymentRequest = PaymentRequest::find($updateData['payment_request_id']);
            if (! $paymentRequest) {
                return $this->errorResponse('Yêu cầu đóng học phí không tồn tại', null, 'NOT_FOUND', 404);
            }
            // Validate payment_request belongs to the same class
            if ($paymentRequest->class_id != $classId) {
                return $this->errorResponse('Yêu cầu đóng học phí không thuộc lớp học này', null, 'VALIDATION_ERROR', 422);
            }
        }

        $payment->update($updateData);

        Log::channel('payments')->info('Payment updated', [
            'payment_id' => $payment->id,
            'student_id' => $payment->student_id,
            'class_id' => $payment->class_id,
            'changes' => $updateData,
        ]);

        CacheHelper::forgetPayments($payment->student_id);

        return $this->successResponse(
            new PaymentResource($payment->fresh()),
            'Cập nhật thanh toán thành công'
        );
    }

    public function destroy(Payment $payment): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        if ($planError = $this->requirePlanCapability('payments.manage')) {
            return $planError;
        }

        if ($mutationError = $this->checkMutationAllowed($user)) {
            return $mutationError;
        }

        $accessError = $this->checkAccess($payment, $user);
        if ($accessError) {
            return $accessError;
        }

        $studentId = $payment->student_id;
        $paymentId = $payment->id;
        $payment->delete();

        Log::channel('payments')->info('Payment deleted', [
            'payment_id' => $paymentId,
            'student_id' => $studentId,
        ]);

        CacheHelper::forgetPayments($studentId);

        return $this->successResponse(null, 'Xóa thanh toán thành công');
    }

    public function byStudent(Request $request, Student $student): JsonResponse
    {
        $studentId = $student->id;

        $user = $this->getAuthUser();
        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Fail closed: only the owning tutor, the student themselves, or a super admin may read this.
        if ($denied = $this->guardStudentAccess($student)) {
            return $denied;
        }

        $query = Payment::where('student_id', $studentId);

        // Org owner/manager see every payment of the student within their org (design §4.3);
        // a plain tutor additionally sees only payments within their own classes (shared-student safety).
        if ($user->isOrgViewerAll()) {
            $orgId = $user->currentOrganization()?->id;
            $query->whereHas('class', function ($q) use ($orgId) {
                $q->where('organization_id', $orgId);
            });
        } elseif ($user->isTutor()) {
            $query->whereHas('class', function ($q) use ($user) {
                $q->where('tutor_id', $user->id);
            });
        }

        $filters = [
            'status' => $request->get('status'),
            'payment_method' => $request->get('payment_method'),
            'date_from' => $request->get('date_from'),
            'date_to' => $request->get('date_to'),
            'class_id' => $request->get('class_id'),
            'search' => $request->get('search'),
            'sort' => $request->get('sort', 'created_at'),
            'order' => $request->get('order', 'desc'),
            'per_page' => $request->get('per_page', 15),
            'page' => $request->get('page', 1),
        ];

        $cacheKey = CacheKeys::studentPayments($studentId, $user->id, $filters);
        $result = Cache::remember($cacheKey, CacheTtl::LIST, function () use ($student, $query, $filters) {
            return $this->buildStudentPaymentsResponse($student, $query, $filters);
        });

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('payments.manage');

        // Thêm permissions vào result
        $result['permissions'] = $permissions;

        return $this->successResponse($result);
    }

    /**
     * Build response for student payments endpoint with pagination and search.
     */
    private function buildStudentPaymentsResponse($student, $query, array $filters): array
    {
        // Apply filters
        if ($filters['status']) {
            $query->where('status', $filters['status']);
        }

        if ($filters['payment_method']) {
            $query->where('payment_method', $filters['payment_method']);
        }

        if ($filters['class_id']) {
            $query->where('class_id', $filters['class_id']);
        }

        if ($filters['date_from']) {
            $query->whereDate('payment_date', '>=', $filters['date_from']);
        }

        if ($filters['date_to']) {
            $query->whereDate('payment_date', '<=', $filters['date_to']);
        }

        // Search functionality
        if ($filters['search']) {
            $searchTerm = $filters['search'];
            $query->where(function ($q) use ($searchTerm) {
                $q->where('invoice_number', 'like', "%{$searchTerm}%")
                    ->orWhere('transaction_id', 'like', "%{$searchTerm}%")
                    ->orWhere('note', 'like', "%{$searchTerm}%")
                    ->orWhere('month', 'like', "%{$searchTerm}%")
                    ->orWhereHas('class', function ($q) use ($searchTerm) {
                        $q->where('name', 'like', "%{$searchTerm}%");
                    });
            });
        }

        $sortable = ['created_at', 'updated_at', 'payment_date', 'due_date', 'amount', 'status', 'month'];
        $sortBy = $filters['sort'] ?? 'created_at';
        if (! in_array($sortBy, $sortable, true)) {
            $sortBy = 'created_at';
        }
        $sortOrder = strtolower($filters['order'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

        // Pagination
        $perPage = (int) min($filters['per_page'] ?? 15, 100);
        $page = (int) ($filters['page'] ?? 1);

        $payments = $query->with(['class.organization.bankAccounts', 'class', 'student', 'paymentRequest'])
            ->orderBy($sortBy, $sortOrder)
            ->paginate($perPage, ['*'], 'page', $page);

        // Calculate statistics from all payments (not just current page)
        $allPaymentsQuery = clone $query;
        $allPayments = $allPaymentsQuery->get();

        $totalAmount = $allPayments->sum('amount');

        return [
            'student' => new StudentResource($student),
            'payments' => PaymentResource::collection($payments->items()),
            'statistics' => [
                'total_count' => $allPayments->count(),
                'total_amount' => $totalAmount,
                'total_amount_formatted' => $this->formatDecimal($totalAmount),
                'status_counts' => $allPayments->groupBy('status')->map->count(),
                'method_counts' => $allPayments->groupBy('payment_method')->map->count(),
            ],
            'meta' => [
                'current_page' => $payments->currentPage(),
                'per_page' => $payments->perPage(),
                'total' => $payments->total(),
                'last_page' => $payments->lastPage(),
            ],
        ];
    }

    /**
     * Get payment statistics
     *
     * Query Parameters (Optional):
     * - date_from: YYYY-MM-DD format, filter from this date (priority)
     * - date_to: YYYY-MM-DD format, filter to this date (priority)
     * - period: integer, number of days from now (fallback if no date_from/date_to, default: 30)
     * - payment_method: Filter by payment method ('cash', 'bank', 'other')
     */
    public function statistics(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        // Validate input
        $validator = Validator::make($request->all(), [
            'date_from' => 'nullable|date_format:Y-m-d',
            'date_to' => 'nullable|date_format:Y-m-d',
            'period' => 'nullable|integer|min:1|max:365',
            'payment_method' => 'nullable|string|in:cash,bank,other',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Định dạng dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Dùng CHUNG applyDataIsolation() với index(), không tự viết lại phạm vi.
        //
        // Trước đây chỗ này khoá cứng `class.tutor_id = user->id`, hẹp hơn hẳn index():
        //  - Chủ trung tâm / quản lý học vụ: danh sách trả 380 khoản (toàn tổ chức) nhưng thẻ thống kê
        //    chỉ tính 2 lớp họ trực tiếp dạy → cùng một màn hình hiện 25tr trong khi Dashboard hiện 193tr.
        //  - Kế toán (role=tutor, không dạy lớp nào): thống kê ra 0.
        //  - Super admin: isTutor() = false → 403 dù có toàn quyền.
        $query = Payment::query();
        $query = $this->applyDataIsolation($query, 'payments');

        // Date filtering: Priority to date_from/date_to, fallback to period.
        //
        // Lọc theo COALESCE(payment_date, due_date), KHÔNG chỉ payment_date: khoản chưa thu
        // (pending/failed) có payment_date = NULL nên lọc thẳng cột đó sẽ loại chúng ra hoàn toàn.
        // Hậu quả: thẻ "Đang chờ" luôn hiện 0 dù đang có công nợ, và by_status chỉ có mỗi 'paid'.
        // Với khoản chưa thu thì mốc thời gian có nghĩa là HẠN NỘP.
        $dateCol = 'COALESCE(payment_date, due_date)';
        $periodLabel = '30 days'; // Default

        if ($request->has('date_from') || $request->has('date_to')) {
            if ($request->has('date_from')) {
                $query->whereRaw("date({$dateCol}) >= ?", [$request->date_from]);
            }

            if ($request->has('date_to')) {
                $query->whereRaw("date({$dateCol}) <= ?", [$request->date_to]);
            }

            // Build period label
            $dateFrom = $request->date_from ?? 'N/A';
            $dateTo = $request->date_to ?? 'N/A';
            $periodLabel = "{$dateFrom} to {$dateTo}";
        } else {
            $period = $request->has('period') ? (int) $request->get('period', 30) : 30;
            $query->whereRaw("{$dateCol} >= ?", [now()->subDays($period)->toDateTimeString()]);
            $periodLabel = "{$period} days";
        }

        // Payment method filter
        if ($request->has('payment_method') && ! empty($request->payment_method)) {
            $query->where('payment_method', $request->payment_method);
        }

        // Calculate statistics
        $totalPayments = $query->count();
        $totalAmount = $query->sum('amount');
        $averageAmount = $totalPayments > 0 ? $totalAmount / $totalPayments : 0;

        // Group by payment method
        $byMethod = $query->clone()
            ->selectRaw('payment_method, COUNT(*) as count, SUM(amount) as total')
            ->groupBy('payment_method')
            ->get()
            ->map(function ($item) use ($totalAmount) {
                $itemTotal = (float) $item->total;

                return [
                    'payment_method' => $item->payment_method,
                    'count' => (int) $item->count,
                    'total' => $itemTotal,
                    'total_formatted' => $this->formatDecimal($itemTotal),
                    'percentage' => $totalAmount > 0 ? ($itemTotal / $totalAmount) * 100 : 0,
                    'percentage_formatted' => $this->formatPercentage($totalAmount > 0 ? ($itemTotal / $totalAmount) * 100 : 0),
                ];
            });

        // Group by status
        $byStatus = $query->clone()
            ->selectRaw('status, COUNT(*) as count, SUM(amount) as total')
            ->groupBy('status')
            ->get()
            ->map(function ($item) {
                $itemTotal = (float) $item->total;

                return [
                    'status' => $item->status,
                    'count' => (int) $item->count,
                    'total' => $itemTotal,
                    'total_formatted' => $this->formatDecimal($itemTotal),
                ];
            });

        return $this->successResponse([
            'period' => $periodLabel,
            'total_payments' => $totalPayments,
            'total_amount' => (float) $totalAmount,
            'total_amount_formatted' => $this->formatDecimal($totalAmount),
            'average_amount' => $averageAmount,
            'average_amount_formatted' => $this->formatDecimal($averageAmount),
            'by_method' => $byMethod,
            'by_status' => $byStatus,
        ]);
    }

    /**
     * Decode payment token and return payment information.
     * Requires authentication và kiểm tra ownership.
     *
     * @param  string  $token  Payment token
     */
    public function decodeToken(string $token): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        $paymentInfo = PaymentTokenService::decodeToken($token);

        if (! $paymentInfo) {
            return $this->errorResponse('Token không hợp lệ hoặc đã hết hạn', null, 'INVALID_TOKEN', 404);
        }

        $type = $paymentInfo['type'];
        $id = $paymentInfo['id'];

        // Only support class payment (tuition fee) now
        if ($type !== 'payment') {
            return $this->errorResponse('Loại thanh toán không hợp lệ', null, 'INVALID_TYPE', 400);
        }

        // Get payment info - scope by ownership, failing closed for non-tutor/non-student roles.
        $query = Payment::where('id', $id)->with(['class.organization.bankAccounts', 'class', 'student']);
        if ($user->isTutor()) {
            $query->whereHas('class', fn ($q) => $q->where('tutor_id', $user->id));
        } elseif ($user->isStudent()) {
            $ownStudent = $this->getCurrentStudent();
            $classIds = $ownStudent ? $this->getStudentClassIds($ownStudent) : [];
            $query->whereIn('class_id', $classIds ?: [0]);
        } elseif ($user->isParent()) {
            // A parent may decode ONLY a payment token for a student they actively guard (design §5:
            // token decode scoped to actual student/linked parent — never a stranger's payment).
            $studentIds = $user->guardedStudentIds();
            $query->whereIn('student_id', $studentIds ?: [0]);
        } elseif (! $user->isSuperAdmin()) {
            return $this->errorResponse('Không tìm thấy thanh toán hoặc không có quyền truy cập', null, 'NOT_FOUND', 404);
        }
        $payment = $query->first();

        if (! $payment) {
            return $this->errorResponse('Không tìm thấy thanh toán hoặc không có quyền truy cập', null, 'NOT_FOUND', 404);
        }

        // Use Resource to get centralized bank transfer info (handles tutor-specific info)
        $resource = new PaymentResource($payment);
        $bankTransferInfo = $resource->additional(['bank_transfer_info' => true])->getBankTransferInfo();

        // If the payment is not pending/bank, bankTransferInfo might be null.
        // But for decodeToken, we usually expect to show this info.

        $paymentReference = $payment->reference_code ?? ReferenceCode::fallbackPayment($payment->id);
        $transferContent = $bankTransferInfo['transfer_content'] ?? $paymentReference;

        return $this->successResponse([
            'payment' => $resource,
            'bank_info' => $bankTransferInfo,
            'payment_reference' => $paymentReference,
            'amount' => (float) $payment->amount,
            'amount_formatted' => CurrencyHelper::formatWithoutSign($payment->amount),
            'instructions' => $bankTransferInfo['instructions'] ?? '',
            'payment_page_url' => PaymentTokenService::getPaymentUrl('payment', $payment->id),
            'payment_token' => PaymentTokenService::generateToken('payment', $payment->id),
            'qr_code_content' => $transferContent,
            'qr_code_url' => $bankTransferInfo['qr_code_url'] ?? null,
        ]);
    }

    /**
     * Get bank transfer information from settings.
     */
    private function getBankTransferInfo(): array
    {
        $settings = Setting::getByGroup('payment'); // Global settings

        // Get QR code URL safely
        $qrCodeUrl = null;
        if (isset($settings['bank_qr_code']) && ! empty($settings['bank_qr_code'])) {
            $qrCodeUrl = Storage::url($settings['bank_qr_code']);
        }

        return [
            'bank_name' => $settings['bank_name'] ?? 'Chưa cấu hình',
            'bank_account_number' => $settings['bank_account_number'] ?? '',
            'bank_account_holder' => $settings['bank_account_holder'] ?? '',
            'bank_branch' => $settings['bank_branch'] ?? null,
            'bank_swift_code' => $settings['bank_swift_code'] ?? null,
            'bank_qr_code' => $qrCodeUrl,
            'bank_transfer_instructions' => $settings['bank_transfer_instructions'] ?? null,
        ];
    }

    /**
     * Find matching payment request for a payment.
     * Tự động tìm payment_request phù hợp dựa trên class_id, month, due_date, amount.
     *
     * @param  string|null  $month  Format: YYYY-MM
     * @param  string|null  $dueDate  Format: YYYY-MM-DD
     */
    private function findMatchingPaymentRequest(?int $classId, ?string $month = null, ?string $dueDate = null, ?float $amount = null): ?PaymentRequest
    {
        if (! $classId) {
            return null;
        }

        $query = PaymentRequest::where('class_id', $classId)
            ->whereIn('status', ['pending', 'active']); // Chỉ tìm các payment_request đang active hoặc pending

        // Match by period_month if provided
        if ($month) {
            $query->where('period_month', $month);
        }

        // Match by due_date if provided
        if ($dueDate) {
            $query->where('due_date', $dueDate);
        }

        // Match by amount_per_student if provided (allow small difference for rounding)
        if ($amount !== null) {
            $query->whereBetween('amount_per_student', [
                $amount - 0.01, // Allow 1 cent difference
                $amount + 0.01,
            ]);
        }

        // Priority: active > pending, then by due_date (closest first)
        return $query->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END")
            ->orderBy('due_date', 'asc')
            ->first();
    }

    /**
     * Approve payment (pending -> paid).
     * Duyệt thanh toán: chuyển từ pending sang paid.
     */
    public function approve(Request $request, Payment $payment): JsonResponse
    {
        // Check capability để đảm bảo user có quyền quản lý thanh toán
        if ($planError = $this->requirePlanCapability('payments.manage')) {
            return $planError;
        }

        // Eager load relations if needed
        $payment->loadMissing(['class', 'student', 'paymentRequest']);

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        if ($mutationError = $this->checkMutationAllowed($user)) {
            return $mutationError;
        }

        $accessError = $this->checkAccess($payment, $user);
        if ($accessError) {
            return $accessError;
        }

        if ($payment->status !== 'pending') {
            return $this->errorResponse('Chỉ có thể duyệt thanh toán đang ở trạng thái chờ thanh toán', null, 'INVALID_STATUS', 400);
        }

        $validator = Validator::make($request->all(), [
            'note' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        $payment->update([
            'status' => 'paid',
            'payment_date' => $payment->payment_date ?? now(),
            'note' => $request->note ?? $payment->note,
        ]);

        // Send notification to student's user (if exists and preferences allow)
        try {
            $student = $payment->student;
            if ($student && $student->user) {
                if (UserNotificationPreference::shouldSendNotification($student->user->id, 'payment_success', 'email')) {
                    // Queue notification để không block response
                    $student->user->notify((new StudentPaymentSuccessNotification($payment->fresh()))->delay(now()->addSeconds(2)));
                }
            }
        } catch (\Exception $e) {
            Log::channel('notifications')->warning('Failed to send payment success notification', [
                'payment_id' => $payment->id,
                'error' => $e->getMessage(),
            ]);
        }

        Log::channel('payments')->info('Payment approved', [
            'payment_id' => $payment->id,
            'student_id' => $payment->student_id,
            'class_id' => $payment->class_id,
            'status' => $payment->status,
        ]);

        CacheHelper::forgetPayments($payment->student_id);

        return $this->successResponse(
            new PaymentResource($payment->fresh()),
            'Đã duyệt thanh toán thành công'
        );
    }

    /**
     * Reject payment (pending -> failed).
     * Từ chối thanh toán: chuyển từ pending sang failed.
     */
    public function reject(Request $request, Payment $payment): JsonResponse
    {
        // Check capability để đảm bảo user có quyền quản lý thanh toán
        if ($planError = $this->requirePlanCapability('payments.manage')) {
            return $planError;
        }

        // Eager load relations if needed
        $payment->loadMissing(['class', 'student', 'paymentRequest']);

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        if ($mutationError = $this->checkMutationAllowed($user)) {
            return $mutationError;
        }

        $accessError = $this->checkAccess($payment, $user);
        if ($accessError) {
            return $accessError;
        }

        if ($payment->status !== 'pending') {
            return $this->errorResponse('Chỉ có thể từ chối thanh toán đang ở trạng thái chờ thanh toán', null, 'INVALID_STATUS', 400);
        }

        $validator = Validator::make($request->all(), [
            'reason' => 'required|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        $note = $payment->note ? "{$payment->note}\n\nLý do từ chối: {$request->reason}" : "Lý do từ chối: {$request->reason}";

        $payment->update([
            'status' => 'failed',
            'note' => $note,
        ]);

        // Send notification to student's user (if exists and preferences allow)
        try {
            $student = $payment->student;
            if ($student && $student->user) {
                if (UserNotificationPreference::shouldSendNotification($student->user->id, 'payment_failed', 'email')) {
                    // Queue notification để không block response
                    $student->user->notify((new StudentPaymentFailedNotification($payment->fresh(), $request->reason))->delay(now()->addSeconds(2)));
                }
            }
        } catch (\Exception $e) {
            Log::channel('notifications')->warning('Failed to send payment failed notification', [
                'payment_id' => $payment->id,
                'error' => $e->getMessage(),
            ]);
        }

        Log::channel('payments')->info('Payment rejected', [
            'payment_id' => $payment->id,
            'student_id' => $payment->student_id,
            'class_id' => $payment->class_id,
            'status' => $payment->status,
            'reason' => $request->reason,
        ]);

        CacheHelper::forgetPayments($payment->student_id);

        return $this->successResponse(
            new PaymentResource($payment->fresh()),
            'Đã từ chối thanh toán'
        );
    }

    /**
     * Refund payment (paid -> refunded).
     * Hoàn tiền: chuyển từ paid sang refunded.
     *
     * LƯU Ý QUAN TRỌNG:
     * - Học viên KHÔNG có ví trong hệ thống
     * - "Hoàn tiền" ở đây chỉ là đánh dấu trạng thái trong hệ thống
     * - Việc trả tiền thực tế cho học viên diễn ra BÊN NGOÀI hệ thống (chuyển khoản, tiền mặt, etc.)
     * - Status "refunded" chỉ ghi nhận rằng giáo viên đã trả lại tiền cho học viên
     * - KHÔNG có logic chuyển tiền vào ví của học viên (vì học viên không có ví)
     */
    public function refund(Request $request, Payment $payment): JsonResponse
    {
        // Check capability để đảm bảo user có quyền quản lý thanh toán
        if ($planError = $this->requirePlanCapability('payments.manage')) {
            return $planError;
        }

        // Eager load relations if needed
        $payment->loadMissing(['class', 'student', 'paymentRequest']);

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        if ($mutationError = $this->checkMutationAllowed($user)) {
            return $mutationError;
        }

        $accessError = $this->checkAccess($payment, $user);
        if ($accessError) {
            return $accessError;
        }

        // REFUND is an owner/manager-only money action (design §5 QĐ: refunds owner/manager). A class
        // tutor may approve/reject their class's payments, but returning money requires center authority.
        if (! $user->isSuperAdmin() && ! $user->isOrgViewerAll()) {
            return $this->errorResponse('Chỉ chủ trung tâm hoặc quản lý mới được hoàn tiền', null, 'REFUND_FORBIDDEN', 403);
        }

        if ($payment->status !== 'paid') {
            return $this->errorResponse('Chỉ có thể hoàn tiền cho thanh toán đã được thanh toán', null, 'INVALID_STATUS', 400);
        }

        $validator = Validator::make($request->all(), [
            'reason' => 'required|string|max:1000',
            // Whole VND only — a fractional refund would silently round against the cash report.
            'refund_amount' => 'nullable|integer|min:1|max:'.$payment->amount,
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        // Lưu số tiền hoàn (để tham khảo)
        $refundAmount = (int) ($request->refund_amount ?? $payment->amount);
        $note = $payment->note ? "{$payment->note}\n\nLý do hoàn tiền: {$request->reason}\nSố tiền hoàn: ".CurrencyHelper::formatWithoutSign($refundAmount) : "Lý do hoàn tiền: {$request->reason}\nSố tiền hoàn: ".CurrencyHelper::formatWithoutSign($refundAmount);

        // Chỉ đánh dấu trạng thái, không có logic chuyển tiền vào ví (học viên không có ví).
        // Structured refund fields: refunded_amount + refunded_at so finance can sum real money back.
        $payment->update([
            'status' => 'refunded',
            'refunded_amount' => $refundAmount,
            'refunded_at' => now(),
            'note' => $note,
        ]);

        Log::channel('payments')->info('Payment refunded', [
            'payment_id' => $payment->id,
            'student_id' => $payment->student_id,
            'class_id' => $payment->class_id,
            'status' => $payment->status,
            'refund_amount' => $refundAmount,
        ]);

        CacheHelper::forgetPayments($payment->student_id);

        return $this->successResponse(
            new PaymentResource($payment->fresh()),
            'Đã ghi nhận hoàn tiền thành công'
        );
    }

    /**
     * Mark payment as failed (paid -> failed).
     * Đánh dấu thanh toán thất bại: chuyển từ paid sang failed.
     */
    public function markFailed(Request $request, Payment $payment): JsonResponse
    {
        // Check capability để đảm bảo user có quyền quản lý thanh toán
        if ($planError = $this->requirePlanCapability('payments.manage')) {
            return $planError;
        }

        // Eager load relations if needed
        $payment->loadMissing(['class', 'student', 'paymentRequest']);

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        if ($mutationError = $this->checkMutationAllowed($user)) {
            return $mutationError;
        }

        $accessError = $this->checkAccess($payment, $user);
        if ($accessError) {
            return $accessError;
        }

        if ($payment->status !== 'paid') {
            return $this->errorResponse('Chỉ có thể đánh dấu thất bại cho thanh toán đã được thanh toán', null, 'INVALID_STATUS', 400);
        }

        $validator = Validator::make($request->all(), [
            'reason' => 'required|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        $note = $payment->note ? "{$payment->note}\n\nLý do thất bại: {$request->reason}" : "Lý do thất bại: {$request->reason}";

        $payment->update([
            'status' => 'failed',
            'note' => $note,
        ]);

        // Send notification to student's user (if exists and preferences allow)
        try {
            $student = $payment->student;
            if ($student && $student->user) {
                if (UserNotificationPreference::shouldSendNotification($student->user->id, 'payment_failed', 'email')) {
                    // Queue notification để không block response
                    $student->user->notify((new StudentPaymentFailedNotification($payment->fresh(), $request->reason))->delay(now()->addSeconds(2)));
                }
            }
        } catch (\Exception $e) {
            Log::channel('notifications')->warning('Failed to send payment failed notification', [
                'payment_id' => $payment->id,
                'error' => $e->getMessage(),
            ]);
        }

        Log::channel('payments')->info('Payment marked failed', [
            'payment_id' => $payment->id,
            'student_id' => $payment->student_id,
            'class_id' => $payment->class_id,
            'status' => $payment->status,
            'reason' => $request->reason,
        ]);

        CacheHelper::forgetPayments($payment->student_id);

        return $this->successResponse(
            new PaymentResource($payment->fresh()),
            'Đã đánh dấu thanh toán thất bại'
        );
    }

    /**
     * Import payments from CSV/XLSX file.
     *
     * POST /api/v1/payments/import
     *
     * Body:
     * - file: CSV/XLSX file (required)
     * - override_existing: boolean (optional, default: false)
     */
    public function import(ImportPaymentsRequest $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Student cannot import
        if ($user->isStudent()) {
            return $this->errorResponse('Không có quyền import thanh toán', null, 'UNAUTHORIZED', 403);
        }

        // Accountant is finance-READ only — importing payments is a money mutation, not a read.
        if ($mutationError = $this->checkMutationAllowed($user)) {
            return $mutationError;
        }

        // Check capability for data import
        if ($capabilityError = $this->requirePlanCapability('data.import')) {
            return $capabilityError;
        }

        // Also check payments.manage to ensure user can manage payments
        if ($capabilityError = $this->requirePlanCapability('payments.manage')) {
            return $capabilityError;
        }

        $file = $request->file('file');
        $overrideExisting = $request->boolean('override_existing', false);

        $job = DataJobService::start('import', 'payments', $user, [
            'file_name' => $file?->getClientOriginalName(),
            'format' => $file?->getClientOriginalExtension(),
            'meta' => [
                'path' => $request->path(),
                'override_existing' => $overrideExisting,
            ],
        ]);

        // Read file
        $fileData = ImportService::readFile($file);

        if (! empty($fileData['errors'])) {
            DataJobService::finishFailed($job, 'FILE_READ_ERROR', ['file_errors' => $fileData['errors']]);

            return $this->errorResponse(
                'Lỗi khi đọc file',
                ['file_errors' => $fileData['errors']],
                'FILE_READ_ERROR',
                422
            );
        }

        if (empty($fileData['rows'])) {
            DataJobService::finishFailed($job, 'EMPTY_FILE');

            return $this->errorResponse('File không có dữ liệu', null, 'EMPTY_FILE', 422);
        }

        // Import payments
        $result = ImportPaymentAction::execute(
            $fileData['rows'],
            $user->id,
            $overrideExisting
        );

        // Build response
        $response = [
            'success' => true,
            'message' => 'Import hoàn tất',
            'data' => [
                'total_rows' => count($fileData['rows']),
                'success' => $result['success'],
                'failed' => $result['failed'],
                'skipped' => $result['skipped'],
                'errors' => $result['errors'],
            ],
        ];

        $metrics = [
            'total_rows' => count($fileData['rows']),
            'success_count' => $result['success'],
            'failed_count' => $result['failed'],
            'skipped_count' => $result['skipped'],
        ];

        if ($result['failed'] > 0 || $result['skipped'] > 0) {
            DataJobService::finishPartial($job, $metrics, ['errors' => $result['errors']]);

            return response()->json($response, 207); // 207 Multi-Status
        }

        DataJobService::finishSuccess($job, $metrics);

        return $this->successResponse($response['data'], 'Import thành công');
    }
}
