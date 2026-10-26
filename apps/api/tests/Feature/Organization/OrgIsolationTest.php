<?php

namespace Tests\Feature\Organization;

use App\Models\Attendance;
use App\Models\ClassRoom;
use App\Models\Grade;
use App\Models\LearningResource;
use App\Models\Notification;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\Payment;
use App\Models\Student;
use App\Models\User;
use Tests\TestCase;

/**
 * PHASE 2 — Organization data-isolation rework. Security-critical: cross-org must fail CLOSED (404),
 * a plain member tutor must NOT see other members, owner/manager see the WHOLE org, and solo tutors /
 * students / parents are unchanged (zero regression). See design §4 + test spec §9.1 (X-ORG-1..14).
 */
class OrgIsolationTest extends TestCase
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
     * Fail-closed denial. Depending on the endpoint's guard the app answers 403 (canManageResource /
     * inline capability checks) or 404 (guardClassAccess / guardStudentAccess). Both are denials; the
     * security property under test is "not 200 and no data", not the exact code.
     */
    private function assertDenied($response): void
    {
        $this->assertContains($response->status(), [403, 404], 'expected a fail-closed denial (403/404), got '.$response->status());
    }

    // ---------------------------------------------------------------------------------------------
    // X-ORG-1 / X-ORG-5 — owner/manager list = the WHOLE org (every member tutor), nothing more.
    // ---------------------------------------------------------------------------------------------

    public function test_manager_lists_all_org_classes_across_members(): void
    {
        [$owner, $org] = $this->makeOrg();
        $manager = $this->addMember($org, 'manager');
        $t1 = $this->addMember($org, 'tutor');
        $t2 = $this->addMember($org, 'tutor');

        $this->orgClass($org, $t1);
        $this->orgClass($org, $t2);
        $this->orgClass($org, $owner);

        // A different org's class must never appear.
        [, $orgB] = $this->makeOrg();
        $this->orgClass($orgB, $orgB->owner);

        foreach ([$owner, $manager] as $viewer) {
            $this->actingAsApi($viewer)
                ->getJson('/api/v1/classes')
                ->assertStatus(200)
                ->assertJsonCount(3, 'data')
                ->assertJsonPath('meta.statistics.total', 3);
        }
    }

    // ---------------------------------------------------------------------------------------------
    // X-ORG-4 — a plain member tutor sees ONLY their own classes, never a co-member's.
    // ---------------------------------------------------------------------------------------------

    public function test_member_tutor_does_not_see_other_members_classes(): void
    {
        [, $org] = $this->makeOrg();
        $t1 = $this->addMember($org, 'tutor');
        $t2 = $this->addMember($org, 'tutor');

        $this->orgClass($org, $t1);
        $classT2 = $this->orgClass($org, $t2);

        $this->actingAsApi($t1)
            ->getJson('/api/v1/classes')
            ->assertStatus(200)
            ->assertJsonCount(1, 'data');

        // And by id: T1 cannot open T2's class → fail-closed.
        $this->assertDenied(
            $this->actingAsApi($t1)->getJson("/api/v1/classes/{$classT2->hash_id}")
        );
    }

    // ---------------------------------------------------------------------------------------------
    // X-ORG-2 — cross-org by id → 404 (guardClassAccess).
    // ---------------------------------------------------------------------------------------------

    public function test_manager_cannot_open_a_class_of_another_org(): void
    {
        [, $orgA] = $this->makeOrg();
        $manager = $this->addMember($orgA, 'manager');

        [$ownerB, $orgB] = $this->makeOrg();
        $classB = $this->orgClass($orgB, $ownerB);

        $this->assertDenied(
            $this->actingAsApi($manager)->getJson("/api/v1/classes/{$classB->hash_id}")
        );
    }

    // ---------------------------------------------------------------------------------------------
    // X-ORG-6 — solo classes (organization_id = NULL) are invisible to any org, and vice-versa.
    // ---------------------------------------------------------------------------------------------

    public function test_solo_class_is_invisible_to_org_owner(): void
    {
        [$owner, $org] = $this->makeOrg();
        $this->orgClass($org, $owner);

        $solo = $this->tutor();
        $soloClass = ClassRoom::factory()->create(['tutor_id' => $solo->id, 'organization_id' => null]);

        $this->actingAsApi($owner)
            ->getJson('/api/v1/classes')
            ->assertStatus(200)
            ->assertJsonCount(1, 'data');

        $this->assertDenied(
            $this->actingAsApi($owner)->getJson("/api/v1/classes/{$soloClass->hash_id}")
        );
    }

    // ---------------------------------------------------------------------------------------------
    // X-ORG-3 — cross-org student by id → 404 (guardStudentAccess).
    // ---------------------------------------------------------------------------------------------

    public function test_owner_cannot_open_student_of_another_org(): void
    {
        [$ownerA, $orgA] = $this->makeOrg();
        $this->orgClass($orgA, $ownerA);

        [$ownerB, $orgB] = $this->makeOrg();
        $classB = $this->orgClass($orgB, $ownerB);
        $studentB = $this->studentInClass($classB);

        $this->assertDenied(
            $this->actingAsApi($ownerA)->getJson("/api/v1/students/{$studentB->hash_id}")
        );
    }

    // ---------------------------------------------------------------------------------------------
    // X-ORG-13 — owner/manager may read a member tutor's student's child records; cross-org → 404.
    // ---------------------------------------------------------------------------------------------

    public function test_manager_reads_member_students_child_records(): void
    {
        [$owner, $org] = $this->makeOrg();
        $manager = $this->addMember($org, 'manager');
        $t1 = $this->addMember($org, 'tutor');

        $class = $this->orgClass($org, $t1);
        $student = $this->studentInClass($class);
        Grade::factory()->create(['student_id' => $student->id, 'class_id' => $class->id, 'tutor_id' => $t1->id]);
        Attendance::factory()->create(['student_id' => $student->id, 'class_id' => $class->id, 'tutor_id' => $t1->id]);
        Payment::factory()->create(['student_id' => $student->id, 'class_id' => $class->id, 'status' => 'paid']);

        foreach ([$owner, $manager] as $viewer) {
            $this->actingAsApi($viewer)
                ->getJson("/api/v1/students/{$student->hash_id}/grades")
                ->assertStatus(200)
                ->assertJsonCount(1, 'data.grades');

            $this->actingAsApi($viewer)
                ->getJson("/api/v1/students/{$student->hash_id}/attendance")
                ->assertStatus(200)
                ->assertJsonCount(1, 'data.attendances');

            $this->actingAsApi($viewer)
                ->getJson("/api/v1/students/{$student->hash_id}/payments")
                ->assertStatus(200)
                ->assertJsonCount(1, 'data.payments');
        }
    }

    public function test_child_records_of_other_org_student_are_fail_closed(): void
    {
        [$ownerA, $orgA] = $this->makeOrg();
        $this->orgClass($orgA, $ownerA);

        [$ownerB, $orgB] = $this->makeOrg();
        $classB = $this->orgClass($orgB, $ownerB);
        $studentB = $this->studentInClass($classB);
        Grade::factory()->create(['student_id' => $studentB->id, 'class_id' => $classB->id, 'tutor_id' => $ownerB->id]);

        // Manager of A must not read B's student's grades/attendance/payments.
        foreach (['grades', 'attendance', 'payments'] as $child) {
            $this->assertDenied(
                $this->actingAsApi($ownerA)->getJson("/api/v1/students/{$studentB->hash_id}/{$child}")
            );
        }
    }

    public function test_member_tutor_cannot_read_co_members_student_child_records(): void
    {
        [, $org] = $this->makeOrg();
        $t1 = $this->addMember($org, 'tutor');
        $t2 = $this->addMember($org, 'tutor');

        $classT2 = $this->orgClass($org, $t2);
        $studentT2 = $this->studentInClass($classT2);

        // T1 does not teach this student → fail-closed (403 access denial on this endpoint).
        $this->actingAsApi($t1)
            ->getJson("/api/v1/students/{$studentT2->hash_id}/grades")
            ->assertStatus(403);
    }

    // ---------------------------------------------------------------------------------------------
    // X-ORG-8 — reassign (tutor_id handover) moves visibility of the class + its child data.
    // ---------------------------------------------------------------------------------------------

    public function test_reassigning_class_tutor_moves_visibility(): void
    {
        [, $org] = $this->makeOrg();
        $t1 = $this->addMember($org, 'tutor');
        $t2 = $this->addMember($org, 'tutor');

        $class = $this->orgClass($org, $t1);

        // Before handover: T1 sees it, T2 does not.
        $this->actingAsApi($t1)->getJson("/api/v1/classes/{$class->hash_id}")->assertStatus(200);
        $this->assertDenied($this->actingAsApi($t2)->getJson("/api/v1/classes/{$class->hash_id}"));

        // Handover (owner/manager action in Phase 3; here we exercise the isolation consequence).
        $class->update(['tutor_id' => $t2->id]);

        $this->assertDenied($this->actingAsApi($t1->fresh())->getJson("/api/v1/classes/{$class->hash_id}"));
        $this->actingAsApi($t2->fresh())->getJson("/api/v1/classes/{$class->hash_id}")->assertStatus(200);
    }

    // ---------------------------------------------------------------------------------------------
    // X-ORG-11 — org context is derived from the caller, never trusted from request input.
    // ---------------------------------------------------------------------------------------------

    public function test_create_class_ignores_organization_id_from_input(): void
    {
        [, $org] = $this->makeOrg();
        $t1 = $this->addMember($org, 'tutor');

        [, $orgB] = $this->makeOrg();

        $this->actingAsApi($t1)
            ->postJson('/api/v1/classes', [
                'name' => 'Lớp inj '.uniqid(),
                'subject' => 'Toán',
                'start_date' => now()->toDateString(),
                'organization_id' => $orgB->id, // hostile input — must be ignored
            ])
            ->assertStatus(201);

        $created = ClassRoom::where('tutor_id', $t1->id)->latest('id')->first();
        $this->assertSame($org->id, $created->organization_id, 'org_id must come from the caller, not input');
    }

    // ---------------------------------------------------------------------------------------------
    // Member tutor class creation — an active member can create a class within the org (H-6).
    // ---------------------------------------------------------------------------------------------

    public function test_member_tutor_can_create_class_in_org(): void
    {
        [, $org] = $this->makeOrg();
        $t1 = $this->addMember($org, 'tutor');

        $this->actingAsApi($t1)
            ->postJson('/api/v1/classes', [
                'name' => 'Lớp GV '.uniqid(),
                'subject' => 'Toán',
                'start_date' => now()->toDateString(),
            ])
            ->assertStatus(201);
    }

    // ---------------------------------------------------------------------------------------------
    // Mutations fail-closed cross-org.
    // ---------------------------------------------------------------------------------------------

    public function test_manager_cannot_delete_class_of_another_org(): void
    {
        [, $orgA] = $this->makeOrg();
        $manager = $this->addMember($orgA, 'manager');

        [$ownerB, $orgB] = $this->makeOrg();
        $classB = $this->orgClass($orgB, $ownerB);

        $this->assertDenied(
            $this->actingAsApi($manager)->deleteJson("/api/v1/classes/{$classB->hash_id}")
        );

        $this->assertDatabaseHas('classes', ['id' => $classB->id, 'deleted_at' => null]);
    }

    public function test_owner_can_update_member_class_in_org(): void
    {
        [$owner, $org] = $this->makeOrg();
        $t1 = $this->addMember($org, 'tutor');
        $class = $this->orgClass($org, $t1);

        $this->actingAsApi($owner)
            ->putJson("/api/v1/classes/{$class->hash_id}", [
                'name' => 'Đổi tên bởi owner',
                'subject' => $class->subject,
            ])
            ->assertStatus(200);
    }

    // ---------------------------------------------------------------------------------------------
    // X-ORG-14 — learning_resources & notifications: owner sees members', tutor org A ≠ org B.
    // ---------------------------------------------------------------------------------------------

    public function test_learning_resources_org_scope(): void
    {
        [$owner, $org] = $this->makeOrg();
        $t1 = $this->addMember($org, 'tutor');

        LearningResource::factory()->create(['tutor_id' => $t1->id, 'status' => 'active']);

        [$ownerB, $orgB] = $this->makeOrg();
        $tB = $this->addMember($orgB, 'tutor');
        LearningResource::factory()->create(['tutor_id' => $tB->id, 'status' => 'active']);

        // Owner of A sees the member's resource (1), not org B's.
        $this->actingAsApi($owner)
            ->getJson('/api/v1/learning-resources')
            ->assertStatus(200)
            ->assertJsonCount(1, 'data');

        // A plain member tutor of A sees only their own; org B invisible.
        $this->actingAsApi($t1)
            ->getJson('/api/v1/learning-resources')
            ->assertStatus(200)
            ->assertJsonCount(1, 'data');

        // Tutor of B never sees A's.
        $this->actingAsApi($tB)
            ->getJson('/api/v1/learning-resources')
            ->assertStatus(200)
            ->assertJsonCount(1, 'data');
    }

    public function test_notifications_org_scope(): void
    {
        [$owner, $org] = $this->makeOrg();
        $t1 = $this->addMember($org, 'tutor');
        Notification::factory()->create(['created_by' => $t1->id, 'status' => 'sent']);

        [$ownerB, $orgB] = $this->makeOrg();
        $tB = $this->addMember($orgB, 'tutor');
        Notification::factory()->create(['created_by' => $tB->id, 'status' => 'sent']);

        // Owner of A sees the member's notification, not org B's.
        $this->actingAsApi($owner)
            ->getJson('/api/v1/notifications')
            ->assertStatus(200)
            ->assertJsonCount(1, 'data');

        // Owner of B sees only B's.
        $this->actingAsApi($ownerB)
            ->getJson('/api/v1/notifications')
            ->assertStatus(200)
            ->assertJsonCount(1, 'data');
    }

    // ---------------------------------------------------------------------------------------------
    // Zero-regression — a solo tutor's world is entirely unchanged by the org branches.
    // ---------------------------------------------------------------------------------------------

    public function test_solo_tutor_sees_only_own_classes(): void
    {
        $solo = $this->tutor();
        ClassRoom::factory()->create(['tutor_id' => $solo->id, 'organization_id' => null]);
        ClassRoom::factory()->create(['tutor_id' => $solo->id, 'organization_id' => null]);

        // An unrelated org exists with classes — must not leak into the solo tutor's list.
        [$owner, $org] = $this->makeOrg();
        $this->orgClass($org, $owner);

        $this->actingAsApi($solo)
            ->getJson('/api/v1/classes')
            ->assertStatus(200)
            ->assertJsonCount(2, 'data');
    }

    public function test_org_owner_dashboard_aggregates_the_whole_org(): void
    {
        [$owner, $org] = $this->makeOrg();
        $t1 = $this->addMember($org, 'tutor');
        $t2 = $this->addMember($org, 'tutor');

        $c1 = $this->orgClass($org, $t1);
        $c2 = $this->orgClass($org, $t2);
        $this->studentInClass($c1);
        $this->studentInClass($c2);

        $this->actingAsApi($owner)
            ->getJson('/api/v1/dashboard')
            ->assertStatus(200)
            ->assertJsonPath('data.user_type', 'organization')
            ->assertJsonPath('data.statistics.total_classes', 2)
            ->assertJsonPath('data.statistics.total_students', 2);
    }
}
