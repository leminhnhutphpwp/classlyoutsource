<?php

namespace Tests\Feature\Organization;

use App\Models\Organization;
use App\Models\OrganizationBankAccount;
use App\Models\OrganizationMember;
use App\Models\User;
use App\Support\VietQrBank;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrganizationBankAccountTest extends TestCase
{
    use RefreshDatabase;

    private function createOrgWithOwner(): array
    {
        $owner = $this->tutor();
        $org = Organization::factory()->create(['owner_id' => $owner->id]);
        OrganizationMember::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);
        return [$org, $owner];
    }

    private function addManager(Organization $org): User
    {
        $manager = $this->tutor();
        OrganizationMember::factory()->manager()->create([
            'organization_id' => $org->id,
            'user_id' => $manager->id,
        ]);
        return $manager;
    }

    private function addTutor(Organization $org): User
    {
        $tutor = $this->tutor();
        OrganizationMember::factory()->tutor()->create([
            'organization_id' => $org->id,
            'user_id' => $tutor->id,
        ]);
        return $tutor;
    }

    public function test_owner_can_list_bank_accounts(): void
    {
        [$org, $owner] = $this->createOrgWithOwner();

        $account = OrganizationBankAccount::create([
            'organization_id' => $org->id,
            'bank_name' => 'Techcombank',
            'account_number' => '123456',
            'account_name' => 'TEST',
            'is_default' => true,
        ]);

        $this->actingAsApi($owner)
            ->getJson('/api/v1/organizations/current/bank-accounts')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $account->id);
    }

    public function test_owner_can_create_bank_account(): void
    {
        [$org, $owner] = $this->createOrgWithOwner();

        $payload = [
            'bank_name' => 'Techcombank',
            'account_number' => '19036666888888',
            'account_name' => 'NGUYEN VAN A',
            'branch' => 'Chi nhánh Hà Nội',
            'memo' => 'HOCPHI-TRI-TUE',
            'is_default' => true,
        ];

        $this->actingAsApi($owner)
            ->postJson('/api/v1/organizations/current/bank-accounts', $payload)
            ->assertStatus(201)
            ->assertJsonPath('data.bank_name', 'Techcombank')
            ->assertJsonPath('data.memo', 'HOCPHI-TRI-TUE')
            ->assertJsonPath('data.is_default', true);

        $this->assertSame(1, OrganizationBankAccount::where('organization_id', $org->id)->count());
    }

    public function test_owner_can_update_bank_account(): void
    {
        [$org, $owner] = $this->createOrgWithOwner();

        $account = OrganizationBankAccount::create([
            'organization_id' => $org->id,
            'bank_name' => 'Techcombank',
            'account_number' => '123456',
            'account_name' => 'OLD',
            'is_default' => true,
        ]);

        $payload = [
            'bank_name' => 'Vietcombank',
            'account_number' => '654321',
            'account_name' => 'NEW',
            'memo' => 'HOCPHI-MOI',
        ];

        $this->actingAsApi($owner)
            ->putJson("/api/v1/organizations/current/bank-accounts/{$account->id}", $payload)
            ->assertOk()
            ->assertJsonPath('data.bank_name', 'Vietcombank')
            ->assertJsonPath('data.account_number', '654321')
            ->assertJsonPath('data.account_name', 'NEW')
            ->assertJsonPath('data.memo', 'HOCPHI-MOI');

        $account->refresh();
        $this->assertSame('Vietcombank', $account->bank_name);
        $this->assertSame('HOCPHI-MOI', $account->memo);
    }

    public function test_owner_can_delete_bank_account(): void
    {
        [$org, $owner] = $this->createOrgWithOwner();

        $account1 = OrganizationBankAccount::create([
            'organization_id' => $org->id,
            'bank_name' => 'Techcombank',
            'account_number' => '111',
            'account_name' => 'A',
            'is_default' => true,
        ]);

        $account2 = OrganizationBankAccount::create([
            'organization_id' => $org->id,
            'bank_name' => 'Vietcombank',
            'account_number' => '222',
            'account_name' => 'B',
            'is_default' => false,
        ]);

        $this->actingAsApi($owner)
            ->deleteJson("/api/v1/organizations/current/bank-accounts/{$account1->id}")
            ->assertOk();

        $this->assertNull(OrganizationBankAccount::find($account1->id));
        $this->assertNotNull(OrganizationBankAccount::find($account2->id));

        // Khi xóa default, account2 trở thành default
        $account2->refresh();
        $this->assertTrue($account2->is_default);
    }

    public function test_owner_can_set_default(): void
    {
        [$org, $owner] = $this->createOrgWithOwner();

        $account1 = OrganizationBankAccount::create([
            'organization_id' => $org->id,
            'bank_name' => 'Techcombank',
            'account_number' => '111',
            'account_name' => 'A',
            'is_default' => true,
        ]);

        $account2 = OrganizationBankAccount::create([
            'organization_id' => $org->id,
            'bank_name' => 'Vietcombank',
            'account_number' => '222',
            'account_name' => 'B',
            'is_default' => false,
        ]);

        $this->actingAsApi($owner)
            ->postJson("/api/v1/organizations/current/bank-accounts/{$account2->id}/set-default")
            ->assertOk();

        $account1->refresh();
        $account2->refresh();
        $this->assertFalse($account1->is_default);
        $this->assertTrue($account2->is_default);
    }

    public function test_manager_can_manage_bank_accounts(): void
    {
        [$org, $owner] = $this->createOrgWithOwner();
        $manager = $this->addManager($org);

        $this->actingAsApi($manager)
            ->getJson('/api/v1/organizations/current/bank-accounts')
            ->assertOk();

        $payload = [
            'bank_name' => 'Techcombank',
            'account_number' => '123456',
            'account_name' => 'MANAGER',
        ];

        $this->actingAsApi($manager)
            ->postJson('/api/v1/organizations/current/bank-accounts', $payload)
            ->assertStatus(201);
    }

    public function test_tutor_cannot_manage_bank_accounts(): void
    {
        [$org, $owner] = $this->createOrgWithOwner();
        $tutor = $this->addTutor($org);

        $this->actingAsApi($tutor)
            ->getJson('/api/v1/organizations/current/bank-accounts')
            ->assertStatus(403);

        $this->actingAsApi($tutor)
            ->postJson('/api/v1/organizations/current/bank-accounts', [
                'bank_name' => 'Techcombank',
                'account_number' => '123456',
                'account_name' => 'TUTOR',
            ])->assertStatus(403);
    }

    public function test_validation_rejects_unknown_bank_name(): void
    {
        [$org, $owner] = $this->createOrgWithOwner();

        $this->actingAsApi($owner)
            ->postJson('/api/v1/organizations/current/bank-accounts', [
                'bank_name' => 'Ngân hàng không tồn tại',
                'account_number' => '123456',
                'account_name' => 'TEST',
            ])->assertStatus(422)
            ->assertJsonPath('code', 'VALIDATION_ERROR');
    }

    public function test_bank_name_normalized_to_canonical(): void
    {
        [$org, $owner] = $this->createOrgWithOwner();

        $this->actingAsApi($owner)
            ->postJson('/api/v1/organizations/current/bank-accounts', [
                'bank_name' => 'TCB',
                'account_number' => '123456',
                'account_name' => 'TEST',
            ])->assertStatus(201)
            ->assertJsonPath('data.bank_name', 'Techcombank');
    }

    public function test_only_one_default_account(): void
    {
        [$org, $owner] = $this->createOrgWithOwner();

        $account1 = OrganizationBankAccount::create([
            'organization_id' => $org->id,
            'bank_name' => 'Techcombank',
            'account_number' => '111',
            'account_name' => 'A',
            'is_default' => true,
        ]);

        $this->actingAsApi($owner)
            ->postJson('/api/v1/organizations/current/bank-accounts', [
                'bank_name' => 'Vietcombank',
                'account_number' => '222',
                'account_name' => 'B',
                'is_default' => true,
            ])->assertStatus(201);

        $account1->refresh();
        $this->assertFalse($account1->is_default);

        $defaultCount = OrganizationBankAccount::where('organization_id', $org->id)
            ->where('is_default', true)
            ->count();
        $this->assertSame(1, $defaultCount);
    }
}