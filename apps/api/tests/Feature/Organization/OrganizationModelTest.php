<?php

namespace Tests\Feature\Organization;

use App\Models\ClassRoom;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\User;
use Illuminate\Database\QueryException;
use Tests\TestCase;

/**
 * Phase 1 — Organization data model, relations and User org helpers.
 * No isolation / endpoints here (those are Phase 2-3).
 */
class OrganizationModelTest extends TestCase
{
    /** Migrations run on SQLite and the org tables/columns exist. */
    public function test_migrations_create_org_schema(): void
    {
        $this->assertTrue(\Schema::hasTable('organizations'));
        $this->assertTrue(\Schema::hasTable('organization_members'));
        $this->assertTrue(\Schema::hasColumn('classes', 'organization_id'));
    }

    public function test_create_org_with_owner_membership(): void
    {
        $owner = $this->tutor();
        $org = Organization::factory()->ownedBy($owner)->create();

        $member = OrganizationMember::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        $this->assertSame($owner->id, $org->owner->id);
        $this->assertTrue($org->members->contains($member));
        $this->assertSame('owner', $member->org_role);
        $this->assertNotEmpty($org->hash_id);
    }

    public function test_add_members_with_roles_and_relations(): void
    {
        $owner = $this->tutor();
        $org = Organization::factory()->ownedBy($owner)->create();
        OrganizationMember::factory()->owner()->create(['organization_id' => $org->id, 'user_id' => $owner->id]);

        $manager = $this->tutor();
        $tutor = $this->tutor();
        OrganizationMember::factory()->manager()->create(['organization_id' => $org->id, 'user_id' => $manager->id]);
        OrganizationMember::factory()->tutor()->create(['organization_id' => $org->id, 'user_id' => $tutor->id]);

        $this->assertCount(3, $org->activeMembers()->get());
        $this->assertEqualsCanonicalizing(
            [$owner->id, $manager->id, $tutor->id],
            $org->activeMemberUserIds()
        );
    }

    public function test_organization_classes_relation(): void
    {
        $owner = $this->tutor();
        $org = Organization::factory()->ownedBy($owner)->create();

        $orgClass = ClassRoom::factory()->create(['tutor_id' => $owner->id, 'organization_id' => $org->id]);
        $soloClass = ClassRoom::factory()->create(['tutor_id' => $owner->id, 'organization_id' => null]);

        $this->assertTrue($org->classes->contains($orgClass));
        $this->assertFalse($org->classes->contains($soloClass));
        $this->assertSame($org->id, $orgClass->organization->id);
        $this->assertNull($soloClass->organization);
    }

    public function test_unique_membership_per_org_and_user(): void
    {
        $owner = $this->tutor();
        $org = Organization::factory()->ownedBy($owner)->create();
        $user = $this->tutor();

        OrganizationMember::factory()->create(['organization_id' => $org->id, 'user_id' => $user->id]);

        $this->expectException(QueryException::class);
        OrganizationMember::factory()->create(['organization_id' => $org->id, 'user_id' => $user->id]);
    }

    public function test_current_organization_and_role_helpers(): void
    {
        $owner = $this->tutor();
        $org = Organization::factory()->ownedBy($owner)->create();
        OrganizationMember::factory()->owner()->create(['organization_id' => $org->id, 'user_id' => $owner->id]);

        $owner = $owner->fresh();
        $this->assertTrue($owner->belongsToOrganization());
        $this->assertSame($org->id, $owner->currentOrganization()->id);
        $this->assertSame('owner', $owner->orgRole());
        $this->assertTrue($owner->isOrgOwner());
        $this->assertFalse($owner->isOrgManager());
        $this->assertTrue($owner->isOrgViewerAll());
        $this->assertFalse($owner->isOrgMemberTutor());
    }

    public function test_manager_is_viewer_all_but_not_owner(): void
    {
        $org = Organization::factory()->create();
        $manager = $this->tutor();
        OrganizationMember::factory()->manager()->create(['organization_id' => $org->id, 'user_id' => $manager->id]);

        $manager = $manager->fresh();
        $this->assertSame('manager', $manager->orgRole());
        $this->assertTrue($manager->isOrgManager());
        $this->assertFalse($manager->isOrgOwner());
        $this->assertTrue($manager->isOrgViewerAll());
    }

    public function test_plain_tutor_member_is_not_viewer_all(): void
    {
        $org = Organization::factory()->create();
        $tutor = $this->tutor();
        OrganizationMember::factory()->tutor()->create(['organization_id' => $org->id, 'user_id' => $tutor->id]);

        $tutor = $tutor->fresh();
        $this->assertTrue($tutor->isOrgMemberTutor());
        $this->assertFalse($tutor->isOrgViewerAll());
    }

    /** A user with no active membership → all org helpers resolve to empty/null. */
    public function test_solo_tutor_has_no_org_context(): void
    {
        $solo = $this->tutor();

        $this->assertFalse($solo->belongsToOrganization());
        $this->assertNull($solo->currentOrganization());
        $this->assertNull($solo->orgRole());
        $this->assertFalse($solo->isOrgViewerAll());
    }

    /** Removed membership is not "active" → user has no current org (E-1 building block). */
    public function test_removed_membership_is_not_current(): void
    {
        $org = Organization::factory()->create();
        $tutor = $this->tutor();
        OrganizationMember::factory()->removed()->create(['organization_id' => $org->id, 'user_id' => $tutor->id]);

        $this->assertNull($tutor->fresh()->currentOrganization());
    }

    /** Single-org: currentOrganization() resolves exactly one active org even if a stale removed row exists. */
    public function test_single_org_current_resolves_one(): void
    {
        $tutor = $this->tutor();
        $orgA = Organization::factory()->create();
        $orgB = Organization::factory()->create();

        // Left org A (removed), now active in org B.
        OrganizationMember::factory()->removed()->create(['organization_id' => $orgA->id, 'user_id' => $tutor->id]);
        OrganizationMember::factory()->tutor()->create(['organization_id' => $orgB->id, 'user_id' => $tutor->id]);

        $this->assertSame($orgB->id, $tutor->fresh()->currentOrganization()->id);
    }

    // Removed test_effective_plan_owner_resolution because plan-related concepts are gone.
}
