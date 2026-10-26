<?php

namespace Tests\Feature\Grades;

use App\Models\ClassRoom;
use App\Models\Grade;
use App\Models\GradeType;
use Tests\TestCase;

/**
 * GET /classes/{class}/gradebook — the whole-class grid (students × grade-type columns) with a
 * per-student weighted average. Owning tutor / super admin only.
 */
class GradebookTest extends TestCase
{
    public function test_gradebook_returns_matrix_with_weighted_average(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $student = $this->studentInClass($class);

        $quiz = GradeType::create(['created_by' => $tutor->id, 'name' => 'Quiz', 'weight' => 1, 'is_active' => true]);
        $final = GradeType::create(['created_by' => $tutor->id, 'name' => 'Final', 'weight' => 3, 'is_active' => true]);

        // 100% weight 1, 50% weight 3 → weighted (100*1 + 50*3)/4 = 62.5.
        Grade::factory()->create([
            'student_id' => $student->id, 'class_id' => $class->id, 'tutor_id' => $tutor->id,
            'grade_type_id' => $quiz->id, 'score' => 10, 'max_score' => 10,
        ]);
        Grade::factory()->create([
            'student_id' => $student->id, 'class_id' => $class->id, 'tutor_id' => $tutor->id,
            'grade_type_id' => $final->id, 'score' => 5, 'max_score' => 10,
        ]);

        $res = $this->actingAsApi($tutor)
            ->getJson("/api/v1/classes/{$class->hash_id}/gradebook")
            ->assertStatus(200)
            ->assertJsonCount(2, 'data.grade_types')
            ->assertJsonCount(1, 'data.students')
            ->assertJsonPath('data.students.0._id', $student->hash_id)
            ->assertJsonPath('data.students.0.weighted_average_percentage', 62.5);

        // Each used grade type shows up as a cell keyed by its hashid.
        $cells = $res->json('data.students.0.cells');
        $this->assertArrayHasKey($quiz->hash_id, $cells);
        $this->assertArrayHasKey($final->hash_id, $cells);
        $this->assertEquals(100.0, $cells[$quiz->hash_id]['average_percentage']);
        $this->assertEquals(50.0, $cells[$final->hash_id]['average_percentage']);
    }

    public function test_gradebook_forbidden_for_non_owner_tutor(): void
    {
        $owner = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $owner->id]);

        $intruder = $this->tutor();

        $this->actingAsApi($intruder)
            ->getJson("/api/v1/classes/{$class->hash_id}/gradebook")
            ->assertStatus(404);
    }

    public function test_gradebook_forbidden_for_student(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $student = $this->studentInClass($class);
        $studentUser = $this->studentUser();
        $student->update(['user_id' => $studentUser->id]);

        $this->actingAsApi($studentUser)
            ->getJson("/api/v1/classes/{$class->hash_id}/gradebook")
            ->assertStatus(404);
    }
}
