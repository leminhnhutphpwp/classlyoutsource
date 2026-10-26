<?php

namespace Tests\Feature\Api;

use Tests\TestCase;

class MeEndpointTest extends TestCase
{
    public function test_me_returns_current_user_with_swr_cache(): void
    {
        $tutor = $this->tutor(['email' => 'me-test@example.com']);

        // Two calls: first populates, second serves from the flexible cache — both must succeed.
        $this->actingAsApi($tutor)->getJson('/api/v1/auth/me')->assertStatus(200)
            ->assertJsonPath('data.user.email', 'me-test@example.com');
        $this->actingAsApi($tutor)->getJson('/api/v1/auth/me')->assertStatus(200);
    }
}
