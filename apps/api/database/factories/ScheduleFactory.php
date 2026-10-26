<?php

namespace Database\Factories;

use App\Models\Schedule;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Schedule>
 */
class ScheduleFactory extends Factory
{
    protected $model = Schedule::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $startHour = fake()->numberBetween(7, 18);
        $startMinute = fake()->randomElement([0, 15, 30, 45]);
        $duration = fake()->randomElement([60, 75, 90, 120]); // minutes

        $startTime = sprintf('%02d:%02d:00', $startHour, $startMinute);
        $endTime = date('H:i:s', strtotime($startTime) + ($duration * 60));

        $rooms = ['P101', 'P102', 'P201', 'P202', 'P301', 'A1.01', 'A1.02', 'B2.05', 'Phòng Học 1', 'Phòng Học 2'];
        $locations = ['Tầng 1', 'Tầng 2', 'Tầng 3', 'Tòa A', 'Tòa B', 'Khu A', 'Khu B'];

        return [
            'day_of_week' => fake()->randomElement(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
            'start_time' => $startTime,
            'end_time' => $endTime,
            'room' => fake()->randomElement($rooms),
            'location' => fake()->optional(0.7)->randomElement($locations),
            'notes' => fake()->optional(0.3)->sentence(),
            'is_active' => fake()->boolean(95), // 95% active
        ];
    }

    /**
     * Indicate that the schedule is for a specific class.
     */
    public function forClass(int $classId): static
    {
        return $this->state(fn (array $attributes) => [
            'class_id' => $classId,
        ]);
    }

    /**
     * Indicate that the schedule is active.
     */
    public function active(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => true,
        ]);
    }

    /**
     * Indicate that the schedule is inactive.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
        ]);
    }

    /**
     * Morning schedule (7-12).
     */
    public function morning(): static
    {
        $startHour = fake()->numberBetween(7, 10);
        $startMinute = fake()->randomElement([0, 30]);
        $duration = fake()->randomElement([90, 120]); // minutes

        $startTime = sprintf('%02d:%02d:00', $startHour, $startMinute);
        $endTime = date('H:i:s', strtotime($startTime) + ($duration * 60));

        return $this->state(fn (array $attributes) => [
            'start_time' => $startTime,
            'end_time' => $endTime,
        ]);
    }

    /**
     * Afternoon schedule (13-18).
     */
    public function afternoon(): static
    {
        $startHour = fake()->numberBetween(13, 16);
        $startMinute = fake()->randomElement([0, 30]);
        $duration = fake()->randomElement([90, 120]); // minutes

        $startTime = sprintf('%02d:%02d:00', $startHour, $startMinute);
        $endTime = date('H:i:s', strtotime($startTime) + ($duration * 60));

        return $this->state(fn (array $attributes) => [
            'start_time' => $startTime,
            'end_time' => $endTime,
        ]);
    }

    /**
     * Evening schedule (18-21).
     */
    public function evening(): static
    {
        $startHour = fake()->numberBetween(18, 19);
        $startMinute = fake()->randomElement([0, 30]);
        $duration = fake()->randomElement([90, 120]); // minutes

        $startTime = sprintf('%02d:%02d:00', $startHour, $startMinute);
        $endTime = date('H:i:s', strtotime($startTime) + ($duration * 60));

        return $this->state(fn (array $attributes) => [
            'start_time' => $startTime,
            'end_time' => $endTime,
        ]);
    }
}
