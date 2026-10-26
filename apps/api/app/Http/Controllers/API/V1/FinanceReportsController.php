<?php

namespace App\Http\Controllers\API\V1;

use App\Models\CenterExpense;
use App\Models\ClassRoom;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\PaymentRequest;
use App\Models\User;
use App\Services\Finance\PayrollCostReader;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Consolidated FINANCE reports for a center (trung tâm) — Wave 2 (read + expenses) → Wave 4 (complete).
 * Deliberately a SEPARATE controller from ReportsController (which stays teaching/ops reports) so neither
 * bloats the other. Every endpoint is gated by the triple (design G3): capability `reports.finance` →
 * org-role (owner/manager/accountant) → org-context (derived from the caller's membership, never the URL).
 *
 * Money is HIGH-sensitivity: revenue is org-scoped through the class→organization anchor, expenses via
 * center_expenses.organization_id, tutor cost via PayrollCostReader (the ONE reader — org-scoped +
 * fail-soft). A solo class (organization_id NULL) can never match a concrete org id, so it stays
 * invisible. P&L is CASH-basis (paid + payment_date; matches DashboardController).
 *
 * Wave 4 wires PayrollCostReader in: P&L now subtracts real tutor cost (approved/paid payroll) and
 * reports payroll_available from the reader; tutor-profitability, cashflow and payables consume the SAME
 * reader so the payroll truth is never forked (design §2.6). NO MySQL DATE_FORMAT anywhere — every group
 * is a YYYY-MM computed in PHP — so the whole controller runs on SQLite (design §6 risk 8).
 */
class FinanceReportsController extends BaseController
{
    private const CAPABILITY = 'reports.finance';

    private const ROLES = ['owner', 'manager', 'accountant'];

    /** Which finance reports may be exported (design §3.3). */
    private const EXPORTABLE = ['pnl', 'tutor-profitability', 'cashflow', 'payables'];

    /**
     * GET reports/finance/pnl — cash-basis P&L for the caller's org.
     * net = revenue (paid payments) − expenses (center_expenses) − tutor cost (approved/paid payroll).
     * Grouped by month WITHOUT MySQL DATE_FORMAT (YYYY-MM computed in PHP) so it runs on SQLite too.
     */
    public function pnl(Request $request): JsonResponse
    {
        [$org, $denied] = $this->financeContext();
        if ($denied) {
            return $denied;
        }
        if ($rangeError = $this->validateRange($request, $from, $to)) {
            return $rangeError;
        }

        return $this->successResponse($this->pnlData($org, $from, $to));
    }

    /**
     * GET reports/finance/tutor-profitability — per tutor: revenue of their org classes (paid payments)
     * − their payroll cost (from the reader, per user_id) − expenses attributed to them
     * (center_expenses.tutor_id) = margin. Reuses the orgOwnerDashboard per-member loop shape but
     * aggregates revenue/expenses in ONE grouped query each (no per-member accessor loop → no N+1).
     */
    public function tutorProfitability(Request $request): JsonResponse
    {
        [$org, $denied] = $this->financeContext();
        if ($denied) {
            return $denied;
        }
        if ($rangeError = $this->validateRange($request, $from, $to)) {
            return $rangeError;
        }

        return $this->successResponse($this->tutorProfitabilityData($org, $from, $to));
    }

    /**
     * GET reports/finance/cashflow — money IN (paid payments by payment_date) vs money OUT (center
     * expenses by expense_date + PAID payroll by paid_at), net flow, grouped by month in PHP.
     */
    public function cashflow(Request $request): JsonResponse
    {
        [$org, $denied] = $this->financeContext();
        if ($denied) {
            return $denied;
        }
        if ($rangeError = $this->validateRange($request, $from, $to)) {
            return $rangeError;
        }

        return $this->successResponse($this->cashflowData($org, $from, $to));
    }

    /**
     * GET reports/finance/payables — outstanding money the center OWES: unpaid (approved-not-paid)
     * payroll via the reader + center expenses not yet disbursed (payment_method NULL). Fail-soft when
     * the payroll table is absent (payroll_available:false, payroll payable 0).
     */
    public function payables(Request $request): JsonResponse
    {
        [$org, $denied] = $this->financeContext();
        if ($denied) {
            return $denied;
        }

        return $this->successResponse($this->payablesData($org));
    }

    /**
     * GET reports/finance/{report}/export — CSV/Excel export of a finance report. Gated by the finance
     * triple HERE (reports.finance + org-role + org-context) AND by `data.export` inside handleExport()
     * (design §3.3). The data builders are SQLite-safe (no DATE_FORMAT), so the export runs end-to-end.
     */
    public function export(Request $request, string $report)
    {
        if (! in_array($report, self::EXPORTABLE, true)) {
            return $this->errorResponse('Báo cáo không hợp lệ', null, 'NOT_FOUND', 404);
        }

        [$org, $denied] = $this->financeContext();
        if ($denied) {
            return $denied;
        }

        // 'payables' is a point-in-time snapshot; the others take a date window.
        if ($report !== 'payables') {
            if ($rangeError = $this->validateRange($request, $from, $to)) {
                return $rangeError;
            }
        }

        $data = match ($report) {
            'pnl' => $this->pnlData($org, $from, $to),
            'tutor-profitability' => $this->tutorProfitabilityData($org, $from, $to),
            'cashflow' => $this->cashflowData($org, $from, $to),
            'payables' => $this->payablesData($org),
        };

        // Reuse ReportsController::handleExport (gates data.export + logs a DataJob + renders CSV/Excel).
        return app(ReportsController::class)->handleExport($request, 'finance-'.$report, fn () => $data);
    }

    // =================================================================================================
    // DATA BUILDERS — shared by the JSON endpoints and the export path (single source per report).
    // =================================================================================================

    /**
     * Cash-basis P&L data. net = revenue − expenses − tutor cost; margin% = net / revenue. tutor cost +
     * payroll_available come from PayrollCostReader (fail-soft: 0 + false when payroll hasn't landed).
     * CASH semantics: only SETTLED expenses (disbursed) count as money out; unpaid bills are payables.
     * by_month now includes the month's tutor cost so the monthly rows reconcile EXACTLY to the summary.
     */
    private function pnlData(Organization $org, string $from, string $to): array
    {
        // --- Revenue: paid payments in range, org-scoped via the class→organization anchor. ---
        $payments = Payment::query()
            ->where('status', 'paid')
            ->whereNotNull('payment_date')
            ->whereBetween('payment_date', [$from, $to])
            ->whereHas('class', fn ($q) => $q->where('organization_id', $org->id))
            ->get(['payment_date', 'amount']);

        // --- Expenses: SETTLED (disbursed) center_expenses, by paid_at, org-scoped. ---
        $expenses = CenterExpense::query()
            ->where('organization_id', $org->id)
            ->where('settlement_status', CenterExpense::SETTLEMENT_SETTLED)
            ->whereNotNull('paid_at')
            ->whereBetween('paid_at', [$from, $to])
            ->get(['paid_at', 'amount', 'category']);

        // --- Tutor cost: the ONE reader (finalized payroll by period_end in window), org-scoped. ---
        $cost = app(PayrollCostReader::class)->tutorCost($org->id, $from, $to);

        // Group by month in PHP (portable — no DATE_FORMAT). Key = 'YYYY-MM'.
        $revenueByMonth = $payments
            ->groupBy(fn ($p) => $p->payment_date->format('Y-m'))
            ->map(fn ($g) => (float) $g->sum('amount'));

        $expenseByMonth = $expenses
            ->groupBy(fn ($e) => $e->paid_at->format('Y-m'))
            ->map(fn ($g) => (float) $g->sum('amount'));

        $payrollByMonth = $cost['by_month'];

        $months = $revenueByMonth->keys()
            ->merge($expenseByMonth->keys())
            ->merge(array_keys($payrollByMonth))
            ->unique()->sort()->values();

        // by_month is the FULL profit view (revenue − settled expenses − payroll), so the rows sum to
        // the summary exactly — a chart never disagrees with the headline net.
        $byMonth = $months->map(function ($month) use ($revenueByMonth, $expenseByMonth, $payrollByMonth) {
            $revenue = (float) ($revenueByMonth[$month] ?? 0);
            $expense = (float) ($expenseByMonth[$month] ?? 0);
            $payroll = (float) ($payrollByMonth[$month] ?? 0);
            $net = $revenue - $expense - $payroll;

            return [
                'month' => $month,
                'revenue' => $revenue,
                'expenses' => $expense,
                'tutor_cost' => $payroll,
                'net_profit' => $net,
                'margin_pct' => $revenue > 0 ? round(($net / $revenue) * 100, 2) : null,
            ];
        });

        $expenseByCategory = $expenses
            ->groupBy('category')
            ->map(fn ($g, $cat) => [
                'category' => $cat,
                'total' => (float) $g->sum('amount'),
            ])
            ->values();

        $totalRevenue = (float) $payments->sum('amount');
        $totalExpenses = (float) $expenses->sum('amount');
        $tutorCost = (float) $cost['total'];
        $netProfit = $totalRevenue - $totalExpenses - $tutorCost;

        return [
            'basis' => 'cash', // revenue = paid payments by payment_date; expenses = settled by paid_at
            'payroll_available' => $cost['available'], // true once payroll_items exists (design §2.6)
            'period' => ['from' => $from, 'to' => $to],
            'summary' => [
                'total_revenue' => $totalRevenue,
                'total_expenses' => $totalExpenses,
                'tutor_cost' => $tutorCost, // real payroll cost (approved/paid) — 0 fail-soft otherwise
                'net_profit' => $netProfit,
                'margin_pct' => $totalRevenue > 0 ? round(($netProfit / $totalRevenue) * 100, 2) : null,
            ],
            'by_month' => $byMonth,
            'expenses_by_category' => $expenseByCategory,
        ];
    }

    /**
     * Per-tutor profitability. Revenue + attributed expenses are each ONE grouped query keyed by tutor;
     * payroll cost comes from the reader keyed by user_id — then the member loop reads from those maps so
     * NO query fires per member (design R10 N+1).
     */
    private function tutorProfitabilityData(Organization $org, string $from, string $to): array
    {
        // Revenue per tutor = paid payments on the org's classes in window, grouped by classes.tutor_id.
        $revenueByTutor = Payment::query()
            ->join('classes', 'classes.id', '=', 'payments.class_id')
            ->where('payments.status', 'paid')
            ->whereNotNull('payments.payment_date')
            ->whereBetween('payments.payment_date', [$from, $to])
            ->where('classes.organization_id', $org->id)
            ->whereNull('classes.deleted_at')
            ->groupBy('classes.tutor_id')
            ->selectRaw('classes.tutor_id as tutor_id, SUM(payments.amount) as total')
            ->pluck('total', 'tutor_id');

        // Expenses attributed directly to a tutor (center_expenses.tutor_id) — SETTLED only, by paid_at
        // (unpaid bills are payables, not cash spent), grouped by tutor.
        $expenseByTutor = CenterExpense::query()
            ->where('organization_id', $org->id)
            ->whereNotNull('tutor_id')
            ->where('settlement_status', CenterExpense::SETTLEMENT_SETTLED)
            ->whereNotNull('paid_at')
            ->whereBetween('paid_at', [$from, $to])
            ->groupBy('tutor_id')
            ->selectRaw('tutor_id, SUM(amount) as total')
            ->pluck('total', 'tutor_id');

        // Payroll cost per user from the ONE reader (approved/paid, org-scoped, fail-soft).
        $cost = app(PayrollCostReader::class)->tutorCost($org->id, $from, $to);
        $payrollByUser = $cost['by_user'];

        $rows = [];
        $totRevenue = 0.0;
        $totPayroll = 0.0;
        $totExpense = 0.0;

        foreach ($org->activeMembers()->with('user')->get() as $member) {
            $memberUser = $member->user;
            if (! $memberUser) {
                continue;
            }
            $uid = $memberUser->id;

            $revenue = (float) ($revenueByTutor[$uid] ?? 0);
            $payroll = (float) ($payrollByUser[$uid] ?? 0);
            $expense = (float) ($expenseByTutor[$uid] ?? 0);
            $margin = $revenue - $payroll - $expense;

            $totRevenue += $revenue;
            $totPayroll += $payroll;
            $totExpense += $expense;

            $rows[] = [
                'tutor_id' => $memberUser->hash_id ?? null,
                'tutor_name' => $memberUser->name,
                'org_role' => $member->org_role,
                'revenue' => $revenue,
                'payroll_cost' => $payroll,
                'attributed_expenses' => $expense,
                'margin' => $margin,
                'margin_pct' => $revenue > 0 ? round(($margin / $revenue) * 100, 2) : null,
            ];
        }

        return [
            'basis' => 'cash',
            'payroll_available' => $cost['available'],
            'period' => ['from' => $from, 'to' => $to],
            'summary' => [
                'total_revenue' => $totRevenue,
                'total_payroll_cost' => $totPayroll,
                'total_attributed_expenses' => $totExpense,
                'total_margin' => $totRevenue - $totPayroll - $totExpense,
            ],
            'tutors' => $rows,
        ];
    }

    /**
     * Cash-flow data: money IN (paid payments by payment_date) vs money OUT (center expenses by
     * expense_date + PAID payroll by paid_at). Everything grouped by 'YYYY-MM' in PHP (no DATE_FORMAT).
     */
    private function cashflowData(Organization $org, string $from, string $to): array
    {
        $inByMonth = Payment::query()
            ->where('status', 'paid')
            ->whereNotNull('payment_date')
            ->whereBetween('payment_date', [$from, $to])
            ->whereHas('class', fn ($q) => $q->where('organization_id', $org->id))
            ->get(['payment_date', 'amount'])
            ->groupBy(fn ($p) => $p->payment_date->format('Y-m'))
            ->map(fn ($g) => (float) $g->sum('amount'));

        $expenseOutByMonth = CenterExpense::query()
            ->where('organization_id', $org->id)
            ->where('settlement_status', CenterExpense::SETTLEMENT_SETTLED)
            ->whereNotNull('paid_at')
            ->whereBetween('paid_at', [$from, $to])
            ->get(['paid_at', 'amount'])
            ->groupBy(fn ($e) => $e->paid_at->format('Y-m'))
            ->map(fn ($g) => (float) $g->sum('amount'));

        // Paid payroll out via the ONE reader (paid periods by paid_at, month-bucketed, fail-soft).
        $payroll = app(PayrollCostReader::class)->paidPayrollFlow($org->id, $from, $to);
        $payrollOutByMonth = $payroll['by_month'];

        $months = collect($inByMonth->keys())
            ->merge($expenseOutByMonth->keys())
            ->merge(array_keys($payrollOutByMonth))
            ->unique()->sort()->values();

        $byMonth = $months->map(function ($month) use ($inByMonth, $expenseOutByMonth, $payrollOutByMonth) {
            $in = (float) ($inByMonth[$month] ?? 0);
            $expenseOut = (float) ($expenseOutByMonth[$month] ?? 0);
            $payrollOut = (float) ($payrollOutByMonth[$month] ?? 0);
            $out = $expenseOut + $payrollOut;

            return [
                'month' => $month,
                'money_in' => $in,
                'money_out' => $out,
                'expense_out' => $expenseOut,
                'payroll_out' => $payrollOut,
                'net_flow' => $in - $out,
            ];
        });

        $totalIn = (float) $inByMonth->sum();
        $totalExpenseOut = (float) $expenseOutByMonth->sum();
        $totalPayrollOut = (float) $payroll['total'];
        $totalOut = $totalExpenseOut + $totalPayrollOut;

        return [
            'basis' => 'cash',
            'payroll_available' => $payroll['available'],
            'period' => ['from' => $from, 'to' => $to],
            'summary' => [
                'total_in' => $totalIn,
                'total_out' => $totalOut,
                'expense_out' => $totalExpenseOut,
                'payroll_out' => $totalPayrollOut,
                'net_flow' => $totalIn - $totalOut,
            ],
            'by_month' => $byMonth,
        ];
    }

    /**
     * Payables (money owed, not yet paid): unpaid (approved-not-paid) payroll via the reader + center
     * expenses not yet disbursed (payment_method NULL). Fail-soft on payroll.
     */
    private function payablesData(Organization $org): array
    {
        $payroll = app(PayrollCostReader::class)->unpaidPayroll($org->id);
        $payrollTotal = (float) $payroll['total'];

        // An expense with settlement_status=unpaid is a bill not yet disbursed (a payable).
        $unpaidExpenses = CenterExpense::query()
            ->where('organization_id', $org->id)
            ->where('settlement_status', CenterExpense::SETTLEMENT_UNPAID)
            ->get(['id', 'category', 'amount', 'expense_date', 'description']);

        $expenseTotal = (float) $unpaidExpenses->sum('amount');

        $expenseRows = $unpaidExpenses->map(fn ($e) => [
            '_id' => $e->hash_id,
            'category' => $e->category,
            'amount' => (float) $e->amount,
            'expense_date' => $e->expense_date?->toDateString(),
            'description' => $e->description,
        ])->values();

        // Resolve the unpaid-payroll user_ids to names in ONE query (no per-row lookup).
        $userIds = array_keys($payroll['by_user']);
        $names = $userIds
            ? User::whereIn('id', $userIds)->pluck('name', 'id')
            : collect();

        $payrollRows = collect($payroll['by_user'])->map(fn ($amount, $uid) => [
            'tutor_id' => User::encodeId((int) $uid),
            'tutor_name' => $names[$uid] ?? null,
            'amount' => (float) $amount,
        ])->values();

        return [
            'payroll_available' => $payroll['available'],
            'summary' => [
                'total_payable' => $payrollTotal + $expenseTotal,
                'payroll_payable' => $payrollTotal,
                'expense_payable' => $expenseTotal,
            ],
            'payroll' => $payrollRows,
            'expenses' => $expenseRows,
        ];
    }

    /**
     * GET reports/finance/receivables — outstanding student billing (per PaymentRequest), aged.
     * Org-scoped via the class→organization anchor; reuses PaymentRequest::getStatusSummary() for the
     * per-request money shape. Eager-loads class.students + payments so getStatusSummary()'s
     * student-count reads hit LOADED relations instead of firing a query per row (design R10 N+1).
     */
    public function receivables(Request $request): JsonResponse
    {
        [$org, $denied] = $this->financeContext();
        if ($denied) {
            return $denied;
        }

        // The selected range filters receivables BY DUE DATE ("các khoản đến hạn trong kỳ") — previously
        // the range was silently ignored, which made the report contradict the filter the user chose.
        if ($rangeError = $this->validateRange($request, $from, $to)) {
            return $rangeError;
        }

        // Eager-load the exact relations getStatusSummary() reaches into: class.students (feeds the
        // loaded-path of getActiveStudentCount — the query it fired per row) and payments.
        $requests = PaymentRequest::query()
            ->whereHas('class', fn ($q) => $q->where('organization_id', $org->id))
            ->where('status', 'active')
            ->whereBetween('due_date', [$from, $to])
            ->with(['class.students', 'payments'])
            ->orderBy('due_date')
            ->get();

        $today = now()->startOfDay();

        // Aged buckets by how overdue each request is (days past due_date). "current" = not yet due.
        $buckets = [
            'current' => 0.0,
            'd1_30' => 0.0,
            'd31_60' => 0.0,
            'd61_90' => 0.0,
            'd90_plus' => 0.0,
        ];

        $totalOutstanding = 0.0;
        $rows = [];

        foreach ($requests as $pr) {
            $summary = $pr->getStatusSummary();
            $debt = (float) $summary['total_debt'];

            if ($debt <= 0) {
                continue; // fully collected → not a receivable
            }

            $totalOutstanding += $debt;

            $daysOverdue = $pr->due_date ? (int) $today->diffInDays($pr->due_date, false) * -1 : 0;
            $bucket = $this->agingBucket($daysOverdue);
            $buckets[$bucket] += $debt;

            $rows[] = [
                '_id' => $pr->hash_id,
                'class_id' => ClassRoom::encodeId($pr->class_id),
                'class_name' => $pr->class->name ?? null,
                'period_name' => $pr->period_name,
                'period_month' => $pr->period_month,
                'due_date' => $pr->due_date?->toDateString(),
                'days_overdue' => max(0, $daysOverdue),
                'aging_bucket' => $bucket,
                'total_expected' => (float) $summary['total_expected'],
                'total_collected' => (float) $summary['total_collected'],
                'outstanding' => $debt,
                'paid_students' => $summary['paid_students'],
                'unpaid_students' => $summary['unpaid_students'],
                'is_overdue' => $summary['is_overdue'],
            ];
        }

        return $this->successResponse([
            'basis' => 'accrual', // receivables are inherently expected-not-yet-collected (design §5 QĐ 7)
            'summary' => [
                'total_outstanding' => $totalOutstanding,
                'open_requests' => count($rows),
            ],
            'aging' => $buckets,
            'requests' => $rows,
        ]);
    }

    /**
     * Map days-overdue to an aging bucket. Negative / zero = not yet due ("current").
     */
    private function agingBucket(int $daysOverdue): string
    {
        return match (true) {
            $daysOverdue <= 0 => 'current',
            $daysOverdue <= 30 => 'd1_30',
            $daysOverdue <= 60 => 'd31_60',
            $daysOverdue <= 90 => 'd61_90',
            default => 'd90_plus',
        };
    }

    /**
     * Validate the optional date window + default to the trailing 12 months. Writes resolved bounds into
     * $from/$to (by reference). Returns a JsonResponse on failure, null on success.
     */
    private function validateRange(Request $request, &$from, &$to): ?JsonResponse
    {
        $validator = validator($request->all(), [
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d'],
        ]);
        if ($validator->fails()) {
            return $this->errorResponse('Định dạng dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        // Default window: the trailing 12 months (inclusive of the current month).
        $from = $request->filled('date_from') ? $request->date_from : now()->subMonths(11)->startOfMonth()->toDateString();
        $to = $request->filled('date_to') ? $request->date_to : now()->endOfMonth()->toDateString();

        if ($from > $to) {
            return $this->errorResponse('date_from phải nhỏ hơn hoặc bằng date_to', null, 'INVALID_DATE_RANGE', 422);
        }

        return null;
    }

    /**
     * Gate the finance triple and resolve the caller's org. Returns [Organization|null, ?JsonResponse].
     * Org-context here = the caller's own active org (there is no {organization} route param).
     */
    private function financeContext(): array
    {
        if ($denied = $this->requirePlanCapability(self::CAPABILITY)) {
            return [null, $denied];
        }
        if ($denied = $this->requireOrgRole(self::ROLES)) {
            return [null, $denied];
        }

        $org = $this->getAuthUser()?->currentOrganization();
        if (! $org instanceof Organization) {
            // Should be unreachable (requireOrgRole already asserts membership) — fail closed anyway.
            return [null, $this->errorResponse('Không tìm thấy tổ chức', null, 'NOT_FOUND', 404)];
        }

        return [$org, null];
    }
}
