<?php

namespace Tests\Feature\Api;

use Tests\TestCase;

/**
 * Every API error must share one envelope shape: {success:false, message, code, errors?}.
 * Regression for Form Requests emitting Laravel's default {message,errors} (no success/code).
 */
class ErrorEnvelopeTest extends TestCase
{
    public function test_form_request_validation_uses_the_standard_envelope(): void
    {
        $tutor = $this->tutor();

        // ImportStudentsRequest (an ApiFormRequest) requires a file → omit it to trigger validation.
        $this->actingAsApi($tutor)
            ->postJson('/api/v1/students/import', [])
            ->assertStatus(422)
            ->assertJson([
                'success' => false,
                'code' => 'VALIDATION_ERROR',
            ])
            ->assertJsonStructure(['success', 'message', 'code', 'errors']);
    }

    public function test_unauthenticated_uses_the_standard_envelope(): void
    {
        $this->postJson('/api/v1/students/import', [])
            ->assertStatus(401)
            ->assertJson(['success' => false, 'code' => 'UNAUTHENTICATED']);
    }
}
