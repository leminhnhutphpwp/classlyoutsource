<?php

namespace Database\Factories;

use App\Models\Assignment;
use App\Models\Student;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Submission>
 */
class SubmissionFactory extends Factory
{
    protected $model = Submission::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $status = fake()->randomElement(['submitted', 'submitted', 'graded', 'graded', 'not_submitted']);
        $submittedAt = in_array($status, ['submitted', 'graded', 'late']) ? fake()->dateTimeBetween('-1 month', 'now') : null;

        $hasGrade = $status === 'graded';
        $isSubmitted = in_array($status, ['submitted', 'graded', 'late']);

        return [
            'assignment_id' => Assignment::factory(),
            'student_id' => Student::factory(),
            'content' => fake()->paragraph(2),
            'attachments' => $isSubmitted ? ['submissions/student_'.fake()->numberBetween(1, 100).'_assignment_'.fake()->numberBetween(1, 50).'.pdf'] : null,
            'submitted_at' => $submittedAt,
            'is_late' => $status === 'late',
            'graded_by' => $hasGrade ? User::factory()->tutor() : null,
            'graded_at' => $hasGrade ? fake()->dateTimeBetween('-2 weeks', 'now') : null,
            'score' => $hasGrade ? fake()->randomFloat(2, 0, 100) : null,
            'feedback' => $hasGrade ? fake()->optional(0.7)->sentence() : null,
            'status' => $status === 'missing' ? 'not_submitted' : $status,
            'attempt_number' => fake()->numberBetween(1, 2),
        ];
    }

    /**
     * Indicate that the submission is graded.
     */
    public function graded(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'graded',
            'graded_by' => User::factory()->tutor(),
            'graded_at' => fake()->dateTimeBetween('-2 weeks', 'now'),
            'score' => fake()->randomFloat(2, 50, 100),
            'feedback' => fake()->sentence(),
        ]);
    }

    /**
     * Indicate that the submission is late.
     */
    public function late(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'submitted',
            'is_late' => true,
            'submitted_at' => fake()->dateTimeBetween('-1 week', 'now'),
        ]);
    }
}
