<?php

namespace Tests\Feature\Api;

use Tests\TestCase;

/**
 * Regression: StudentStoreRequest required a password (always creates a login User with a NOT-NULL
 * email) but email was nullable, so omitting email 500'd instead of returning a clean 422.
 */
class StudentCreateValidationTest extends TestCase
{
    public function test_missing_email_returns_422_not_500(): void
    {
        $tutor = $this->tutor();

        $this->actingAsApi($tutor)
            ->postJson('/api/v1/students', [
                'name' => 'Học viên Không Email',
                'password' => 'password123',
                'password_confirmation' => 'password123',
            ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'VALIDATION_ERROR');
    }
}
