<?php

namespace Tests\Feature\Grades;

use App\Models\ClassRoom;
use App\Models\Grade;
use App\Models\GradeType;
use Tests\TestCase;

/**
 * POST /grades/bulk — upsert an array of grades in one transaction (one grade per class+student+type
 * cell). Validates score <= max, enrolment, and grade-type access; a single bad item aborts the batch.
 */
class BulkGradesTest extends TestCase
{
    public function test_bulk_upsert_creates_then_updates(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $s1 = $this->studentInClass($class);
        $s2 = $this->studentInClass($class);
        $type = GradeType::create(['created_by' => $tutor->id, 'name' => 'Quiz', 'weight' => 1, 'is_active' => true]);

        // First call: two new grades.
        $this->actingAsApi($tutor)
            ->postJson('/api/v1/grades/bulk', [
                'class_id' => $class->hash_id,
                'grades' => [
                    ['student_id' => $s1->hash_id, 'grade_type_id' => $type->hash_id, 'score' => 8, 'max_score' => 10],
                    ['student_id' => $s2->hash_id, 'grade_type_id' => $type->hash_id, 'score' => 9, 'max_score' => 10],
                ],
            ])
            ->assertStatus(200)
            ->assertJsonPath('data.created', 2)
            ->assertJsonPath('data.updated', 0);

        $this->assertSame(2, Grade::where('class_id', $class->id)->count());

        // Second call: same cell for s1 → update (no new row).
        $this->actingAsApi($tutor)
            ->postJson('/api/v1/grades/bulk', [
                'class_id' => $class->hash_id,
                'grades' => [
                    ['student_id' => $s1->hash_id, 'grade_type_id' => $type->hash_id, 'score' => 10, 'max_score' => 10],
                ],
            ])
            ->assertStatus(200)
            ->assertJsonPath('data.created', 0)
            ->assertJsonPath('data.updated', 1);

        $this->assertSame(2, Grade::where('class_id', $class->id)->count());
        $this->assertEquals(10.0, (float) Grade::where('student_id', $s1->id)->where('grade_type_id', $type->id)->first()->score);
    }

    public function test_bulk_rejects_score_over_max_and_writes_nothing(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $s1 = $this->studentInClass($class);

        $this->actingAsApi($tutor)
            ->postJson('/api/v1/grades/bulk', [
                'class_id' => $class->hash_id,
                'grades' => [
                    ['student_id' => $s1->hash_id, 'score' => 11, 'max_score' => 10],
                ],
            ])
            ->assertStatus(422);

        $this->assertSame(0, Grade::where('class_id', $class->id)->count());
    }

    public function test_bulk_rejects_student_not_in_class(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);

        $otherClass = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $outsider = $this->studentInClass($otherClass);

        $this->actingAsApi($tutor)
            ->postJson('/api/v1/grades/bulk', [
                'class_id' => $class->hash_id,
                'grades' => [
                    ['student_id' => $outsider->hash_id, 'score' => 5, 'max_score' => 10],
                ],
            ])
            ->assertStatus(422);

        $this->assertSame(0, Grade::where('class_id', $class->id)->count());
    }

    public function test_bulk_forbidden_for_non_owner_tutor(): void
    {
        $owner = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $owner->id]);
        $student = $this->studentInClass($class);

        $intruder = $this->tutor();

        $this->actingAsApi($intruder)
            ->postJson('/api/v1/grades/bulk', [
                'class_id' => $class->hash_id,
                'grades' => [
                    ['student_id' => $student->hash_id, 'score' => 5, 'max_score' => 10],
                ],
            ])
            ->assertStatus(404);

        $this->assertSame(0, Grade::where('class_id', $class->id)->count());
    }
}
