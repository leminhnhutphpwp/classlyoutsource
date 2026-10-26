<?php

namespace Tests\Feature\Security;

use App\Models\ClassRoom;
use Tests\TestCase;

/**
 * Audit P2: list endpoints fed request-derived sort columns straight into orderBy().
 * Laravel quotes identifiers (so it is not classic SQLi), but an unknown/arbitrary
 * column throws a 500 or leaks schema info. Every list must allow-list the sort
 * column and fall back to a safe default. These tests assert a bogus/injection
 * ?sort= yields 200 (safe fallback), never 500.
 */
class SortAllowlistTest extends TestCase
{
    private const BOGUS_SORTS = [
        'sort' => 'does_not_exist_column',
    ];

    private const INJECTION_SORTS = [
        'sort' => 'id); DROP TABLE users;--',
    ];

    public function test_classes_index_ignores_bogus_sort_column(): void
    {
        $tutor = $this->tutor();
        ClassRoom::factory()->count(2)->create(['tutor_id' => $tutor->id]);

        $this->actingAsApi($tutor)
            ->getJson('/api/v1/classes?'.http_build_query(self::BOGUS_SORTS))
            ->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_classes_index_ignores_injection_sort_column(): void
    {
        $tutor = $this->tutor();
        ClassRoom::factory()->count(2)->create(['tutor_id' => $tutor->id]);

        $this->actingAsApi($tutor)
            ->getJson('/api/v1/classes?'.http_build_query(self::INJECTION_SORTS).'&order=WHATEVER')
            ->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_students_index_ignores_bogus_sort_column(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $this->studentInClass($class);
        $this->studentInClass($class);

        $this->actingAsApi($tutor)
            ->getJson('/api/v1/students?'.http_build_query(self::BOGUS_SORTS))
            ->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_students_index_ignores_injection_sort_column(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $this->studentInClass($class);

        $this->actingAsApi($tutor)
            ->getJson('/api/v1/students?'.http_build_query(self::INJECTION_SORTS))
            ->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_notifications_index_ignores_bogus_sort_column(): void
    {
        $tutor = $this->tutor();

        $this->actingAsApi($tutor)
            ->getJson('/api/v1/notifications?'.http_build_query(self::BOGUS_SORTS))
            ->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_payments_index_ignores_bogus_sort_column(): void
    {
        $tutor = $this->tutor();

        $this->actingAsApi($tutor)
            ->getJson('/api/v1/payments?'.http_build_query(self::BOGUS_SORTS))
            ->assertStatus(200)
            ->assertJsonPath('success', true);
    }
}
