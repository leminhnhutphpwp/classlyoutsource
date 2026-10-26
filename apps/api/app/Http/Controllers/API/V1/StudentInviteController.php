<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Resources\StudentInviteResource;
use App\Models\Student;
use App\Models\StudentInvite;
use App\Notifications\StudentInviteNotification;
use App\Rules\ExistsHashId;
use App\Services\InviteRateLimiter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class StudentInviteController extends BaseController
{
    public function index(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $query = StudentInvite::where('user_id', $user->id)
            ->orderByDesc('created_at');

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $perPage = min($request->get('per_page', 15), 100);
        $invites = $query->paginate($perPage);

        return $this->successResponse([
            'invites' => StudentInviteResource::collection($invites),
            'meta' => [
                'current_page' => $invites->currentPage(),
                'per_page' => $invites->perPage(),
                'total' => $invites->total(),
                'last_page' => $invites->lastPage(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $validator = Validator::make($request->all(), [
            'email' => 'required|email|max:255',
            'name' => 'nullable|string|max:255',
            'role' => 'required|in:student,parent',
            // A parent invite MUST reference the child it will be able to see.
            'student_id' => ['required_if:role,parent', new ExistsHashId(Student::class)],
        ]);

        if ($validator->fails()) {
            return $this->errorResponse(
                'Lỗi xác thực dữ liệu',
                $validator,
                'VALIDATION_ERROR',
                422
            );
        }

        // Inviting a guardian (parent) grants permanent read access to their child's data,
        // so this stays behind the standard role guard for the inviting tutor.
        if ($request->input('role') === 'parent') {
            if ($denied = $this->requirePlanCapability('guardians.manage')) {
                return $denied;
            }
        }

        // The invited student (if any) must belong to the inviting tutor — never let a tutor grant a
        // parent access to another tutor's student.
        $studentId = null;
        if ($request->filled('student_id')) {
            // findByHashId decodes the public hashid → model (was $this->decodeHashId(), a method this
            // controller doesn't have — it 500'd every parent invite; the demo linked guardians via the
            // seeder so it went unnoticed). guardStudentAccess fail-closes 404 on null/other-tutor.
            $student = Student::findByHashId($request->input('student_id'));
            if ($denied = $this->guardStudentAccess($student)) {
                return $denied;
            }
            $studentId = $student->id;
        }

        if ($limitError = InviteRateLimiter::ensureAllowed($user, $request)) {
            return $this->errorResponse(
                $limitError['message'],
                null,
                $limitError['code'],
                $limitError['status']
            );
        }

        $token = Str::uuid()->toString();
        $invite = StudentInvite::create([
            'user_id' => $user->id,
            'email' => $request->email,
            'name' => $request->name,
            'role' => $request->role,
            'token' => hash('sha256', $token),
            'status' => 'sent',
            'sent_at' => now(),
            'expires_at' => now()->addDays(7),
            'ip_address' => $request->ip(),
            'meta' => $studentId ? ['student_id' => $studentId] : null,
        ]);

        // Deliver the invite (email now; +Zalo/SMS via the channels in Phase 5). Pass the RAW token.
        Notification::route('mail', $invite->email)
            ->notify((new StudentInviteNotification($token, $invite, $user->name))->delay(now()->addSeconds(2)));

        return $this->successResponse(
            [
                'invite' => new StudentInviteResource($invite),
                'invite_token' => $token,
            ],
            'Đã gửi lời mời thành công',
            201
        );
    }

    public function destroy($id): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $invite = StudentInvite::where('user_id', $user->id)->whereHashId($id)->first();

        if (! $invite) {
            return $this->errorResponse('Không tìm thấy lời mời', null, 'NOT_FOUND', 404);
        }

        if ($invite->status === 'accepted') {
            return $this->errorResponse('Không thể thu hồi lời mời đã được chấp nhận', null, 'INVITE_ALREADY_ACCEPTED', 422);
        }

        $invite->update([
            'status' => 'revoked',
            'revoked_at' => now(),
        ]);

        return $this->successResponse(
            new StudentInviteResource($invite),
            'Đã thu hồi lời mời'
        );
    }
}
