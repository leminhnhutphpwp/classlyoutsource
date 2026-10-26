<?php

namespace App\Http\Controllers\API\V1;

use App\Models\Assignment;
use App\Models\Attendance;
use App\Models\Enrollment;
use App\Models\Grade;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\ScheduleSession;
use App\Models\Student;
use App\Support\ReferenceCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Parent (guardian) portal. Every method resolves the target child via guardStudentAccess (fail-closed):
 * a parent only ever sees a child they are linked to. A linked parent's READ access is NOT gated by the
 * tutor's account — parents can always view their own child's schedule/grades/attendance/tuition regardless
 * of the tutor's role. A parent sees the union of a child's data across all the child's
 * tutors. (Note: the tutor-side guardian invite, StudentInviteController::store, is currently ungated.)
 */
class ParentController extends BaseController
{
    /** GET /parent/children — the guarded children + a quick summary. */
    public function children(): JsonResponse
    {
        $user = $this->getAuthUser();
        if (! $user || ! $user->isParent()) {
            return $this->errorResponse('Không có quyền truy cập', null, 'FORBIDDEN', 403);
        }

        $children = Student::query()
            ->whereIn('id', $this->getGuardianStudentIds())
            ->with('creator:id,name')
            ->get()
            ->map(function (Student $s) {
                $classIds = Enrollment::where('student_id', $s->id)->pluck('class_id');

                return [
                    'id' => $s->hash_id,
                    'name' => $s->name,
                    'avatar' => $s->avatar,
                    'tutor_name' => $s->creator?->name,
                    'class_count' => $classIds->count(),
                    'outstanding_tuition' => (float) Payment::where('student_id', $s->id)->pending()->sum('amount'),
                    'portal_enabled' => true, // parents always have read access to their linked child
                ];
            });

        return $this->successResponse(['children' => $children]);
    }

    public function grades(Request $request, Student $student): JsonResponse
    {
        if ($denied = $this->authorizeChild($student)) {
            return $denied;
        }

        $grades = Grade::where('student_id', $student->id)
            ->with(['class:id,name,subject', 'gradeType:id,name'])
            ->orderByDesc('grade_date')
            ->paginate(min($request->get('per_page', 20), 100));

        return $this->paginated($grades);
    }

    public function attendance(Request $request, Student $student): JsonResponse
    {
        if ($denied = $this->authorizeChild($student)) {
            return $denied;
        }

        $rows = Attendance::where('student_id', $student->id)
            ->with(['class:id,name,subject'])
            ->orderByDesc('date')
            ->paginate(min($request->get('per_page', 20), 100));

        return $this->paginated($rows);
    }

    public function schedule(Request $request, Student $student): JsonResponse
    {
        if ($denied = $this->authorizeChild($student)) {
            return $denied;
        }

        $classIds = Enrollment::where('student_id', $student->id)->pluck('class_id');
        $sessions = ScheduleSession::whereIn('class_id', $classIds)
            ->when($request->filled('from'), fn ($q) => $q->whereDate('session_date', '>=', $request->from))
            ->with(['class:id,name,subject'])
            ->orderBy('session_date')
            ->paginate(min($request->get('per_page', 30), 100));

        return $this->paginated($sessions);
    }

    public function assignments(Request $request, Student $student): JsonResponse
    {
        if ($denied = $this->authorizeChild($student)) {
            return $denied;
        }

        $classIds = Enrollment::where('student_id', $student->id)->pluck('class_id');
        $rows = Assignment::whereIn('class_id', $classIds)
            ->whereIn('status', ['published', 'closed'])
            ->with(['class:id,name,subject'])
            ->orderByDesc('due_date')
            ->paginate(min($request->get('per_page', 20), 100));

        return $this->paginated($rows);
    }

    /** GET /parent/children/{student}/tuition — outstanding + recent payments. */
    public function tuition(Student $student): JsonResponse
    {
        if ($denied = $this->authorizeChild($student)) {
            return $denied;
        }

        $pending = Payment::where('student_id', $student->id)->pending()
            ->with(['class:id,name,subject'])->orderBy('due_date')->get();

        return $this->successResponse([
            'outstanding_total' => (float) $pending->sum('amount'),
            'pending' => $pending->map(fn (Payment $p) => [
                'id' => $p->hash_id,
                'amount' => (float) $p->amount,
                'due_date' => $p->due_date,
                'month' => $p->month,
                'class_name' => $p->class?->name,
                'reference_code' => $p->reference_code,
            ]),
        ]);
    }

    /** POST /parent/payments/{payment}/intent — bank-transfer instruction for a pending tuition payment. */
    public function paymentIntent(Payment $payment): JsonResponse
    {
        $student = Student::find($payment->student_id);
        if ($denied = $this->authorizeChild($student)) {
            return $denied;
        }
        if (! $payment->isPending()) {
            return $this->errorResponse('Khoản này không còn chờ thanh toán.', null, 'NOT_PENDING', 422);
        }

        // Lấy thông tin chuyển khoản từ organization của class — cùng nguồn với PaymentResource
        // (Organization::bankTransferInfoFor), nên học viên và phụ huynh luôn thấy cùng tài khoản.
        $class = $payment->class;
        $bank = null;
        if ($class && $class->organization_id) {
            $organization = Organization::find($class->organization_id);
            if ($organization) {
                $bank = $organization->bankTransferInfoFor(
                    (float) $payment->amount,
                    $payment->reference_code ?? ReferenceCode::fallbackPayment($payment->id),
                );
            }
        }

        return $this->successResponse([
            'amount' => (float) $payment->amount,
            'reference_code' => $payment->reference_code,
            'transfer_content' => $bank['transfer_content'] ?? $payment->reference_code,
            'bank' => $bank,
            'note' => 'Sau khi chuyển khoản, vui lòng chờ trung tâm xác nhận (thường trong vài giờ).',
        ]);
    }

    /**
     * A parent may ALWAYS view their own linked child's read-only data (schedule/grades/attendance/
     * tuition). The only gate is the guardian↔child link (guardStudentAccess, fail-closed 404) — a
     * parent never sees a child they don't guard. A tutor's account status does NOT cut off an already-linked
     * parent's read access.
     */
    private function authorizeChild(?Student $student): ?JsonResponse
    {
        return $this->guardStudentAccess($student);
    }

    private function paginated($paginator): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }
}
