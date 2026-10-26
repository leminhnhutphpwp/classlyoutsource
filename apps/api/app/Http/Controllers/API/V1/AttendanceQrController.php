<?php

namespace App\Http\Controllers\API\V1;

use App\Models\Attendance;
use App\Models\ScheduleSession;
use App\Services\AttendanceQrService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * QR attendance: a tutor opens a session's QR screen (start/token), students self-check-in by scanning the
 * rotating QR (or typing the fallback code), and the tutor watches the roster fill in live. Authorization is
 * fail-closed: tutor endpoints require canManageResource on the session's class; check-in requires the caller
 * to be an enrolled, non-paused student of that class — the token is never trusted for authorization on its own.
 */
class AttendanceQrController extends BaseController
{
    /** Minutes after start_time before a check-in counts as late. */
    private const LATE_GRACE_MINUTES = 15;

    /** POST /schedule-sessions/{scheduleSession}/attendance/start — open the session for QR check-in. */
    public function start(ScheduleSession $scheduleSession): JsonResponse
    {
        if ($denied = $this->guardTutorSession($scheduleSession)) {
            return $denied;
        }

        $scheduleSession->update([
            'status' => $scheduleSession->status === 'completed' ? $scheduleSession->status : 'ongoing',
            'attendance_code' => AttendanceQrService::generateCode(),
        ]);

        return $this->tokenResponse($scheduleSession->fresh());
    }

    /** GET /schedule-sessions/{scheduleSession}/attendance/token — a fresh rotating token (polled ~45s). */
    public function token(ScheduleSession $scheduleSession): JsonResponse
    {
        if ($denied = $this->guardTutorSession($scheduleSession)) {
            return $denied;
        }

        if (! $scheduleSession->attendance_code) {
            $scheduleSession->update(['attendance_code' => AttendanceQrService::generateCode()]);
        }

        return $this->tokenResponse($scheduleSession);
    }

    /** GET /schedule-sessions/{scheduleSession}/attendance/live — roster + who has checked in. */
    public function live(ScheduleSession $scheduleSession): JsonResponse
    {
        if ($denied = $this->guardTutorSession($scheduleSession)) {
            return $denied;
        }

        $date = $scheduleSession->session_date->toDateString();
        $marks = Attendance::where('class_id', $scheduleSession->class_id)
            ->whereDate('date', $date)
            ->get()
            ->keyBy('student_id');

        $students = $scheduleSession->class->students->map(function ($student) use ($marks) {
            $a = $marks->get($student->id);

            return [
                'id' => $student->hash_id,
                'name' => $student->name,
                'status' => $a->status ?? 'absent',
                'checked_in_via' => $a->checked_in_via ?? null,
                'check_in_time' => $a->check_in_time ?? null,
            ];
        })->values();

        return $this->successResponse([
            'session' => ['id' => $scheduleSession->hash_id, 'date' => $date, 'status' => $scheduleSession->status],
            'students' => $students,
            'counts' => [
                'total' => $students->count(),
                'present' => $students->whereIn('status', ['present', 'late'])->count(),
                'late' => $students->where('status', 'late')->count(),
                'absent' => $students->where('status', 'absent')->count(),
            ],
        ]);
    }

    /** POST /attendance/check-in — a student self-marks present via a QR token or the fallback code. */
    public function checkIn(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();
        if (! $user || ! $user->isStudent()) {
            return $this->errorResponse('Chỉ học viên mới có thể tự điểm danh.', null, 'FORBIDDEN', 403);
        }

        $validator = Validator::make($request->all(), [
            'token' => 'nullable|string',
            'code' => 'nullable|string|max:8',
        ]);
        if ($validator->fails()) {
            return $this->errorResponse('Dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        $student = $this->getCurrentStudent();
        if (! $student) {
            return $this->errorResponse('Không tìm thấy hồ sơ học viên.', null, 'NOT_FOUND', 404);
        }

        // Resolve the session from a QR token, or from the fallback code (looked up ONLY among the student's
        // own ongoing sessions — so a typed code can never reach a class they aren't enrolled in).
        $via = 'qr';
        if ($request->filled('token')) {
            $sessionId = AttendanceQrService::validateToken($request->token);
            if (! $sessionId) {
                return $this->errorResponse('Mã QR đã hết hạn. Vui lòng quét lại.', null, 'QR_EXPIRED', 410);
            }
            $session = ScheduleSession::find($sessionId);
        } elseif ($request->filled('code')) {
            $via = 'code';
            $session = ScheduleSession::where('attendance_code', strtoupper($request->code))
                ->where('status', 'ongoing')
                ->whereIn('class_id', $this->getStudentClassIds($student))
                ->first();
            if (! $session) {
                return $this->errorResponse('Mã điểm danh không hợp lệ.', null, 'INVALID_CODE', 422);
            }
        } else {
            return $this->errorResponse('Thiếu mã QR hoặc mã điểm danh.', null, 'VALIDATION_ERROR', 422);
        }

        if (! $session) {
            return $this->errorResponse('Không tìm thấy buổi học.', null, 'NOT_FOUND', 404);
        }

        // Fail-closed: caller must be an enrolled, non-paused student of this session's class.
        if (! $this->isStudentEnrolledInClass($student, $session->class_id)) {
            return $this->errorResponse('Bạn không thuộc lớp học này.', null, 'NOT_FOUND', 404);
        }
        if ($student->isPausedInClass($session->class_id)) {
            return $this->errorResponse('Bạn đang tạm dừng lớp học này.', null, 'STUDENT_PAUSED', 422);
        }

        // Only an open session accepts check-ins. The code path already filters status=ongoing; this closes
        // the token path too, so a QR token minted before the tutor completed/cancelled the session (or a
        // token for a session kept 'completed' by start()) can't back-fill attendance on a closed session.
        if ($session->status !== 'ongoing') {
            return $this->errorResponse('Buổi học chưa mở điểm danh hoặc đã kết thúc.', null, 'SESSION_NOT_OPEN', 422);
        }

        $status = $this->isLate($session) ? 'late' : 'present';
        $date = $session->session_date->toDateString();

        $existing = Attendance::where('class_id', $session->class_id)
            ->where('student_id', $student->id)
            ->whereDate('date', $date)
            ->first();

        if ($existing && in_array($existing->status, ['present', 'late'], true)) {
            // Idempotent: already checked in — a re-scan is a no-op.
            return $this->checkInResponse($session, $existing->status, true);
        }

        Attendance::updateOrCreate(
            ['class_id' => $session->class_id, 'student_id' => $student->id, 'date' => $date],
            [
                'schedule_session_id' => $session->id,
                'status' => $status,
                'check_in_time' => now()->format('H:i:s'),
                'checked_in_via' => $via,
            ],
        );

        return $this->checkInResponse($session, $status, false);
    }

    private function guardTutorSession(ScheduleSession $session): ?JsonResponse
    {
        if (! $session->exists || ! $this->canManageResource($session->class)) {
            return $this->errorResponse('Không tìm thấy buổi học.', null, 'NOT_FOUND', 404);
        }
        if ($planError = $this->requirePlanCapability('attendance.manage')) {
            return $planError;
        }

        return null;
    }

    private function tokenResponse(ScheduleSession $session): JsonResponse
    {
        $issued = AttendanceQrService::issueToken($session);

        return $this->successResponse([
            'token' => $issued['token'],
            'expires_at' => $issued['expires_at'],
            'check_in_url' => $issued['check_in_url'],
            'code' => $session->attendance_code,
            'session' => ['id' => $session->hash_id, 'status' => $session->status],
        ]);
    }

    private function checkInResponse(ScheduleSession $session, string $status, bool $already): JsonResponse
    {
        return $this->successResponse([
            'status' => $status,
            'already_checked_in' => $already,
            'class_name' => $session->class?->name,
            'session_date' => $session->session_date->toDateString(),
        ], $already ? 'Bạn đã điểm danh trước đó.' : 'Điểm danh thành công.');
    }

    private function isLate(ScheduleSession $session): bool
    {
        $start = Carbon::parse($session->session_date->format('Y-m-d').' '.$session->start_time->format('H:i:s'));

        return now()->greaterThan($start->addMinutes(self::LATE_GRACE_MINUTES));
    }
}
