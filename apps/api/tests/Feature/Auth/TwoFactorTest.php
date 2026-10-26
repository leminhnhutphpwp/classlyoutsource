<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

/**
 * End-to-end coverage for TOTP two-factor auth: enable → confirm → login challenge → verify,
 * recovery codes, disable, and the no-2FA regression path. Valid TOTP codes are generated with
 * the same google2fa library the backend uses.
 */
class TwoFactorTest extends TestCase
{
    private Google2FA $google2fa;

    protected function setUp(): void
    {
        parent::setUp();
        $this->google2fa = new Google2FA;
    }

    /** Create a tutor with a known password. */
    private function userWithPassword(string $password = 'password'): User
    {
        return $this->tutor(['password' => Hash::make($password)]);
    }

    /**
     * Drive enable+confirm and return [user (fresh), secret, recoveryCodes].
     *
     * @return array{0:User,1:string,2:array<int,string>}
     */
    private function enableAndConfirm(User $user, string $password = 'password'): array
    {
        $this->actingAsApi($user);

        $enable = $this->postJson('/api/v1/auth/2fa/enable', ['password' => $password])
            ->assertOk()
            ->json('data');

        $secret = $enable['secret'];
        $code = $this->google2fa->getCurrentOtp($secret);

        $recovery = $this->postJson('/api/v1/auth/2fa/confirm', ['code' => $code])
            ->assertOk()
            ->json('data.recovery_codes');

        return [$user->fresh(), $secret, $recovery];
    }

    public function test_enable_requires_correct_password(): void
    {
        $user = $this->userWithPassword();
        $this->actingAsApi($user);

        $this->postJson('/api/v1/auth/2fa/enable', ['password' => 'wrong-password'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'INVALID_PASSWORD');

        // Nothing was armed.
        $this->assertNull($user->fresh()->two_factor_secret);
    }

    public function test_enable_returns_provisioning_uri_and_secret_without_confirming(): void
    {
        $user = $this->userWithPassword();
        $this->actingAsApi($user);

        $data = $this->postJson('/api/v1/auth/2fa/enable', ['password' => 'password'])
            ->assertOk()
            ->assertJsonStructure(['data' => ['secret', 'provisioning_uri']])
            ->json('data');

        $this->assertStringContainsString('otpauth://', $data['provisioning_uri']);
        $this->assertStringContainsString(rawurlencode($user->email), $data['provisioning_uri']);

        $fresh = $user->fresh();
        $this->assertNotNull($fresh->two_factor_secret);           // secret stored (encrypted)
        $this->assertNull($fresh->two_factor_confirmed_at);        // but NOT yet confirmed
        $this->assertFalse($fresh->hasTwoFactorEnabled());
    }

    public function test_confirm_with_valid_code_enables_2fa_and_returns_recovery_codes(): void
    {
        $user = $this->userWithPassword();
        [$fresh, , $recovery] = $this->enableAndConfirm($user);

        $this->assertNotNull($fresh->two_factor_confirmed_at);
        $this->assertTrue($fresh->hasTwoFactorEnabled());
        $this->assertCount(8, $recovery);
    }

    public function test_confirm_with_invalid_code_is_rejected(): void
    {
        $user = $this->userWithPassword();
        $this->actingAsApi($user);
        $this->postJson('/api/v1/auth/2fa/enable', ['password' => 'password'])->assertOk();

        $this->postJson('/api/v1/auth/2fa/confirm', ['code' => '000000'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'INVALID_2FA_CODE');

        $this->assertFalse($user->fresh()->hasTwoFactorEnabled());
    }

    public function test_security_endpoint_reflects_two_factor_state(): void
    {
        $user = $this->userWithPassword();

        $this->actingAsApi($user);
        $this->getJson('/api/v1/settings/security')
            ->assertOk()
            ->assertJsonPath('data.two_factor_enabled', false);

        $this->enableAndConfirm($user);

        $this->actingAsApi($user->fresh());
        $this->getJson('/api/v1/settings/security')
            ->assertOk()
            ->assertJsonPath('data.two_factor_enabled', true);
    }

    public function test_login_with_2fa_returns_challenge_and_no_token(): void
    {
        $user = $this->userWithPassword();
        $this->enableAndConfirm($user);

        $data = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.requires_2fa', true)
            ->json('data');

        $this->assertArrayHasKey('challenge', $data);
        $this->assertArrayNotHasKey('token', $data);            // NO access token leaked
        $this->assertArrayNotHasKey('refresh_token', $data);
    }

    public function test_verify_with_valid_totp_completes_login(): void
    {
        $user = $this->userWithPassword();
        [, $secret] = $this->enableAndConfirm($user);

        $challenge = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk()->json('data.challenge');

        $data = $this->postJson('/api/v1/auth/2fa/verify', [
            'challenge' => $challenge,
            'code' => $this->google2fa->getCurrentOtp($secret),
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->json('data');

        $this->assertArrayHasKey('token', $data);
        $this->assertArrayHasKey('refresh_token', $data);
        $this->assertSame('bearer', $data['token_type']);
    }

    public function test_verify_with_wrong_code_is_rejected(): void
    {
        $user = $this->userWithPassword();
        $this->enableAndConfirm($user);

        $challenge = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk()->json('data.challenge');

        $this->postJson('/api/v1/auth/2fa/verify', [
            'challenge' => $challenge,
            'code' => '000000',
        ])->assertStatus(422)
            ->assertJsonPath('code', 'INVALID_2FA_CODE')
            ->assertJsonMissingPath('data.token');
    }

    public function test_verify_with_invalid_challenge_is_rejected(): void
    {
        $user = $this->userWithPassword();
        [, $secret] = $this->enableAndConfirm($user);

        $this->postJson('/api/v1/auth/2fa/verify', [
            'challenge' => 'not-a-real-challenge',
            'code' => $this->google2fa->getCurrentOtp($secret),
        ])->assertStatus(401)
            ->assertJsonPath('code', 'INVALID_2FA_CHALLENGE');
    }

    public function test_recovery_code_completes_login_once_then_is_consumed(): void
    {
        $user = $this->userWithPassword();
        [, , $recovery] = $this->enableAndConfirm($user);
        $recoveryCode = $recovery[0];

        $challenge = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk()->json('data.challenge');

        // First use succeeds.
        $this->postJson('/api/v1/auth/2fa/verify', [
            'challenge' => $challenge,
            'code' => $recoveryCode,
        ])->assertOk()->assertJsonPath('success', true);

        // Second use of the SAME recovery code must fail (consumed).
        $challenge2 = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk()->json('data.challenge');

        $this->postJson('/api/v1/auth/2fa/verify', [
            'challenge' => $challenge2,
            'code' => $recoveryCode,
        ])->assertStatus(422)
            ->assertJsonPath('code', 'INVALID_2FA_CODE');

        $this->assertCount(7, $user->fresh()->two_factor_recovery_codes);
    }

    public function test_disable_with_valid_code_clears_everything(): void
    {
        $user = $this->userWithPassword();
        [$fresh, $secret] = $this->enableAndConfirm($user);

        $this->actingAsApi($fresh);
        $this->postJson('/api/v1/auth/2fa/disable', [
            'code' => $this->google2fa->getCurrentOtp($secret),
        ])->assertOk()->assertJsonPath('data.two_factor_enabled', false);

        $after = $user->fresh();
        $this->assertNull($after->two_factor_secret);
        $this->assertNull($after->two_factor_recovery_codes);
        $this->assertNull($after->two_factor_confirmed_at);
        $this->assertFalse($after->hasTwoFactorEnabled());
    }

    public function test_disable_with_password_also_works(): void
    {
        $user = $this->userWithPassword();
        [$fresh] = $this->enableAndConfirm($user);

        $this->actingAsApi($fresh);
        $this->postJson('/api/v1/auth/2fa/disable', ['password' => 'password'])
            ->assertOk();

        $this->assertFalse($user->fresh()->hasTwoFactorEnabled());
    }

    public function test_disable_requires_valid_credentials(): void
    {
        $user = $this->userWithPassword();
        [$fresh] = $this->enableAndConfirm($user);

        $this->actingAsApi($fresh);
        $this->postJson('/api/v1/auth/2fa/disable', ['code' => '000000'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'INVALID_2FA_CREDENTIALS');

        $this->assertTrue($user->fresh()->hasTwoFactorEnabled());
    }

    public function test_regenerate_recovery_codes_replaces_old_set(): void
    {
        $user = $this->userWithPassword();
        [$fresh, $secret, $original] = $this->enableAndConfirm($user);

        $this->actingAsApi($fresh);
        $new = $this->postJson('/api/v1/auth/2fa/recovery-codes/regenerate', [
            'code' => $this->google2fa->getCurrentOtp($secret),
        ])->assertOk()->json('data.recovery_codes');

        $this->assertCount(8, $new);
        $this->assertNotEquals($original, $new);
        $this->assertEqualsCanonicalizing($new, $user->fresh()->two_factor_recovery_codes);
    }

    public function test_user_without_2fa_logs_in_normally(): void
    {
        $user = $this->userWithPassword();

        $data = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->json('data');

        // Regression: normal login is unchanged — a real token, no 2FA challenge.
        $this->assertArrayHasKey('token', $data);
        $this->assertArrayHasKey('refresh_token', $data);
        $this->assertArrayNotHasKey('requires_2fa', $data);
    }
}
