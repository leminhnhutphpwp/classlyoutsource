<?php

namespace Tests\Feature\Guardian;

use App\Models\ClassRoom;
use App\Models\Organization;
use App\Models\OrganizationBankAccount;
use App\Models\OrganizationMember;
use App\Models\Payment;
use App\Models\Setting;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The parent payment intent must show the SAME bank account a student sees on the
 * payment page. Single source of truth = the class's ORGANIZATION default bank
 * account (tuition is paid into the center's account, not the tutor's personal one).
 */
class ParentPortalBankMatchTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Payment templates live in global settings (seeded in prod by SystemSettingsSeeder).
        Setting::set('bank_transfer_content_template', 'CLASSLY [Mã đơn hàng]', ['group' => 'payment']);
        Setting::set('bank_transfer_instructions', "Nội dung chuyển khoản: CLASSLY [Mã đơn hàng]\nVD: CLASSLY ORD123456\n\nSau khi chuyển khoản, vui lòng chụp ảnh bill và gửi cho trung tâm để xác nhận.", ['group' => 'payment']);
    }

    /** Create an org (owned by $owner) whose class has $organizationId set. */
    private function makeOrgClass(User $owner): ClassRoom
    {
        $org = Organization::factory()->create(['owner_id' => $owner->id]);
        OrganizationMember::factory()->owner()->create([
            'organization_id' => $org->id,
            'user_id' => $owner->id,
        ]);

        return ClassRoom::factory()->create([
            'tutor_id' => $owner->id,
            'organization_id' => $org->id,
        ]);
    }

    public function test_parent_intent_uses_organization_bank_account(): void
    {
        $owner = $this->tutor();
        $class = $this->makeOrgClass($owner);
        $student = Student::factory()->create(['created_by' => $owner->id, 'class_id' => $class->id]);
        $this->enroll($student, $class);

        // Org has a default bank account — the one that must be shown.
        OrganizationBankAccount::create([
            'organization_id' => $class->organization_id,
            'bank_name' => 'Techcombank',
            'account_number' => 'ORG_ACCOUNT',
            'account_name' => 'TRUNG TAM A',
            'is_default' => true,
        ]);

        $payment = Payment::factory()->pending()->create([
            'student_id' => $student->id,
            'class_id' => $class->id,
        ]);

        $parent = $this->guardian();
        $this->linkGuardian($parent, $student);

        $this->actingAsApi($parent)
            ->postJson("/api/v1/parent/payments/{$payment->hash_id}/intent")
            ->assertOk()
            ->assertJsonPath('data.bank.bank_name', 'Techcombank')
            ->assertJsonPath('data.bank.account_number', 'ORG_ACCOUNT')
            ->assertJsonPath('data.bank.account_holder', 'TRUNG TAM A')
            ->assertJsonPath('data.bank.qr_code_url', fn ($url) => is_string($url) && str_contains($url, 'img.vietqr.io/image/TCB-ORG_ACCOUNT'))
            ->assertJsonPath('data.bank.instructions', fn ($v) => is_string($v) && str_contains($v, 'CLASSLY'));
    }

    public function test_parent_intent_uses_org_default_not_non_default_account(): void
    {
        $owner = $this->tutor();
        $class = $this->makeOrgClass($owner);
        $student = Student::factory()->create(['created_by' => $owner->id, 'class_id' => $class->id]);
        $this->enroll($student, $class);

        // Two org accounts: one default (B), one not (A). The default must win.
        OrganizationBankAccount::create([
            'organization_id' => $class->organization_id,
            'bank_name' => 'Techcombank',
            'account_number' => 'A_ACCOUNT',
            'account_name' => 'ORG A',
            'is_default' => false,
        ]);
        OrganizationBankAccount::create([
            'organization_id' => $class->organization_id,
            'bank_name' => 'Vietcombank',
            'account_number' => 'B_ACCOUNT',
            'account_name' => 'ORG B',
            'is_default' => true,
        ]);

        $payment = Payment::factory()->pending()->create([
            'student_id' => $student->id,
            'class_id' => $class->id,
        ]);

        $parent = $this->guardian();
        $this->linkGuardian($parent, $student);

        $this->actingAsApi($parent)
            ->postJson("/api/v1/parent/payments/{$payment->hash_id}/intent")
            ->assertOk()
            ->assertJsonPath('data.bank.account_number', 'B_ACCOUNT');
    }

    public function test_parent_intent_returns_null_bank_when_org_has_no_bank_account(): void
    {
        $owner = $this->tutor();
        $class = $this->makeOrgClass($owner);
        $student = Student::factory()->create(['created_by' => $owner->id, 'class_id' => $class->id]);
        $this->enroll($student, $class);

        $payment = Payment::factory()->pending()->create([
            'student_id' => $student->id,
            'class_id' => $class->id,
        ]);

        $parent = $this->guardian();
        $this->linkGuardian($parent, $student);

        $this->actingAsApi($parent)
            ->postJson("/api/v1/parent/payments/{$payment->hash_id}/intent")
            ->assertOk()
            ->assertJsonPath('data.bank', null);
    }

    public function test_parent_intent_returns_null_bank_when_class_has_no_organization(): void
    {
        // payments.class_id is NOT NULL, but a class can exist without an org
        // (standalone tutor). In that case there is no center account → null.
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id, 'organization_id' => null]);
        $student = Student::factory()->create(['created_by' => $tutor->id, 'class_id' => $class->id]);
        $this->enroll($student, $class);

        $payment = Payment::factory()->pending()->create([
            'student_id' => $student->id,
            'class_id' => $class->id,
        ]);

        $parent = $this->guardian();
        $this->linkGuardian($parent, $student);

        $this->actingAsApi($parent)
            ->postJson("/api/v1/parent/payments/{$payment->hash_id}/intent")
            ->assertOk()
            ->assertJsonPath('data.bank', null);
    }
}