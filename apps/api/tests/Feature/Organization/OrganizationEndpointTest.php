<?php

namespace Tests\Feature\Organization;

use App\Models\ClassRoom;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\User;
use Tests\TestCase;

/**
 * PHASE 3 — Organization / member endpoints + role/capability gating. Mirrors OrgIsolationTest helpers.
 * Security-critical cases: create is gated to the org owner, single-org is enforced, and E-1 (remove
 * member) must fail-closed so the ex-member loses ALL access to their former org data.
 */
class OrganizationEndpointTest extends TestCase
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

    private function assertDenied($response): void
    {
        $this->assertContains($response->status(), [403, 404], 'expected a fail-closed denial (403/404), got '.$response->status());
    }

    // ---------------------------------------------------------------------------------------------
    // Create — gated behind the org-owner role.
    // ---------------------------------------------------------------------------------------------

    public function test_enterprise_owner_can_create_org(): void
    {
        $owner = $this->enterpriseOwner();

        $this->actingAsApi($owner)
            ->postJson('/api/v1/organizations', ['name' => 'Trung tâm ABC'])
            ->assertStatus(201)
            ->assertJsonPath('data.name', 'Trung tâm ABC')
            ->assertJsonPath('data.my_role', 'owner');

        $org = Organization::where('owner_id', $owner->id)->first();
        $this->assertNotNull($org);
        $this->assertDatabaseHas('organization_members', [
            'organization_id' => $org->id,
            'user_id' => $owner->id,
            'org_role' => 'owner',
            'status' => 'active',
        ]);

        // GET /organizations/current reflects it.
        $this->actingAsApi($owner->fresh())
            ->getJson('/api/v1/organizations/current')
            ->assertStatus(200)
            ->assertJsonPath('data.my_role', 'owner')
            ->assertJsonPath('data.name', 'Trung tâm ABC');
    }

    public function test_single_org_rejects_creating_a_second_org(): void
    {
        [$owner] = $this->makeOrg();

        $this->actingAsApi($owner)
            ->postJson('/api/v1/organizations', ['name' => 'Trung tâm thứ hai'])
            ->assertStatus(409)
            ->assertJsonPath('code', 'ALREADY_IN_ORGANIZATION');
    }

    // ---------------------------------------------------------------------------------------------
    // Create a center-native tutor (the center provisions its own staff).
    // ---------------------------------------------------------------------------------------------

    public function test_owner_creates_center_tutor_who_is_active_pending_activation_and_can_teach(): void
    {
        [$owner, $org] = $this->makeOrg();

        // Owner provisions a brand-new tutor account → status=active, pending activation (activated=false).
        $this->actingAsApi($owner)
            ->postJson("/api/v1/organizations/{$org->hash_id}/members", [
                'name' => 'Gia sư Mới',
                'email' => 'newtutor@example.com',
                'phone' => '0900123123',
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.org_role', 'tutor')
            ->assertJsonPath('data.name', 'Gia sư Mới')
            ->assertJsonPath('data.email', 'newtutor@example.com')
            ->assertJsonPath('data.activated', false);

        // A real User was created (role=tutor, unverified) with an ACTIVE membership.
        $created = User::where('email', 'newtutor@example.com')->first();
        $this->assertNotNull($created);
        $this->assertSame('tutor', $created->role);
        $this->assertTrue($created->isTutor());
        $this->assertNull($created->email_verified_at);
        $this->assertDatabaseHas('organization_members', [
            'organization_id' => $org->id,
            'user_id' => $created->id,
            'org_role' => 'tutor',
            'status' => 'active',
            'invited_by' => $owner->id,
        ]);

        // Center-native: the new member can create a class which auto-belongs to the org.
        $this->actingAsApi($created->fresh())
            ->postJson('/api/v1/classes', [
                'name' => 'Lớp của GV trung tâm',
                'subject' => 'Toán',
                'start_date' => now()->toDateString(),
            ])
            ->assertStatus(201);

        $classCreated = ClassRoom::where('tutor_id', $created->id)->latest('id')->first();
        $this->assertSame($org->id, $classCreated->organization_id);
    }

    public function test_create_member_rejected_when_email_already_exists(): void
    {
        [$owner, $org] = $this->makeOrg();
        $this->tutor(['email' => 'taken@example.com']); // an existing (independent) account

        $this->actingAsApi($owner)
            ->postJson("/api/v1/organizations/{$org->hash_id}/members", [
                'name' => 'Trùng Email',
                'email' => 'taken@example.com',
            ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'EMAIL_ALREADY_EXISTS');

        // No membership was created for the existing user (no linking).
        $this->assertDatabaseMissing('organization_members', [
            'organization_id' => $org->id,
            'user_id' => User::where('email', 'taken@example.com')->value('id'),
        ]);
    }

    public function test_owner_can_create_a_manager_but_manager_can_only_create_tutors(): void
    {
        [$owner, $org] = $this->makeOrg();

        // Owner creates a manager.
        $this->actingAsApi($owner)
            ->postJson("/api/v1/organizations/{$org->hash_id}/members", [
                'name' => 'Quản lý Mới',
                'email' => 'newmgr@example.com',
                'org_role' => 'manager',
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.org_role', 'manager')
            ->assertJsonPath('data.status', 'active');

        $manager = User::where('email', 'newmgr@example.com')->first()->fresh();

        // The manager can create a tutor...
        $this->actingAsApi($manager)
            ->postJson("/api/v1/organizations/{$org->hash_id}/members", [
                'name' => 'GV của quản lý',
                'email' => 'mgr-tutor@example.com',
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.org_role', 'tutor');

        // ...but NOT another manager (owner-only).
        $this->actingAsApi($manager)
            ->postJson("/api/v1/organizations/{$org->hash_id}/members", [
                'name' => 'Quản lý cấm',
                'email' => 'mgr2@example.com',
                'org_role' => 'manager',
            ])
            ->assertStatus(403);

        $this->assertDatabaseMissing('users', ['email' => 'mgr2@example.com']);
    }

    // ---------------------------------------------------------------------------------------------
    // Assign class to a member (handover).
    // ---------------------------------------------------------------------------------------------

    public function test_owner_assigns_class_to_member_and_visibility_moves(): void
    {
        [$owner, $org] = $this->makeOrg();
        $t1 = $this->addMember($org, 'tutor');
        $t2 = $this->addMember($org, 'tutor');
        $class = $this->orgClass($org, $t1);

        $this->actingAsApi($owner)
            ->postJson("/api/v1/organizations/{$org->hash_id}/classes/{$class->hash_id}/assign", [
                'tutor_id' => $t2->hash_id,
            ])
            ->assertStatus(200);

        $this->assertSame($t2->id, $class->fresh()->tutor_id);

        // Handover consequence: T1 loses access, T2 gains it.
        $this->assertDenied($this->actingAsApi($t1->fresh())->getJson("/api/v1/classes/{$class->hash_id}"));
        $this->actingAsApi($t2->fresh())->getJson("/api/v1/classes/{$class->hash_id}")->assertStatus(200);
    }

    public function test_cannot_assign_class_to_a_non_member(): void
    {
        [$owner, $org] = $this->makeOrg();
        $t1 = $this->addMember($org, 'tutor');
        $class = $this->orgClass($org, $t1);

        // A tutor from another org (never a member of this org).
        [, $orgB] = $this->makeOrg();
        $outsider = $this->addMember($orgB, 'tutor');

        $this->actingAsApi($owner)
            ->postJson("/api/v1/organizations/{$org->hash_id}/classes/{$class->hash_id}/assign", [
                'tutor_id' => $outsider->hash_id,
            ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'INVALID_ASSIGNEE');

        $this->assertSame($t1->id, $class->fresh()->tutor_id);
    }

    // ---------------------------------------------------------------------------------------------
    // E-1 — remove member is the key security test: ex-member must be fully fail-closed.
    // ---------------------------------------------------------------------------------------------

    public function test_removing_member_reassigns_classes_to_owner_and_fails_closed_for_ex_member(): void
    {
        [$owner, $org] = $this->makeOrg();
        $t1 = $this->addMember($org, 'tutor');
        $class = $this->orgClass($org, $t1);
        $student = $this->studentInClass($class);

        // Before removal T1 can see their class + student.
        $this->actingAsApi($t1)->getJson("/api/v1/classes/{$class->hash_id}")->assertStatus(200);

        $member = OrganizationMember::where('organization_id', $org->id)
            ->where('user_id', $t1->id)->first();

        $this->actingAsApi($owner)
            ->deleteJson("/api/v1/organizations/{$org->hash_id}/members/{$member->hash_id}")
            ->assertStatus(200);

        // Membership removed; the class stays in the org but is now owned by the owner.
        $this->assertDatabaseHas('organization_members', [
            'id' => $member->id, 'status' => 'removed',
        ]);
        $class->refresh();
        $this->assertSame($owner->id, $class->tutor_id);
        $this->assertSame($org->id, $class->organization_id);

        // Base-core lifecycle: removed staff are suspended before any former-org resource can be read.
        $ex = $t1->fresh();
        $this->assertNull($ex->currentOrganization());
        $this->assertTrue($ex->isLoginBlocked());
        $this->actingAsApi($ex)->getJson("/api/v1/classes/{$class->hash_id}")
            ->assertStatus(401)
            ->assertJsonPath('code', 'ACCOUNT_SUSPENDED');
        $this->actingAsApi($ex)->getJson("/api/v1/students/{$student->hash_id}")
            ->assertStatus(401)
            ->assertJsonPath('code', 'ACCOUNT_SUSPENDED');
        $this->actingAsApi($ex)->getJson('/api/v1/classes')
            ->assertStatus(401)
            ->assertJsonPath('code', 'ACCOUNT_SUSPENDED');

        // The owner still sees the class.
        $this->actingAsApi($owner->fresh())
            ->getJson("/api/v1/classes/{$class->hash_id}")
            ->assertStatus(200);
    }

    public function test_cannot_remove_the_owner(): void
    {
        [$owner, $org] = $this->makeOrg();
        $ownerMember = OrganizationMember::where('organization_id', $org->id)
            ->where('user_id', $owner->id)->first();

        $this->actingAsApi($owner)
            ->deleteJson("/api/v1/organizations/{$org->hash_id}/members/{$ownerMember->hash_id}")
            ->assertStatus(422)
            ->assertJsonPath('code', 'CANNOT_REMOVE_OWNER');
    }

    public function test_manager_cannot_remove_another_manager(): void
    {
        [$owner, $org] = $this->makeOrg();
        $m1 = $this->addMember($org, 'manager');
        $m2 = $this->addMember($org, 'manager');

        $m2Member = OrganizationMember::where('organization_id', $org->id)
            ->where('user_id', $m2->id)->first();

        $this->actingAsApi($m1)
            ->deleteJson("/api/v1/organizations/{$org->hash_id}/members/{$m2Member->hash_id}")
            ->assertStatus(403);
    }

    // ---------------------------------------------------------------------------------------------
    // Dashboard aggregation.
    // ---------------------------------------------------------------------------------------------

    public function test_org_dashboard_aggregates_the_whole_org(): void
    {
        [$owner, $org] = $this->makeOrg();
        $t1 = $this->addMember($org, 'tutor');
        $t2 = $this->addMember($org, 'tutor');

        $c1 = $this->orgClass($org, $t1);
        $c2 = $this->orgClass($org, $t2);
        $this->studentInClass($c1);
        $this->studentInClass($c2);

        $this->actingAsApi($owner)
            ->getJson("/api/v1/organizations/{$org->hash_id}/dashboard")
            ->assertStatus(200)
            ->assertJsonPath('data.user_type', 'organization')
            ->assertJsonPath('data.statistics.total_classes', 2)
            ->assertJsonPath('data.statistics.total_students', 2);
    }

    // ---------------------------------------------------------------------------------------------
    // Fail-closed for non-members / wrong role / unauthenticated (X-ORG-10).
    // ---------------------------------------------------------------------------------------------

    public function test_non_member_cannot_touch_the_org(): void
    {
        [, $org] = $this->makeOrg();
        $outsider = $this->enterpriseOwner(); // has the capability, but is NOT in THIS org

        // Different org's owner also must not reach in.
        [$ownerB] = $this->makeOrg();

        foreach ([$outsider, $ownerB] as $caller) {
            $this->actingAsApi($caller)
                ->getJson("/api/v1/organizations/{$org->hash_id}/dashboard")
                ->assertStatus(404);

            $this->actingAsApi($caller)
                ->patchJson("/api/v1/organizations/{$org->hash_id}", ['name' => 'hijack'])
                ->assertStatus(404);

            $this->actingAsApi($caller)
                ->postJson("/api/v1/organizations/{$org->hash_id}/members", ['name' => 'X', 'email' => 'x@example.com'])
                ->assertStatus(404);
        }
    }

    public function test_member_tutor_cannot_use_owner_manager_endpoints(): void
    {
        [, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');
        $this->tutor(['email' => 'target@example.com']);

        // guardOrgContext passes (they ARE in this org) but requireOrgRole denies → 403.
        $this->actingAsApi($tutor)
            ->getJson("/api/v1/organizations/{$org->hash_id}/dashboard")
            ->assertStatus(403);

        $this->actingAsApi($tutor)
            ->postJson("/api/v1/organizations/{$org->hash_id}/members", ['name' => 'Target', 'email' => 'target@example.com'])
            ->assertStatus(403);

        $this->actingAsApi($tutor)
            ->patchJson("/api/v1/organizations/{$org->hash_id}", ['name' => 'nope'])
            ->assertStatus(403);
    }

    public function test_org_endpoints_require_authentication(): void
    {
        [, $org] = $this->makeOrg();

        $this->getJson("/api/v1/organizations/{$org->hash_id}/dashboard")->assertStatus(401);
        $this->postJson('/api/v1/organizations', ['name' => 'x'])->assertStatus(401);
    }

    public function test_owner_can_update_org(): void
    {
        [$owner, $org] = $this->makeOrg();

        $this->actingAsApi($owner)
            ->patchJson("/api/v1/organizations/{$org->hash_id}", [
                'name' => 'Tên mới',
                'description' => 'Mô tả mới',
            ])
            ->assertStatus(200)
            ->assertJsonPath('data.name', 'Tên mới')
            ->assertJsonPath('data.description', 'Mô tả mới');
    }
}
