<?php

namespace Tests\Feature\Payments;

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
 * The student tuition flow must surface the CENTER's default bank account (QR +
 * instructions) for ANY pending payment — even one recorded as cash — and must
 * never reveal the double "CLASSLY CLASSLY" prefix bug in the instructions.
 */
class StudentTuitionQrTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Payment templates live in global settings (seeded in prod by SystemSettingsSeeder).
        // Without them the transfer_content falls back to the raw reference and the
        // instructions to an empty string — neither reflects the real flow.
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

    /** Create a student whose user account maps to the given Student record. */
    private function studentUserFor(Student $student): User
    {
        $user = $this->studentUser();
        $student->update(['user_id' => $user->id]);

        return $user;
    }

    private function seedOrgDefaultBank(int $organizationId, string $accountNumber = '000123456789'): void
    {
        OrganizationBankAccount::create([
            'organization_id' => $organizationId,
            'bank_name' => 'Techcombank',
            'account_number' => $accountNumber,
            'account_name' => 'TRUNG TAM GIA SU TRI TUE',
            'branch' => 'Chi nhánh TP. Hồ Chí Minh',
            'is_default' => true,
        ]);
    }

    public function test_student_sees_org_default_bank_for_pending_payment(): void
    {
        $owner = $this->tutor();
        $class = $this->makeOrgClass($owner);
        $student = Student::factory()->create(['created_by' => $owner->id, 'class_id' => $class->id]);
        $this->enroll($student, $class);
        $this->seedOrgDefaultBank($class->organization_id);

        $payment = Payment::factory()->pending()->create([
            'student_id' => $student->id,
            'class_id' => $class->id,
        ]);

        $studentUser = $this->studentUserFor($student);

        $this->actingAsApi($studentUser)
            ->getJson("/api/v1/payments/{$payment->hash_id}")
            ->assertOk()
            ->assertJsonPath('data.bank_transfer_info.bank_name', 'Techcombank')
            ->assertJsonPath('data.bank_transfer_info.account_number', '000123456789')
            ->assertJsonPath('data.bank_transfer_info.account_holder', 'TRUNG TAM GIA SU TRI TUE')
            ->assertJsonPath('data.bank_transfer_info.qr_code_url', fn ($url) => is_string($url) && str_contains($url, 'img.vietqr.io/image/TCB-000123456789'));
    }

    public function test_pending_cash_payment_still_returns_bank_transfer_info(): void
    {
        $owner = $this->tutor();
        $class = $this->makeOrgClass($owner);
        $student = Student::factory()->create(['created_by' => $owner->id, 'class_id' => $class->id]);
        $this->enroll($student, $class);
        $this->seedOrgDefaultBank($class->organization_id);

        // pending + cash: the QR/instructions must STILL be present (the center's
        // account is the single way a student settles a pending tuition).
        $payment = Payment::factory()->pending()->create([
            'student_id' => $student->id,
            'class_id' => $class->id,
            'payment_method' => 'cash',
        ]);

        $studentUser = $this->studentUserFor($student);

        $this->actingAsApi($studentUser)
            ->getJson("/api/v1/payments/{$payment->hash_id}")
            ->assertOk()
            ->assertJsonPath('data.bank_transfer_info.account_number', '000123456789');
    }

    public function test_instructions_have_no_double_prefix(): void
    {
        $owner = $this->tutor();
        $class = $this->makeOrgClass($owner);
        $student = Student::factory()->create(['created_by' => $owner->id, 'class_id' => $class->id]);
        $this->enroll($student, $class);
        $this->seedOrgDefaultBank($class->organization_id);

        $payment = Payment::factory()->pending()->create([
            'student_id' => $student->id,
            'class_id' => $class->id,
        ]);

        $studentUser = $this->studentUserFor($student);

        $this->actingAsApi($studentUser)
            ->getJson("/api/v1/payments/{$payment->hash_id}")
            ->assertOk()
            ->assertJsonPath('data.bank_transfer_info.transfer_content', 'CLASSLY '.$payment->reference_code)
            ->assertJsonPath('data.bank_transfer_info.instructions', function (string $instructions) {
                $this->assertStringNotContainsString('CLASSLY CLASSLY', $instructions);
                $this->assertStringContainsString('CLASSLY', $instructions);

                return true;
            });
    }

    public function test_student_cannot_view_another_students_payment(): void
    {
        $owner = $this->tutor();
        $class = $this->makeOrgClass($owner);
        $student = Student::factory()->create(['created_by' => $owner->id, 'class_id' => $class->id]);
        $otherStudent = Student::factory()->create(['created_by' => $owner->id, 'class_id' => $class->id]);
        $this->enroll($student, $class);
        $this->enroll($otherStudent, $class);
        $this->seedOrgDefaultBank($class->organization_id);

        $otherPayment = Payment::factory()->pending()->create([
            'student_id' => $otherStudent->id,
            'class_id' => $class->id,
        ]);

        $studentUser = $this->studentUserFor($student);

        $this->actingAsApi($studentUser)
            ->getJson("/api/v1/payments/{$otherPayment->hash_id}")
            ->assertForbidden();
    }

    public function test_account_memo_overrides_global_template_for_transfer_content(): void
    {
        $owner = $this->tutor();
        $class = $this->makeOrgClass($owner);
        $student = Student::factory()->create(['created_by' => $owner->id, 'class_id' => $class->id]);
        $this->enroll($student, $class);

        // The account carries its own memo (per-account transfer content) with the placeholder.
        OrganizationBankAccount::create([
            'organization_id' => $class->organization_id,
            'bank_name' => 'MBBank',
            'account_number' => 'MEMO_ACCT',
            'account_name' => 'TRUNG TAM MEMO',
            'memo' => 'TT [Mã đơn hàng]',
            'is_default' => true,
        ]);

        $payment = Payment::factory()->pending()->create([
            'student_id' => $student->id,
            'class_id' => $class->id,
        ]);

        $studentUser = $this->studentUserFor($student);

        $this->actingAsApi($studentUser)
            ->getJson("/api/v1/payments/{$payment->hash_id}")
            ->assertOk()
            ->assertJsonPath('data.bank_transfer_info.bank_name', 'MBBank')
            ->assertJsonPath('data.bank_transfer_info.transfer_content', 'TT '.$payment->reference_code);
    }

    public function test_bank_transfer_info_null_when_org_has_no_bank_account(): void
    {
        $owner = $this->tutor();
        $class = $this->makeOrgClass($owner);
        $student = Student::factory()->create(['created_by' => $owner->id, 'class_id' => $class->id]);
        $this->enroll($student, $class);

        $payment = Payment::factory()->pending()->create([
            'student_id' => $student->id,
            'class_id' => $class->id,
        ]);

        $studentUser = $this->studentUserFor($student);

        $this->actingAsApi($studentUser)
            ->getJson("/api/v1/payments/{$payment->hash_id}")
            ->assertOk()
            ->assertJsonPath('data.bank_transfer_info', null);
    }

    /**
     * The transfer content MUST always carry the payment reference: SePay reconciles by
     * extracting it from what the student typed, and it is how the center tells payers
     * apart. A memo without the placeholder (what a center would realistically type) must
     * still end up with the reference appended.
     */
    public function test_memo_without_placeholder_still_carries_payment_reference(): void
    {
        $owner = $this->tutor();
        $class = $this->makeOrgClass($owner);
        $student = Student::factory()->create(['created_by' => $owner->id, 'class_id' => $class->id]);
        $this->enroll($student, $class);

        OrganizationBankAccount::create([
            'organization_id' => $class->organization_id,
            'bank_name' => 'MBBank',
            'account_number' => 'MEMO_PLAIN',
            'account_name' => 'TRUNG TAM MEMO',
            'memo' => 'HOCPHI-TRITUE', // no [Mã đơn hàng] placeholder — the realistic mistake
            'is_default' => true,
        ]);

        $payment = Payment::factory()->pending()->create([
            'student_id' => $student->id,
            'class_id' => $class->id,
        ]);

        $studentUser = $this->studentUserFor($student);

        $this->actingAsApi($studentUser)
            ->getJson("/api/v1/payments/{$payment->hash_id}")
            ->assertOk()
            ->assertJsonPath('data.bank_transfer_info.transfer_content', 'HOCPHI-TRITUE '.$payment->reference_code)
            ->assertJsonPath('data.bank_transfer_info.qr_code_url', fn ($url) => is_string($url) && str_contains($url, urlencode('HOCPHI-TRITUE '.$payment->reference_code)));
    }

    /** A memo WITH the placeholder must not get the reference appended a second time. */
    public function test_memo_with_placeholder_does_not_duplicate_reference(): void
    {
        $owner = $this->tutor();
        $class = $this->makeOrgClass($owner);
        $student = Student::factory()->create(['created_by' => $owner->id, 'class_id' => $class->id]);
        $this->enroll($student, $class);

        OrganizationBankAccount::create([
            'organization_id' => $class->organization_id,
            'bank_name' => 'MBBank',
            'account_number' => 'MEMO_PH',
            'account_name' => 'TRUNG TAM MEMO',
            'memo' => 'TT [Mã đơn hàng]',
            'is_default' => true,
        ]);

        $payment = Payment::factory()->pending()->create([
            'student_id' => $student->id,
            'class_id' => $class->id,
        ]);

        $studentUser = $this->studentUserFor($student);

        $expected = 'TT '.$payment->reference_code;
        $this->actingAsApi($studentUser)
            ->getJson("/api/v1/payments/{$payment->hash_id}")
            ->assertOk()
            ->assertJsonPath('data.bank_transfer_info.transfer_content', $expected)
            ->assertJsonPath('data.bank_transfer_info.transfer_content', function (string $content) use ($payment) {
                // Exactly one occurrence of the reference — never "TT REF REF".
                $this->assertSame(1, substr_count($content, $payment->reference_code));

                return true;
            });
    }
}
