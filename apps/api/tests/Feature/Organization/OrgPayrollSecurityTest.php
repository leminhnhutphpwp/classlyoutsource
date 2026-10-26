<?php

namespace Tests\Feature\Organization;

use App\Models\ClassRoom;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\Payment;
use App\Models\PayrollItem;
use App\Models\PayrollPeriod;
use App\Models\Schedule;
use App\Models\ScheduleSession;
use App\Models\TutorCompensationProfile;
use App\Models\User;
use App\Services\Payroll\PayrollCalculator;
use Tests\TestCase;

/**
 * WAVE 3 — PAYROLL. The HIGHEST bar in the suite: money that is MEMBER-anchored (design §2.4, §6 risks
 * 1,3,4,5). Adversarial in every direction:
 *  - CROSS-org: org B's period/item/profile is a fail-closed 404 to org A — even guessing the real
 *    hashid; a null-org / foreign anchor is invisible to everyone.
 *  - MEMBER-tutor: sees ONLY their OWN finalized payslip (draft hidden), NEVER rate tables nor another
 *    member's payslip; an ex-member is locked out while the owner still sees their historical payslip
 *    (immutable snapshot).
 *  - IDEMPOTENCY: compute twice = identical totals, no duplicate rows; compute is blocked once approved.
 *  - STATE machine: mark-paid is OWNER-only (manager 403).
 *  - CALCULATOR unit tests on SQLite for each v1 pay model (fixed / per_session / revenue_share).
 *  - HAPPY path: profile → period → compute → approve → mark-paid, with correct totals.
 * Mirrors the OrgFinanceReadTest harness.
 */
class OrgPayrollSecurityTest extends TestCase
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

    private function orgClass(Organization $org, User $tutor): ClassRoom
    {
        return ClassRoom::factory()->create([
            'tutor_id' => $tutor->id,
            'organization_id' => $org->id,
        ]);
    }

    private function period(Organization $org): PayrollPeriod
    {
        return PayrollPeriod::factory()->create([
            'organization_id' => $org->id,
            'period_start' => now()->startOfMonth()->toDateString(),
            'period_end' => now()->endOfMonth()->toDateString(),
        ]);
    }

    /** A completed session in the current month, attributed to $completedBy (nullable). */
    private function completedSession(ClassRoom $class, int $day, ?int $completedBy): ScheduleSession
    {
        $schedule = Schedule::factory()->forClass($class->id)->create();

        return ScheduleSession::create([
            'schedule_id' => $schedule->id,
            'class_id' => $class->id,
            'session_date' => now()->startOfMonth()->addDays($day)->toDateString(),
            'start_time' => '18:00',
            'end_time' => '20:00',
            'mode' => 'offline',
            'status' => 'completed',
            'completed_by' => $completedBy,
        ]);
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

    private function assertDenied($response): void
    {
        $this->assertContains($response->status(), [403, 404], 'expected a fail-closed denial (403/404), got '.$response->status());
    }

    // =============================================================================================
    // CALCULATOR UNIT TESTS — directly on SQLite, one per v1 pay model, known fixtures.
    // =============================================================================================

    public function test_calculator_fixed_monthly(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');

        TutorCompensationProfile::factory()->fixedMonthly(12000000)->create([
            'organization_id' => $org->id, 'user_id' => $tutor->id,
        ]);

        $period = $this->period($org);
        $written = (new PayrollCalculator)->computePeriod($period);

        // owner has no profile → skipped; only the tutor gets an item.
        $this->assertSame(1, $written);
        $item = PayrollItem::where('payroll_period_id', $period->id)->where('user_id', $tutor->id)->firstOrFail();
        $this->assertSame('fixed_monthly', $item->pay_model);
        $this->assertSame(12000000, (int) $item->base_amount);
        $this->assertSame(12000000, (int) $item->gross_amount);
        $this->assertSame(12000000, (int) $period->fresh()->total_amount);
    }

    public function test_calculator_per_session_uses_completed_by_then_lead_tutor(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');
        $class = $this->orgClass($org, $tutor);

        TutorCompensationProfile::factory()->perSession(200000)->create([
            'organization_id' => $org->id, 'user_id' => $tutor->id,
        ]);

        // 2 sessions closed BY the tutor + 1 auto-completed (completed_by null → falls back to lead
        // tutor of the class = this tutor) = 3 payable sessions × 200,000 = 600,000.
        $this->completedSession($class, 1, $tutor->id);
        $this->completedSession($class, 3, $tutor->id);
        $this->completedSession($class, 5, null);

        $period = $this->period($org);
        (new PayrollCalculator)->computePeriod($period);

        $item = PayrollItem::where('payroll_period_id', $period->id)->where('user_id', $tutor->id)->firstOrFail();
        $this->assertSame(3, (int) $item->sessions_count);
        $this->assertSame(600000, (int) $item->sessions_amount);
        $this->assertSame(600000, (int) $item->gross_amount);
    }

    public function test_calculator_per_session_ignores_other_orgs_and_out_of_window(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');
        $class = $this->orgClass($org, $tutor);

        TutorCompensationProfile::factory()->perSession(200000)->create([
            'organization_id' => $org->id, 'user_id' => $tutor->id,
        ]);

        $this->completedSession($class, 2, $tutor->id); // in window → counts

        // Out of window (next month) → excluded.
        $sched = Schedule::factory()->forClass($class->id)->create();
        ScheduleSession::create([
            'schedule_id' => $sched->id, 'class_id' => $class->id,
            'session_date' => now()->addMonth()->startOfMonth()->toDateString(),
            'start_time' => '18:00', 'end_time' => '20:00', 'mode' => 'offline',
            'status' => 'completed', 'completed_by' => $tutor->id,
        ]);

        // Another org's completed session by the same person → excluded (org anchor).
        [$owner2, $org2] = $this->makeOrg();
        OrganizationMember::factory()->create(['organization_id' => $org2->id, 'user_id' => $tutor->id, 'org_role' => 'tutor']);
        $class2 = $this->orgClass($org2, $tutor);
        $this->completedSession($class2, 2, $tutor->id);

        $period = $this->period($org);
        (new PayrollCalculator)->computePeriod($period);

        $item = PayrollItem::where('payroll_period_id', $period->id)->where('user_id', $tutor->id)->firstOrFail();
        $this->assertSame(1, (int) $item->sessions_count);
        $this->assertSame(200000, (int) $item->sessions_amount);
    }

    public function test_calculator_revenue_share_cash_basis(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');
        $class = $this->orgClass($org, $tutor);
        $student = $this->studentInClass($class, ['created_by' => $tutor->id]);

        TutorCompensationProfile::factory()->revenueShare(40)->create([
            'organization_id' => $org->id, 'user_id' => $tutor->id,
        ]);

        // Paid revenue on the tutor's class this month: 1,000,000 + 500,000 = 1,500,000.
        $this->paidPayment($class, $student->id, 1000000);
        $this->paidPayment($class, $student->id, 500000);
        // A pending payment must NOT count (cash-basis).
        Payment::factory()->create([
            'student_id' => $student->id, 'class_id' => $class->id,
            'status' => 'pending', 'amount' => 9000000, 'payment_date' => now()->toDateString(),
        ]);

        $period = $this->period($org);
        (new PayrollCalculator)->computePeriod($period);

        // 40% of 1,500,000 = 600,000.
        $item = PayrollItem::where('payroll_period_id', $period->id)->where('user_id', $tutor->id)->firstOrFail();
        $this->assertSame(1500000, (int) $item->revenue_base);
        $this->assertSame(600000, (int) $item->revenue_amount);
        $this->assertSame(600000, (int) $item->gross_amount);
    }

    // =============================================================================================
    // IDEMPOTENCY — compute twice = identical totals, no duplicate rows; blocked once approved.
    // =============================================================================================

    public function test_compute_twice_is_idempotent_no_duplicate_rows(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');
        TutorCompensationProfile::factory()->fixedMonthly(8000000)->create([
            'organization_id' => $org->id, 'user_id' => $tutor->id,
        ]);

        $period = $this->period($org);
        $calc = new PayrollCalculator;
        $calc->computePeriod($period);
        $calc->computePeriod($period->fresh());

        $this->assertSame(1, PayrollItem::where('payroll_period_id', $period->id)->count());
        $item = PayrollItem::where('payroll_period_id', $period->id)->first();
        $this->assertSame(8000000, (int) $item->gross_amount);
        $this->assertSame(8000000, (int) $period->fresh()->total_amount);
    }

    public function test_compute_blocked_when_period_approved(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');
        TutorCompensationProfile::factory()->fixedMonthly(8000000)->create([
            'organization_id' => $org->id, 'user_id' => $tutor->id,
        ]);

        $period = $this->period($org);
        $period->update(['status' => 'approved']);

        $written = (new PayrollCalculator)->computePeriod($period);
        $this->assertSame(0, $written);
        $this->assertSame(0, PayrollItem::where('payroll_period_id', $period->id)->count());

        // The compute ENDPOINT also refuses (409) on an approved period.
        $this->actingAsApi($owner)
            ->postJson("/api/v1/organizations/{$org->hash_id}/payroll-periods/{$period->hash_id}/compute")
            ->assertStatus(409);
    }

    // =============================================================================================
    // HAPPY PATH — profile → period → compute → approve → mark-paid, totals correct.
    // =============================================================================================

    public function test_full_payroll_happy_path(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');

        // 1. Create a compensation profile (owner).
        $this->actingAsApi($owner)
            ->postJson("/api/v1/organizations/{$org->hash_id}/compensation-profiles", [
                'user_id' => $tutor->hash_id,
                'pay_model' => 'fixed_monthly',
                'base_salary' => 15000000,
                'effective_from' => now()->startOfYear()->toDateString(),
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.pay_model', 'fixed_monthly');

        // 2. Create a payroll period.
        $periodRes = $this->actingAsApi($owner)
            ->postJson("/api/v1/organizations/{$org->hash_id}/payroll-periods", [
                'period_start' => now()->startOfMonth()->toDateString(),
                'period_end' => now()->endOfMonth()->toDateString(),
                'label' => 'Tháng này',
            ])
            ->assertStatus(201);
        $periodHash = $periodRes->json('data._id');

        // 3. Compute (queued → sync in tests).
        $this->actingAsApi($owner)
            ->postJson("/api/v1/organizations/{$org->hash_id}/payroll-periods/{$periodHash}/compute")
            ->assertStatus(200);

        // 4. Items present with correct gross.
        $this->actingAsApi($owner)
            ->getJson("/api/v1/organizations/{$org->hash_id}/payroll-periods/{$periodHash}/items")
            ->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.gross_amount', 15000000);

        // 5. Approve (owner/manager).
        $this->actingAsApi($owner)
            ->postJson("/api/v1/organizations/{$org->hash_id}/payroll-periods/{$periodHash}/approve")
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.total_amount', 15000000);

        // 6. Mark-paid (owner-only).
        $this->actingAsApi($owner)
            ->postJson("/api/v1/organizations/{$org->hash_id}/payroll-periods/{$periodHash}/mark-paid")
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'paid');

        // Member sees their finalized payslip via self-service.
        $this->actingAsApi($tutor)
            ->getJson("/api/v1/organizations/{$org->hash_id}/my-payslips")
            ->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.gross_amount', 15000000);
    }

    // =============================================================================================
    // STATE MACHINE — mark-paid is OWNER-only (manager can approve, cannot pay).
    // =============================================================================================

    public function test_mark_paid_is_owner_only_manager_forbidden(): void
    {
        [$owner, $org] = $this->makeOrg();
        $manager = $this->addMember($org, 'manager');
        $period = $this->period($org);

        // Approve requires at least one payslip item — seed one.
        PayrollItem::factory()->create([
            'organization_id' => $org->id, 'payroll_period_id' => $period->id, 'user_id' => $owner->id, 'status' => 'draft',
        ]);

        // Manager CAN approve.
        $this->actingAsApi($manager)
            ->postJson("/api/v1/organizations/{$org->hash_id}/payroll-periods/{$period->hash_id}/approve")
            ->assertStatus(200);

        // Manager CANNOT mark-paid → 403.
        $this->actingAsApi($manager)
            ->postJson("/api/v1/organizations/{$org->hash_id}/payroll-periods/{$period->hash_id}/mark-paid")
            ->assertStatus(403);

        // Owner CAN mark-paid.
        $this->actingAsApi($owner)
            ->postJson("/api/v1/organizations/{$org->hash_id}/payroll-periods/{$period->hash_id}/mark-paid")
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'paid');
    }

    // =============================================================================================
    // MEMBER-tutor exposure — own finalized payslip ONLY; no rate tables, no other members, no draft.
    // =============================================================================================

    public function test_member_tutor_sees_only_own_approved_payslip_draft_hidden(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');
        $other = $this->addMember($org, 'tutor');
        $period = $this->period($org);

        // Draft items for both members.
        $mine = PayrollItem::factory()->create([
            'organization_id' => $org->id, 'payroll_period_id' => $period->id, 'user_id' => $tutor->id, 'status' => 'draft',
        ]);
        $theirs = PayrollItem::factory()->create([
            'organization_id' => $org->id, 'payroll_period_id' => $period->id, 'user_id' => $other->id, 'status' => 'approved',
        ]);

        // my-payslips: draft is hidden → empty.
        $this->actingAsApi($tutor)
            ->getJson("/api/v1/organizations/{$org->hash_id}/my-payslips")
            ->assertStatus(200)
            ->assertJsonCount(0, 'data');

        // Approve mine → now visible.
        $mine->update(['status' => 'approved']);
        $this->actingAsApi($tutor)
            ->getJson("/api/v1/organizations/{$org->hash_id}/my-payslips")
            ->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0._id', $mine->hash_id);

        // Another member's payslip via item show → fail-closed 404 (even though same org, approved).
        $this->assertDenied($this->actingAsApi($tutor)->getJson("/api/v1/payroll-items/{$theirs->hash_id}"));

        // Rate tables (compensation-profiles) are invisible to a member-tutor.
        $this->assertDenied($this->actingAsApi($tutor)->getJson("/api/v1/organizations/{$org->hash_id}/compensation-profiles"));
        // Period management is owner/manager-only.
        $this->assertDenied($this->actingAsApi($tutor)->getJson("/api/v1/organizations/{$org->hash_id}/payroll-periods"));
    }

    public function test_member_tutor_can_show_own_approved_item(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');
        $period = $this->period($org);

        $draft = PayrollItem::factory()->create([
            'organization_id' => $org->id, 'payroll_period_id' => $period->id, 'user_id' => $tutor->id, 'status' => 'draft',
        ]);
        // Own DRAFT item is hidden even on direct show.
        $this->assertDenied($this->actingAsApi($tutor)->getJson("/api/v1/payroll-items/{$draft->hash_id}"));

        $draft->update(['status' => 'approved']);
        $this->actingAsApi($tutor)
            ->getJson("/api/v1/payroll-items/{$draft->hash_id}")
            ->assertStatus(200)
            ->assertJsonPath('data._id', $draft->hash_id);
    }

    // =============================================================================================
    // EX-member — locked out of payroll, but the owner still sees their historical payslip.
    // =============================================================================================

    public function test_ex_member_locked_out_but_owner_keeps_historical_payslip(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');
        $period = $this->period($org);
        $item = PayrollItem::factory()->create([
            'organization_id' => $org->id, 'payroll_period_id' => $period->id, 'user_id' => $tutor->id, 'status' => 'paid',
        ]);

        // Remove the member (membership → removed).
        OrganizationMember::where('organization_id', $org->id)->where('user_id', $tutor->id)
            ->update(['status' => 'removed']);
        $tutor = $tutor->fresh();

        // Ex-member is locked out of payroll (no active membership → guardOrgContext 404 / capability).
        $this->assertDenied($this->actingAsApi($tutor)->getJson("/api/v1/organizations/{$org->hash_id}/my-payslips"));
        $this->assertDenied($this->actingAsApi($tutor)->getJson("/api/v1/payroll-items/{$item->hash_id}"));

        // Owner STILL sees the historical payslip (immutable snapshot: organization_id + user_id on row).
        $this->actingAsApi($owner)
            ->getJson("/api/v1/payroll-items/{$item->hash_id}")
            ->assertStatus(200)
            ->assertJsonPath('data._id', $item->hash_id);
        $this->assertSame($tutor->id, (int) $item->fresh()->user_id);
        $this->assertSame($org->id, (int) $item->fresh()->organization_id);
    }

    // =============================================================================================
    // CROSS-org — org B's period/item/profile invisible to org A even with a real hashid.
    // =============================================================================================

    public function test_cross_org_period_item_profile_are_404_with_real_hashid(): void
    {
        [$ownerA, $orgA] = $this->makeOrg();
        [$ownerB, $orgB] = $this->makeOrg();
        $tutorB = $this->addMember($orgB, 'tutor');
        $periodB = $this->period($orgB);
        $itemB = PayrollItem::factory()->create([
            'organization_id' => $orgB->id, 'payroll_period_id' => $periodB->id, 'user_id' => $tutorB->id, 'status' => 'approved',
        ]);
        $profileB = TutorCompensationProfile::factory()->fixedMonthly()->create([
            'organization_id' => $orgB->id, 'user_id' => $tutorB->id,
        ]);

        // Owner A using A's own org URL but B's real hashids → 404 (no existence leak).
        $this->actingAsApi($ownerA)
            ->getJson("/api/v1/organizations/{$orgA->hash_id}/payroll-periods/{$periodB->hash_id}")
            ->assertStatus(404);
        $this->actingAsApi($ownerA)
            ->getJson("/api/v1/organizations/{$orgA->hash_id}/compensation-profiles/{$profileB->hash_id}")
            ->assertStatus(404);
        // The org-param-less item route resolves globally then org-checks → 404 for A.
        $this->actingAsApi($ownerA)
            ->getJson("/api/v1/payroll-items/{$itemB->hash_id}")
            ->assertStatus(404);

        // Owner A pointing at B's org URL → org-context (from membership) fails closed too.
        $this->actingAsApi($ownerA)
            ->getJson("/api/v1/organizations/{$orgB->hash_id}/payroll-periods")
            ->assertStatus(404);

        // Owner A cannot MUTATE B's payslip via an adjustment (org-checked) → 404.
        $this->actingAsApi($ownerA)
            ->postJson("/api/v1/payroll-items/{$itemB->hash_id}/adjustments", [
                'type' => 'deduction', 'amount' => -100000, 'reason' => 'attack',
            ])
            ->assertStatus(404);
        // Compute B's period from A's context → 404 (period not in A's org).
        $this->actingAsApi($ownerA)
            ->postJson("/api/v1/organizations/{$orgA->hash_id}/payroll-periods/{$periodB->hash_id}/compute")
            ->assertStatus(404);
    }

    public function test_cross_org_index_never_leaks_other_orgs_rows(): void
    {
        [$ownerA, $orgA] = $this->makeOrg();
        [$ownerB, $orgB] = $this->makeOrg();
        $tutorB = $this->addMember($orgB, 'tutor');
        $this->period($orgB);
        TutorCompensationProfile::factory()->fixedMonthly()->create([
            'organization_id' => $orgB->id, 'user_id' => $tutorB->id,
        ]);

        // A's period + profile lists are empty (B's rows never leak).
        $this->actingAsApi($ownerA)
            ->getJson("/api/v1/organizations/{$orgA->hash_id}/payroll-periods")
            ->assertStatus(200)->assertJsonCount(0, 'data');
        $this->actingAsApi($ownerA)
            ->getJson("/api/v1/organizations/{$orgA->hash_id}/compensation-profiles")
            ->assertStatus(200)->assertJsonCount(0, 'data');
    }

    // =============================================================================================
    // NULL-org / foreign anchor — invisible to everyone.
    // =============================================================================================

    public function test_solo_tutor_and_outsiders_have_no_payroll_access(): void
    {
        [$owner, $org] = $this->makeOrg();

        // A solo tutor (no org) — every payroll endpoint fails closed.
        $solo = $this->tutor();
        $this->assertDenied($this->actingAsApi($solo)->getJson("/api/v1/organizations/{$org->hash_id}/payroll-periods"));
        $this->assertDenied($this->actingAsApi($solo)->getJson("/api/v1/organizations/{$org->hash_id}/my-payslips"));

        // A student / parent — denied everywhere too.
        $student = $this->studentUser();
        $parent = $this->guardian();
        foreach ([$student, $parent] as $outsider) {
            $this->assertDenied($this->actingAsApi($outsider)->getJson("/api/v1/organizations/{$org->hash_id}/payroll-periods"));
            $this->assertDenied($this->actingAsApi($outsider)->getJson("/api/v1/organizations/{$org->hash_id}/my-payslips"));
        }
    }

    // =============================================================================================
    // ADJUSTMENTS — owner/manager fold a signed correction into the payslip total.
    // =============================================================================================

    public function test_adjustment_refolds_item_and_period_total(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');
        $period = $this->period($org);

        // Seed an item, then approve the period (adjustments only allowed on approved, unpaid periods).
        $item = PayrollItem::factory()->create([
            'organization_id' => $org->id, 'payroll_period_id' => $period->id, 'user_id' => $tutor->id,
            'base_amount' => 10000000, 'gross_amount' => 10000000, 'status' => 'draft',
        ]);
        $this->actingAsApi($owner)
            ->postJson("/api/v1/organizations/{$org->hash_id}/payroll-periods/{$period->hash_id}/approve")
            ->assertStatus(200);
        $this->assertSame('approved', $item->fresh()->status);

        // Add a 2,000,000 bonus → gross 12,000,000.
        $adjRes = $this->actingAsApi($owner)
            ->postJson("/api/v1/payroll-items/{$item->hash_id}/adjustments", [
                'type' => 'bonus', 'amount' => 2000000, 'reason' => 'Thưởng KPI',
            ])
            ->assertStatus(201);
        $this->assertSame(12000000, (int) $item->fresh()->gross_amount);
        $this->assertSame(2000000, (int) $item->fresh()->adjustments_total);

        // Remove it → back to 10,000,000.
        $adjHash = $adjRes->json('data._id');
        $this->actingAsApi($owner)
            ->deleteJson("/api/v1/payroll-adjustments/{$adjHash}")
            ->assertStatus(200);
        $this->assertSame(10000000, (int) $item->fresh()->gross_amount);
        $this->assertSame(0, (int) $item->fresh()->adjustments_total);
    }

    public function test_duplicate_period_window_is_rejected_422_not_500(): void
    {
        [$owner, $org] = $this->makeOrg();
        $body = [
            'period_start' => now()->startOfMonth()->toDateString(),
            'period_end' => now()->endOfMonth()->toDateString(),
        ];

        $this->actingAsApi($owner)
            ->postJson("/api/v1/organizations/{$org->hash_id}/payroll-periods", $body)
            ->assertStatus(201);

        // Same window again → a friendly 422 (the DB unique constraint would otherwise 500).
        $this->actingAsApi($owner)
            ->postJson("/api/v1/organizations/{$org->hash_id}/payroll-periods", $body)
            ->assertStatus(422);

        $this->assertSame(1, PayrollPeriod::where('organization_id', $org->id)->count());
    }

    public function test_member_tutor_cannot_add_adjustment(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');
        $period = $this->period($org);

        // Seed an item + approve so the item is in the adjustable state — the point is the ROLE gate.
        PayrollItem::factory()->create([
            'organization_id' => $org->id, 'payroll_period_id' => $period->id, 'user_id' => $tutor->id, 'status' => 'draft',
        ]);
        $this->actingAsApi($owner)
            ->postJson("/api/v1/organizations/{$org->hash_id}/payroll-periods/{$period->hash_id}/approve")
            ->assertStatus(200);

        $item = PayrollItem::where('payroll_period_id', $period->id)->firstOrFail();

        $this->assertDenied($this->actingAsApi($tutor)
            ->postJson("/api/v1/payroll-items/{$item->hash_id}/adjustments", [
                'type' => 'bonus', 'amount' => 5000000, 'reason' => 'self-raise',
            ]));
    }
}
