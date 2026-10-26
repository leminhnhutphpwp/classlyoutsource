<?php

namespace Database\Factories;

use App\Models\ClassRoom;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ClassRoom>
 */
class ClassRoomFactory extends Factory
{
    protected $model = ClassRoom::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $subjects = ['Toán', 'Lý', 'Hóa', 'Anh Văn', 'Văn', 'Sinh', 'Sử', 'Địa', 'Tiếng Nhật', 'Lập trình'];
        $grades = ['10', '11', '12', 'IELTS', 'TOEIC', 'Cơ bản', 'Nâng cao', 'Luyện thi'];

        $subject = fake()->randomElement($subjects);
        $grade = fake()->randomElement($grades);

        $days = fake()->randomElements(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], fake()->numberBetween(2, 3));
        $hour = fake()->numberBetween(14, 19);

        return [
            'tutor_id' => User::factory()->tutor(),
            'name' => $subject.' '.$grade,
            'subject' => $subject,
            'start_date' => fake()->dateTimeBetween('-2 months', 'now'),
            'end_date' => fake()->dateTimeBetween('+3 months', '+6 months'),
            'schedule' => [
                'days' => $days,
                'time' => $hour.':00-'.($hour + 2).':00',
            ],
            'tuition_fee' => fake()->randomElement([500000, 800000, 1000000, 1200000, 1500000, 2000000]),
            'max_students' => fake()->numberBetween(15, 30),
            'description' => fake()->paragraph(),
            'status' => fake()->randomElement(['active', 'active', 'active', 'inactive', 'completed']),
        ];
    }

    /**
     * Indicate that the class is active.
     */
    public function active(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'active',
        ]);
    }

    /**
     * Indicate that the class is completed.
     */
    public function completed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'completed',
            'end_date' => fake()->dateTimeBetween('-2 months', '-1 month'),
        ]);
    }
}
