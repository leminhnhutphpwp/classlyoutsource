<?php

namespace Tests\Feature\Guardian;

use App\Models\ClassRoom;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\Student;
use Tests\TestCase;

class ParentPortalTest extends TestCase
{
    /**
     * Regression: a student created by an org MEMBER-tutor must let the parent in — a linked parent
     * can read the child's grades and attendance regardless of which tutor created the student.
     */
    public function test_parent_portal_works_for_org_member_tutor_student(): void
    {
        $owner = $this->tutor();
        $member = $this->tutor();
        $org = Organization::factory()->create(['owner_id' => $owner->id]);
        OrganizationMember::factory()->create(['organization_id' => $org->id, 'user_id' => $owner->id, 'org_role' => 'owner', 'status' => 'active']);
        OrganizationMember::factory()->create(['organization_id' => $org->id, 'user_id' => $member->id, 'org_role' => 'tutor', 'status' => 'active']);

        $child = Student::factory()->create(['created_by' => $member->id]);
        $parent = $this->guardian();
        $this->linkGuardian($parent, $child);

        $this->actingAsApi($parent)->getJson("/api/v1/parent/children/{$child->hash_id}/grades")->assertStatus(200);
        $this->actingAsApi($parent)->getJson("/api/v1/parent/children/{$child->hash_id}/attendance")->assertStatus(200);
    }

    public function test_parent_lists_children_and_reads_child_data(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $child = Student::factory()->create(['created_by' => $tutor->id, 'class_id' => $class->id]);
        $this->enroll($child, $class);
        $parent = $this->guardian();
        $this->linkGuardian($parent, $child);

        $this->actingAsApi($parent)->getJson('/api/v1/parent/children')
            ->assertStatus(200)->assertJsonCount(1, 'data.children');
        $this->actingAsApi($parent)->getJson("/api/v1/parent/children/{$child->hash_id}/grades")->assertStatus(200);
        $this->actingAsApi($parent)->getJson("/api/v1/parent/children/{$child->hash_id}/tuition")->assertStatus(200);
        $this->actingAsApi($parent)->getJson("/api/v1/parent/children/{$child->hash_id}/attendance")->assertStatus(200);
    }

    public function test_parent_cannot_read_non_guarded_child(): void
    {
        $tutor = $this->tutor();
        $child = Student::factory()->create(['created_by' => $tutor->id]);
        $other = Student::factory()->create(['created_by' => $tutor->id]);
        $parent = $this->guardian();
        $this->linkGuardian($parent, $child);

        $this->actingAsApi($parent)->getJson("/api/v1/parent/children/{$other->hash_id}/grades")->assertStatus(404);
    }

    public function test_parent_can_view_child(): void
    {
        // A parent's READ access to an already-linked child is never gated by any tutor-side feature
        // flag — a linked parent can always view their child's grades and tuition.
        $tutor = $this->tutor();
        $child = Student::factory()->create(['created_by' => $tutor->id]);
        $parent = $this->guardian();
        $this->linkGuardian($parent, $child);

        $this->actingAsApi($parent)->getJson("/api/v1/parent/children/{$child->hash_id}/grades")->assertStatus(200);
        $this->actingAsApi($parent)->getJson("/api/v1/parent/children/{$child->hash_id}/tuition")->assertStatus(200);
    }
}
