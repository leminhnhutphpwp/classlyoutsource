<?php

namespace Database\Factories;

use App\Models\ClassRoom;
use App\Models\Payment;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Payment>
 */
class PaymentFactory extends Factory
{
    protected $model = Payment::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $status = fake()->randomElement(['paid', 'paid', 'paid', 'pending', 'failed']);
        $paymentDate = $status === 'paid' ? fake()->dateTimeBetween('-2 months', 'now') : null;

        return [
            'student_id' => Student::factory(),
            'class_id' => ClassRoom::factory(),
            'collected_by' => User::factory()->tutor(),
            'invoice_number' => null, // Will be auto-generated
            'amount' => fake()->randomElement([500000, 800000, 1000000, 1200000, 1500000, 2000000]),
            'payment_method' => fake()->randomElement(['cash', 'bank']),
            'transaction_id' => fake()->optional(0.3)->numerify('TXN##########'),
            'month' => fake()->date('Y-m'),
            'payment_date' => $paymentDate,
            'due_date' => fake()->dateTimeBetween('-1 month', '+1 month'),
            'status' => $status,
            'note' => fake()->optional(0.2)->sentence(),
        ];
    }

    /**
     * Indicate that the payment is paid.
     */
    public function paid(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'paid',
            'payment_date' => fake()->dateTimeBetween('-2 months', 'now'),
        ]);
    }

    /**
     * Indicate that the payment is pending.
     */
    public function pending(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'pending',
            'payment_date' => null,
        ]);
    }
}
