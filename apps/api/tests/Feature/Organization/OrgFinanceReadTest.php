<?php

namespace Tests\Feature\Organization;

use App\Models\CenterExpense;
use App\Models\ClassRoom;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\Payment;
use App\Models\PaymentRequest;
use App\Models\Student;
use App\Models\User;
use Tests\TestCase;

/**
 * WAVE 2 — FINANCE READ + center expenses. Money is HIGH-sensitivity, so this suite is adversarial in
 * BOTH directions and cross-org:
 *  - UNDER-exposure: owner, manager AND accountant of org A MUST read A's revenue / expenses /
 *    receivables (a finance role that can't read finance is a silent regression).
 *  - OVER-exposure: a plain member-tutor and a student/parent are DENIED every finance endpoint
 *    (fail-closed); org B's money is invisible; a SOLO class (organization_id NULL) never appears.
 *  - CROSS-org: org B cannot read/mutate org A expenses even with a real hashid (404, no leak);
 *    expense create rejects a class_id / tutor_id from another org.
 *  - P&L math: revenue − expenses = net, cash-basis, payroll_available:false (Wave 3 not landed).
 * Mirrors the OrgAccountantIsolationTest harness. See design §2.5/§2.6/§3.3/§6 (risks 5,8,10).
 */
class OrgFinanceReadTest extends TestCase
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

    /**
     * A finance-populated org: owner + member tutor + accountant, one class with an enrolled student,
     * a paid payment (revenue = 1,000,000), an outstanding payment-request (expected 500,000, nothing
     * collected → receivable), and one center expense (400,000). Payment/expense dated today so the
     * default P&L window catches them.
     */
    private function seedOrg(): array
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');
        $accountant = $this->addMember($org, 'accountant');

        $class = $this->orgClass($org, $tutor);
        $student = $this->studentInClass($class, ['created_by' => $tutor->id]);

        $payment = Payment::factory()->create([
            'student_id' => $student->id,
            'class_id' => $class->id,
            'status' => 'paid',
            'amount' => 1000000,
            'payment_date' => now()->toDateString(),
        ]);

        $paymentRequest = PaymentRequest::create([
            'class_id' => $class->id,
            'created_by' => $tutor->id,
            'period_name' => 'Tháng 7/2026',
            'period_month' => '2026-07',
            'amount_per_student' => 500000,
            'due_date' => now()->subDays(10)->toDateString(), // overdue → an aged receivable
            'status' => 'active',
        ]);

        $expense = CenterExpense::factory()->create([
            'organization_id' => $org->id,
            'category' => 'rent',
            'amount' => 400000,
            'expense_date' => now()->toDateString(),
            'created_by' => $owner->id,
        ]);

        return compact('owner', 'org', 'tutor', 'accountant', 'class', 'student', 'payment', 'paymentRequest', 'expense');
    }

    private function assertDenied($response): void
    {
        $this->assertContains($response->status(), [403, 404], 'expected a fail-closed denial (403/404), got '.$response->status());
    }

    // =============================================================================================
    // UNDER-exposure — owner/manager/accountant MUST read org finance.
    // =============================================================================================

    public function test_owner_manager_accountant_all_read_pnl_and_receivables_and_expenses(): void
    {
        $data = $this->seedOrg();
        $manager = $this->addMember($data['org'], 'manager');

        foreach ([$data['owner'], $manager, $data['accountant']] as $viewer) {
            // P&L: revenue 1,000,000 − expenses 400,000 = net 600,000.
            $this->actingAsApi($viewer)
                ->getJson('/api/v1/reports/finance/pnl')
                ->assertStatus(200)
                ->assertJsonPath('data.summary.total_revenue', 1000000)
                ->assertJsonPath('data.summary.total_expenses', 400000)
                ->assertJsonPath('data.summary.net_profit', 600000);

            // Receivables: one open request, 500,000 outstanding.
            $this->actingAsApi($viewer)
                ->getJson('/api/v1/reports/finance/receivables')
                ->assertStatus(200)
                ->assertJsonPath('data.summary.total_outstanding', 500000)
                ->assertJsonPath('data.summary.open_requests', 1);

            // Expenses list.
            $this->actingAsApi($viewer)
                ->getJson("/api/v1/organizations/{$data['org']->hash_id}/expenses")
                ->assertStatus(200)
                ->assertJsonCount(1, 'data')
                ->assertJsonPath('data.0._id', $data['expense']->hash_id);
        }
    }

    public function test_pnl_is_cash_basis_and_payroll_available_after_wave3(): void
    {
        ['owner' => $owner] = $this->seedOrg();

        // Wave 3 landed the payroll_items table, so payroll_available flips to true (design §2.6 ties it
        // to Schema::hasTable). tutor_cost stays 0 here until Wave 4 wires PayrollCostReader into P&L.
        $this->actingAsApi($owner)
            ->getJson('/api/v1/reports/finance/pnl')
            ->assertStatus(200)
            ->assertJsonPath('data.basis', 'cash')
            ->assertJsonPath('data.payroll_available', true)
            ->assertJsonPath('data.summary.tutor_cost', 0);
    }

    // =============================================================================================
    // OVER-exposure — member-tutor / student / parent are DENIED finance.
    // =============================================================================================

    public function test_member_tutor_denied_finance(): void
    {
        ['org' => $org] = $this->seedOrg();
        $tutor = $this->addMember($org, 'tutor');

        $this->assertDenied($this->actingAsApi($tutor)->getJson('/api/v1/reports/finance/pnl'));
        $this->assertDenied($this->actingAsApi($tutor)->getJson('/api/v1/reports/finance/receivables'));
        $this->assertDenied($this->actingAsApi($tutor)->getJson("/api/v1/organizations/{$org->hash_id}/expenses"));
    }

    public function test_student_and_parent_denied_finance(): void
    {
        $this->seedOrg();
        $student = $this->studentUser();
        $parent = $this->guardian();

        foreach ([$student, $parent] as $outsider) {
            $this->assertDenied($this->actingAsApi($outsider)->getJson('/api/v1/reports/finance/pnl'));
            $this->assertDenied($this->actingAsApi($outsider)->getJson('/api/v1/reports/finance/receivables'));
        }
    }

    // =============================================================================================
    // CROSS-org — org B's money is invisible to org A; a solo class never appears.
    // =============================================================================================

    public function test_org_b_finance_invisible_to_org_a(): void
    {
        $a = $this->seedOrg();
        $b = $this->seedOrg();

        // A's P&L only sees A's numbers (not A+B).
        $this->actingAsApi($a['owner'])
            ->getJson('/api/v1/reports/finance/pnl')
            ->assertStatus(200)
            ->assertJsonPath('data.summary.total_revenue', 1000000)
            ->assertJsonPath('data.summary.total_expenses', 400000);

        // A's expense list is A only, never B's expense.
        $res = $this->actingAsApi($a['owner'])
            ->getJson("/api/v1/organizations/{$a['org']->hash_id}/expenses")
            ->assertStatus(200)
            ->assertJsonCount(1, 'data');
        $this->assertNotEquals($b['expense']->hash_id, $res->json('data.0._id'));
    }

    public function test_solo_class_revenue_never_appears_in_org_finance(): void
    {
        ['owner' => $owner] = $this->seedOrg();

        // A solo (non-org) tutor's paid payment must NEVER leak into the org P&L.
        $soloTutor = $this->tutor();
        $soloClass = ClassRoom::factory()->create(['tutor_id' => $soloTutor->id, 'organization_id' => null]);
        $soloStudent = $this->studentInClass($soloClass, ['created_by' => $soloTutor->id]);
        Payment::factory()->create([
            'student_id' => $soloStudent->id,
            'class_id' => $soloClass->id,
            'status' => 'paid',
            'amount' => 9999999,
            'payment_date' => now()->toDateString(),
        ]);

        // Revenue is still only the org's 1,000,000 — the solo 9,999,999 is invisible.
        $this->actingAsApi($owner)
            ->getJson('/api/v1/reports/finance/pnl')
            ->assertStatus(200)
            ->assertJsonPath('data.summary.total_revenue', 1000000);
    }

    // =============================================================================================
    // CROSS-org adversarial — expenses cannot be read/mutated across orgs, even with a real hashid.
    // =============================================================================================

    public function test_org_a_cannot_read_or_mutate_org_b_expense_by_real_hashid(): void
    {
        $a = $this->seedOrg();
        $b = $this->seedOrg();

        // Using A's own org URL but B's real expense hashid → fail-closed 404 (no existence leak).
        $this->actingAsApi($a['owner'])
            ->patchJson("/api/v1/organizations/{$a['org']->hash_id}/expenses/{$b['expense']->hash_id}", ['amount' => 1])
            ->assertStatus(404);

        $this->actingAsApi($a['owner'])
            ->deleteJson("/api/v1/organizations/{$a['org']->hash_id}/expenses/{$b['expense']->hash_id}")
            ->assertStatus(404);

        // Using B's org URL as A's owner → org-context (from membership) fails closed too.
        $this->actingAsApi($a['owner'])
            ->getJson("/api/v1/organizations/{$b['org']->hash_id}/expenses")
            ->assertStatus(404);

        // B's expense is untouched.
        $this->assertSame(400000, (int) $b['expense']->fresh()->amount);
    }

    // =============================================================================================
    // Expense create — accountant may write; cross-org attribution is rejected.
    // =============================================================================================

    public function test_accountant_can_create_expense(): void
    {
        ['org' => $org, 'accountant' => $accountant] = $this->seedOrg();

        $this->actingAsApi($accountant)
            ->postJson("/api/v1/organizations/{$org->hash_id}/expenses", [
                'category' => 'marketing',
                'amount' => 750000,
                'expense_date' => now()->toDateString(),
                'description' => 'Chạy quảng cáo Facebook',
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.category', 'marketing')
            ->assertJsonPath('data.amount', 750000);

        $this->assertDatabaseHas('center_expenses', [
            'organization_id' => $org->id,
            'category' => 'marketing',
            'amount' => 750000,
            'created_by' => $accountant->id,
        ]);
    }

    public function test_expense_create_rejects_cross_org_class_and_tutor(): void
    {
        $a = $this->seedOrg();
        $b = $this->seedOrg();

        // class_id belonging to org B → 422 (cross-org injection rejected).
        $this->actingAsApi($a['owner'])
            ->postJson("/api/v1/organizations/{$a['org']->hash_id}/expenses", [
                'category' => 'equipment',
                'amount' => 300000,
                'expense_date' => now()->toDateString(),
                'class_id' => $b['class']->hash_id,
            ])
            ->assertStatus(422);

        // tutor_id belonging to org B → 422.
        $this->actingAsApi($a['owner'])
            ->postJson("/api/v1/organizations/{$a['org']->hash_id}/expenses", [
                'category' => 'equipment',
                'amount' => 300000,
                'expense_date' => now()->toDateString(),
                'tutor_id' => $b['tutor']->hash_id,
            ])
            ->assertStatus(422);

        // Neither bad request created a row for org A.
        $this->assertSame(1, CenterExpense::where('organization_id', $a['org']->id)->count());
    }

    public function test_expense_create_validates_category_and_amount(): void
    {
        ['org' => $org, 'owner' => $owner] = $this->seedOrg();

        // Unknown category → 422.
        $this->actingAsApi($owner)
            ->postJson("/api/v1/organizations/{$org->hash_id}/expenses", [
                'category' => 'not_a_real_category',
                'amount' => 100000,
                'expense_date' => now()->toDateString(),
            ])
            ->assertStatus(422);

        // Non-positive amount → 422.
        $this->actingAsApi($owner)
            ->postJson("/api/v1/organizations/{$org->hash_id}/expenses", [
                'category' => 'other',
                'amount' => 0,
                'expense_date' => now()->toDateString(),
            ])
            ->assertStatus(422);
    }

    // =============================================================================================
    // Filters + happy-path mutation.
    // =============================================================================================

    public function test_expense_list_filters_by_category(): void
    {
        ['org' => $org, 'owner' => $owner] = $this->seedOrg(); // seeds one 'rent' expense
        CenterExpense::factory()->create([
            'organization_id' => $org->id, 'category' => 'marketing', 'created_by' => $owner->id,
        ]);

        $this->actingAsApi($owner)
            ->getJson("/api/v1/organizations/{$org->hash_id}/expenses?category=marketing")
            ->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.category', 'marketing');
    }

    public function test_owner_can_update_and_delete_expense(): void
    {
        ['org' => $org, 'owner' => $owner] = $this->seedOrg();

        // An UNSETTLED expense may be edited and deleted (it never entered cash reports).
        $unpaid = CenterExpense::factory()->unpaid()->create([
            'organization_id' => $org->id,
            'category' => 'marketing',
            'amount' => 250000,
            'created_by' => $owner->id,
        ]);

        $this->actingAsApi($owner)
            ->patchJson("/api/v1/organizations/{$org->hash_id}/expenses/{$unpaid->hash_id}", ['amount' => 123456])
            ->assertStatus(200)
            ->assertJsonPath('data.amount', 123456);

        $this->actingAsApi($owner)
            ->deleteJson("/api/v1/organizations/{$org->hash_id}/expenses/{$unpaid->hash_id}")
            ->assertStatus(200);

        $this->assertSoftDeleted('center_expenses', ['id' => $unpaid->id]);
    }

    public function test_settled_expense_is_immutable(): void
    {
        ['org' => $org, 'owner' => $owner, 'expense' => $expense] = $this->seedOrg();
        $this->assertTrue($expense->fresh()->isSettled(), 'seedOrg expense should be a settled cash fact');

        // A settled expense (already in P&L/cashflow) can be neither edited nor deleted.
        $this->actingAsApi($owner)
            ->patchJson("/api/v1/organizations/{$org->hash_id}/expenses/{$expense->hash_id}", ['amount' => 123456])
            ->assertStatus(409)
            ->assertJsonPath('code', 'EXPENSE_SETTLED');

        $this->actingAsApi($owner)
            ->deleteJson("/api/v1/organizations/{$org->hash_id}/expenses/{$expense->hash_id}")
            ->assertStatus(409)
            ->assertJsonPath('code', 'EXPENSE_SETTLED');
    }
}
