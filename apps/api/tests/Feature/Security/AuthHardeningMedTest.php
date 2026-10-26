<?php

namespace Tests\Feature\Security;

use App\Models\PasswordResetCode;
use App\Models\User;
use App\Notifications\PasswordResetNotification;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;
use Tymon\JWTAuth\Facades\JWTAuth;

/**
 * MED-severity auth-hardening regressions:
 *  - S3: password-reset endpoints must not leak whether an account exists/its state.
 *  - S4: a reset code must be invalidated after a small number of wrong guesses.
 *  - S7: an expired access token must return code TOKEN_EXPIRED (refresh), not a
 *        generic UNAUTHENTICATED (re-login).
 */
class AuthHardeningMedTest extends TestCase
{
    private const GENERIC_FORGOT = 'Nếu tài khoản tồn tại, mã xác thực đã được gửi.';

    // ---- S3: user enumeration on password reset ----------------------------

    public function test_forgot_password_returns_generic_200_for_unknown_email_and_creates_no_code(): void
    {
        Notification::fake();

        $this->postJson('/api/v1/auth/forgot-password', [
            'email' => 'nobody-'.uniqid().'@example.com',
        ])
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', self::GENERIC_FORGOT);

        // No code is created and no mail is sent for a non-existent account.
        $this->assertSame(0, PasswordResetCode::count());
        Notification::assertNothingSent();
    }

    public function test_forgot_password_returns_same_generic_200_for_valid_active_user_and_sends_code(): void
    {
        Notification::fake();
        $user = $this->tutor();

        $this->postJson('/api/v1/auth/forgot-password', [
            'email' => $user->email,
        ])
            ->assertStatus(200)
            // Identical message to the unknown-email case → no enumeration signal.
            ->assertJsonPath('message', self::GENERIC_FORGOT);

        $this->assertSame(1, PasswordResetCode::where('email', $user->email)->count());
        Notification::assertSentTo($user, PasswordResetNotification::class);
    }

    public function test_forgot_password_returns_same_generic_200_for_inactive_user_without_creating_code(): void
    {
        Notification::fake();
        $user = $this->tutor(['status' => 'inactive']);

        $this->postJson('/api/v1/auth/forgot-password', [
            'email' => $user->email,
        ])
            ->assertStatus(200)
            ->assertJsonPath('message', self::GENERIC_FORGOT);

        $this->assertSame(0, PasswordResetCode::where('email', $user->email)->count());
        Notification::assertNothingSent();
    }

    public function test_verify_code_returns_identical_error_for_unknown_email_and_wrong_code(): void
    {
        $user = $this->tutor();
        PasswordResetCode::createForEmail($user->email);

        // Unknown email.
        $unknown = $this->postJson('/api/v1/auth/verify-code', [
            'email' => 'nobody-'.uniqid().'@example.com',
            'code' => '123456',
        ])->assertStatus(422)->assertJsonPath('code', 'INVALID_CODE');

        // Existing account, wrong code — must be indistinguishable.
        $wrong = $this->postJson('/api/v1/auth/verify-code', [
            'email' => $user->email,
            'code' => '000000',
        ])->assertStatus(422)->assertJsonPath('code', 'INVALID_CODE');

        $this->assertSame($unknown->json('message'), $wrong->json('message'));
        $this->assertSame($unknown->status(), $wrong->status());
    }

    // ---- S4: per-code failed-attempt cap -----------------------------------

    public function test_reset_code_is_invalidated_after_max_wrong_attempts(): void
    {
        $user = $this->tutor();
        $reset = PasswordResetCode::createForEmail($user->email);
        $realCode = $reset->code;
        $wrongCode = $realCode === '000000' ? '111111' : '000000';

        // Burn the full allowance of wrong guesses.
        for ($i = 0; $i < PasswordResetCode::MAX_ATTEMPTS; $i++) {
            $this->postJson('/api/v1/auth/verify-code', [
                'email' => $user->email,
                'code' => $wrongCode,
            ])->assertStatus(422)->assertJsonPath('code', 'INVALID_CODE');
        }

        // The code is now gone (fail closed) — even the CORRECT code no longer works.
        $this->assertDatabaseMissing('password_reset_codes', ['id' => $reset->id]);

        $this->postJson('/api/v1/auth/verify-code', [
            'email' => $user->email,
            'code' => $realCode,
        ])->assertStatus(422)->assertJsonPath('code', 'INVALID_CODE');
    }

    public function test_reset_code_survives_below_the_cap_and_still_verifies(): void
    {
        $user = $this->tutor();
        $reset = PasswordResetCode::createForEmail($user->email);
        $wrongCode = $reset->code === '000000' ? '111111' : '000000';

        // One short of the cap.
        for ($i = 0; $i < PasswordResetCode::MAX_ATTEMPTS - 1; $i++) {
            $this->postJson('/api/v1/auth/verify-code', [
                'email' => $user->email,
                'code' => $wrongCode,
            ])->assertStatus(422);
        }

        // The correct code still verifies.
        $this->postJson('/api/v1/auth/verify-code', [
            'email' => $user->email,
            'code' => $reset->code,
        ])->assertStatus(200)->assertJsonPath('success', true);
    }

    // ---- S7: expired token surfaces TOKEN_EXPIRED --------------------------

    public function test_expired_access_token_returns_token_expired_code(): void
    {
        $user = $this->tutor();

        // Mint a normal access token, then move the clock past its TTL so it is a
        // well-formed but expired token (fromUser() validates exp at creation, so
        // we can't stamp a past exp directly).
        $token = JWTAuth::customClaims(['typ' => 'access'])->fromUser($user);

        $this->travel(2)->days();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->withHeader('Accept', 'application/json')
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401)
            ->assertJsonPath('code', 'TOKEN_EXPIRED');
    }

    public function test_absent_token_still_returns_generic_unauthenticated(): void
    {
        $this->getJson('/api/v1/auth/me')
            ->assertStatus(401)
            ->assertJsonPath('code', 'UNAUTHENTICATED');
    }
}
