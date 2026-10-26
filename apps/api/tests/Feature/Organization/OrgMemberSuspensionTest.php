<?php

namespace Tests\Feature\Organization;

use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\User;
use App\Support\CacheKeys;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;
use Tymon\JWTAuth\Facades\JWTAuth;

/**
 * Base-core staff lifecycle: removing ANY member suspends the account, revokes the session, and blocks
 * login immediately — even a still-valid access token is rejected. `restore` re-opens login. The user row
 * stays intact for payroll/audit history but no detached tutor remains operational.
 */
class OrgMemberSuspensionTest extends TestCase
{
    /** Org owner + org + owner membership (ready-made center). */
    private function makeOrg(): array
    {
        $owner = $this->tutor();

        $org = Organization::factory()->ownedBy($owner)->create();
        OrganizationMember::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        return [$owner->fresh(), $org];
    }

    /** Owner provisions a brand-new center tutor via the endpoint (stamps provisioned_org_id). */
    private function provisionTutor(User $owner, Organization $org, string $email = 'staff@example.com'): User
    {
        $this->actingAsApi($owner)
            ->postJson("/api/v1/organizations/{$org->hash_id}/members", [
                'name' => 'Gia sư Trung tâm',
                'email' => $email,
            ])->assertStatus(201);

        // Give the provisioned account a real, known password so we can test the login gate.
        $tutor = User::where('email', $email)->firstOrFail();
        $tutor->forceFill([
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ])->save();

        return $tutor->fresh();
    }

    private function memberRow(Organization $org, User $user): OrganizationMember
    {
        return OrganizationMember::where('organization_id', $org->id)
            ->where('user_id', $user->id)->firstOrFail();
    }

    /** Raw JWT bearer (no actingAs) so we exercise the real AuthenticateApi resolution path. */
    private function withBearer(string $token): static
    {
        return $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ]);
    }

    // -------------------------------------------------------------------------------------------------

    public function test_provisioned_account_is_stamped_with_org(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->provisionTutor($owner, $org);

        $this->assertSame($org->id, $tutor->provisioned_org_id);
        $this->assertNull($tutor->suspended_at);
    }

    public function test_removing_provisioned_member_suspends_and_a_live_jwt_is_rejected(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->provisionTutor($owner, $org);

        // A LIVE, still-valid access token that was issued BEFORE removal (as it would be at login).
        $liveToken = JWTAuth::customClaims(['typ' => 'access'])->fromUser($tutor);

        // Plant a sentinel in the current-user cache to prove remove() forgets it (a warm /me entry must
        // not survive to serve the now-suspended user for its SWR window).
        Cache::put(CacheKeys::currentUser($tutor->id), ['stale' => true], 900);

        // Owner removes the member — via a raw bearer (no actingAs) so it can't pollute the guard state.
        $member = $this->memberRow($org, $tutor);
        $ownerToken = JWTAuth::customClaims(['typ' => 'access'])->fromUser($owner->fresh());
        $this->withBearer($ownerToken)
            ->deleteJson("/api/v1/organizations/{$org->hash_id}/members/{$member->hash_id}")
            ->assertStatus(200);

        // Suspension stamped + reason + session cache forgotten.
        $tutor->refresh();
        $this->assertNotNull($tutor->suspended_at);
        $this->assertSame('org_removed', $tutor->suspended_reason);
        $this->assertTrue($tutor->isLoginBlocked());
        $this->assertNull(Cache::get(CacheKeys::currentUser($tutor->id)), 'stale /me cache must be forgotten');

        // Force a brand-new guard so the JWT is re-resolved from the DB (in prod every request is a fresh
        // process; the in-test guard would otherwise memoize the pre-suspension user model).
        $this->app['auth']->forgetGuards();

        // The still-valid live token is now rejected (401) — the REAL revoke, not just refresh-token death.
        $this->withBearer($liveToken)->getJson('/api/v1/auth/me')
            ->assertStatus(401)
            ->assertJsonPath('code', 'ACCOUNT_SUSPENDED');
    }

    public function test_suspended_account_login_is_denied(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->provisionTutor($owner, $org);
        $member = $this->memberRow($org, $tutor);

        // Login works before removal.
        $this->postJson('/api/v1/auth/login', ['email' => $tutor->email, 'password' => 'password123'])
            ->assertOk();

        $this->actingAsApi($owner->fresh())
            ->deleteJson("/api/v1/organizations/{$org->hash_id}/members/{$member->hash_id}")
            ->assertStatus(200);

        // Login is now denied with a clear suspended message.
        $this->postJson('/api/v1/auth/login', ['email' => $tutor->email, 'password' => 'password123'])
            ->assertStatus(403)
            ->assertJsonPath('code', 'ACCOUNT_SUSPENDED');
    }

    public function test_restore_reopens_login(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->provisionTutor($owner, $org);
        $member = $this->memberRow($org, $tutor);

        $this->actingAsApi($owner->fresh())
            ->deleteJson("/api/v1/organizations/{$org->hash_id}/members/{$member->hash_id}")
            ->assertStatus(200);

        // Restore flips membership back to active and clears suspension.
        $this->actingAsApi($owner->fresh())
            ->postJson("/api/v1/organizations/{$org->hash_id}/members/{$member->hash_id}/restore")
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'active');

        $tutor->refresh();
        $this->assertNull($tutor->suspended_at);
        $this->assertNull($tutor->suspended_reason);
        $this->assertFalse($tutor->isLoginBlocked());

        // Login re-opens; the member re-inherits the owner's org capabilities/role (active membership again).
        $this->postJson('/api/v1/auth/login', ['email' => $tutor->email, 'password' => 'password123'])
            ->assertOk();

        $this->assertDatabaseHas('organization_members', [
            'id' => $member->id, 'status' => 'active',
        ]);
    }

    public function test_legacy_keep_active_body_cannot_bypass_suspension(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->provisionTutor($owner, $org);
        $member = $this->memberRow($org, $tutor);

        // The old client body is intentionally ignored: no detached-but-active staff accounts.
        $this->actingAsApi($owner->fresh())
            ->deleteJson("/api/v1/organizations/{$org->hash_id}/members/{$member->hash_id}", [
                'keep_active' => true,
            ])
            ->assertStatus(200);

        $tutor->refresh();
        $this->assertNotNull($tutor->suspended_at);
        $this->assertTrue($tutor->isLoginBlocked());
        $this->assertDatabaseHas('organization_members', ['id' => $member->id, 'status' => 'removed']);

        $this->postJson('/api/v1/auth/login', ['email' => $tutor->email, 'password' => 'password123'])
            ->assertStatus(403)
            ->assertJsonPath('code', 'ACCOUNT_SUSPENDED');
    }

    public function test_non_provisioned_legacy_member_is_also_suspended(): void
    {
        [$owner, $org] = $this->makeOrg();

        // Covers imported/legacy staff rows that predate provisioned_org_id.
        $legacyTutor = $this->tutor(['email' => 'legacy@example.com', 'password' => Hash::make('password123')]);
        $legacyTutor->forceFill(['email_verified_at' => now()])->save();
        OrganizationMember::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $legacyTutor->id,
            'org_role' => 'tutor',
        ]);
        $member = $this->memberRow($org, $legacyTutor);

        $this->actingAsApi($owner->fresh())
            ->deleteJson("/api/v1/organizations/{$org->hash_id}/members/{$member->hash_id}")
            ->assertStatus(200);

        $legacyTutor->refresh();
        $this->assertNotNull($legacyTutor->suspended_at);
        $this->assertSame('org_removed', $legacyTutor->suspended_reason);
        $this->assertTrue($legacyTutor->isLoginBlocked());

        $this->postJson('/api/v1/auth/login', ['email' => $legacyTutor->email, 'password' => 'password123'])
            ->assertStatus(403)
            ->assertJsonPath('code', 'ACCOUNT_SUSPENDED');
    }
}
