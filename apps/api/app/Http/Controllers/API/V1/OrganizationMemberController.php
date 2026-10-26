<?php

namespace App\Http\Controllers\API\V1;

use App\Enums\OrgRole;
use App\Http\Requests\CreateOrganizationMemberRequest;
use App\Http\Resources\ClassRoomResource;
use App\Http\Resources\OrganizationMemberResource;
use App\Models\ClassRoom;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\PasswordResetCode;
use App\Models\Student;
use App\Models\User;
use App\Notifications\PasswordResetNotification;
use App\Services\SessionGuard;
use App\Support\CacheKeys;
use App\Traits\InteractsWithOrganizationRoutes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;

/**
 * Organization membership lifecycle: the center CREATES its own tutor accounts (center-native staff,
 * status=active), an owner/manager removes a member (E-1 fail-closed), and (re)assigning a class's
 * lead tutor to a member. All org context comes from the caller/route, never from the request body.
 */
class OrganizationMemberController extends BaseController
{
    use InteractsWithOrganizationRoutes;

    /**
     * POST /organizations/{organization}/members — provision a NEW center-native tutor account.
     *
     * The center owns its staff: this creates a brand-new User (role=tutor, random unusable password,
     * email_verified_at=null = pending activation) plus an ACTIVE OrganizationMember, then emails an
     * account-activation / set-password link (reusing the password-reset flow). The new tutor is a
     * member of the center and inherits its permissions through their org role.
     *
     * owner/manager only; a manager may create tutors only (never a manager). The email must be brand
     * new: if it already belongs to ANY user we reject with EMAIL_ALREADY_EXISTS so independent tutors
     * stay fully separate (no linking).
     */
    public function store(CreateOrganizationMemberRequest $request, Organization $organization): JsonResponse
    {
        [$caller, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        if ($denied = $this->guardOrgContext($organization)) {
            return $denied;
        }

        if ($denied = $this->requireOrgRole(['owner', 'manager'])) {
            return $denied;
        }

        $data = $request->validated();
        $role = $data['org_role'] ?? 'tutor';

        // Only the OWNER may create a privileged member (manager OR accountant); a manager can create
        // tutors only (design §3.1/§3.2). Both roles carry org-wide reach (manager = full visibility,
        // accountant = full finance), so their creation stays owner-only.
        if (in_array($role, ['manager', 'accountant'], true) && ! $caller->isOrgOwner()) {
            return $this->errorResponse('Chỉ chủ tổ chức mới có thể tạo tài khoản quản lý hoặc kế toán', null, 'FORBIDDEN', 403);
        }

        // The email must be brand new. A center tutor is a NEW account — never a link to an existing
        // (possibly independent) user. withTrashed() also blocks colliding soft-deleted emails (the
        // unique index still reserves them), which would otherwise 500 on insert.
        if (User::withTrashed()->where('email', $data['email'])->exists()) {
            return $this->errorResponse(
                'Email này đã có tài khoản trên hệ thống. Gia sư của trung tâm phải là tài khoản mới.',
                null,
                'EMAIL_ALREADY_EXISTS',
                422
            );
        }

        $member = DB::transaction(function () use ($data, $role, $caller, $organization) {
            // Random, unknowable password → the account cannot be logged into until the tutor sets one
            // via the activation email. email_verified_at=null marks it "chưa kích hoạt".
            $tutor = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                'role' => 'tutor',
                'status' => 'active',
                'password' => Hash::make(Str::random(40)),
                'email_verified_at' => null,
                // Ops-fix A: record who provisioned this account so remove() may auto-suspend ONLY
                // center-native accounts (never an independent tutor invited in a future flow).
                'provisioned_org_id' => $organization->id,
            ]);
            $tutor->assignRole(Role::findOrCreate('tutor', 'web'));

            return OrganizationMember::create([
                'organization_id' => $organization->id,
                'user_id' => $tutor->id,
                'org_role' => $role,
                'status' => 'active',
                'invited_by' => $caller->id,
                'joined_at' => now(),
            ]);
        });

        // Non-blocking activation / set-password email (queued via the log driver locally).
        $this->sendActivationEmail($member->user);

        return $this->successResponse(
            new OrganizationMemberResource($member->load('user')),
            'Đã tạo tài khoản gia sư cho trung tâm',
            201
        );
    }

    /**
     * Send the set-password / activation email by reusing the password-reset flow: a fresh reset code
     * plus the queued PasswordResetNotification. The tutor uses it to set their first password and log
     * in (resetPassword also verifies their email). Wrapped so a mail failure never breaks creation.
     */
    private function sendActivationEmail(User $tutor): void
    {
        try {
            $resetCode = PasswordResetCode::createForEmail($tutor->email);
            $tutor->notify(
                (new PasswordResetNotification($resetCode->code, $resetCode->getRemainingMinutes()))
                    ->delay(now()->addSeconds(2))
            );
        } catch (\Throwable $e) {
            Log::channel('auth')->warning('Failed to send org tutor activation email', [
                'user_id' => $tutor->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * DELETE /organizations/{organization}/members/{member} — remove a member.
     *
     * E-1 (CRITICAL fail-closed): removing a membership alone would leak the ex-member's old classes
     * because applyTutorIsolation still matches tutor_id = them. So on remove we set status=removed
     * AND reassign that member's org classes to the OWNER (keeping organization_id). The org keeps the
     * classes; the ex-member loses ALL access (their tutor_id no longer matches any org class).
     *
     * Base-core lifecycle: removal ALWAYS suspends the staff account and revokes every session. The user
     * row remains for payroll/audit history and can be re-enabled only through restore(). A detached tutor
     * with no active organization has no valid operational context in this single-center installation.
     */
    public function remove(Organization $organization, OrganizationMember $member): JsonResponse
    {
        [$caller, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        if ($denied = $this->guardOrgContext($organization)) {
            return $denied;
        }

        if ($denied = $this->requireOrgRole(['owner', 'manager'])) {
            return $denied;
        }

        // The member must belong to THIS org (fail-closed 404 otherwise — no cross-org leak).
        if ((int) $member->organization_id !== (int) $organization->id) {
            return $this->errorResponse('Không tìm thấy thành viên', null, 'NOT_FOUND', 404);
        }

        // The owner can never be removed (they own the org).
        if ($member->org_role === 'owner') {
            return $this->errorResponse('Không thể gỡ chủ tổ chức', null, 'CANNOT_REMOVE_OWNER', 422);
        }

        // A manager may remove plain tutors only; removing another manager is owner-only (design §3.1).
        if ($caller->isOrgManager() && $member->org_role !== 'tutor') {
            return $this->errorResponse('Chỉ chủ tổ chức mới có thể gỡ quản lý', null, 'FORBIDDEN', 403);
        }

        // E-1: hand the ex-member's org teaching resources (classes + student PII) back to the owner
        // BEFORE dropping the membership, so their old tutor_id/created_by no longer grants access.
        $this->handBackTeachingResources($organization, (int) $member->user_id);

        $member->update(['status' => 'removed']);

        // Base-core policy: no detached-but-active tutor accounts. Preserve the user row for history,
        // but suspend it and revoke every session until an owner/manager restores the membership.
        $removedUser = $member->user;
        if ($removedUser) {
            $removedUser->forceFill([
                'suspended_at' => now(),
                'suspended_reason' => 'org_removed',
            ])->save();

            // Kill every outstanding session (refresh tokens) — the live access token is rejected on its
            // next request by AuthenticateApi (isLoginBlocked). Forget the SWR /me cache so a warm entry
            // can't serve the now-suspended user for its 5–15 min window.
            SessionGuard::revokeAllForUser($removedUser);
            Cache::forget(CacheKeys::currentUser($removedUser->id));
        }

        return $this->successResponse(
            new OrganizationMemberResource($member->fresh()),
            'Đã gỡ thành viên khỏi tổ chức'
        );
    }

    /**
     * PATCH /organizations/{organization}/members/{member} — change a member's org_role (OWNER-ONLY).
     *
     * The owner is the only role with org-wide authority to reshape the staff hierarchy. The owner's own
     * row can never change (they own the org); a target must belong to THIS org; owner is not
     * an assignable target role (in:manager,accountant,tutor).
     *
     * E-1 (finance least-privilege): when a member LEAVES a teaching role and BECOMES an accountant, run
     * the SAME class/student hand-back as remove() — an accountant must not still OWN teaching resources
     * (their old tutor_id/created_by would otherwise keep leaking classes/students they can no longer
     * legitimately reach, and applyOrgFinanceIsolation fails them closed on teaching anyway). Promoting
     * an accountant back to a teaching role does no hand-back (they start owning nothing).
     */
    public function updateRole(Request $request, Organization $organization, OrganizationMember $member): JsonResponse
    {
        [$caller, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        if ($denied = $this->guardOrgContext($organization)) {
            return $denied;
        }

        // Owner-only (design §3.2) — stricter than remove()/store() (owner|manager).
        if ($denied = $this->requireOrgRole(['owner'])) {
            return $denied;
        }

        // The member must belong to THIS org (fail-closed 404 otherwise — no cross-org leak).
        if ((int) $member->organization_id !== (int) $organization->id) {
            return $this->errorResponse('Không tìm thấy thành viên', null, 'NOT_FOUND', 404);
        }

        // The owner's role is immutable (they own the org).
        if ($member->org_role === 'owner') {
            return $this->errorResponse('Không thể đổi vai trò của chủ tổ chức', null, 'CANNOT_CHANGE_OWNER', 422);
        }

        $validator = Validator::make($request->all(), [
            // owner is never an assignable target role.
            'org_role' => ['required', Rule::in(OrgRole::assignableValues())],
        ]);
        if ($validator->fails()) {
            return $this->errorResponse('Dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        $newRole = $request->input('org_role');
        $oldRole = $member->org_role;

        if ($newRole === $oldRole) {
            return $this->successResponse(
                new OrganizationMemberResource($member->fresh()->load('user')),
                'Vai trò không thay đổi'
            );
        }

        // Leaving a teaching role for accountant → hand teaching resources back to the owner (E-1).
        if ($newRole === 'accountant' && $oldRole !== 'accountant') {
            $this->handBackTeachingResources($organization, (int) $member->user_id);
        }

        $member->update(['org_role' => $newRole]);

        // The member's capability resolution keys off org_role — forget the SWR /me cache so a
        // warm entry can't keep serving the old role for its 5–15 min window.
        if ($member->user) {
            Cache::forget(CacheKeys::currentUser($member->user_id));
        }

        return $this->successResponse(
            new OrganizationMemberResource($member->fresh()->load('user')),
            'Đã cập nhật vai trò thành viên'
        );
    }

    /**
     * E-1 hand-back (shared by remove() and updateRole()): reassign every org class led by $userId and
     * every org student they created back to the owner, so their tutor_id / created_by no longer grants
     * access once they leave the org (removed) or leave a teaching role (→ accountant).
     *
     * Classes use per-model update() so ClassRoom::saved fires and both tutors' caches invalidate.
     * Students are scoped to those enrolled in a class of THIS org (a solo student the member created,
     * in no org class, is left untouched — it isn't the org's PII).
     */
    private function handBackTeachingResources(Organization $organization, int $userId): void
    {
        $orphanClasses = ClassRoom::where('organization_id', $organization->id)
            ->where('tutor_id', $userId)
            ->get();
        foreach ($orphanClasses as $class) {
            $class->update(['tutor_id' => $organization->owner_id]);
        }

        Student::where('created_by', $userId)
            ->whereHas('classes', fn ($q) => $q->where('organization_id', $organization->id))
            ->update(['created_by' => $organization->owner_id]);
    }

    /**
     * POST /organizations/{organization}/members/{member}/restore — bring a removed member back.
     *
     * store() rejects an existing email, so a removed staff account has no way back in without this.
     * Flips membership removed→active and clears the suspension so login re-opens. The member re-inherits
     * capabilities through the active membership again. owner/manager only; a manager may restore plain
     * tutors only (mirrors remove()).
     */
    public function restore(Organization $organization, OrganizationMember $member): JsonResponse
    {
        [$caller, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        if ($denied = $this->guardOrgContext($organization)) {
            return $denied;
        }

        if ($denied = $this->requireOrgRole(['owner', 'manager'])) {
            return $denied;
        }

        // The member must belong to THIS org (fail-closed 404 otherwise — no cross-org leak).
        if ((int) $member->organization_id !== (int) $organization->id) {
            return $this->errorResponse('Không tìm thấy thành viên', null, 'NOT_FOUND', 404);
        }

        if ($member->status !== 'removed') {
            return $this->errorResponse('Thành viên này đang hoạt động', null, 'MEMBER_NOT_REMOVED', 422);
        }

        // A manager may restore plain tutors only; restoring a manager is owner-only (mirrors remove()).
        if ($caller->isOrgManager() && $member->org_role !== 'tutor') {
            return $this->errorResponse('Chỉ chủ tổ chức mới có thể khôi phục quản lý', null, 'FORBIDDEN', 403);
        }

        // Single-org rule (E-2): never re-activate someone who is now active in another org.
        if ($this->hasActiveMembershipElsewhere((int) $member->user_id, (int) $organization->id)) {
            return $this->errorResponse(
                'Người dùng đã là thành viên hoạt động của một tổ chức khác',
                null,
                'ALREADY_IN_ORGANIZATION',
                409
            );
        }

        $member->update(['status' => 'active']);

        // Clear the suspension the removal set so login re-opens (only meaningful for a provisioned
        // account; a no-op for a never-suspended one).
        $restoredUser = $member->user;
        if ($restoredUser) {
            $restoredUser->forceFill([
                'suspended_at' => null,
                'suspended_reason' => null,
            ])->save();
            Cache::forget(CacheKeys::currentUser($restoredUser->id));
        }

        return $this->successResponse(
            new OrganizationMemberResource($member->fresh()->load('user')),
            'Đã khôi phục thành viên'
        );
    }

    /**
     * POST /organizations/{organization}/classes/{classRoom}/assign — (re)assign a class's lead tutor
     * to a member of the org (owner/manager). Validates the class is in the org and the new tutor is an
     * ACTIVE member of the SAME org (X-ORG-9 — never assign outside the org).
     */
    public function assignClass(Request $request, Organization $organization, ClassRoom $classRoom): JsonResponse
    {
        [$caller, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        if ($denied = $this->guardOrgContext($organization)) {
            return $denied;
        }

        if ($denied = $this->requireOrgRole(['owner', 'manager'])) {
            return $denied;
        }

        // The class must belong to THIS org (fail-closed 404 — cross-org / solo class invisible).
        if ((int) $classRoom->organization_id !== (int) $organization->id) {
            return $this->errorResponse('Không tìm thấy lớp học', null, 'NOT_FOUND', 404);
        }

        $validator = Validator::make($request->all(), [
            'tutor_id' => 'required|string',
        ]);
        if ($validator->fails()) {
            return $this->errorResponse('Dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        $newTutor = User::findByHashId($request->input('tutor_id'));

        // The new lead tutor MUST be an active member of this org.
        if (! $newTutor || ! in_array((int) $newTutor->id, $this->orgTutorIds($organization), true)) {
            return $this->errorResponse(
                'Gia sư được gán phải là thành viên của tổ chức',
                null,
                'INVALID_ASSIGNEE',
                422
            );
        }

        $classRoom->update(['tutor_id' => $newTutor->id]);

        return $this->successResponse(
            new ClassRoomResource($classRoom->fresh()->load('tutor')),
            'Đã gán gia sư phụ trách lớp học'
        );
    }
}
