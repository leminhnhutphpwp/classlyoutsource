<?php

namespace Tests\Feature\Grades;

use App\Models\Assignment;
use App\Models\ClassRoom;
use App\Models\Grade;
use App\Models\Submission;
use Tests\TestCase;

/**
 * Grading a submission must write straight into the gradebook (no double entry) and stay idempotent:
 * re-grading the same submission updates its one Grade row rather than creating a duplicate.
 */
class SubmissionToGradebookTest extends TestCase
{
    private function scenario(): array
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $student = $this->studentInClass($class);
        $assignment = Assignment::factory()->published()->create([
            'class_id' => $class->id, 'tutor_id' => $tutor->id, 'max_score' => 10,
        ]);
        $submission = Submission::factory()->create([
            'assignment_id' => $assignment->id, 'student_id' => $student->id,
            'status' => 'submitted', 'score' => null, 'graded_by' => null, 'graded_at' => null,
        ]);

        return [$tutor, $class, $student, $assignment, $submission];
    }

    public function test_grading_submission_creates_linked_grade(): void
    {
        [$tutor, $class, $student, $assignment, $submission] = $this->scenario();

        $this->actingAsApi($tutor)
            ->postJson("/api/v1/submissions/{$submission->hash_id}/grade", [
                'score' => 8, 'feedback' => 'Tốt',
            ])
            ->assertStatus(200);

        $grade = Grade::where('submission_id', $submission->id)->first();
        $this->assertNotNull($grade);
        $this->assertSame($student->id, $grade->student_id);
        $this->assertSame($class->id, $grade->class_id);
        $this->assertSame($assignment->id, $grade->assignment_id);
        $this->assertEquals(8.0, (float) $grade->score);
        $this->assertEquals(10, (int) $grade->max_score);
    }

    public function test_regrading_does_not_duplicate_grade(): void
    {
        [$tutor, $class, $student, $assignment, $submission] = $this->scenario();

        $this->actingAsApi($tutor)
            ->postJson("/api/v1/submissions/{$submission->hash_id}/grade", ['score' => 6])
            ->assertStatus(200);

        $this->actingAsApi($tutor)
            ->postJson("/api/v1/submissions/{$submission->hash_id}/grade", ['score' => 9])
            ->assertStatus(200);

        $grades = Grade::where('submission_id', $submission->id)->get();
        $this->assertCount(1, $grades);
        $this->assertEquals(9.0, (float) $grades->first()->score);
    }
}
