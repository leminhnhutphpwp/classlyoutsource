<?php

namespace Database\Factories;

use App\Models\Organization;
use App\Models\PayrollItem;
use App\Models\PayrollPeriod;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PayrollItem>
 */
class PayrollItemFactory extends Factory
{
    protected $model = PayrollItem::class;

    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'payroll_period_id' => PayrollPeriod::factory(),
            'user_id' => User::factory()->tutor(),
            'compensation_profile_id' => null,
            'pay_model' => 'fixed_monthly',
            'base_amount' => 10000000,
            'sessions_count' => 0,
            'sessions_amount' => 0,
            'students_count' => 0,
            'students_amount' => 0,
            'revenue_base' => 0,
            'revenue_amount' => 0,
            'adjustments_total' => 0,
            'gross_amount' => 10000000,
            'computation_breakdown' => ['pay_model' => 'fixed_monthly'],
            'status' => 'draft',
        ];
    }

    public function approved(): static
    {
        return $this->state(fn () => ['status' => 'approved']);
    }
}
