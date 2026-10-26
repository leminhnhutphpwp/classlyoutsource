<?php

namespace Database\Factories;

use App\Models\ClassRoom;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Student>
 */
class StudentFactory extends Factory
{
    protected $model = Student::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $firstName = fake()->firstName();
        $lastName = fake()->lastName();

        return [
            'class_id' => ClassRoom::factory(),
            'user_id' => fake()->optional(0.3)->passthrough(User::factory()->student()),
            'name' => $lastName.' '.$firstName,
            'parent_name' => fake()->name(),
            'phone' => fake()->numerify('09########'),
            'email' => fake()->optional()->email(),
            'birth_date' => fake()->dateTimeBetween('-18 years', '-12 years'),
            'gender' => fake()->randomElement(['male', 'female']),
            'address' => fake()->address(),
            'avatar' => null,
            'notes' => fake()->optional()->sentence(),
            'status' => fake()->randomElement(['active', 'active', 'active', 'inactive']),
        ];
    }

    /**
     * Indicate that the student is active.
     */
    public function active(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'active',
        ]);
    }

    /**
     * Indicate that the student is male.
     */
    public function male(): static
    {
        return $this->state(fn (array $attributes) => [
            'gender' => 'male',
        ]);
    }

    /**
     * Indicate that the student is female.
     */
    public function female(): static
    {
        return $this->state(fn (array $attributes) => [
            'gender' => 'female',
        ]);
    }
}
