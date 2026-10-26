<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Requests\StoreCompensationProfileRequest;
use App\Http\Requests\UpdateCompensationProfileRequest;
use App\Http\Resources\TutorCompensationProfileResource;
use App\Models\Organization;
use App\Models\TutorCompensationProfile;
use App\Models\User;
use App\Traits\InteractsWithOrganizationRoutes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Compensation profiles (pay RULES) CRUD — Wave 3 payroll. Money is HIGH-sensitivity and MEMBER-anchored
 * (design §2.4, §6 risk 1): every row carries organization_id (pattern b). Every action is gated by the
 * triple (G3) capability `payroll.manage` → org-role (owner/manager) → org-context, all derived from the
 * caller's membership (never the URL/body). Member-tutors + accountants NEVER see rate tables
 * (fail-closed via isolation). Cross-org is fail-closed 404 (no existence leak).
 */
class CompensationProfileController extends BaseController
{
    use InteractsWithOrganizationRoutes;

    private const CAPABILITY = 'payroll.manage';

    private const ROLES = ['owner', 'manager'];

    /**
     * GET /organizations/{organization}/compensation-profiles — list the org's pay rules.
     */
    public function index(Request $request, Organization $organization): JsonResponse
    {
        if ($denied = $this->gate($organization)) {
            return $denied;
        }

        $query = TutorCompensationProfile::query()
            ->where('organization_id', $organization->id)
            ->orderByDesc('status') // active before archived (alphabetical: active < archived is false → desc)
            ->orderByDesc('effective_from')
            ->orderByDesc('id');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('user_id')) {
            $query->where('user_id', User::decodeId($request->user_id) ?? 0);
        }

        return $this->successResponse(TutorCompensationProfileResource::collection($query->get()));
    }

    /**
     * POST /organizations/{organization}/compensation-profiles — create a pay rule for a member.
     *
     * Effective-date history is PRESERVED (the audit finding): we never archive every active profile.
     * Only the immediately-preceding open-ended rule is closed exactly at the new rule's start, and the
     * new window is rejected if it overlaps any other active rule — so a future-dated replacement can
     * never make current/historical periods compute as zero. All writes are transactional.
     */
    public function store(StoreCompensationProfileRequest $request, Organization $organization): JsonResponse
    {
        if ($denied = $this->gate($organization)) {
            return $denied;
        }

        $data = $request->validated();

        [$userId, $userError] = $this->resolveOrgMemberId($data['user_id'], $organization);
        if ($userError) {
            return $userError;
        }

        try {
            DB::transaction(function () use ($organization, $data, $userId) {
                $from = $data['effective_from'];
                $to = $data['effective_to'] ?? null;
                $predecessorEnd = \Illuminate\Support\Carbon::createFromFormat('Y-m-d', $from)->subDay()->toDateString();

                // 1) Close the open-ended predecessor exactly at the new start (history preserved, no gap).
                TutorCompensationProfile::where('organization_id', $organization->id)
                    ->where('user_id', $userId)
                    ->where('status', 'active')
                    ->whereNotNull('effective_to')
                    ->whereDate('effective_from', '<', $from)
                    ->whereDate('effective_to', '>=', $from)
                    ->update(['effective_to' => $predecessorEnd]);

                TutorCompensationProfile::where('organization_id', $organization->id)
                    ->where('user_id', $userId)
                    ->where('status', 'active')
                    ->whereNull('effective_to')
                    ->whereDate('effective_from', '<', $from)
                    ->update(['effective_to' => $predecessorEnd]);

                // 2) Reject any OTHER overlap: an active rule that starts on/after the new start and
                //    intersects the new window (or the new rule is open-ended → must be the latest).
                $overlap = TutorCompensationProfile::where('organization_id', $organization->id)
                    ->where('user_id', $userId)
                    ->where('status', 'active')
                    ->whereDate('effective_from', '>=', $from)
                    ->when($to === null, fn ($q) => $q)
                    ->when($to !== null, fn ($q) => $q->whereDate('effective_from', '<=', $to))
                    ->exists();

                if ($overlap) {
                    abort(422, 'PROFILE_OVERLAP');
                }

                TutorCompensationProfile::create([
                    'organization_id' => $organization->id, // anchor — from context, never the body
                    'user_id' => $userId,
                    'pay_model' => $data['pay_model'],
                    'base_salary' => $data['base_salary'] ?? null,
                    'rate_per_session' => $data['rate_per_session'] ?? null,
                    'rate_per_student' => $data['rate_per_student'] ?? null,
                    'revenue_share_pct' => $data['revenue_share_pct'] ?? null,
                    'components' => $data['components'] ?? null,
                    'session_basis' => $data['session_basis'] ?? 'completed_session',
                    'currency' => $data['currency'] ?? 'VND',
                    'effective_from' => $from,
                    'effective_to' => $to,
                    'status' => 'active',
                ]);
            });
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            return $this->errorResponse(
                'Khoảng hiệu lực trùng với hồ sơ lương khác của giáo viên này',
                null,
                'PROFILE_OVERLAP',
                422
            );
        }

        $profile = TutorCompensationProfile::where('organization_id', $organization->id)
            ->where('user_id', $userId)
            ->latest('id')
            ->firstOrFail();

        return $this->successResponse(
            new TutorCompensationProfileResource($profile),
            'Tạo cấu hình lương thành công',
            201
        );
    }

    /**
     * GET /organizations/{organization}/compensation-profiles/{profile} — show one pay rule.
     */
    public function show(Organization $organization, TutorCompensationProfile $profile): JsonResponse
    {
        if ($denied = $this->gate($organization)) {
            return $denied;
        }
        if ($denied = $this->profileInOrg($profile, $organization)) {
            return $denied;
        }

        return $this->successResponse(new TutorCompensationProfileResource($profile));
    }

    /**
     * PATCH /organizations/{organization}/compensation-profiles/{profile} — edit a pay rule.
     */
    public function update(UpdateCompensationProfileRequest $request, Organization $organization, TutorCompensationProfile $profile): JsonResponse
    {
        if ($denied = $this->gate($organization)) {
            return $denied;
        }
        if ($denied = $this->profileInOrg($profile, $organization)) {
            return $denied;
        }

        $data = $request->validated();

        foreach ([
            'pay_model', 'base_salary', 'rate_per_session', 'rate_per_student', 'revenue_share_pct',
            'components', 'session_basis', 'currency', 'effective_from', 'effective_to', 'status',
        ] as $field) {
            if (array_key_exists($field, $data)) {
                $profile->{$field} = $data[$field];
            }
        }

        $profile->save();

        return $this->successResponse(
            new TutorCompensationProfileResource($profile),
            'Cập nhật cấu hình lương thành công'
        );
    }

    /**
     * DELETE /organizations/{organization}/compensation-profiles/{profile} — ARCHIVE the pay rule
     * (design §3.4: DELETE = archive). Soft-deletes the row so it drops out of the active set.
     */
    public function destroy(Organization $organization, TutorCompensationProfile $profile): JsonResponse
    {
        if ($denied = $this->gate($organization)) {
            return $denied;
        }
        if ($denied = $this->profileInOrg($profile, $organization)) {
            return $denied;
        }

        $profile->status = 'archived';
        $profile->save();
        $profile->delete();

        return $this->successResponse(null, 'Đã lưu trữ cấu hình lương');
    }

    /**
     * The gate triple (G3): capability → org-role (owner/manager) → org-context. First denial, or null.
     */
    private function gate(Organization $organization): ?JsonResponse
    {
        if ($denied = $this->requirePlanCapability(self::CAPABILITY)) {
            return $denied;
        }
        if ($denied = $this->requireOrgRole(self::ROLES)) {
            return $denied;
        }
        if ($denied = $this->guardOrgContext($organization)) {
            return $denied;
        }

        return null;
    }

    /**
     * A bound {profile} must belong to $organization — else fail CLOSED (404, no existence leak).
     */
    private function profileInOrg(TutorCompensationProfile $profile, Organization $organization): ?JsonResponse
    {
        if ((int) $profile->organization_id !== (int) $organization->id) {
            return $this->errorResponse('Không tìm thấy cấu hình lương', null, 'NOT_FOUND', 404);
        }

        return null;
    }

    /**
     * Decode + org-validate a member (user) hashid: must be an ACTIVE member of $organization.
     * Returns [int|null id, ?JsonResponse error]. Cross-org injection → 422.
     */
    private function resolveOrgMemberId($hashId, Organization $organization): array
    {
        $userId = User::decodeId($hashId);
        $belongs = $userId && in_array((int) $userId, array_map('intval', $organization->activeMemberUserIds()), true);

        if (! $belongs) {
            return [null, $this->errorResponse('Gia sư không thuộc tổ chức này', null, 'VALIDATION_ERROR', 422)];
        }

        return [$userId, null];
    }
}
