<?php

namespace Database\Factories;

use App\Models\Assignment;
use App\Models\ClassRoom;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Assignment>
 */
class AssignmentFactory extends Factory
{
    protected $model = Assignment::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $assignedDate = fake()->dateTimeBetween('-1 month', 'now');
        $dueDate = fake()->dateTimeBetween('now', '+2 weeks');

        $titles = ['Bài tập về nhà số ', 'Ôn tập chương ', 'Luyện tập ', 'Bài tập nâng cao ', 'Kiểm tra 15 phút ', 'Quiz ', 'Đồ án ', 'Dự án nhóm ', 'Bài tập lớn '];

        return [
            'class_id' => ClassRoom::factory(),
            'tutor_id' => User::factory()->tutor(),
            'assignment_type_id' => null, // Will be set in seeder
            'title' => fake()->randomElement($titles).fake()->numberBetween(1, 10),
            'description' => fake()->paragraph(),
            'instructions' => fake()->paragraph(2),
            'max_score' => fake()->randomElement([10, 20, 50, 100]),
            'assigned_date' => $assignedDate,
            'due_date' => $dueDate,
            'deadline' => $dueDate->format('Y-m-d').' 23:59:00',
            'allow_late_submission' => fake()->boolean(30),
            'status' => fake()->randomElement(['published', 'published', 'draft', 'closed']),
        ];
    }

    /**
     * Indicate that the assignment is published.
     */
    public function published(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'published',
        ]);
    }

    /**
     * DEPRECATED: type field removed, use assignment_type_id instead
     */
}
