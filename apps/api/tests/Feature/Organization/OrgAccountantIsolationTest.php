<?php

namespace Tests\Feature\Organization;

use App\Models\Attendance;
use App\Models\ClassRoom;
use App\Models\Grade;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\Payment;
use App\Models\PaymentRequest;
use App\Models\Student;
use App\Models\User;
use Tests\TestCase;

/**
 * WAVE 1 — the ACCOUNTANT (kế toán) org role: FINANCE-ONLY, least-privilege. Money is HIGH-sensitivity,
 * so this suite is adversarial in BOTH directions:
 *  - OVER-exposure: an accountant must NOT see any teaching data (classes/grades/attendance/...).
 *  - UNDER-exposure: an accountant MUST see their org's finance (payments / payment-requests / student
 *    billing) — a finance role that can't read finance is a silent regression.
 *  - CROSS-org: org B is entirely invisible (fail-closed 404 / empty), even by guessed hashid.
 * Plus zero-regression spot checks (manager sees all, member-tutor sees own) and the role lifecycle
 * (removed accountant denied; solo (non-org) tutor denied; role-change hand-back). See design §2.1/§6.
 */
class OrgAccountantIsolationTest extends TestCase
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
     * A fully-populated org: owner, a member tutor with a class + enrolled student + paid payment +
     * payment-request + a grade + an attendance, and an accountant. Returns the moving parts.
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
        ]);
        $paymentRequest = PaymentRequest::create([
            'class_id' => $class->id,
            'created_by' => $tutor->id,
            'period_name' => 'Tháng 7/2026',
            'period_month' => '2026-07',
            'amount_per_student' => 500000,
            'due_date' => now()->addWeek()->toDateString(),
            'status' => 'active',
        ]);
        $grade = Grade::factory()->create(['student_id' => $student->id, 'class_id' => $class->id, 'tutor_id' => $tutor->id]);
        Attendance::factory()->create(['student_id' => $student->id, 'class_id' => $class->id, 'tutor_id' => $tutor->id]);

        return compact('owner', 'org', 'tutor', 'accountant', 'class', 'student', 'payment', 'paymentRequest');
    }

    private function assertDenied($response): void
    {
        $this->assertContains($response->status(), [403, 404], 'expected a fail-closed denial (403/404), got '.$response->status());
    }

    // =============================================================================================
    // UNDER-exposure guard — the accountant MUST be able to read org finance.
    // =============================================================================================

    public function test_accountant_sees_org_payments(): void
    {
        ['accountant' => $accountant, 'payment' => $payment] = $this->seedOrg();

        $this->actingAsApi($accountant)
            ->getJson('/api/v1/payments')
            ->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0._id', $payment->hash_id);
    }

    public function test_accountant_sees_org_payment_requests(): void
    {
        ['accountant' => $accountant, 'class' => $class, 'paymentRequest' => $pr] = $this->seedOrg();

        // Class-scoped list of payment-requests (finance read, not teaching access).
        $this->actingAsApi($accountant)
            ->getJson("/api/v1/classes/{$class->hash_id}/payment-requests")
            ->assertStatus(200)
            ->assertJsonCount(1, 'data');

        // And the single payment-request by id.
        $this->actingAsApi($accountant)
            ->getJson("/api/v1/payment-requests/{$pr->hash_id}")
            ->assertStatus(200);
    }

    public function test_accountant_reads_org_student_billing_without_teaching_fields(): void
    {
        ['accountant' => $accountant, 'student' => $student] = $this->seedOrg();

        $res = $this->actingAsApi($accountant)
            ->getJson("/api/v1/students/{$student->hash_id}")
            ->assertStatus(200)
            ->assertJsonPath('data._id', $student->hash_id);

        // Billing/contact is present, teaching-derived fields are trimmed (fail-closed on teaching).
        $data = $res->json('data');
        $this->assertArrayNotHasKey('attendance_rate', $data, 'accountant must not see attendance-derived data');
        $this->assertArrayNotHasKey('classes', $data, 'accountant must not see the student class list');
    }

    // =============================================================================================
    // OVER-exposure guard — the accountant must be FAIL-CLOSED on ALL teaching data.
    // =============================================================================================

    public function test_accountant_denied_teaching_by_id_and_by_student(): void
    {
        ['accountant' => $accountant, 'class' => $class, 'student' => $student] = $this->seedOrg();

        // Class by id → 404.
        $this->assertDenied($this->actingAsApi($accountant)->getJson("/api/v1/classes/{$class->hash_id}"));

        // Per-student teaching records → fail-closed.
        foreach (['grades', 'attendance'] as $child) {
            $this->assertDenied(
                $this->actingAsApi($accountant)->getJson("/api/v1/students/{$student->hash_id}/{$child}")
            );
        }
    }

    public function test_accountant_teaching_lists_are_empty(): void
    {
        ['accountant' => $accountant] = $this->seedOrg();

        // List endpoints run through applyDataIsolation → the finance branch fails teaching closed (1=0),
        // so the accountant sees an empty list (200 + zero rows) rather than a co-member's data.
        foreach (['classes', 'grades', 'assignments', 'schedules', 'lesson-notes'] as $resource) {
            $this->actingAsApi($accountant)
                ->getJson("/api/v1/{$resource}")
                ->assertStatus(200)
                ->assertJsonCount(0, 'data');
        }
    }

    public function test_accountant_cannot_manage_teaching_resources(): void
    {
        ['accountant' => $accountant, 'class' => $class] = $this->seedOrg();

        // canManageResource fails accountant closed → no mutation of a co-member's class.
        $this->assertDenied(
            $this->actingAsApi($accountant)->putJson("/api/v1/classes/{$class->hash_id}", [
                'name' => 'Kế toán đổi tên', 'subject' => $class->subject,
            ])
        );
        $this->assertDenied(
            $this->actingAsApi($accountant)->deleteJson("/api/v1/classes/{$class->hash_id}")
        );
    }

    // =============================================================================================
    // CROSS-org — org B is entirely invisible to an accountant of org A.
    // =============================================================================================

    public function test_accountant_of_a_cannot_see_org_b_finance(): void
    {
        $a = $this->seedOrg();
        $b = $this->seedOrg();

        // A's accountant list is scoped to A only (1 payment), never B's.
        $this->actingAsApi($a['accountant'])
            ->getJson('/api/v1/payments')
            ->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0._id', $a['payment']->hash_id);

        // B's payment / payment-request / class by id → fail-closed (even with a real hashid).
        $this->assertDenied($this->actingAsApi($a['accountant'])->getJson("/api/v1/payment-requests/{$b['paymentRequest']->hash_id}"));
        $this->assertDenied($this->actingAsApi($a['accountant'])->getJson("/api/v1/classes/{$b['class']->hash_id}/payment-requests"));
        $this->assertDenied($this->actingAsApi($a['accountant'])->getJson("/api/v1/classes/{$b['class']->hash_id}"));
        $this->assertDenied($this->actingAsApi($a['accountant'])->getJson("/api/v1/students/{$b['student']->hash_id}"));
    }

    // =============================================================================================
    // Lifecycle — removed accountant, solo (non-org) tutor, role changes.
    // =============================================================================================

    public function test_removed_accountant_sees_empty_payments(): void
    {
        ['org' => $org, 'accountant' => $accountant] = $this->seedOrg();

        // Flip the membership to removed → no active membership → no org context.
        OrganizationMember::where('organization_id', $org->id)
            ->where('user_id', $accountant->id)
            ->update(['status' => 'removed']);

        // A removed member is still authenticated but belongs to no org → list endpoint returns empty data (200).
        $this->actingAsApi($accountant->fresh())
            ->getJson('/api/v1/payments')
            ->assertStatus(200)
            ->assertJsonCount(0, 'data');
    }

    public function test_solo_tutor_sees_empty_payments(): void
    {
        // A solo tutor with no organization has no payments → returns empty list (200).
        $solo = $this->tutor();

        $this->actingAsApi($solo)
            ->getJson('/api/v1/payments')
            ->assertStatus(200)
            ->assertJsonCount(0, 'data');
    }

    // =============================================================================================
    // Zero-regression — manager still sees everything; a member tutor still sees only their own.
    // =============================================================================================

    public function test_manager_still_sees_everything(): void
    {
        ['org' => $org, 'class' => $class, 'student' => $student] = $this->seedOrg();
        $manager = $this->addMember($org, 'manager');

        $this->actingAsApi($manager)->getJson("/api/v1/classes/{$class->hash_id}")->assertStatus(200);
        $this->actingAsApi($manager)->getJson('/api/v1/payments')->assertStatus(200)->assertJsonCount(1, 'data');
        $this->actingAsApi($manager)
            ->getJson("/api/v1/students/{$student->hash_id}/grades")
            ->assertStatus(200);
    }

    public function test_member_tutor_still_sees_only_own(): void
    {
        ['org' => $org, 'class' => $class] = $this->seedOrg();
        $other = $this->addMember($org, 'tutor');

        // A different member tutor cannot open the first tutor's class.
        $this->assertDenied($this->actingAsApi($other)->getJson("/api/v1/classes/{$class->hash_id}"));
    }

    // =============================================================================================
    // Role management — PATCH member role (owner-only) + store creation gates + E-1 hand-back.
    // =============================================================================================

    public function test_owner_promotes_tutor_to_accountant_with_class_handback(): void
    {
        ['owner' => $owner, 'org' => $org, 'tutor' => $tutor, 'class' => $class, 'student' => $student] = $this->seedOrg();
        $row = OrganizationMember::where('organization_id', $org->id)->where('user_id', $tutor->id)->firstOrFail();

        $this->actingAsApi($owner)
            ->patchJson("/api/v1/organizations/{$org->hash_id}/members/{$row->hash_id}", ['org_role' => 'accountant'])
            ->assertStatus(200)
            ->assertJsonPath('data.org_role', 'accountant');

        // E-1: the class + the student they created were handed back to the owner (no teaching left).
        $this->assertSame((int) $org->owner_id, (int) $class->fresh()->tutor_id);
        $this->assertSame((int) $org->owner_id, (int) $student->fresh()->created_by);

        // The now-accountant is fail-closed on the class they used to teach.
        $this->assertDenied($this->actingAsApi($tutor->fresh())->getJson("/api/v1/classes/{$class->hash_id}"));
    }

    public function test_role_change_is_owner_only(): void
    {
        ['org' => $org, 'tutor' => $tutor] = $this->seedOrg();
        $manager = $this->addMember($org, 'manager');
        $row = OrganizationMember::where('organization_id', $org->id)->where('user_id', $tutor->id)->firstOrFail();

        // A manager may NOT change roles (owner-only, design §3.2).
        $this->actingAsApi($manager)
            ->patchJson("/api/v1/organizations/{$org->hash_id}/members/{$row->hash_id}", ['org_role' => 'accountant'])
            ->assertStatus(403);
    }

    public function test_role_change_cross_org_is_fail_closed(): void
    {
        ['owner' => $ownerA, 'org' => $orgA] = $this->seedOrg();
        ['org' => $orgB, 'tutor' => $tutorB] = $this->seedOrg();
        $rowB = OrganizationMember::where('organization_id', $orgB->id)->where('user_id', $tutorB->id)->firstOrFail();

        // Owner A cannot touch a member of org B — org context is derived from the caller, not the URL.
        $this->assertDenied(
            $this->actingAsApi($ownerA)->patchJson("/api/v1/organizations/{$orgA->hash_id}/members/{$rowB->hash_id}", ['org_role' => 'accountant'])
        );
    }

    public function test_only_owner_may_create_accountant(): void
    {
        [$owner, $org] = $this->makeOrg();
        $manager = $this->addMember($org, 'manager');

        // A manager creating an accountant → 403 (owner-only).
        $this->actingAsApi($manager)
            ->postJson("/api/v1/organizations/{$org->hash_id}/members", [
                'name' => 'KT Mới', 'email' => 'kt.new@example.com', 'org_role' => 'accountant',
            ])
            ->assertStatus(403);

        // The owner can.
        $this->actingAsApi($owner)
            ->postJson("/api/v1/organizations/{$org->hash_id}/members", [
                'name' => 'KT Hợp Lệ', 'email' => 'kt.ok@example.com', 'org_role' => 'accountant',
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.org_role', 'accountant');
    }
}
