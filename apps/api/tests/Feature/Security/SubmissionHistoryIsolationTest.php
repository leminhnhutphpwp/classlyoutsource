<?php

namespace Tests\Feature\Security;

use App\Models\Assignment;
use App\Models\ClassRoom;
use App\Models\Student;
use Tests\TestCase;

/**
 * Regression for the P0 IDOR: SubmissionController::history never verified the tutor owns the
 * assignment, and read an arbitrary request student_id → cross-tenant submission read.
 */
class SubmissionHistoryIsolationTest extends TestCase
{
    public function test_other_tutor_cannot_read_submission_history_of_foreign_assignment(): void
    {
        $owner = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $owner->id]);
        $assignment = Assignment::factory()->create(['class_id' => $class->id, 'tutor_id' => $owner->id]);
        $student = Student::factory()->create(['class_id' => $class->id]);

        $attacker = $this->tutor();

        $this->actingAsApi($attacker)
            ->getJson("/api/v1/submissions/assignment/{$assignment->hash_id}/history?student_id={$student->hash_id}")
            ->assertStatus(404);
    }

    public function test_owner_can_read_submission_history_of_own_assignment(): void
    {
        $owner = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $owner->id]);
        $assignment = Assignment::factory()->create(['class_id' => $class->id, 'tutor_id' => $owner->id]);
        $student = Student::factory()->create(['class_id' => $class->id]);

        $this->actingAsApi($owner)
            ->getJson("/api/v1/submissions/assignment/{$assignment->hash_id}/history?student_id={$student->hash_id}")
            ->assertStatus(200);
    }
}
