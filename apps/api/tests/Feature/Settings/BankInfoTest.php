<?php

namespace Tests\Feature\Settings;

use App\Models\User;
use App\Models\UserBankAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Feature tests for GET/PUT /api/v1/settings/payment/bank-info.
 *
 * Guards (fail-closed):
 *  - tutor-only (student / parent / super_admin → 403),
 *  - required bank_name/account_number/account_name,
 *  - bank_name must resolve to a known VietQR bank (canonical name + code accepted),
 *  - exactly ONE default row per tutor (unique (user_id, is_default)).
 */
class BankInfoTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'bank_name' => 'Techcombank',
            'account_number' => '19036666888888',
            'account_name' => 'NGUYEN VAN A',
            'branch' => 'Chi nhánh TP. Hồ Chí Minh',
        ], $overrides);
    }

    public function test_tutor_can_fetch_empty_bank_info(): void
    {
        $tutor = $this->tutor();

        $this->actingAsApi($tutor)
            ->getJson('/api/v1/settings/payment/bank-info')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.bank_name', null)
            ->assertJsonPath('data.account_number', null)
            ->assertJsonPath('data.account_name', null)
            ->assertJsonPath('data.branch', null);
    }

    public function test_tutor_can_create_bank_info(): void
    {
        $tutor = $this->tutor();

        $this->actingAsApi($tutor)
            ->putJson('/api/v1/settings/payment/bank-info', $this->payload())
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertSame(1, UserBankAccount::where('user_id', $tutor->id)->count());

        $this->actingAsApi($tutor)
            ->getJson('/api/v1/settings/payment/bank-info')
            ->assertOk()
            ->assertJsonPath('data.bank_name', 'Techcombank')
            ->assertJsonPath('data.account_number', '19036666888888')
            ->assertJsonPath('data.account_name', 'NGUYEN VAN A')
            ->assertJsonPath('data.branch', 'Chi nhánh TP. Hồ Chí Minh');
    }

    public function test_tutor_can_update_bank_info_without_duplicating_rows(): void
    {
        $tutor = $this->tutor();

        $this->actingAsApi($tutor)->putJson('/api/v1/settings/payment/bank-info', $this->payload());
        $this->actingAsApi($tutor)->putJson('/api/v1/settings/payment/bank-info', $this->payload([
            'bank_name' => 'Vietcombank',
            'account_number' => '0071370698888',
            'branch' => null,
        ]));

        $this->assertSame(1, UserBankAccount::where('user_id', $tutor->id)->count());
        $this->assertSame(1, UserBankAccount::where('user_id', $tutor->id)->where('is_default', true)->count());

        $this->actingAsApi($tutor)
            ->getJson('/api/v1/settings/payment/bank-info')
            ->assertJsonPath('data.bank_name', 'Vietcombank')
            ->assertJsonPath('data.branch', null);
    }

    public function test_bank_name_is_normalized_to_canonical_display_name(): void
    {
        $tutor = $this->tutor();

        // Short code accepted → stored as display name.
        $this->actingAsApi($tutor)->putJson('/api/v1/settings/payment/bank-info', $this->payload(['bank_name' => 'TCB']));
        $this->assertSame('Techcombank', UserBankAccount::where('user_id', $tutor->id)->first()->bank_name);

        // Lowercase accepted → stored as display name.
        $this->actingAsApi($tutor)->putJson('/api/v1/settings/payment/bank-info', $this->payload(['bank_name' => '  vietcombank  ']));
        $this->assertSame('Vietcombank', UserBankAccount::where('user_id', $tutor->id)->first()->bank_name);
    }

    public function test_account_number_whitespace_is_removed(): void
    {
        $tutor = $this->tutor();

        $this->actingAsApi($tutor)->putJson('/api/v1/settings/payment/bank-info', $this->payload([
            'account_number' => '1903 6666 8888 88',
        ]));

        $this->assertSame('19036666888888', UserBankAccount::where('user_id', $tutor->id)->first()->account_number);
    }

    public function test_validation_rejects_unknown_bank_name(): void
    {
        $tutor = $this->tutor();

        $this->actingAsApi($tutor)
            ->putJson('/api/v1/settings/payment/bank-info', $this->payload(['bank_name' => 'Ngân hàng không tồn tại']))
            ->assertStatus(422)
            ->assertJsonPath('code', 'VALIDATION_ERROR');
    }

    public function test_validation_requires_account_fields(): void
    {
        $tutor = $this->tutor();

        $this->actingAsApi($tutor)
            ->putJson('/api/v1/settings/payment/bank-info', ['bank_name' => 'Techcombank'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['account_number', 'account_name']);
    }

    public function test_non_tutor_roles_are_forbidden(): void
    {
        $student = $this->studentUser();
        $this->actingAsApi($student)
            ->getJson('/api/v1/settings/payment/bank-info')
            ->assertStatus(403);
        $this->actingAsApi($student)
            ->putJson('/api/v1/settings/payment/bank-info', $this->payload())
            ->assertStatus(403);

        $superAdmin = User::factory()->create(['role' => 'super_admin']);
        $this->actingAsApi($superAdmin)
            ->getJson('/api/v1/settings/payment/bank-info')
            ->assertStatus(403);
    }

    public function test_unauthenticated_returns_401(): void
    {
        $this->getJson('/api/v1/settings/payment/bank-info')->assertStatus(401);
    }

    public function test_legacy_aliases_are_still_accepted_on_update(): void
    {
        $tutor = $this->tutor();

        $this->actingAsApi($tutor)
            ->putJson('/api/v1/settings/payment/bank-info', [
                'bank_name' => 'Techcombank',
                'bank_account_number' => '999999',
                'bank_account_holder' => 'LEGACY NAME',
            ])
            ->assertOk();

        $bank = UserBankAccount::where('user_id', $tutor->id)->first();
        $this->assertSame('999999', $bank->account_number);
        $this->assertSame('LEGACY NAME', $bank->account_name);
    }
}
