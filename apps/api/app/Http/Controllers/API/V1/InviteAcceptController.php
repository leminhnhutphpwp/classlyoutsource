<?php

namespace App\Http\Controllers\API\V1;

use App\Models\Student;
use App\Models\StudentInvite;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Spatie\Permission\Models\Role;
use Tymon\JWTAuth\Facades\JWTAuth;

/**
 * Public invite acceptance: a student or parent redeems an invite token, sets a password, and is logged
 * straight in. Completes the previously half-built StudentInvite flow (delivery was a // TODO, there was
 * no accept endpoint). Security: tokens are sha256-hashed + expiring; accept transitions sent→accepted
 * under lockForUpdate (replay-safe); a parent can only ever be linked to the invite's meta.student_id
 * (set by the owning tutor).
 */
class InviteAcceptController extends BaseController
{
    /** GET /auth/invite/{token} — show who the invite is for (no auth). */
    public function show(string $token): JsonResponse
    {
        $invite = $this->findValidInvite($token);
        if (! $invite) {
            return $this->errorResponse('Lời mời không hợp lệ hoặc đã hết hạn.', null, 'INVITE_INVALID', 410);
        }

        $tutor = User::find($invite->user_id);

        return $this->successResponse([
            'email' => $invite->email,
            'name' => $invite->name,
            'role' => $invite->role,
            'tutor_name' => $tutor?->name,
        ]);
    }

    /** POST /auth/accept-invite — set password, create/link the account, log in. */
    public function accept(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'token' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
            'name' => 'nullable|string|max:255',
        ]);
        if ($validator->fails()) {
            return $this->errorResponse('Dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        return DB::transaction(function () use ($request) {
            $invite = StudentInvite::where('token', hash('sha256', $request->token))
                ->where('status', 'sent')
                ->where('expires_at', '>', now())
                ->lockForUpdate()
                ->first();

            if (! $invite) {
                return $this->errorResponse('Lời mời không hợp lệ hoặc đã hết hạn.', null, 'INVITE_INVALID', 410);
            }

            $user = $invite->role === 'parent'
                ? $this->acceptParent($invite, $request)
                : $this->acceptStudent($invite, $request);

            if ($user instanceof JsonResponse) {
                return $user; // an error response
            }

            $invite->update(['status' => 'accepted', 'accepted_at' => now()]);

            return $this->issueTokens($user);
        });
    }

    private function findValidInvite(string $token): ?StudentInvite
    {
        return StudentInvite::where('token', hash('sha256', $token))
            ->where('status', 'sent')
            ->where('expires_at', '>', now())
            ->first();
    }

    /** Link (or create) the student's login User to the tutor-created Student record. */
    private function acceptStudent(StudentInvite $invite, Request $request): User|JsonResponse
    {
        $student = Student::query()
            ->where('created_by', $invite->user_id)
            ->when(data_get($invite->meta, 'student_id'), fn ($q, $id) => $q->where('id', $id))
            ->where('email', $invite->email)
            ->first();

        if (! $student) {
            return $this->errorResponse('Không tìm thấy hồ sơ học viên cho lời mời này.', null, 'STUDENT_NOT_FOUND', 404);
        }

        $user = $this->firstOrCreateUser($invite, $request, 'student');
        if ($student->user_id === null) {
            $student->update(['user_id' => $user->id]);
        }

        return $user;
    }

    /** Create the parent User and link them to the invite's student via guardian_student. */
    private function acceptParent(StudentInvite $invite, Request $request): User|JsonResponse
    {
        $studentId = data_get($invite->meta, 'student_id');
        if (! $studentId || ! Student::whereKey($studentId)->where('created_by', $invite->user_id)->exists()) {
            return $this->errorResponse('Lời mời phụ huynh không hợp lệ.', null, 'INVITE_INVALID', 410);
        }

        $user = $this->firstOrCreateUser($invite, $request, 'parent');

        DB::table('guardian_student')->updateOrInsert(
            ['user_id' => $user->id, 'student_id' => $studentId],
            ['status' => 'active', 'is_primary' => true, 'updated_at' => now(), 'created_at' => now()],
        );

        return $user;
    }

    private function firstOrCreateUser(StudentInvite $invite, Request $request, string $role): User
    {
        $user = User::where('email', $invite->email)->first();
        if (! $user) {
            $user = User::create([
                'name' => $request->input('name') ?: ($invite->name ?: $invite->email),
                'email' => $invite->email,
                'password' => Hash::make($request->password),
                'role' => $role,
                'status' => 'active',
                'email_verified_at' => now(),
            ]);
            // Spatie role is secondary (isParent/isStudent read the User.role column); assign only if seeded.
            if (Role::where('name', $role)->where('guard_name', 'web')->exists()) {
                $user->assignRole($role);
            }
        }

        return $user;
    }

    private function issueTokens(User $user): JsonResponse
    {
        // typ-tagged so the refresh token can't be replayed as an access credential (see AuthenticateApi).
        $accessToken = JWTAuth::customClaims(['typ' => 'access'])->fromUser($user);
        $refreshTtl = (int) config('jwt.refresh_ttl', 20160);
        $refreshToken = JWTAuth::customClaims([
            'typ' => 'refresh',
            'exp' => now()->addMinutes($refreshTtl)->timestamp,
        ])->fromUser($user);

        return response()->json([
            'success' => true,
            'message' => 'Kích hoạt tài khoản thành công',
            'data' => [
                'user' => [
                    '_id' => $user->hash_id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'status' => $user->status,
                ],
                'token' => $accessToken,
                'refresh_token' => $refreshToken,
                'token_type' => 'bearer',
                'expires_in' => auth('api')->factory()->getTTL() * 60,
                'refresh_expires_in' => $refreshTtl * 60,
            ],
        ]);
    }
}
