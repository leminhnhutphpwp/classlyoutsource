<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Requests\StorePayrollAdjustmentRequest;
use App\Http\Resources\PayrollAdjustmentResource;
use App\Http\Resources\PayrollItemResource;
use App\Models\Organization;
use App\Models\PayrollAdjustment;
use App\Models\PayrollItem;
use App\Models\PayrollPeriod;
use App\Traits\InteractsWithOrganizationRoutes;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Payslips (payroll_items) + their manual adjustments, and the member self-service view — Wave 3. Money
 * is HIGH-sensitivity + MEMBER-anchored (design §2.4). Two access shapes:
 *  - OWNER/MANAGER (+ accountant read) → org-wide payslips (isolated by organization_id, pattern b);
 *    adjustments are owner/manager-only writes.
 *  - MEMBER-TUTOR → ONLY their OWN payslip, and ONLY once APPROVED (draft hidden — design §5 QĐ 8),
 *    via my-payslips / a self item show. Never rate tables, never another member's payslip.
 * Cross-org / another-member is fail-closed 404 (no existence leak).
 */
class PayrollItemController extends BaseController
{
    use InteractsWithOrganizationRoutes;

    private const CAPABILITY = 'payroll.manage';

    /**
     * GET /payroll-items/{item} — a single payslip. Owner/manager/accountant may read any item in THEIR
     * org; a member-tutor may read ONLY their own APPROVED item. Everyone else / cross-org → 404.
     */
    public function show(PayrollItem $item): JsonResponse
    {
        if ($denied = $this->requirePlanCapability(self::CAPABILITY)) {
            return $denied;
        }

        $user = $this->getAuthUser();
        $org = $user?->currentOrganization();
        if (! $org) {
            return $this->notFoundItem();
        }

        // The item MUST belong to the caller's org — cross-org is invisible (fail-closed 404).
        if ((int) $item->organization_id !== (int) $org->id) {
            return $this->notFoundItem();
        }

        // Owner/manager (whole org) and accountant (finance read) may see any item in the org.
        if ($user->isOrgViewerAll() || $user->isOrgAccountant()) {
            return $this->successResponse(new PayrollItemResource($item->load(['user', 'adjustments'])));
        }

        // Member-tutor: own item ONLY, and only once FINALIZED (approved or paid) — draft is hidden.
        if ((int) $item->user_id === (int) $user->id && $item->isLocked()) {
            return $this->successResponse(new PayrollItemResource($item->load('adjustments')));
        }

        return $this->notFoundItem();
    }

    /**
     * GET /organizations/{organization}/my-payslips — member self-service: the caller's OWN payslips,
     * APPROVED only (design §5 QĐ 8). Works for any active member (incl owner/manager — they see their
     * own). Scoped to self via applyDataIsolation('payroll_items') AND an explicit user_id belt-and-braces.
     */
    public function myPayslips(Organization $organization): JsonResponse
    {
        if ($denied = $this->requirePlanCapability(self::CAPABILITY)) {
            return $denied;
        }
        if ($denied = $this->guardOrgContext($organization)) {
            return $denied;
        }

        $user = $this->getAuthUser();

        $query = PayrollItem::query()->where('organization_id', $organization->id);
        // isolation arm: member-tutor → user_id=self; owner/manager → org (narrowed below to self).
        $this->applyDataIsolation($query, 'payroll_items');

        $items = $query
            ->where('user_id', $user->id) // self only — belt-and-braces for owner/manager viewers
            ->whereIn('status', [PayrollItem::STATUS_APPROVED, PayrollItem::STATUS_PAID]) // finalized only — draft hidden
            ->with(['adjustments', 'period'])
            ->orderByDesc('id')
            ->get();

        return $this->successResponse(PayrollItemResource::collection($items));
    }

    /**
     * POST /payroll-items/{item}/adjustments — add a bonus/deduction/advance/correction to a payslip.
     * Owner/manager only, and ONLY while the item's period is APPROVED but not yet PAID: draft items are
     * recomputed (an adjustment there is overwritten) and PAID items are immutable (money has left the
     * center — a post-payment correction belongs in a later period, not a total rewrite). This is the
     * ONLY way an approved item changes its total — a new signed row folded into adjustments_total+gross.
     */
    public function storeAdjustment(StorePayrollAdjustmentRequest $request, PayrollItem $item): JsonResponse
    {
        [$org, $denied] = $this->manageContext();
        if ($denied) {
            return $denied;
        }
        if ((int) $item->organization_id !== (int) $org->id) {
            return $this->notFoundItem();
        }

        $data = $request->validated();
        $creatorId = $this->getAuthUser()->id;
        $created = null;

        try {
            DB::transaction(function () use ($item, $org, $data, $creatorId, &$created) {
                /** @var PayrollItem $lockedItem */
                $lockedItem = PayrollItem::whereKey($item->id)->lockForUpdate()->firstOrFail();
                /** @var PayrollPeriod|null $period */
                $period = $lockedItem->period()->lockForUpdate()->first();

                // The item must be APPROVED (finalized, still owed) — never draft (recomputed away) and
                // never paid (immutable once money has left).
                if (! $period || ! $period->isApproved() || ! $lockedItem->isLocked()) {
                    abort(409, 'NOT_ADJUSTABLE');
                }

                $created = PayrollAdjustment::create([
                    'organization_id' => $org->id, // anchor — from context, never the body
                    'payroll_item_id' => $lockedItem->id,
                    'type' => $data['type'],
                    'amount' => $data['amount'],
                    'reason' => $data['reason'],
                    'created_by' => $creatorId,
                ]);

                $this->refold($lockedItem);
            });
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            return $this->errorResponse(
                'Chỉ có thể điều chỉnh phiếu lương đã duyệt và chưa trả',
                null,
                'NOT_ADJUSTABLE',
                409
            );
        }

        return $this->successResponse(
            new PayrollAdjustmentResource($created),
            'Đã thêm điều chỉnh lương',
            201
        );
    }

    /**
     * DELETE /payroll-adjustments/{adjustment} — remove an adjustment. Owner/manager only, and only while
     * the parent period is still APPROVED (unpaid); once paid the adjustment is part of the immutable
     * payout. Re-folds the item + period total afterwards, atomically.
     */
    public function destroyAdjustment(PayrollAdjustment $adjustment): JsonResponse
    {
        [$org, $denied] = $this->manageContext();
        if ($denied) {
            return $denied;
        }
        if ((int) $adjustment->organization_id !== (int) $org->id) {
            return $this->errorResponse('Không tìm thấy điều chỉnh', null, 'NOT_FOUND', 404);
        }

        try {
            DB::transaction(function () use ($adjustment) {
                /** @var PayrollAdjustment $locked */
                $locked = PayrollAdjustment::whereKey($adjustment->id)->lockForUpdate()->firstOrFail();
                $item = $locked->item()->lockForUpdate()->first();
                $period = $item?->period()->lockForUpdate()->first();

                if (! $item || ! $period || ! $period->isApproved()) {
                    abort(409, 'NOT_ADJUSTABLE');
                }

                $locked->delete();
                $this->refold($item);
            });
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            return $this->errorResponse(
                'Chỉ có thể xóa điều chỉnh khi kỳ lương còn ở trạng thái đã duyệt và chưa trả',
                null,
                'NOT_ADJUSTABLE',
                409
            );
        }

        return $this->successResponse(null, 'Đã xóa điều chỉnh lương');
    }

    /**
     * Re-fold an item's adjustments into adjustments_total + gross, then re-total the parent period.
     * gross = base + sessions + students + revenue + adjustments (the computed inputs are untouched).
     * Runs inside the caller's transaction (row locks held).
     */
    private function refold(PayrollItem $item): void
    {
        $item->adjustments_total = (int) $item->adjustments()->sum('amount');
        $item->gross_amount = (int) $item->base_amount
            + (int) $item->sessions_amount
            + (int) $item->students_amount
            + (int) $item->revenue_amount
            + (int) $item->adjustments_total;
        $item->save();

        $period = $item->period;
        if ($period) {
            $period->total_amount = (int) PayrollItem::where('payroll_period_id', $period->id)->sum('gross_amount');
            $period->save();
        }
    }

    /**
     * Owner/manager management context (capability → owner/manager role → resolve org). Adjustments are
     * an owner/manager write (the accountant reconciles but does NOT set pay — design §2.4).
     * Returns [Organization|null, ?JsonResponse].
     */
    private function manageContext(): array
    {
        if ($denied = $this->requirePlanCapability(self::CAPABILITY)) {
            return [null, $denied];
        }
        if ($denied = $this->requireOrgRole(['owner', 'manager'])) {
            return [null, $denied];
        }

        $org = $this->getAuthUser()?->currentOrganization();
        if (! $org instanceof Organization) {
            return [null, $this->notFoundItem()];
        }

        return [$org, null];
    }

    private function notFoundItem(): JsonResponse
    {
        return $this->errorResponse('Không tìm thấy phiếu lương', null, 'NOT_FOUND', 404);
    }
}
