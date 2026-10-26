<?php

namespace Tests\Feature\Organization;

use App\Models\Assignment;
use App\Models\Attendance;
use App\Models\ClassRoom;
use App\Models\Grade;
use App\Models\LearningResource;
use App\Models\LessonNote;
use App\Models\Notification;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\Payment;
use App\Models\Schedule;
use App\Models\Student;
use App\Models\Submission;
use App\Models\User;
use Tests\TestCase;

/**
 * PHASE 5 — adversarial red-team for the Organization isolation. Every test here is an ATTACK that
 * must be DENIED (fail-closed). It probes the residual risks flagged by Phases 1-3:
 *   1. 403-vs-404 existence oracle across orgs.
 *   2. E-1 remove-member: FULL lockout across every resource type, incl. students created by the ex-member.
 *   3. Non-member isolation: a tutor who is not in the org can never reach an org endpoint.
 *   4. Privilege escalation: a plain member cannot create a tutor / remove / assign; no email oracle exposed.
 * Plus cross-org reads/mutations, manager boundary, and zero-regression spot checks.
 */
class OrgSecurityTest extends TestCase
{
    /** A tutor account that will own an org, NOT yet in any org. */
    private function enterpriseOwner(array $attrs = []): User
    {
        return $this->tutor($attrs);
    }

    /** Org owner + org + owner membership (ready-made center). */
    private function makeOrg(): array
    {
        $owner = $this->enterpriseOwner();
        $org = Organization::factory()->ownedBy($owner)->create();
        OrganizationMember::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        return [$owner->fresh(), $org];
    }

    private function addMember(Organization $org, string $role = 'tutor'): User
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

    /** Fail-closed denial — 403 (capability/manage) OR 404 (existence guard). Both mean "no access, no data". */
    private function assertDenied($response): void
    {
        $this->assertContains(
            $response->status(),
            [403, 404],
            'expected a fail-closed denial (403/404), got '.$response->status().': '.$response->getContent()
        );
    }

    /** Removed staff are suspended at the authentication layer, before any resource guard runs. */
    private function assertSuspended($response): void
    {
        $response->assertStatus(401)->assertJsonPath('code', 'ACCOUNT_SUSPENDED');
    }

    // =============================================================================================
    // RISK 1 — cross-org existence oracle. A different org's resource must be DENIED, and the
    // response must not leak the resource's payload.
    // =============================================================================================

    public function test_cross_org_class_show_is_denied_and_leaks_no_payload(): void
    {
        [$ownerA, $orgA] = $this->makeOrg();
        $this->orgClass($orgA, $ownerA);

        [$ownerB, $orgB] = $this->makeOrg();
        $classB = $this->orgClass($orgB, $ownerB, ['name' => 'SECRET-ORG-B-CLASS']);

        $resp = $this->actingAsApi($ownerA)->getJson("/api/v1/classes/{$classB->hash_id}");
        $this->assertDenied($resp);
        // No cross-org data may appear in the denial body.
        $this->assertStringNotContainsString('SECRET-ORG-B-CLASS', $resp->getContent());
    }

    public function test_cross_org_student_show_is_denied(): void
    {
        [$ownerA, $orgA] = $this->makeOrg();
        $this->orgClass($orgA, $ownerA);

        [$ownerB, $orgB] = $this->makeOrg();
        $classB = $this->orgClass($orgB, $ownerB);
        $studentB = $this->studentInClass($classB, ['name' => 'SECRET-ORG-B-STUDENT']);

        // Cross-org read of a foreign org's student is DENIED (no data). NOTE: StudentController::show
        // answers 403 here (its own checkAccess), not 404 — a pre-existing, app-wide 403-vs-404
        // existence oracle that also affects solo tutors (see report). The org-isolation property
        // (denied + zero payload) holds; we assert that, not the exact code.
        $resp = $this->actingAsApi($ownerA)->getJson("/api/v1/students/{$studentB->hash_id}");
        $this->assertDenied($resp);
        $this->assertStringNotContainsString('SECRET-ORG-B-STUDENT', $resp->getContent());
    }

    // =============================================================================================
    // RISK 2 — E-1 remove member: the ex-member must be FULLY fail-closed across EVERY resource type.
    // The existing endpoint test only covers classes + a factory-default student (created_by=null);
    // here we attack every child resource by hashid AND the realistic student the member CREATED.
    // =============================================================================================

    /**
     * A member's class carries a full child-record graph. After removal (class reassigned to owner),
     * the ex-member must lose access to grades / attendance / assignments / schedules / lesson_notes /
     * payments / submissions — by direct hashid, not just in list scopes.
     */
    public function test_ex_member_locked_out_of_all_child_records_after_removal(): void
    {
        [$owner, $org] = $this->makeOrg();
        $member = $this->addMember($org, 'tutor');
        $class = $this->orgClass($org, $member);
        // Student CREATED BY the member (realistic — StudentController::store sets created_by = caller).
        $student = $this->studentInClass($class, ['created_by' => $member->id]);

        $grade = Grade::factory()->create(['student_id' => $student->id, 'class_id' => $class->id, 'tutor_id' => $member->id]);
        $attendance = Attendance::factory()->create(['student_id' => $student->id, 'class_id' => $class->id, 'tutor_id' => $member->id]);
        $assignment = Assignment::factory()->create(['class_id' => $class->id, 'tutor_id' => $member->id, 'status' => 'published']);
        $schedule = Schedule::factory()->create(['class_id' => $class->id]);
        $lessonNote = LessonNote::factory()->create(['class_id' => $class->id, 'tutor_id' => $member->id]);
        $payment = Payment::factory()->create(['student_id' => $student->id, 'class_id' => $class->id, 'status' => 'paid']);
        $submission = Submission::factory()->create(['assignment_id' => $assignment->id, 'student_id' => $student->id]);

        // Remove the member (owner action).
        $memberRow = OrganizationMember::where('organization_id', $org->id)->where('user_id', $member->id)->first();
        $this->actingAsApi($owner)
            ->deleteJson("/api/v1/organizations/{$org->hash_id}/members/{$memberRow->hash_id}")
            ->assertStatus(200);

        $ex = $member->fresh();
        $this->assertNull($ex->currentOrganization());

        // Every former-org resource is blocked at authentication because removed staff are suspended.
        $this->assertSuspended($this->actingAsApi($ex)->getJson("/api/v1/classes/{$class->hash_id}"));
        $this->assertSuspended($this->actingAsApi($ex)->getJson("/api/v1/grades/{$grade->hash_id}"));
        $this->assertSuspended($this->actingAsApi($ex)->getJson("/api/v1/attendance/{$attendance->hash_id}"));
        $this->assertSuspended($this->actingAsApi($ex)->getJson("/api/v1/assignments/{$assignment->hash_id}"));
        $this->assertSuspended($this->actingAsApi($ex)->getJson("/api/v1/schedules/{$schedule->hash_id}"));
        $this->assertSuspended($this->actingAsApi($ex)->getJson("/api/v1/lesson-notes/{$lessonNote->hash_id}"));
        $this->assertSuspended($this->actingAsApi($ex)->getJson("/api/v1/payments/{$payment->hash_id}"));
        $this->assertSuspended($this->actingAsApi($ex)->getJson("/api/v1/submissions/{$submission->hash_id}"));

        // Mutations are blocked by that same authentication gate.
        $this->assertSuspended($this->actingAsApi($ex)->deleteJson("/api/v1/classes/{$class->hash_id}"));
        $this->assertSuspended($this->actingAsApi($ex)->deleteJson("/api/v1/grades/{$grade->hash_id}"));
    }

    /**
     * THE KEY ATTACK: a student the member CREATED (created_by = member). After removal the org keeps
     * the student (still enrolled in the now-owner-led class), so the ex-member must NOT retain access
     * via the created_by ownership branch — that would leak the org's student PII to an ejected tutor.
     */
    public function test_ex_member_cannot_access_student_they_created_after_removal(): void
    {
        [$owner, $org] = $this->makeOrg();
        $member = $this->addMember($org, 'tutor');
        $class = $this->orgClass($org, $member);
        $student = $this->studentInClass($class, ['created_by' => $member->id]);

        $memberRow = OrganizationMember::where('organization_id', $org->id)->where('user_id', $member->id)->first();
        $this->actingAsApi($owner)
            ->deleteJson("/api/v1/organizations/{$org->hash_id}/members/{$memberRow->hash_id}")
            ->assertStatus(200);

        $ex = $member->fresh();

        // Direct read and all child resources are blocked before ownership checks run.
        $this->assertSuspended($this->actingAsApi($ex)->getJson("/api/v1/students/{$student->hash_id}"));
        $this->assertSuspended($this->actingAsApi($ex)->getJson("/api/v1/students/{$student->hash_id}/grades"));
        $this->assertSuspended($this->actingAsApi($ex)->getJson("/api/v1/students/{$student->hash_id}/attendance"));
        $this->assertSuspended($this->actingAsApi($ex)->getJson("/api/v1/students/{$student->hash_id}/payments"));
        $this->assertSuspended($this->actingAsApi($ex)->getJson('/api/v1/students'));

        // The OWNER must still see the student (the org kept them).
        $this->actingAsApi($owner->fresh())
            ->getJson("/api/v1/students/{$student->hash_id}")
            ->assertStatus(200);
    }

    // =============================================================================================
    // RISK 3 — non-member isolation. A tutor who is NOT in any org must never reach an org endpoint
    // with a 200, and /organizations/current reports no org.
    // =============================================================================================

    public function test_non_member_tutor_cannot_reach_any_org_endpoint(): void
    {
        [$owner, $org] = $this->makeOrg();
        $class = $this->orgClass($org, $owner);
        $ownerRow = OrganizationMember::where('organization_id', $org->id)->where('user_id', $owner->id)->first();

        $outsider = $this->tutor(); // not a member of any org

        // Every {org} endpoint → 404 (guardOrgContext: not a member; no existence leak).
        foreach ([
            fn () => $this->actingAsApi($outsider)->getJson("/api/v1/organizations/{$org->hash_id}/dashboard"),
            fn () => $this->actingAsApi($outsider)->patchJson("/api/v1/organizations/{$org->hash_id}", ['name' => 'n']),
            fn () => $this->actingAsApi($outsider)->postJson("/api/v1/organizations/{$org->hash_id}/members", ['name' => 'N', 'email' => 'a@b.c']),
            fn () => $this->actingAsApi($outsider)->deleteJson("/api/v1/organizations/{$org->hash_id}/members/{$ownerRow->hash_id}"),
            fn () => $this->actingAsApi($outsider)->postJson("/api/v1/organizations/{$org->hash_id}/classes/{$class->hash_id}/assign", ['tutor_id' => $owner->hash_id]),
        ] as $call) {
            $call()->assertStatus(404);
        }

        // /organizations/current is legitimately readable but must report "no org".
        $this->actingAsApi($outsider)->getJson('/api/v1/organizations/current')
            ->assertStatus(200)->assertJsonPath('data', null);
    }

    // =============================================================================================
    // RISK 4 — privilege escalation. A plain member (org_role=tutor) cannot create a tutor / remove /
    // assign, and the email existence-oracle is never exposed to a non-owner/manager (denied before any
    // user lookup).
    // =============================================================================================

    public function test_plain_member_cannot_create_remove_or_assign(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');
        $victim = $this->addMember($org, 'tutor');
        $class = $this->orgClass($org, $tutor);
        $this->tutor(['email' => 'target@example.com']);

        $victimRow = OrganizationMember::where('organization_id', $org->id)->where('user_id', $victim->id)->first();

        // create → 403 (requireOrgRole) BEFORE any email lookup → no enumeration oracle.
        $this->actingAsApi($tutor)
            ->postJson("/api/v1/organizations/{$org->hash_id}/members", ['name' => 'Target', 'email' => 'target@example.com'])
            ->assertStatus(403);

        // Even probing a definitely-existing email yields the same 403 (oracle not leaked to a tutor).
        $this->actingAsApi($tutor)
            ->postJson("/api/v1/organizations/{$org->hash_id}/members", ['name' => 'Ghost', 'email' => 'ghost-'.uniqid().'@nope.test'])
            ->assertStatus(403);

        // remove a co-member → 403.
        $this->actingAsApi($tutor)
            ->deleteJson("/api/v1/organizations/{$org->hash_id}/members/{$victimRow->hash_id}")
            ->assertStatus(403);

        // assign a class → 403.
        $this->actingAsApi($tutor)
            ->postJson("/api/v1/organizations/{$org->hash_id}/classes/{$class->hash_id}/assign", ['tutor_id' => $victim->hash_id])
            ->assertStatus(403);

        // update the org → 403.
        $this->actingAsApi($tutor)
            ->patchJson("/api/v1/organizations/{$org->hash_id}", ['name' => 'hijack'])
            ->assertStatus(403);
    }

    // =============================================================================================
    // Cross-org mutations — owner of A cannot mutate B's resources; store cannot inject a foreign org.
    // =============================================================================================

    public function test_owner_cannot_mutate_child_records_of_another_org(): void
    {
        [$ownerA, $orgA] = $this->makeOrg();
        $this->orgClass($orgA, $ownerA);

        [$ownerB, $orgB] = $this->makeOrg();
        $classB = $this->orgClass($orgB, $ownerB);
        $studentB = $this->studentInClass($classB);
        $gradeB = Grade::factory()->create(['student_id' => $studentB->id, 'class_id' => $classB->id, 'tutor_id' => $ownerB->id]);
        $attendanceB = Attendance::factory()->create(['student_id' => $studentB->id, 'class_id' => $classB->id, 'tutor_id' => $ownerB->id]);

        // DELETE has no body validation, so it reaches the ownership guard directly → clean denial.
        $this->assertDenied($this->actingAsApi($ownerA)->deleteJson("/api/v1/grades/{$gradeB->hash_id}"));
        $this->assertDenied($this->actingAsApi($ownerA)->deleteJson("/api/v1/attendance/{$attendanceB->hash_id}"));
        // A fully-valid update payload still cannot mutate B's grade (ownership guard denies).
        $this->assertDenied($this->actingAsApi($ownerA)->putJson("/api/v1/grades/{$gradeB->hash_id}", [
            'title' => 'hijack', 'score' => 1, 'max_score' => 10, 'grade_date' => now()->toDateString(),
        ]));

        // And owner A cannot create a grade against B's class by supplying B's class/student ids
        // (valid payload → reaches canManageResource(classB) → denied).
        $this->assertDenied(
            $this->actingAsApi($ownerA)->postJson('/api/v1/grades', [
                'class_id' => $classB->hash_id,
                'student_id' => $studentB->hash_id,
                'title' => 'inj', 'score' => 9, 'max_score' => 10, 'grade_date' => now()->toDateString(),
            ])
        );
        $this->assertDatabaseHas('grades', ['id' => $gradeB->id, 'class_id' => $classB->id]);
    }

    public function test_member_cannot_assign_class_to_a_tutor_of_another_org_via_owner_path(): void
    {
        // Even the owner cannot hand a class to a foreign-org tutor (X-ORG-9 re-probe, distinct assignee).
        [$owner, $org] = $this->makeOrg();
        $member = $this->addMember($org, 'tutor');
        $class = $this->orgClass($org, $member);

        [, $orgB] = $this->makeOrg();
        $foreign = $this->addMember($orgB, 'tutor');

        $this->actingAsApi($owner)
            ->postJson("/api/v1/organizations/{$org->hash_id}/classes/{$class->hash_id}/assign", ['tutor_id' => $foreign->hash_id])
            ->assertStatus(422)
            ->assertJsonPath('code', 'INVALID_ASSIGNEE');

        $this->assertSame($member->id, $class->fresh()->tutor_id);
    }

    // =============================================================================================
    // guardOrgContext — a member of org A hitting org B's endpoints gets a uniform 404, whatever
    // their role in A.
    // =============================================================================================

    public function test_manager_of_org_a_gets_404_on_org_b_endpoints(): void
    {
        [, $orgA] = $this->makeOrg();
        $managerA = $this->addMember($orgA, 'manager');

        [$ownerB, $orgB] = $this->makeOrg();
        $classB = $this->orgClass($orgB, $ownerB);
        $ownerBRow = OrganizationMember::where('organization_id', $orgB->id)->where('user_id', $ownerB->id)->first();

        $this->actingAsApi($managerA)->getJson("/api/v1/organizations/{$orgB->hash_id}/dashboard")->assertStatus(404);
        $this->actingAsApi($managerA)->patchJson("/api/v1/organizations/{$orgB->hash_id}", ['name' => 'x'])->assertStatus(404);
        $this->actingAsApi($managerA)->postJson("/api/v1/organizations/{$orgB->hash_id}/members", ['name' => 'N', 'email' => 'x@y.z'])->assertStatus(404);
        $this->actingAsApi($managerA)->deleteJson("/api/v1/organizations/{$orgB->hash_id}/members/{$ownerBRow->hash_id}")->assertStatus(404);
        $this->actingAsApi($managerA)->postJson("/api/v1/organizations/{$orgB->hash_id}/classes/{$classB->hash_id}/assign", ['tutor_id' => $ownerB->hash_id])->assertStatus(404);
    }

    // =============================================================================================
    // Cross-org learning_resources / notifications by hashid (R3/R4).
    // =============================================================================================

    public function test_cross_org_learning_resource_and_notification_show_denied(): void
    {
        [$ownerA, $orgA] = $this->makeOrg();

        [$ownerB, $orgB] = $this->makeOrg();
        $tB = $this->addMember($orgB, 'tutor');
        $lrB = LearningResource::factory()->create(['tutor_id' => $tB->id, 'status' => 'active']);
        $notifB = Notification::factory()->create(['created_by' => $tB->id, 'status' => 'sent']);

        $this->assertDenied($this->actingAsApi($ownerA)->getJson("/api/v1/learning-resources/{$lrB->hash_id}"));
        $this->assertDenied($this->actingAsApi($ownerA)->getJson("/api/v1/notifications/{$notifB->hash_id}"));
    }

    // =============================================================================================
    // Zero-regression — students and parents see nothing org-related; /organizations/current is null.
    // =============================================================================================

    public function test_student_and_parent_see_no_org_context(): void
    {
        [$owner, $org] = $this->makeOrg();
        $class = $this->orgClass($org, $owner);
        $student = $this->studentInClass($class);

        $studentUser = $this->studentUser();
        $student->update(['user_id' => $studentUser->id]);

        $parent = $this->guardian();
        $this->linkGuardian($parent, $student);

        foreach ([$studentUser, $parent] as $caller) {
            $this->actingAsApi($caller)
                ->getJson('/api/v1/organizations/current')
                ->assertStatus(200)
                ->assertJsonPath('data', null);
        }

        // A student/parent can never create or reach an org.
        $this->assertDenied($this->actingAsApi($studentUser)->postJson('/api/v1/organizations', ['name' => 'nope']));
        $this->actingAsApi($studentUser)->getJson("/api/v1/organizations/{$org->hash_id}/dashboard")->assertStatus(404);
    }
}
