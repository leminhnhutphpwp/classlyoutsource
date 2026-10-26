<?php

namespace Tests\Feature;

use Tests\TestCase;

class SmokeTest extends TestCase
{
    public function test_health_endpoint_responds(): void
    {
        $this->getJson('/up')->assertStatus(200);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->getJson('/api/v1/classes')->assertStatus(401);
    }

    public function test_authenticated_tutor_can_list_own_classes(): void
    {
        $tutor = $this->tutor();

        $this->actingAsApi($tutor)
            ->getJson('/api/v1/classes')
            ->assertStatus(200);
    }
}
