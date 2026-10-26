<?php

namespace Tests\Feature\Caching;

use App\Models\ClassRoom;
use Tests\TestCase;

/**
 * Regression for the cache-invalidation bug: editing a student left the (cached, version-keyed) class
 * roster stale because the observer/controller called Cache::forget on a versioned key (a no-op)
 * instead of bumping the students_class version.
 */
class RosterInvalidationTest extends TestCase
{
    public function test_class_roster_refreshes_after_a_student_is_renamed(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $student = $this->studentInClass($class, ['name' => 'Alice Nguyen']);

        // 1. First read populates the version-keyed roster cache.
        $this->actingAsApi($tutor)
            ->getJson("/api/v1/classes/{$class->hash_id}/students")
            ->assertStatus(200)
            ->assertJsonFragment(['name' => 'Alice Nguyen']);

        // 2. Rename the student (fires StudentObserver → must bump students_class version).
        $student->update(['name' => 'Bob Tran']);

        // 3. The roster must reflect the new name, not the stale cached one.
        $this->actingAsApi($tutor)
            ->getJson("/api/v1/classes/{$class->hash_id}/students")
            ->assertStatus(200)
            ->assertJsonFragment(['name' => 'Bob Tran'])
            ->assertJsonMissing(['name' => 'Alice Nguyen']);
    }
}
