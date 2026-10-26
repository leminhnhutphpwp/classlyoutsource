<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Requests\StoreOrganizationRequest;
use App\Http\Requests\UpdateOrganizationRequest;
use App\Http\Resources\OrganizationResource;
use App\Models\AiUsage;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\User;
use App\Traits\InteractsWithOrganizationRoutes;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Organization (trung tâm) endpoints: create, read the caller's current org, update, and the org
 * aggregate dashboard. Creating/managing an org is gated behind the enterprise `organization.manage`
 * capability; the org context is always derived from the caller, never from request input.
 */
class OrganizationController extends BaseController
{
    use InteractsWithOrganizationRoutes;

    /** Enterprise capability that unlocks creating/managing an organization. */
    private const MANAGE_CAPABILITY = 'organization.manage';

    /**
     * POST /organizations — create an org (caller becomes owner). Gated: enterprise capability.
     * Single-org rule (E-2): a user already in an org cannot create another.
     */
    public function store(StoreOrganizationRequest $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Only a tutor account may own an organization. A student/parent must be rejected BEFORE the
        // capability check: a student inherits their tutor's capabilities (requirePlanCapability's
        // student fallback), so a student enrolled in an enterprise owner's class would otherwise pass
        // the organization.manage gate and create an org owned by a student (privilege escalation).
        if (! $user->isTutor()) {
            return $this->errorResponse(
                'Chỉ tài khoản gia sư mới có thể tạo tổ chức',
                null,
                'FORBIDDEN',
                403
            );
        }

        if ($capabilityError = $this->requirePlanCapability(self::MANAGE_CAPABILITY)) {
            return $capabilityError;
        }

        if ($user->belongsToOrganization()) {
            return $this->errorResponse(
                'Bạn đã thuộc về một tổ chức. Mỗi tài khoản chỉ có thể thuộc một tổ chức.',
                null,
                'ALREADY_IN_ORGANIZATION',
                409
            );
        }

        $data = $request->validated();

        $organization = DB::transaction(function () use ($data, $user) {
            $org = Organization::create([
                'owner_id' => $user->id,
                'name' => $data['name'],
                'slug' => $this->uniqueSlug($data['name']),
                'description' => $data['description'] ?? null,
                'settings' => $data['settings'] ?? null,
                'status' => 'active',
            ]);

            OrganizationMember::create([
                'organization_id' => $org->id,
                'user_id' => $user->id,
                'org_role' => 'owner',
                'status' => 'active',
                'invited_by' => null,
                'joined_at' => now(),
            ]);

            return $org;
        });

        $organization->my_role = 'owner';

        return $this->successResponse(
            new OrganizationResource($organization),
            'Tạo tổ chức thành công',
            201
        );
    }

    /**
     * GET /organizations/current — the caller's current org + roster + their own role. Any member.
     * Returns data:null (200) when the caller belongs to no org (lets the FE decide what to show).
     */
    public function current(): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $org = $user->currentOrganization();
        if (! $org) {
            return $this->successResponse(null, 'Bạn chưa thuộc tổ chức nào');
        }

        $org->loadMissing(['members' => fn ($q) => $q->where('status', 'active')->with('user')]);
        $org->my_role = $user->orgRole();
        $org->members_count = $org->members->count();

        return $this->successResponse(new OrganizationResource($org));
    }

    /**
     * PATCH /organizations/{organization} — update editable fields (owner/manager only).
     */
    public function update(UpdateOrganizationRequest $request, Organization $organization): JsonResponse
    {
        if ($denied = $this->guardOrgContext($organization)) {
            return $denied;
        }

        if ($denied = $this->requireOrgRole(['owner', 'manager'])) {
            return $denied;
        }

        if ($capabilityError = $this->requirePlanCapability(self::MANAGE_CAPABILITY)) {
            return $capabilityError;
        }

        $data = $request->validated();

        // slug / owner_id / status are intentionally NOT editable here.
        if (array_key_exists('name', $data)) {
            $organization->name = $data['name'];
        }
        if (array_key_exists('description', $data)) {
            $organization->description = $data['description'];
        }
        if (array_key_exists('settings', $data)) {
            $organization->settings = $data['settings'];
        }

        $organization->save();

        $organization->my_role = $this->getAuthUser()->orgRole();

        return $this->successResponse(
            new OrganizationResource($organization),
            'Cập nhật tổ chức thành công'
        );
    }

    /**
     * GET /organizations/{organization}/dashboard — org aggregate. Reuses the Phase 2
     * orgOwnerDashboard via DashboardController (scope derived from the caller's membership).
     */
    public function dashboard(Organization $organization): JsonResponse
    {
        if ($denied = $this->guardOrgContext($organization)) {
            return $denied;
        }

        if ($denied = $this->requireOrgRole(['owner', 'manager'])) {
            return $denied;
        }

        return app(DashboardController::class)->index();
    }

    /**
     * GET /organizations/{organization}/ai-usage — the org's SHARED AI pool this month (Ops-fix B).
     * owner/manager only. Returns used/remaining for the combined call pool and the generate sub-pool
     * (single-tenant: null cap = unlimited → remaining:null), plus a per-tutor breakdown.
     * Counts by organization_id so an ex-member's calls still count against the pool (churn-immune).
     */
    public function aiUsage(Organization $organization): JsonResponse
    {
        if ($denied = $this->guardOrgContext($organization)) {
            return $denied;
        }

        if ($denied = $this->requireOrgRole(['owner', 'manager'])) {
            return $denied;
        }

        $user = $this->getAuthUser();
        // Single-tenant: no plan governs the org pool — AI usage is uncapped (null = unlimited).
        $monthStart = now()->startOfMonth();

        $callsUsed = AiUsage::where('organization_id', $organization->id)
            ->where('created_at', '>=', $monthStart)
            ->count();
        $generateUsed = AiUsage::where('organization_id', $organization->id)
            ->where('feature', 'generate')
            ->where('created_at', '>=', $monthStart)
            ->count();

        $callsCap = null;
        $generateCap = null;

        $remaining = fn (?int $cap, int $used): ?int => $cap === null ? null : max(0, $cap - $used);

        // Per-tutor breakdown (grouped by user_id; SQLite- and MySQL-safe conditional SUM).
        $rows = AiUsage::query()
            ->selectRaw('user_id, COUNT(*) as calls, SUM(CASE WHEN feature = ? THEN 1 ELSE 0 END) as generates', ['generate'])
            ->where('organization_id', $organization->id)
            ->where('created_at', '>=', $monthStart)
            ->groupBy('user_id')
            ->get();

        $names = User::withTrashed()
            ->whereIn('id', $rows->pluck('user_id')->filter()->all())
            ->pluck('name', 'id');

        $breakdown = $rows->map(fn ($r) => [
            'user_id' => $r->user_id ? User::encodeId($r->user_id) : null,
            'name' => $r->user_id ? ($names[$r->user_id] ?? null) : null,
            'calls' => (int) $r->calls,
            'generates' => (int) $r->generates,
        ])->values();

        return $this->successResponse([
            'month' => $monthStart->toDateString(),
            'pool' => [
                'calls' => [
                    'used' => $callsUsed,
                    'limit' => $callsCap,
                    'remaining' => $remaining($callsCap, $callsUsed),
                ],
                'generate' => [
                    'used' => $generateUsed,
                    'limit' => $generateCap,
                    'remaining' => $remaining($generateCap, $generateUsed),
                ],
            ],
            'breakdown' => $breakdown,
        ]);
    }

    /**
     * Build a unique slug from the org name (design E-7: collisions get a numeric suffix).
     */
    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name);
        if ($base === '') {
            $base = 'to-chuc';
        }

        $slug = $base;
        $i = 1;
        while (Organization::withTrashed()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$i;
            $i++;
        }

        return $slug;
    }
}
