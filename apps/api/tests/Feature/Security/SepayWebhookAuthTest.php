<?php

namespace Tests\Feature\Security;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Regression for the P1 SePay webhook hardening.
 *
 * The vendor controller skips auth entirely when `sepay.webhook_token` is empty
 * and compares tokens with a non-constant-time `!==`. Our VerifySePayWebhook
 * guard runs first on the `api` group and must:
 *   - FAIL CLOSED when no token is configured (empty token != "no auth"),
 *   - reject a wrong token,
 *   - let a correct token through to the vendor handler.
 */
class SepayWebhookAuthTest extends TestCase
{
    private const URL = '/api/sepay/webhook';

    /** A minimally valid SePay payload. Content avoids the SE pattern so no event fires. */
    private function payload(): array
    {
        return [
            'id' => 987654,
            'gateway' => 'Vietcombank',
            'transactionDate' => '2026-07-18 10:00:00',
            'accountNumber' => '0123456789',
            'subAccount' => null,
            'code' => null,
            'content' => 'no matching pattern here',
            'transferType' => 'in',
            'description' => 'test',
            'transferAmount' => 50000,
            'referenceCode' => 'REF-1',
            'accumulated' => 0,
        ];
    }

    /** Create the vendor's sepay_transactions table (package migration is not auto-run). */
    private function createSepayTable(): void
    {
        if (Schema::hasTable('sepay_transactions')) {
            return;
        }

        $migration = require base_path('vendor/sepayvn/laravel-sepay/database/migrations/create_sepay_table.php.stub');
        $migration->up();
    }

    public function test_empty_configured_token_is_rejected_not_silently_accepted(): void
    {
        // The dangerous case: token unset/empty must NOT disable the guard.
        config(['sepay.webhook_token' => '']);

        $this->postJson(self::URL, $this->payload(), [
            'Authorization' => 'Apikey anything',
        ])
            ->assertStatus(401)
            ->assertJsonPath('code', 'WEBHOOK_NOT_CONFIGURED');

        // Handler never ran → no transaction persisted.
        $this->assertFalse(
            Schema::hasTable('sepay_transactions') &&
            DB::table('sepay_transactions')->exists()
        );
    }

    public function test_null_configured_token_is_rejected(): void
    {
        config(['sepay.webhook_token' => null]);

        $this->postJson(self::URL, $this->payload(), [
            'Authorization' => 'Apikey anything',
        ])
            ->assertStatus(401)
            ->assertJsonPath('code', 'WEBHOOK_NOT_CONFIGURED');
    }

    public function test_wrong_token_is_rejected(): void
    {
        config(['sepay.webhook_token' => 'super-secret-token']);

        $this->postJson(self::URL, $this->payload(), [
            'Authorization' => 'Apikey wrong-token',
        ])
            ->assertStatus(401)
            ->assertJsonPath('code', 'WEBHOOK_INVALID_TOKEN');
    }

    public function test_missing_authorization_header_is_rejected(): void
    {
        config(['sepay.webhook_token' => 'super-secret-token']);

        $this->postJson(self::URL, $this->payload())
            ->assertStatus(401)
            ->assertJsonPath('code', 'WEBHOOK_INVALID_TOKEN');
    }

    public function test_correct_token_passes_through_to_handler(): void
    {
        config(['sepay.webhook_token' => 'super-secret-token']);
        $this->createSepayTable();

        // Vendor handler returns 204 No Content on success.
        $this->postJson(self::URL, $this->payload(), [
            'Authorization' => 'Apikey super-secret-token',
        ])->assertStatus(204);

        $this->assertDatabaseHas('sepay_transactions', ['id' => 987654]);
    }
}
