<?php

namespace Tests\Feature\Security;

use App\Models\PasswordResetCode;
use App\Models\User;
use App\Models\UserSession;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Regression for the P1 token-revocation cluster:
 *  - logout must kill BOTH access and refresh tokens
 *  - a revoked/missing session must NOT be resurrected by refresh()
 *  - password change AND password reset must revoke all sessions
 * so a logged-out or compromise-recovered account can't be silently reused.
 */
class TokenRevocationTest extends TestCase
{
    /** Login through the real endpoint and return the token payload. */
    private function login(User $user, string $password = 'password'): array
    {
        $res = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => $password,
        ])->assertStatus(200);

        return $res->json('data');
    }

    public function test_login_then_refresh_happy_path_still_works(): void
    {
        $user = $this->tutor();
        $data = $this->login($user);

        $this->postJson('/api/v1/auth/refresh', [
            'refresh_token' => $data['refresh_token'],
        ])
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['token', 'refresh_token', 'session_id']]);
    }

    public function test_logout_blacklists_refresh_token_and_blocks_further_refresh(): void
    {
        $user = $this->tutor();
        $data = $this->login($user);

        $this->assertSame(1, UserSession::where('user_id', $user->id)->whereNull('revoked_at')->count());

        // Logout: pass the access token as bearer AND the refresh token in body.
        $this->withHeader('Authorization', 'Bearer '.$data['token'])
            ->postJson('/api/v1/auth/logout', ['refresh_token' => $data['refresh_token']])
            ->assertStatus(200);

        // Session is revoked...
        $this->assertSame(0, UserSession::where('user_id', $user->id)->whereNull('revoked_at')->count());

        // ...and the refresh token can no longer mint new tokens.
        $this->postJson('/api/v1/auth/refresh', [
            'refresh_token' => $data['refresh_token'],
        ])->assertStatus(401);
    }

    public function test_refresh_rejects_revoked_session_without_creating_a_new_one(): void
    {
        $user = $this->tutor();
        $data = $this->login($user);

        // Simulate a session kill that does NOT touch the JWT blacklist
        // (e.g. admin revoke). The refresh token itself is still cryptographically
        // valid, so this isolates rotate()'s "must not resurrect" behaviour.
        UserSession::where('user_id', $user->id)->update(['revoked_at' => now()]);

        $this->postJson('/api/v1/auth/refresh', [
            'refresh_token' => $data['refresh_token'],
        ])
            ->assertStatus(401)
            ->assertJsonPath('code', 'SESSION_REVOKED');

        // Crucially, no brand-new session was registered.
        $this->assertSame(0, UserSession::where('user_id', $user->id)->whereNull('revoked_at')->count());
        $this->assertSame(1, UserSession::where('user_id', $user->id)->count());
    }

    public function test_change_password_revokes_all_sessions(): void
    {
        $user = $this->tutor();
        $data = $this->login($user);

        $this->assertSame(1, UserSession::where('user_id', $user->id)->whereNull('revoked_at')->count());

        $this->withHeader('Authorization', 'Bearer '.$data['token'])
            ->postJson('/api/v1/auth/change-password', [
                'current_password' => 'password',
                'new_password' => 'new-password-123',
                'new_password_confirmation' => 'new-password-123',
            ])
            ->assertStatus(200);

        // Every session revoked → the pre-existing refresh token cannot rotate.
        $this->assertSame(0, UserSession::where('user_id', $user->id)->whereNull('revoked_at')->count());

        $this->postJson('/api/v1/auth/refresh', [
            'refresh_token' => $data['refresh_token'],
        ])->assertStatus(401);
    }

    public function test_password_reset_revokes_all_sessions(): void
    {
        $user = $this->tutor();
        $data = $this->login($user);

        $this->assertSame(1, UserSession::where('user_id', $user->id)->whereNull('revoked_at')->count());

        $resetCode = PasswordResetCode::createForEmail($user->email);

        $this->postJson('/api/v1/auth/reset-password', [
            'email' => $user->email,
            'code' => $resetCode->code,
            'new_password' => 'brand-new-pass-123',
            'new_password_confirmation' => 'brand-new-pass-123',
        ])->assertStatus(200);

        // Attacker's outstanding sessions are all gone.
        $this->assertSame(0, UserSession::where('user_id', $user->id)->whereNull('revoked_at')->count());

        // The old refresh token can no longer rotate into fresh access.
        $this->postJson('/api/v1/auth/refresh', [
            'refresh_token' => $data['refresh_token'],
        ])->assertStatus(401);

        // Sanity: the new password actually took effect.
        $this->assertTrue(Hash::check('brand-new-pass-123', $user->fresh()->password));
    }
}
