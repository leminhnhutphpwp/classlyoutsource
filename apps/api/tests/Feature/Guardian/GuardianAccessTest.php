<?php

namespace Tests\Feature\Guardian;

use App\Models\ClassRoom;
use Tests\TestCase;

/**
 * Phase 1 authz: the guardStudentAccess parent branch + getGuardianStudentIds. A parent may access only
 * students they actively guard; a revoked link fails closed. Exercised via /payments/student/{student}
 * (byStudent), which gates purely on guardStudentAccess.
 */
class GuardianAccessTest extends TestCase
{
    public function test_parent_can_access_a_guarded_child(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $child = $this->studentInClass($class);

        $parent = $this->guardian();
        $this->linkGuardian($parent, $child);

        $this->actingAsApi($parent)
            ->getJson("/api/v1/payments/student/{$child->hash_id}")
            ->assertStatus(200);
    }

    public function test_parent_cannot_access_a_non_guarded_child(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $ownChild = $this->studentInClass($class);
        $otherChild = $this->studentInClass($class);

        $parent = $this->guardian();
        $this->linkGuardian($parent, $ownChild); // linked to ownChild only

        $this->actingAsApi($parent)
            ->getJson("/api/v1/payments/student/{$otherChild->hash_id}")
            ->assertStatus(404);
    }

    public function test_revoked_link_fails_closed(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $child = $this->studentInClass($class);

        $parent = $this->guardian();
        $this->linkGuardian($parent, $child, active: false); // revoked

        $this->actingAsApi($parent)
            ->getJson("/api/v1/payments/student/{$child->hash_id}")
            ->assertStatus(404);
    }

    public function test_guardian_relations_resolve(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $child = $this->studentInClass($class);
        $parent = $this->guardian();
        $this->linkGuardian($parent, $child);

        $this->assertSame([$child->id], $parent->fresh()->guardedStudentIds());
        $this->assertTrue($child->fresh()->guardians->contains('id', $parent->id));
    }
}
