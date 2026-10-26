<?php

namespace Tests\Feature\Grades;

use App\Models\Attendance;
use App\Models\ClassRoom;
use App\Models\Grade;
use App\Models\GradeType;
use Tests\TestCase;

/**
 * GET /classes/{class}/students/{student}/report-card — printable per-student summary: grades by type
 * (weighted), overall weighted average, and attendance rate. Fails closed for anyone who can't view both.
 */
class ReportCardTest extends TestCase
{
    public function test_report_card_returns_expected_structure(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $student = $this->studentInClass($class);

        $quiz = GradeType::create(['created_by' => $tutor->id, 'name' => 'Quiz', 'weight' => 1, 'is_active' => true]);
        $final = GradeType::create(['created_by' => $tutor->id, 'name' => 'Final', 'weight' => 3, 'is_active' => true]);

        Grade::factory()->create([
            'student_id' => $student->id, 'class_id' => $class->id, 'tutor_id' => $tutor->id,
            'grade_type_id' => $quiz->id, 'score' => 10, 'max_score' => 10,
        ]);
        Grade::factory()->create([
            'student_id' => $student->id, 'class_id' => $class->id, 'tutor_id' => $tutor->id,
            'grade_type_id' => $final->id, 'score' => 5, 'max_score' => 10,
        ]);

        // 3 present + 1 absent → 75% attendance rate.
        Attendance::factory()->count(3)->present()->create(['student_id' => $student->id, 'class_id' => $class->id, 'tutor_id' => $tutor->id]);
        Attendance::factory()->absent()->create(['student_id' => $student->id, 'class_id' => $class->id, 'tutor_id' => $tutor->id]);

        $res = $this->actingAsApi($tutor)
            ->getJson("/api/v1/classes/{$class->hash_id}/students/{$student->hash_id}/report-card")
            ->assertStatus(200)
            ->assertJsonPath('data.student._id', $student->hash_id)
            ->assertJsonPath('data.weighted_average_percentage', 62.5)
            ->assertJsonCount(2, 'data.grade_types')
            ->assertJsonPath('data.attendance.total', 4);

        // 3 present + 1 absent → 75% (JSON collapses 75.0 to 75, so compare loosely).
        $this->assertEquals(75.0, $res->json('data.attendance.attendance_rate'));
    }

    public function test_report_card_forbidden_for_non_owner_tutor(): void
    {
        $owner = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $owner->id]);
        $student = $this->studentInClass($class);

        $intruder = $this->tutor();

        $this->actingAsApi($intruder)
            ->getJson("/api/v1/classes/{$class->hash_id}/students/{$student->hash_id}/report-card")
            ->assertStatus(404);
    }

    public function test_report_card_404_when_student_not_in_class(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $otherClass = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $outsider = $this->studentInClass($otherClass);

        $this->actingAsApi($tutor)
            ->getJson("/api/v1/classes/{$class->hash_id}/students/{$outsider->hash_id}/report-card")
            ->assertStatus(404);
    }
}
