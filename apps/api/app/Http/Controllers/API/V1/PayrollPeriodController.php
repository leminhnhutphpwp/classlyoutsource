<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Requests\StorePayrollPeriodRequest;
use App\Http\Resources\PayrollItemResource;
use App\Http\Resources\PayrollPeriodResource;
use App\Jobs\ComputePayrollPeriod;
use App\Models\Organization;
use App\Models\PayrollItem;
use App\Models\PayrollPeriod;
use App\Support\ReferenceCode;
use App\Traits\InteractsWithOrganizationRoutes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Payroll periods (pay runs) — Wave 3. Money is HIGH-sensitivity + MEMBER-anchored; every row carries
 * organization_id (pattern b, design §2.4). Gated by the triple (G3) capability `payroll.manage` →
 * org-role → org-context. Management (list/create/compute/approve/cancel/items) is owner/manager;
 * MARK-PAID is OWNER-ONLY (money leaving the center is the owner's act — design §3.4, §5 QĐ 6).
 *
 * State machine: draft → approved (owner/manager) → paid (owner). Cancel only from draft. Compute is
 * REFUSED once the period is approved/paid (the snapshot is chosen — force an adjustment instead,
 * design §6 risk 4). Cross-org is fail-closed 404.
 */
class PayrollPeriodController extends BaseController
{
    use InteractsWithOrganizationRoutes;

    private const CAPABILITY = 'payroll.manage';

    private const MANAGE_ROLES = ['owner', 'manager'];

    /**
     * GET /organizations/{organization}/payroll-periods — list the org's pay runs.
     */
    public function index(Organization $organization): JsonResponse
    {
        if ($denied = $this->gate($organization)) {
            return $denied;
        }

        $periods = PayrollPeriod::query()
            ->where('organization_id', $organization->id)
            ->withCount('items')
            ->orderByDesc('period_start')
            ->orderByDesc('id')
            ->get();

        return $this->successResponse(PayrollPeriodResource::collection($periods));
    }

    /**
     * POST /organizations/{organization}/payroll-periods — create a draft pay run for a window. The
     * unique (org, period_start, period_end) window blocks a duplicate run (returns 422, not a 500).
     */
    public function store(StorePayrollPeriodRequest $request, Organization $organization): JsonResponse
    {
        if ($denied = $this->gate($organization)) {
            return $denied;
        }

        $data = $request->validated();

        // whereDate (not a raw = match): the `date` cast stores 'Y-m-d 00:00:00' in SQLite, so an exact
        // match on a 'Y-m-d' string would miss and let the DB unique constraint fire a 500 instead.
        $existing = PayrollPeriod::where('organization_id', $organization->id)
            ->whereDate('period_start', $data['period_start'])
            ->whereDate('period_end', $data['period_end'])
            ->first();
        if ($existing) {
            // A cancelled run is kept (state-only) — reopen it instead of colliding on the unique key.
            if ($existing->isCancelled()) {
                return $this->errorResponse('Kỳ lương này đã hủy — hãy Mở lại thay vì tạo mới', null, 'PERIOD_CANCELLED', 422);
            }
            return $this->errorResponse('Kỳ lương cho khoảng thời gian này đã tồn tại', null, 'PERIOD_EXISTS', 422);
        }

        $period = PayrollPeriod::create([
            'organization_id' => $organization->id, // anchor — from context, never the body
            'reference_code' => ReferenceCode::generate(PayrollPeriod::class, 'PR'),
            'period_start' => $data['period_start'],
            'period_end' => $data['period_end'],
            'label' => $data['label'] ?? ('Kỳ lương '.$data['period_start'].' → '.$data['period_end']),
            'status' => PayrollPeriod::STATUS_DRAFT,
            'total_amount' => 0,
        ]);

        return $this->successResponse(
            new PayrollPeriodResource($period),
            'Tạo kỳ lương thành công',
            201
        );
    }

    /**
     * GET /organizations/{organization}/payroll-periods/{period} — show one pay run + its items.
     */
    public function show(Organization $organization, PayrollPeriod $period): JsonResponse
    {
        if ($denied = $this->gate($organization)) {
            return $denied;
        }
        if ($denied = $this->periodInOrg($period, $organization)) {
            return $denied;
        }

        $period->load(['items.user']);

        return $this->successResponse(new PayrollPeriodResource($period));
    }

    /**
     * POST /organizations/{organization}/payroll-periods/{period}/compute — QUEUED (re)compute of items.
     * Blocked unless the period is a draft (design §6 risk 4) and no run is already in flight. The claim
     * is atomic: the period row is locked, a fresh calculation token is minted, and the state is moved to
     * `queued` in the SAME transaction that dispatches the job — so a concurrent approve (which requires
     * `completed`) can never interleave with a half-finished compute.
     */
    public function compute(Organization $organization, PayrollPeriod $period): JsonResponse
    {
        if ($denied = $this->gate($organization)) {
            return $denied;
        }
        if ($denied = $this->periodInOrg($period, $organization)) {
            return $denied;
        }

        $token = null;

        try {
            DB::transaction(function () use ($period, &$token) {
                /** @var PayrollPeriod $locked */
                $locked = PayrollPeriod::whereKey($period->id)->lockForUpdate()->firstOrFail();

                if (! $locked->isComputable()) {
                    abort(409, 'PERIOD_LOCKED');
                }
                if ($locked->isCalculationInFlight()) {
                    abort(409, 'CALC_IN_PROGRESS');
                }

                $token = bin2hex(random_bytes(16));
                $locked->forceFill([
                    'calculation_status' => PayrollPeriod::CALC_QUEUED,
                    'calculation_token' => $token,
                    'calculation_started_at' => null,
                    'calculation_error' => null,
                    'computed_at' => null,
                ])->save();
            });
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException) {
            return $this->errorResponse('Không tìm thấy kỳ lương', null, 'NOT_FOUND', 404);
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            return $this->computeError($e->getMessage());
        }

        // Long/idempotent money work → off the request thread (needs queue:work; sync in tests).
        ComputePayrollPeriod::dispatch($period->id, $token);

        return $this->successResponse(
            new PayrollPeriodResource($period->fresh()),
            'Đã bắt đầu tính lương cho kỳ này'
        );
    }

    private function computeError(string $code): JsonResponse
    {
        return match ($code) {
            'PERIOD_LOCKED' => $this->errorResponse(
                'Kỳ lương đã được duyệt — không thể tính lại. Hãy tạo điều chỉnh (adjustment) thay thế.',
                null,
                'PERIOD_LOCKED',
                409
            ),
            'CALC_IN_PROGRESS' => $this->errorResponse('Đang có lượt tính lương chạy, vui lòng đợi hoàn tất', null, 'CALC_IN_PROGRESS', 409),
            default => $this->errorResponse('Không thể tính lương', null, 'CALC_FAILED', 409),
        };
    }

    /**
     * POST /organizations/{organization}/payroll-periods/{period}/approve — draft → approved
     * (owner/manager). Snapshots the run: items become approved (immutable except via adjustments).
     * Requires the CURRENT calculation run to have COMPLETED (never approve a stale/empty snapshot).
     */
    public function approve(Organization $organization, PayrollPeriod $period): JsonResponse
    {
        if ($denied = $this->gate($organization)) {
            return $denied;
        }
        if ($denied = $this->periodInOrg($period, $organization)) {
            return $denied;
        }

        $approverId = $this->getAuthUser()->id;

        try {
            DB::transaction(function () use ($period, $approverId) {
                /** @var PayrollPeriod $locked */
                $locked = PayrollPeriod::whereKey($period->id)->lockForUpdate()->firstOrFail();

                if (! $locked->isDraft()) {
                    abort(409, 'INVALID_STATE');
                }
                if (! $locked->isCalculationCompleted()) {
                    abort(409, 'CALC_NOT_COMPLETED');
                }
                if ((int) PayrollItem::where('payroll_period_id', $locked->id)->count() === 0) {
                    abort(409, 'NO_ITEMS');
                }

                $locked->status = PayrollPeriod::STATUS_APPROVED;
                $locked->approved_by = $approverId;
                $locked->approved_at = now();
                // Re-total from the chosen snapshot so total_amount matches the approved items exactly.
                $locked->total_amount = (int) PayrollItem::where('payroll_period_id', $locked->id)->sum('gross_amount');
                $locked->save();

                PayrollItem::where('payroll_period_id', $locked->id)
                    ->update(['status' => PayrollItem::STATUS_APPROVED]);
            });
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException) {
            return $this->errorResponse('Không tìm thấy kỳ lương', null, 'NOT_FOUND', 404);
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            return $this->approveError($e->getMessage());
        }

        return $this->successResponse(new PayrollPeriodResource($period->fresh()), 'Đã duyệt kỳ lương');
    }

    private function approveError(string $code): JsonResponse
    {
        return match ($code) {
            'INVALID_STATE' => $this->errorResponse('Chỉ có thể duyệt kỳ lương ở trạng thái nháp', null, 'INVALID_STATE', 409),
            'CALC_NOT_COMPLETED' => $this->errorResponse('Chưa tính lương xong — không thể duyệt. Hãy bấm Tính lương và chờ hoàn tất.', null, 'CALC_NOT_COMPLETED', 409),
            'NO_ITEMS' => $this->errorResponse('Kỳ lương không có phiếu nào để duyệt', null, 'NO_ITEMS', 409),
            default => $this->errorResponse('Không thể duyệt kỳ lương', null, 'INVALID_STATE', 409),
        };
    }

    /**
     * POST /organizations/{organization}/payroll-periods/{period}/mark-paid — approved → paid.
     * OWNER-ONLY (money leaving the center). Managers get 403 here even though they can approve.
     * Period + item status flip atomically under a row lock.
     */
    public function markPaid(Organization $organization, PayrollPeriod $period): JsonResponse
    {
        // OWNER-only gate (stricter than the management gate) — checked before org-context.
        if ($denied = $this->requirePlanCapability(self::CAPABILITY)) {
            return $denied;
        }
        if ($denied = $this->requireOrgRole(['owner'])) {
            return $denied;
        }
        if ($denied = $this->guardOrgContext($organization)) {
            return $denied;
        }
        if ($denied = $this->periodInOrg($period, $organization)) {
            return $denied;
        }

        $payerId = $this->getAuthUser()->id;

        try {
            DB::transaction(function () use ($period, $payerId) {
                /** @var PayrollPeriod $locked */
                $locked = PayrollPeriod::whereKey($period->id)->lockForUpdate()->firstOrFail();

                if (! $locked->isApproved()) {
                    abort(409, 'INVALID_STATE');
                }

                $locked->status = PayrollPeriod::STATUS_PAID;
                $locked->paid_by = $payerId;
                $locked->paid_at = now();
                $locked->save();

                PayrollItem::where('payroll_period_id', $locked->id)
                    ->update(['status' => PayrollItem::STATUS_PAID]);
            });
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            return $this->errorResponse('Chỉ có thể đánh dấu đã trả cho kỳ lương đã duyệt', null, 'INVALID_STATE', 409);
        }

        return $this->successResponse(new PayrollPeriodResource($period->fresh()), 'Đã đánh dấu kỳ lương là đã trả');
    }

    /**
     * DELETE /organizations/{organization}/payroll-periods/{period} — CANCEL a run. Only from draft
     * (an approved/paid run is immutable history — design §6 risk 4). Cancellation is STATE-ONLY (the row
     * is kept, NOT soft-deleted) so the unique(org, window) key stays consistent and the run can be
     * reopened instead of colliding on recreate.
     */
    public function destroy(Organization $organization, PayrollPeriod $period): JsonResponse
    {
        if ($denied = $this->gate($organization)) {
            return $denied;
        }
        if ($denied = $this->periodInOrg($period, $organization)) {
            return $denied;
        }

        try {
            DB::transaction(function () use ($period) {
                /** @var PayrollPeriod $locked */
                $locked = PayrollPeriod::whereKey($period->id)->lockForUpdate()->firstOrFail();

                if (! $locked->isDraft()) {
                    abort(409, 'INVALID_STATE');
                }

                $locked->status = PayrollPeriod::STATUS_CANCELLED;
                $locked->calculation_status = PayrollPeriod::CALC_NOT_STARTED;
                $locked->calculation_token = null;
                $locked->calculation_error = null;
                $locked->computed_at = null;
                $locked->save();

                // A cancelled draft has no payable items; drop any draft payslips it had computed.
                PayrollItem::where('payroll_period_id', $locked->id)
                    ->where('status', PayrollItem::STATUS_DRAFT)
                    ->delete();
            });
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            return $this->errorResponse('Chỉ có thể hủy kỳ lương ở trạng thái nháp', null, 'INVALID_STATE', 409);
        }

        return $this->successResponse(null, 'Đã hủy kỳ lương');
    }

    /**
     * POST /organizations/{organization}/payroll-periods/{period}/reopen — cancelled → draft. Lets the
     * center revive a cancelled run (same window) instead of recreating it and hitting the unique key.
     */
    public function reopen(Organization $organization, PayrollPeriod $period): JsonResponse
    {
        if ($denied = $this->gate($organization)) {
            return $denied;
        }
        if ($denied = $this->periodInOrg($period, $organization)) {
            return $denied;
        }

        try {
            DB::transaction(function () use ($period) {
                /** @var PayrollPeriod $locked */
                $locked = PayrollPeriod::whereKey($period->id)->lockForUpdate()->firstOrFail();

                if (! $locked->isCancelled()) {
                    abort(409, 'INVALID_STATE');
                }

                $locked->status = PayrollPeriod::STATUS_DRAFT;
                $locked->calculation_status = PayrollPeriod::CALC_NOT_STARTED;
                $locked->calculation_token = null;
                $locked->calculation_error = null;
                $locked->computed_at = null;
                $locked->total_amount = 0;
                $locked->save();
            });
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            return $this->errorResponse('Chỉ có thể mở lại kỳ lương đã hủy', null, 'INVALID_STATE', 409);
        }

        return $this->successResponse(new PayrollPeriodResource($period->fresh()), 'Đã mở lại kỳ lương');
    }

    /**
     * GET /organizations/{organization}/payroll-periods/{period}/items — items of a run. Owner/manager
     * see the whole run; the accountant reads it too (finance). Member-tutors are gated out of this
     * endpoint (they use my-payslips) — the gate requires owner/manager/accountant.
     */
    public function items(Organization $organization, PayrollPeriod $period): JsonResponse
    {
        // Owner/manager/accountant may read the run's items (accountant is finance-read).
        if ($denied = $this->requirePlanCapability(self::CAPABILITY)) {
            return $denied;
        }
        if ($denied = $this->requireOrgRole(['owner', 'manager', 'accountant'])) {
            return $denied;
        }
        if ($denied = $this->guardOrgContext($organization)) {
            return $denied;
        }
        if ($denied = $this->periodInOrg($period, $organization)) {
            return $denied;
        }

        $items = PayrollItem::query()
            ->where('payroll_period_id', $period->id)
            ->where('organization_id', $organization->id)
            ->with(['user', 'adjustments'])
            ->orderBy('user_id')
            ->get();

        return $this->successResponse(PayrollItemResource::collection($items));
    }

    /**
     * The management gate triple (G3): capability → org-role (owner/manager) → org-context.
     */
    private function gate(Organization $organization): ?JsonResponse
    {
        if ($denied = $this->requirePlanCapability(self::CAPABILITY)) {
            return $denied;
        }
        if ($denied = $this->requireOrgRole(self::MANAGE_ROLES)) {
            return $denied;
        }
        if ($denied = $this->guardOrgContext($organization)) {
            return $denied;
        }

        return null;
    }

    /**
     * A bound {period} must belong to $organization — else fail CLOSED (404, no existence leak).
     */
    private function periodInOrg(PayrollPeriod $period, Organization $organization): ?JsonResponse
    {
        if ((int) $period->organization_id !== (int) $organization->id) {
            return $this->errorResponse('Không tìm thấy kỳ lương', null, 'NOT_FOUND', 404);
        }

        return null;
    }
}
