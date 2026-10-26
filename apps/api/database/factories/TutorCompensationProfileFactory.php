<?php

namespace Database\Factories;

use App\Models\Organization;
use App\Models\TutorCompensationProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TutorCompensationProfile>
 */
class TutorCompensationProfileFactory extends Factory
{
    protected $model = TutorCompensationProfile::class;

    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'user_id' => User::factory()->tutor(),
            'pay_model' => 'fixed_monthly',
            'base_salary' => 10000000,
            'rate_per_session' => null,
            'rate_per_student' => null,
            'revenue_share_pct' => null,
            'components' => null,
            'session_basis' => 'completed_session',
            'currency' => 'VND',
            'effective_from' => now()->startOfYear()->toDateString(),
            'effective_to' => null,
            'status' => 'active',
        ];
    }

    public function fixedMonthly(int $base = 10000000): static
    {
        return $this->state(fn () => [
            'pay_model' => 'fixed_monthly',
            'base_salary' => $base,
            'rate_per_session' => null,
            'revenue_share_pct' => null,
        ]);
    }

    public function perSession(int $rate = 200000, string $basis = 'completed_session'): static
    {
        return $this->state(fn () => [
            'pay_model' => 'per_session',
            'base_salary' => null,
            'rate_per_session' => $rate,
            'session_basis' => $basis,
            'revenue_share_pct' => null,
        ]);
    }

    public function revenueShare(float $pct = 40): static
    {
        return $this->state(fn () => [
            'pay_model' => 'revenue_share',
            'base_salary' => null,
            'rate_per_session' => null,
            'revenue_share_pct' => $pct,
        ]);
    }
}
