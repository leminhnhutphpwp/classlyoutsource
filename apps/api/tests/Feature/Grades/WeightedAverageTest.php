<?php

namespace Tests\Feature\Grades;

use App\Models\ClassRoom;
use App\Models\Grade;
use App\Models\GradeType;
use App\Models\Student;
use Tests\TestCase;

/**
 * Grade::weightedAveragePercentage weights each grade by its GradeType.weight (default 1). Before this
 * fix the weight column existed but no average used it — all averages were plain/unweighted.
 */
class WeightedAverageTest extends TestCase
{
    public function test_average_is_weighted_by_grade_type_weight(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $student = Student::factory()->create(['created_by' => $tutor->id, 'class_id' => $class->id]);

        $light = GradeType::create(['created_by' => $tutor->id, 'name' => 'Quiz', 'weight' => 1, 'is_active' => true]);
        $heavy = GradeType::create(['created_by' => $tutor->id, 'name' => 'Final', 'weight' => 3, 'is_active' => true]);

        // 100% weighted 1, 50% weighted 3 → weighted = (100*1 + 50*3)/4 = 62.5 (plain mean would be 75).
        Grade::factory()->create([
            'student_id' => $student->id, 'class_id' => $class->id, 'tutor_id' => $tutor->id,
            'grade_type_id' => $light->id, 'score' => 10, 'max_score' => 10,
        ]);
        Grade::factory()->create([
            'student_id' => $student->id, 'class_id' => $class->id, 'tutor_id' => $tutor->id,
            'grade_type_id' => $heavy->id, 'score' => 5, 'max_score' => 10,
        ]);

        $weighted = Grade::weightedAveragePercentage(Grade::where('class_id', $class->id));

        $this->assertSame(62.5, $weighted);
        $this->assertNotSame(75.0, $weighted, 'weighting must change the result vs a plain mean');
    }

    public function test_null_weight_defaults_to_one(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $student = Student::factory()->create(['created_by' => $tutor->id, 'class_id' => $class->id]);

        // No grade_type_id → weight defaults to 1; two equal-weight grades → plain mean.
        Grade::factory()->create([
            'student_id' => $student->id, 'class_id' => $class->id, 'tutor_id' => $tutor->id,
            'grade_type_id' => null, 'score' => 8, 'max_score' => 10, // 80%
        ]);
        Grade::factory()->create([
            'student_id' => $student->id, 'class_id' => $class->id, 'tutor_id' => $tutor->id,
            'grade_type_id' => null, 'score' => 6, 'max_score' => 10, // 60%
        ]);

        $this->assertSame(70.0, Grade::weightedAveragePercentage(Grade::where('class_id', $class->id)));
    }

    public function test_no_grades_returns_zero(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);

        $this->assertSame(0.0, Grade::weightedAveragePercentage(Grade::where('class_id', $class->id)));
    }
}
