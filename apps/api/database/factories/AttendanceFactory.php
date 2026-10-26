<?php

namespace Database\Factories;

use App\Models\Attendance;
use App\Models\ClassRoom;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Attendance>
 */
class AttendanceFactory extends Factory
{
    protected $model = Attendance::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $status = fake()->randomElement([
            'present', 'present', 'present', 'present', 'present', // 62.5% present
            'late', 'late', // 25% late
            'absent', // 12.5% absent
        ]);

        $checkInTime = $status !== 'absent' ? fake()->time('H:i', '19:30') : null;
        $checkOutTime = $status !== 'absent' && fake()->boolean(80) ? fake()->time('H:i', '21:30') : null;

        return [
            'class_id' => ClassRoom::factory(),
            'student_id' => Student::factory(),
            'tutor_id' => User::factory()->tutor(),
            'date' => fake()->dateTimeBetween('-2 months', 'now'),
            'check_in_time' => $checkInTime,
            'check_out_time' => $checkOutTime,
            'status' => $status,
            'note' => fake()->optional(0.2)->sentence(),
        ];
    }

    /**
     * Indicate that the student was present.
     */
    public function present(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'present',
            'check_in_time' => fake()->time('H:i', '18:30'),
            'check_out_time' => fake()->time('H:i', '20:30'),
        ]);
    }

    /**
     * Indicate that the student was absent.
     */
    public function absent(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'absent',
            'check_in_time' => null,
            'check_out_time' => null,
            'note' => fake()->sentence(),
        ]);
    }

    /**
     * Indicate that the student was late.
     */
    public function late(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'late',
            'check_in_time' => fake()->time('H:i', '19:00'),
        ]);
    }
}
