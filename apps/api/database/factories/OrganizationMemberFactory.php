<?php

namespace Database\Factories;

use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrganizationMember>
 */
class OrganizationMemberFactory extends Factory
{
    protected $model = OrganizationMember::class;

    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'user_id' => User::factory()->tutor(),
            'org_role' => 'tutor',
            'status' => 'active',
            'invited_by' => null,
            'joined_at' => now(),
        ];
    }

    public function owner(): static
    {
        return $this->state(fn (array $attributes) => ['org_role' => 'owner']);
    }

    public function manager(): static
    {
        return $this->state(fn (array $attributes) => ['org_role' => 'manager']);
    }

    public function accountant(): static
    {
        return $this->state(fn (array $attributes) => ['org_role' => 'accountant']);
    }

    public function tutor(): static
    {
        return $this->state(fn (array $attributes) => ['org_role' => 'tutor']);
    }

    public function removed(): static
    {
        return $this->state(fn (array $attributes) => ['status' => 'removed']);
    }

    public function invited(): static
    {
        return $this->state(fn (array $attributes) => ['status' => 'invited', 'joined_at' => null]);
    }
}
