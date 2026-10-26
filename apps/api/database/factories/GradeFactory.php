<?php

namespace Database\Factories;

use App\Models\ClassRoom;
use App\Models\Grade;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Grade>
 */
class GradeFactory extends Factory
{
    protected $model = Grade::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $maxScore = fake()->randomElement([10, 20, 50, 100]);
        $score = fake()->randomFloat(2, 0, $maxScore);

        return [
            'student_id' => Student::factory(),
            'class_id' => ClassRoom::factory(),
            'assignment_id' => null,
            'tutor_id' => User::factory()->tutor(),
            'grade_type_id' => null, // Will be set in seeder
            'title' => fake()->randomElement(['Bài kiểm tra 15 phút', 'Kiểm tra giữa kỳ', 'Kiểm tra cuối kỳ', 'Bài tập về nhà']),
            'score' => $score,
            'max_score' => $maxScore,
            'comments' => fake()->optional(0.5)->sentence(),
            'grade_date' => fake()->dateTimeBetween('-2 months', 'now'),
            'semester' => fake()->randomElement(['1', '2', 'Học kỳ 1', 'Học kỳ 2']),
        ];
    }

    /**
     * Indicate that the grade is excellent (A).
     */
    public function excellent(): static
    {
        return $this->state(fn (array $attributes) => [
            'score' => fake()->randomFloat(2, 90, 100),
            'max_score' => 100,
        ]);
    }

    /**
     * Indicate that the grade is passing (C or better).
     */
    public function passing(): static
    {
        return $this->state(fn (array $attributes) => [
            'score' => fake()->randomFloat(2, 70, 100),
            'max_score' => 100,
        ]);
    }

    /**
     * DEPRECATED: grade_type field removed, use grade_type_id instead
     */
}
