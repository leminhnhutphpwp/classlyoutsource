<?php

namespace Database\Factories;

use App\Models\Organization;
use App\Models\PayrollPeriod;
use App\Support\ReferenceCode;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PayrollPeriod>
 */
class PayrollPeriodFactory extends Factory
{
    protected $model = PayrollPeriod::class;

    public function definition(): array
    {
        $start = now()->startOfMonth();
        $end = now()->endOfMonth();

        return [
            'organization_id' => Organization::factory(),
            'reference_code' => ReferenceCode::generate(PayrollPeriod::class, 'PR'),
            'period_start' => $start->toDateString(),
            'period_end' => $end->toDateString(),
            'label' => 'Kỳ lương '.$start->format('m/Y'),
            'status' => 'draft',
            'calculation_status' => PayrollPeriod::CALC_COMPLETED,
            'calculation_token' => null,
            'calculation_error' => null,
            'computed_at' => now(),
            'total_amount' => 0,
        ];
    }

    /** A draft that has finished a calculation run — the state approve() requires. */
    public function computed(): static
    {
        return $this->state(fn () => [
            'calculation_status' => PayrollPeriod::CALC_COMPLETED,
            'computed_at' => now(),
        ]);
    }

    public function approved(): static
    {
        return $this->state(fn () => ['status' => 'approved', 'approved_at' => now()]);
    }

    public function paid(): static
    {
        return $this->state(fn () => ['status' => 'paid', 'approved_at' => now(), 'paid_at' => now()]);
    }
}
