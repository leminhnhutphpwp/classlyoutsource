<?php

namespace Tests\Feature\Organization;

use App\Models\CenterExpense;
use App\Models\ClassRoom;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\Payment;
use App\Models\PayrollItem;
use App\Models\PayrollPeriod;
use App\Models\User;
use App\Services\Finance\PayrollCostReader;
use Tests\TestCase;

/**
 * WAVE 4 — FINANCE COMPLETE. Wires PayrollCostReader (the ONE payroll-truth reader) into finance: real
 * tutor cost in P&L, tutor-profitability, cashflow and payables. Money is HIGH-sensitivity so this is
 * adversarial + cross-org:
 *  - P&L: net = revenue − expenses − Σ(approved/paid gross); a DRAFT period is EXCLUDED; approved AND
 *    paid periods are INCLUDED; margin% correct; payroll_available:true.
 *  - Ex-member: their historical approved payslip STILL counts toward org tutor cost (immutable snapshot).
 *  - CROSS-org: org B's approved/paid payroll NEVER appears in org A's pnl/profitability/cashflow/
 *    payables; a member-tutor / student / parent are DENIED every finance endpoint (fail-closed).
 *  - cashflow in/out math; payables = unpaid payroll + unpaid expenses; tutor-profitability per-tutor
 *    margin incl. attributed expenses.
 *  - Export gated by data.export (in addition to reports.finance).
 * Mirrors the OrgFinanceReadTest / OrgPayrollSecurityTest harness. See design §2.6, §3.3, §6 (risks 8,10).
 */
class OrgFinanceCompleteTest extends TestCase
{
    /** Owner (is the org owner) + org + owner membership. */
    private function makeOrg(): array
    {
        $owner = $this->tutor();
        $org = Organization::factory()->ownedBy($owner)->create();
        OrganizationMember::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        return [$owner->fresh(), $org];
    }

    private function addMember(Organization $org, string $role): User
    {
        $user = $this->tutor();
        OrganizationMember::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $user->id,
            'org_role' => $role,
        ]);

        return $user->fresh();
    }

    private function orgClass(Organization $org, User $tutor, array $attrs = []): ClassRoom
    {
        return ClassRoom::factory()->create(array_merge([
            'tutor_id' => $tutor->id,
            'organization_id' => $org->id,
        ], $attrs));
    }

    private function paidPayment(ClassRoom $class, int $studentId, int $amount): Payment
    {
        return Payment::factory()->create([
            'student_id' => $studentId,
            'class_id' => $class->id,
            'status' => 'paid',
            'amount' => $amount,
            'payment_date' => now()->toDateString(),
        ]);
    }

    /**
     * A payslip of $gross for $user in a period of $periodStatus, anchored $monthsAgo months back (so
     * multiple periods per org don't collide on the unique window). Period status drives what the reader
     * consumes (approved/paid → P&L; approved → payable; paid+paid_at → cashflow out).
     */
    private function payslip(Organization $org, User $user, int $gross, string $periodStatus, int $monthsAgo = 0): PayrollItem
    {
        $anchor = now()->copy()->subMonths($monthsAgo);
        $period = PayrollPeriod::factory()->create([
            'organization_id' => $org->id,
            'status' => $periodStatus,
            'period_start' => $anchor->copy()->startOfMonth()->toDateString(),
            'period_end' => $anchor->copy()->endOfMonth()->toDateString(),
            'approved_at' => in_array($periodStatus, ['approved', 'paid'], true) ? $anchor : null,
            'paid_at' => $periodStatus === 'paid' ? $anchor : null,
        ]);

        return PayrollItem::factory()->create([
            'organization_id' => $org->id,
            'payroll_period_id' => $period->id,
            'user_id' => $user->id,
            'base_amount' => $gross,
            'gross_amount' => $gross,
            'status' => $periodStatus === 'draft' ? 'draft' : ($periodStatus === 'paid' ? 'paid' : 'approved'),
        ]);
    }

    private function assertDenied($response): void
    {
        $this->assertContains($response->status(), [403, 404], 'expected a fail-closed denial (403/404), got '.$response->status());
    }

    // =============================================================================================
    // P&L — real tutor cost; draft excluded; approved/paid included; margin + payroll_available.
    // =============================================================================================

    public function test_pnl_subtracts_only_finalized_payroll_and_computes_margin(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');
        $class = $this->orgClass($org, $tutor);
        $student = $this->studentInClass($class, ['created_by' => $tutor->id]);

        $this->paidPayment($class, $student->id, 1000000);
        CenterExpense::factory()->create([
            'organization_id' => $org->id, 'category' => 'rent', 'amount' => 400000,
            'expense_date' => now()->toDateString(), 'created_by' => $owner->id,
        ]);

        // Approved payslip 300,000 counts; a DRAFT payslip 500,000 (last month) is excluded.
        $this->payslip($org, $tutor, 300000, 'approved');
        $this->payslip($org, $tutor, 500000, 'draft', 1);

        // net = 1,000,000 − 400,000 − 300,000 = 300,000; margin = 30%.
        $this->actingAsApi($owner)
            ->getJson('/api/v1/reports/finance/pnl')
            ->assertStatus(200)
            ->assertJsonPath('data.payroll_available', true)
            ->assertJsonPath('data.summary.total_revenue', 1000000)
            ->assertJsonPath('data.summary.total_expenses', 400000)
            ->assertJsonPath('data.summary.tutor_cost', 300000)
            ->assertJsonPath('data.summary.net_profit', 300000)
            ->assertJsonPath('data.summary.margin_pct', 30);
    }

    public function test_pnl_includes_paid_period_in_tutor_cost(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');

        $this->payslip($org, $tutor, 200000, 'paid');

        $this->actingAsApi($owner)
            ->getJson('/api/v1/reports/finance/pnl')
            ->assertStatus(200)
            ->assertJsonPath('data.summary.tutor_cost', 200000);
    }

    public function test_ex_member_historical_payslip_still_counts_toward_org_tutor_cost(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');
        $this->payslip($org, $tutor, 300000, 'approved');

        // The member leaves the org — the payslip snapshot (org_id + user_id on the row) is immutable.
        OrganizationMember::where('organization_id', $org->id)->where('user_id', $tutor->id)
            ->update(['status' => 'removed']);

        // Owner's P&L STILL includes the ex-member's finalized cost (the reader keys off the row, not
        // current membership).
        $this->actingAsApi($owner)
            ->getJson('/api/v1/reports/finance/pnl')
            ->assertStatus(200)
            ->assertJsonPath('data.summary.tutor_cost', 300000);
    }

    // =============================================================================================
    // CROSS-org — org B's payroll never bleeds into org A's finance.
    // =============================================================================================

    public function test_org_b_payroll_never_appears_in_org_a_finance(): void
    {
        [$ownerA, $orgA] = $this->makeOrg();
        $tutorA = $this->addMember($orgA, 'tutor');
        [$ownerB, $orgB] = $this->makeOrg();
        $tutorB = $this->addMember($orgB, 'tutor');

        // A: approved 100,000 + paid 50,000 (prev month). B: approved 999,999 + paid 888,888.
        $this->payslip($orgA, $tutorA, 100000, 'approved');
        $this->payslip($orgA, $tutorA, 50000, 'paid', 1);
        $this->payslip($orgB, $tutorB, 999999, 'approved');
        $this->payslip($orgB, $tutorB, 888888, 'paid', 1);

        // P&L: A's tutor cost = 100,000 + 50,000 = 150,000 (NEVER B's numbers).
        $this->actingAsApi($ownerA)
            ->getJson('/api/v1/reports/finance/pnl')
            ->assertStatus(200)
            ->assertJsonPath('data.summary.tutor_cost', 150000);

        // Tutor-profitability: A's total payroll cost = 150,000.
        $this->actingAsApi($ownerA)
            ->getJson('/api/v1/reports/finance/tutor-profitability')
            ->assertStatus(200)
            ->assertJsonPath('data.summary.total_payroll_cost', 150000);

        // Cashflow: A's paid payroll out = 50,000 (only A's paid period).
        $this->actingAsApi($ownerA)
            ->getJson('/api/v1/reports/finance/cashflow')
            ->assertStatus(200)
            ->assertJsonPath('data.summary.payroll_out', 50000);

        // Payables: A's unpaid (approved) payroll = 100,000.
        $this->actingAsApi($ownerA)
            ->getJson('/api/v1/reports/finance/payables')
            ->assertStatus(200)
            ->assertJsonPath('data.summary.payroll_payable', 100000);
    }

    public function test_accountant_sees_own_org_finance_only(): void
    {
        [$ownerA, $orgA] = $this->makeOrg();
        $accountantA = $this->addMember($orgA, 'accountant');
        $tutorA = $this->addMember($orgA, 'tutor');
        $this->payslip($orgA, $tutorA, 120000, 'approved');

        [$ownerB, $orgB] = $this->makeOrg();
        $tutorB = $this->addMember($orgB, 'tutor');
        $this->payslip($orgB, $tutorB, 777777, 'approved');

        // Accountant of A reads A's finance (derived from their membership) — B's payroll is invisible.
        $this->actingAsApi($accountantA)
            ->getJson('/api/v1/reports/finance/pnl')
            ->assertStatus(200)
            ->assertJsonPath('data.summary.tutor_cost', 120000);
    }

    // =============================================================================================
    // Fail-closed — member-tutor / student / parent DENIED every finance endpoint (incl. new ones).
    // =============================================================================================

    public function test_member_tutor_denied_all_finance_endpoints(): void
    {
        [, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');

        foreach (['pnl', 'tutor-profitability', 'cashflow', 'payables'] as $report) {
            $this->assertDenied($this->actingAsApi($tutor)->getJson("/api/v1/reports/finance/{$report}"));
            $this->assertDenied($this->actingAsApi($tutor)->getJson("/api/v1/reports/finance/{$report}/export?format=csv"));
        }
    }

    public function test_student_and_parent_denied_all_finance_endpoints(): void
    {
        $this->makeOrg();
        $student = $this->studentUser();
        $parent = $this->guardian();

        foreach ([$student, $parent] as $outsider) {
            foreach (['tutor-profitability', 'cashflow', 'payables'] as $report) {
                $this->assertDenied($this->actingAsApi($outsider)->getJson("/api/v1/reports/finance/{$report}"));
            }
        }
    }

    // =============================================================================================
    // Tutor-profitability — per-tutor margin incl. attributed expenses.
    // =============================================================================================

    public function test_tutor_profitability_per_tutor_margin_with_attributed_expense(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');
        $class = $this->orgClass($org, $tutor);
        $student = $this->studentInClass($class, ['created_by' => $tutor->id]);

        // Revenue 1,000,000 on the tutor's class; payroll 300,000; expense attributed to the tutor 50,000.
        $this->paidPayment($class, $student->id, 1000000);
        $this->payslip($org, $tutor, 300000, 'approved');
        CenterExpense::factory()->create([
            'organization_id' => $org->id, 'category' => 'equipment', 'amount' => 50000,
            'tutor_id' => $tutor->id, 'expense_date' => now()->toDateString(), 'created_by' => $owner->id,
        ]);

        $res = $this->actingAsApi($owner)
            ->getJson('/api/v1/reports/finance/tutor-profitability')
            ->assertStatus(200)
            ->assertJsonPath('data.summary.total_revenue', 1000000)
            ->assertJsonPath('data.summary.total_payroll_cost', 300000)
            ->assertJsonPath('data.summary.total_attributed_expenses', 50000)
            ->assertJsonPath('data.summary.total_margin', 650000);

        // The tutor's own row: margin = 1,000,000 − 300,000 − 50,000 = 650,000.
        $rows = collect($res->json('data.tutors'));
        $row = $rows->firstWhere('tutor_id', $tutor->hash_id);
        $this->assertNotNull($row);
        $this->assertSame(1000000.0, (float) $row['revenue']);
        $this->assertSame(300000.0, (float) $row['payroll_cost']);
        $this->assertSame(50000.0, (float) $row['attributed_expenses']);
        $this->assertSame(650000.0, (float) $row['margin']);
    }

    // =============================================================================================
    // Cashflow — in/out/net math.
    // =============================================================================================

    public function test_cashflow_in_out_and_net(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');
        $class = $this->orgClass($org, $tutor);
        $student = $this->studentInClass($class, ['created_by' => $tutor->id]);

        // IN: paid payment 1,000,000. OUT: expense 400,000 + paid payroll 300,000 = 700,000.
        $this->paidPayment($class, $student->id, 1000000);
        CenterExpense::factory()->create([
            'organization_id' => $org->id, 'category' => 'rent', 'amount' => 400000,
            'expense_date' => now()->toDateString(), 'created_by' => $owner->id,
        ]);
        $this->payslip($org, $tutor, 300000, 'paid');

        $this->actingAsApi($owner)
            ->getJson('/api/v1/reports/finance/cashflow')
            ->assertStatus(200)
            ->assertJsonPath('data.summary.total_in', 1000000)
            ->assertJsonPath('data.summary.expense_out', 400000)
            ->assertJsonPath('data.summary.payroll_out', 300000)
            ->assertJsonPath('data.summary.total_out', 700000)
            ->assertJsonPath('data.summary.net_flow', 300000);
    }

    // =============================================================================================
    // Payables — unpaid payroll + unpaid expenses (paid ones excluded).
    // =============================================================================================

    public function test_payables_unpaid_payroll_plus_unpaid_expenses(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');

        // Unpaid (approved) payroll 500,000; a PAID period 111,111 is settled → excluded.
        $this->payslip($org, $tutor, 500000, 'approved');
        $this->payslip($org, $tutor, 111111, 'paid', 1);

        // Unpaid expense (no payment_method) 400,000; a disbursed expense (cash) 999,999 → excluded.
        CenterExpense::factory()->unpaid()->create([
            'organization_id' => $org->id, 'category' => 'rent', 'amount' => 400000,
            'expense_date' => now()->toDateString(), 'created_by' => $owner->id,
        ]);
        CenterExpense::factory()->create([
            'organization_id' => $org->id, 'category' => 'utilities', 'amount' => 999999,
            'expense_date' => now()->toDateString(), 'payment_method' => 'cash', 'created_by' => $owner->id,
        ]);

        $this->actingAsApi($owner)
            ->getJson('/api/v1/reports/finance/payables')
            ->assertStatus(200)
            ->assertJsonPath('data.payroll_available', true)
            ->assertJsonPath('data.summary.payroll_payable', 500000)
            ->assertJsonPath('data.summary.expense_payable', 400000)
            ->assertJsonPath('data.summary.total_payable', 900000);
    }

    // =============================================================================================
    // Reader — direct unit-style tests (empty org = 0, not an error; org-scoped grand total).
    // =============================================================================================

    public function test_reader_returns_zero_for_org_with_no_finalized_periods(): void
    {
        [, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');
        // Only a DRAFT period exists → nothing finalized → cost 0 (available true, not an error).
        $this->payslip($org, $tutor, 500000, 'draft');

        $reader = app(PayrollCostReader::class);
        $cost = $reader->tutorCost($org->id, now()->subYear()->toDateString(), now()->toDateString());

        $this->assertTrue($cost['available']);
        $this->assertSame(0.0, $cost['total']);
        $this->assertSame([], $cost['by_user']);
    }

    public function test_reader_grand_total_and_by_user_are_org_scoped(): void
    {
        [, $orgA] = $this->makeOrg();
        $t1 = $this->addMember($orgA, 'tutor');
        $t2 = $this->addMember($orgA, 'tutor');
        [, $orgB] = $this->makeOrg();
        $tb = $this->addMember($orgB, 'tutor');

        $this->payslip($orgA, $t1, 100000, 'approved');
        $this->payslip($orgA, $t2, 200000, 'paid', 1);
        $this->payslip($orgB, $tb, 999999, 'approved'); // must NOT leak into A

        $reader = app(PayrollCostReader::class);
        $cost = $reader->tutorCost($orgA->id, now()->subYear()->toDateString(), now()->toDateString());

        $this->assertSame(300000.0, $cost['total']);
        $this->assertSame(100000.0, $cost['by_user'][$t1->id]);
        $this->assertSame(200000.0, $cost['by_user'][$t2->id]);
        $this->assertArrayNotHasKey($tb->id, $cost['by_user']);
    }

    // =============================================================================================
    // Export — runs end-to-end on SQLite.
    // =============================================================================================

    public function test_finance_export_succeeds_with_both_capabilities(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');
        $class = $this->orgClass($org, $tutor);
        $student = $this->studentInClass($class, ['created_by' => $tutor->id]);
        $this->paidPayment($class, $student->id, 1000000);
        $this->payslip($org, $tutor, 300000, 'approved');

        foreach (['pnl', 'tutor-profitability', 'cashflow', 'payables'] as $report) {
            $res = $this->actingAsApi($owner)
                ->get("/api/v1/reports/finance/{$report}/export?format=csv");
            $res->assertStatus(200);
            $this->assertStringContainsString('text/csv', $res->headers->get('content-type'));
        }
    }

    public function test_finance_export_rejects_unknown_report(): void
    {
        [$owner] = $this->makeOrg();
        // Route constraint blocks anything outside the exportable set → 404.
        $this->actingAsApi($owner)
            ->get('/api/v1/reports/finance/not-a-report/export?format=csv')
            ->assertStatus(404);
    }
}
