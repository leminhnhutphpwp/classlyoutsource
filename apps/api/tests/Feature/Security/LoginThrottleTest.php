<?php

namespace Tests\Feature\Security;

use Tests\TestCase;

/**
 * Auth endpoints must be throttled far more strictly than generic API routes (brute-force defense).
 * Regression: the ':auth' limiter argument only namespaced the key, so login kept the 60/min limit.
 */
class LoginThrottleTest extends TestCase
{
    public function test_login_is_throttled_after_repeated_failures(): void
    {
        $payload = ['email' => 'victim@example.com', 'password' => 'wrong-password'];

        // The stricter auth limit is 8/min — the first 8 attempts must not be throttled.
        for ($i = 1; $i <= 8; $i++) {
            $status = $this->postJson('/api/v1/auth/login', $payload)->status();
            $this->assertNotSame(429, $status, "attempt {$i} should not be throttled yet (got {$status})");
        }

        // The 9th attempt (same IP + email) must be throttled.
        $this->postJson('/api/v1/auth/login', $payload)->assertStatus(429);
    }
}
