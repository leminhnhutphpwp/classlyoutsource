<?php

namespace App\Traits;

use App\Models\Organization;
use App\Models\OrganizationMember;
use Illuminate\Http\JsonResponse;

/**
 * Shared guards for the /organizations/{organization}/* endpoints. The route org is ALWAYS validated
 * against the caller's own active membership (never trusted from the URL alone) and denials fail
 * CLOSED as a 404 so we never leak the existence of another center's org. See design §6.
 */
trait InteractsWithOrganizationRoutes
{
    /**
     * Fail CLOSED (404) unless the caller is an active member of exactly this $org. A non-member or a
     * member of a different org gets the same 404 — no existence leak (design §6, X-ORG-10b).
     */
    protected function guardOrgContext(?Organization $org): ?JsonResponse
    {
        $user = $this->getAuthUser();
        $current = $user?->currentOrganization();

        if (! $org || ! $current || (int) $org->id !== (int) $current->id) {
            return $this->errorResponse('Không tìm thấy tổ chức', null, 'NOT_FOUND', 404);
        }

        return null;
    }

    /**
     * Whether $userId is already an ACTIVE member of some OTHER organization (single-org rule, E-2).
     */
    protected function hasActiveMembershipElsewhere(int $userId, ?int $exceptOrgId = null): bool
    {
        return OrganizationMember::query()
            ->where('user_id', $userId)
            ->where('status', 'active')
            ->when($exceptOrgId, fn ($q) => $q->where('organization_id', '!=', $exceptOrgId))
            ->exists();
    }
}
