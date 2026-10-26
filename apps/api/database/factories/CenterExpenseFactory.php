<?php

namespace Database\Factories;

use App\Models\CenterExpense;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CenterExpense>
 */
class CenterExpenseFactory extends Factory
{
    protected $model = CenterExpense::class;

    public function definition(): array
    {
        $expenseDate = fake()->dateTimeBetween('-3 months', 'now');

        return [
            'organization_id' => Organization::factory(),
            'category' => fake()->randomElement(CenterExpense::CATEGORIES),
            'amount' => fake()->randomElement([500000, 1000000, 2000000, 5000000, 10000000]),
            'expense_date' => $expenseDate->format('Y-m-d'),
            'description' => fake()->optional()->sentence(),
            'class_id' => null,
            'tutor_id' => null,
            // Default: a settled cash fact (payment method recorded → disbursed at expense_date).
            'payment_method' => 'cash',
            'settlement_status' => CenterExpense::SETTLEMENT_SETTLED,
            'paid_at' => $expenseDate->format('Y-m-d'),
            'created_by' => User::factory()->tutor(),
        ];
    }

    /** An unpaid bill (a payable) — recorded, but cash has not left yet. */
    public function unpaid(): static
    {
        return $this->state(fn () => [
            'payment_method' => null,
            'settlement_status' => CenterExpense::SETTLEMENT_UNPAID,
            'paid_at' => null,
        ]);
    }
}
