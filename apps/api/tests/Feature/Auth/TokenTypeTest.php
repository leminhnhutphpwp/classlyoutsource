<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Access and refresh tokens are tagged with a `typ` claim so they can't be swapped: a captured refresh
 * token must not work as a 14-day bearer access token, and an access token must not drive /auth/refresh.
 */
class TokenTypeTest extends TestCase
{
    /** @return array{0:User,1:string,2:string} [user, accessToken, refreshToken] */
    private function login(string $password = 'password'): array
    {
        $user = $this->tutor(['password' => Hash::make($password)]);

        $data = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => $password,
        ])->assertOk()->json('data');

        return [$user, $data['token'], $data['refresh_token']];
    }

    public function test_access_token_reaches_a_protected_endpoint(): void
    {
        [, $access] = $this->login();

        $this->withHeader('Authorization', "Bearer {$access}")
            ->getJson('/api/v1/auth/me')
            ->assertOk();
    }

    public function test_refresh_token_cannot_be_used_as_an_access_bearer(): void
    {
        [, , $refresh] = $this->login();

        $this->withHeader('Authorization', "Bearer {$refresh}")
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);
    }

    public function test_access_token_cannot_be_used_to_refresh(): void
    {
        [, $access] = $this->login();

        $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $access])
            ->assertStatus(401);
    }

    public function test_a_real_refresh_token_still_refreshes(): void
    {
        [, , $refresh] = $this->login();

        $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $refresh])
            ->assertOk()
            ->assertJsonPath('success', true);
    }
}
