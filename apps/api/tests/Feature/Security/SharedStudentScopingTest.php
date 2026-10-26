<?php

namespace Tests\Feature\Security;

use App\Models\Attendance;
use App\Models\ClassRoom;
use App\Models\Grade;
use Tests\TestCase;

/**
 * A student can be enrolled with more than one tutor. Reading that student's child records must be
 * scoped to the caller's own classes — tutor A must not see tutor B's grades/attendance for a shared student.
 */
class SharedStudentScopingTest extends TestCase
{
    public function test_tutor_only_sees_own_class_grades_for_shared_student(): void
    {
        $tutorA = $this->tutor();
        $classA = ClassRoom::factory()->create(['tutor_id' => $tutorA->id]);

        $tutorB = $this->tutor();
        $classB = ClassRoom::factory()->create(['tutor_id' => $tutorB->id]);

        $student = $this->studentInClass($classA);
        $this->enroll($student, $classB);

        Grade::factory()->create(['student_id' => $student->id, 'class_id' => $classA->id, 'tutor_id' => $tutorA->id]);
        Grade::factory()->create(['student_id' => $student->id, 'class_id' => $classB->id, 'tutor_id' => $tutorB->id]);

        $this->actingAsApi($tutorA)
            ->getJson("/api/v1/students/{$student->hash_id}/grades")
            ->assertStatus(200)
            ->assertJsonCount(1, 'data.grades')
            ->assertJsonPath('data.statistics.total_count', 1);
    }

    public function test_tutor_only_sees_own_class_attendance_for_shared_student(): void
    {
        $tutorA = $this->tutor();
        $classA = ClassRoom::factory()->create(['tutor_id' => $tutorA->id]);

        $tutorB = $this->tutor();
        $classB = ClassRoom::factory()->create(['tutor_id' => $tutorB->id]);

        $student = $this->studentInClass($classA);
        $this->enroll($student, $classB);

        Attendance::factory()->create(['student_id' => $student->id, 'class_id' => $classA->id, 'tutor_id' => $tutorA->id]);
        Attendance::factory()->create(['student_id' => $student->id, 'class_id' => $classB->id, 'tutor_id' => $tutorB->id]);

        $this->actingAsApi($tutorA)
            ->getJson("/api/v1/students/{$student->hash_id}/attendance")
            ->assertStatus(200)
            ->assertJsonCount(1, 'data.attendances');
    }
}
