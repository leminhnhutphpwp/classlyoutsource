<?php

namespace App\Services\Finance;

use App\Models\PayrollItem;
use App\Models\PayrollPeriod;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;

/**
 * The SINGLE source of truth for "tutor cost" in finance (design §2.6). Finance NEVER re-derives salary
 * math — PayrollCalculator is the one money-math for payroll, this reader is the one way finance CONSUMES
 * it. Every method is org-scoped by payroll_items.organization_id (the immutable snapshot anchor) so org
 * B's payroll can never leak into org A's numbers, and every method is FAIL-SOFT: if the payroll_items
 * table has not landed yet, cost is 0 with available=false so a caller shows "payroll not integrated"
 * instead of a wrong margin.
 *
 * Data contract (design §2.6): org tutor cost in [from,to] = SUM(payroll_items.gross_amount) joined to
 * payroll_periods WHERE the PERIOD status ∈ {approved, paid} (draft is provisional → excluded so P&L
 * never jumps on recompute) AND the period window overlaps [from,to], grouped by user_id + a grand total.
 * Cash-basis window semantics mirror revenue.
 *
 * SQLite-safe: plain BETWEEN / comparison on date columns, grouping in PHP where needed — never MySQL
 * DATE_FORMAT (design §6 risk 8).
 */
class PayrollCostReader
{
    /** Period statuses that are "chosen" numbers finance may consume (design §2.6). */
    public const FINALIZED_STATUSES = [PayrollPeriod::STATUS_APPROVED, PayrollPeriod::STATUS_PAID];

    /**
     * Whether payroll has landed at all. When false every reader method returns 0 + available:false so
     * finance stays truthful (design §2.6 fail-soft) rather than reporting a wrong margin.
     */
    public function available(): bool
    {
        return Schema::hasTable('payroll_items') && Schema::hasTable('payroll_periods');
    }

    /**
     * Org tutor cost in [$from,$to] = SUM(gross) of finalized (approved/paid) periods whose period_end
     * falls INSIDE the window's MONTHS (no partial-overlap double counting: a period is attributed to
     * exactly one month — the month it ENDS — so monthly rows reconcile to the summary), grouped by
     * user_id + grand total + a by_month allocation. An org with no approved/paid periods returns 0.
     *
     * @return array{available:bool,total:float,by_user:array<int,float>,by_month:array<string,float>}
     */
    public function tutorCost(int $orgId, string $from, string $to): array
    {
        if (! $this->available()) {
            return ['available' => false, 'total' => 0.0, 'by_user' => [], 'by_month' => []];
        }

        // Month-granular bounds: a current-month period (period_end = last day of the month) belongs to a
        // window whose $to is mid-month (e.g. today), because the period IS that month's payroll.
        // Time-suffixed like paidPayrollFlow: period_end is a DATETIME column on MySQL (and SQLite
        // stores the time too), so comparing against a bare date string would drop same-day rows.
        $fromBound = Carbon::parse($from)->startOfMonth()->toDateString().' 00:00:00';
        $toBound = Carbon::parse($to)->endOfMonth()->toDateString().' 23:59:59';

        $rows = $this->finalizedItems($orgId)
            ->where('payroll_periods.period_end', '>=', $fromBound)
            ->where('payroll_periods.period_end', '<=', $toBound)
            ->selectRaw('payroll_items.user_id as user_id, payroll_periods.period_end as period_end, payroll_items.gross_amount as gross_amount')
            ->get();

        $byUser = [];
        $byMonth = [];
        $total = 0.0;

        foreach ($rows as $row) {
            $amount = (float) $row->gross_amount;
            $total += $amount;
            $byUser[(int) $row->user_id] = ($byUser[(int) $row->user_id] ?? 0.0) + $amount;
            $month = Carbon::parse($row->period_end)->format('Y-m');
            $byMonth[$month] = ($byMonth[$month] ?? 0.0) + $amount;
        }

        return ['available' => true, 'total' => $total, 'by_user' => $byUser, 'by_month' => $byMonth];
    }

    /**
     * Outstanding (unpaid) payroll for payables — periods that are APPROVED (a committed liability the
     * center still owes) but NOT yet paid. Draft is provisional (not a liability yet); paid is settled.
     * This is the SAME reader truth as tutorCost minus the paid slice — payables does NOT fork the
     * payroll math (design §2.6). Point-in-time (no window). Fail-soft like the rest.
     *
     * @return array{available:bool,total:float,by_user:array<int,float>}
     */
    public function unpaidPayroll(int $orgId): array
    {
        if (! $this->available()) {
            return ['available' => false, 'total' => 0.0, 'by_user' => []];
        }

        $rows = $this->baseItems($orgId)
            ->where('payroll_periods.status', PayrollPeriod::STATUS_APPROVED)
            ->selectRaw('payroll_items.user_id as user_id, SUM(payroll_items.gross_amount) as total')
            ->groupBy('payroll_items.user_id')
            ->get();

        return $this->foldByUser($rows);
    }

    /**
     * Cash OUT for payroll in [$from,$to] = SUM(gross) of PAID periods whose paid_at falls in the window,
     * grouped by 'YYYY-MM' of paid_at (grouped in PHP — no DATE_FORMAT). Feeds the cashflow report's
     * money-out side (design §3.3). Fail-soft.
     *
     * @return array{available:bool,total:float,by_month:array<string,float>}
     */
    public function paidPayrollFlow(int $orgId, string $from, string $to): array
    {
        if (! $this->available()) {
            return ['available' => false, 'total' => 0.0, 'by_month' => []];
        }

        // Fetch each paid item's gross alongside its period's paid_at, then bucket by month in PHP.
        $rows = $this->baseItems($orgId)
            ->where('payroll_periods.status', PayrollPeriod::STATUS_PAID)
            ->whereNotNull('payroll_periods.paid_at')
            ->where('payroll_periods.paid_at', '>=', $from.' 00:00:00')
            ->where('payroll_periods.paid_at', '<=', $to.' 23:59:59')
            ->selectRaw('payroll_periods.paid_at as paid_at, payroll_items.gross_amount as gross_amount')
            ->get();

        $byMonth = [];
        $total = 0.0;
        foreach ($rows as $row) {
            $month = Carbon::parse($row->paid_at)->format('Y-m');
            $amount = (float) $row->gross_amount;
            $byMonth[$month] = ($byMonth[$month] ?? 0.0) + $amount;
            $total += $amount;
        }

        return ['available' => true, 'total' => $total, 'by_month' => $byMonth];
    }

    /**
     * Org-scoped payroll_items joined to their period, soft-deletes on BOTH tables respected. This is the
     * ONLY place the join + org filter lives (design §2.6 "one reader").
     */
    private function baseItems(int $orgId): Builder
    {
        return PayrollItem::query()
            ->join('payroll_periods', 'payroll_periods.id', '=', 'payroll_items.payroll_period_id')
            ->where('payroll_items.organization_id', $orgId) // hard org scope — B never leaks into A
            ->whereNull('payroll_periods.deleted_at');
    }

    /** baseItems() narrowed to finalized (approved/paid) periods — the P&L-consumable slice. */
    private function finalizedItems(int $orgId): Builder
    {
        return $this->baseItems($orgId)
            ->whereIn('payroll_periods.status', self::FINALIZED_STATUSES);
    }

    /**
     * Fold a (user_id,total) aggregate result into the standard shape.
     *
     * @param  Collection<int,object>  $rows
     * @return array{available:bool,total:float,by_user:array<int,float>}
     */
    private function foldByUser($rows): array
    {
        $byUser = [];
        $total = 0.0;
        foreach ($rows as $row) {
            $amount = (float) $row->total;
            $byUser[(int) $row->user_id] = $amount;
            $total += $amount;
        }

        return ['available' => true, 'total' => $total, 'by_user' => $byUser];
    }
}
