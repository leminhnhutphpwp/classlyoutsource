<?php

namespace Tests\Feature\Security;

use App\Actions\ImportPaymentAction;
use App\Models\CenterExpense;
use App\Models\ClassRoom;
use App\Models\Enrollment;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\Payment;
use App\Models\PaymentRequest;
use App\Models\Student;
use App\Models\User;
use App\Services\PaymentTokenService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Payment mutation guards (design §5 QĐ 3 + §cash):
 *  - Accountant is FINANCE-READ + expense-entry ONLY — every payment mutation (store/update/destroy/
 *    approve/reject/refund/mark-failed/import) returns 403 ACCOUNTANT_READONLY.
 *  - REFUND is owner/manager-only (a class tutor may approve/reject their class's payments but never
 *    return money) → 403 REFUND_FORBIDDEN.
 *  - refund writes STRUCTURED refunded_amount/refunded_at (not just a free-text note).
 *  - amount/refund_amount reject fractional VND (money is whole VND).
 *  - import verifies the student is ACTIVELY enrolled in the class before booking revenue.
 *  - parent decode-token is scoped to guarded students only.
 */
class PaymentMutationGuardTest extends TestCase
{
    use RefreshDatabase;

    /** Owner (is the org owner) + org + owner membership. */
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

    private function addMember(Organization $org, string $role): User
    {
        $user = $this->tutor();
        OrganizationMember::factory()->create([
            'organization_id' => $org->id,
            'user_id' => $user->id,
            'org_role' => $role,
        ]);

        return $user->fresh();
    }

    private function orgClass(Organization $org, User $tutor): ClassRoom
    {
        return ClassRoom::factory()->create([
            'tutor_id' => $tutor->id,
            'organization_id' => $org->id,
            'status' => 'active',
        ]);
    }

    private function paidPayment(ClassRoom $class, Student $student): Payment
    {
        return Payment::factory()->create([
            'student_id' => $student->id,
            'class_id' => $class->id,
            'status' => 'paid',
            'amount' => 1000000,
            'payment_date' => now()->toDateString(),
        ]);
    }

    public function test_accountant_cannot_mutate_payments(): void
    {
        [$owner, $org] = $this->makeOrg();
        $accountant = $this->addMember($org, 'accountant');
        $tutor = $this->addMember($org, 'tutor');
        $class = $this->orgClass($org, $tutor);
        $student = $this->studentInClass($class, ['created_by' => $tutor->id]);
        $payment = $this->paidPayment($class, $student);

        $payload = [
            'student_id' => $student->hash_id,
            'class_id' => $class->hash_id,
            'amount' => 500000,
            'payment_method' => 'cash',
            'month' => now()->format('Y-m'),
        ];

        // Store + every state mutation is forbidden for the accountant.
        $this->actingAsApi($accountant)
            ->postJson('/api/v1/payments', $payload)
            ->assertStatus(403)
            ->assertJsonPath('code', 'ACCOUNTANT_READONLY');

        $this->actingAsApi($accountant)
            ->patchJson("/api/v1/payments/{$payment->hash_id}", ['amount' => 600000])
            ->assertStatus(403)
            ->assertJsonPath('code', 'ACCOUNTANT_READONLY');

        $this->actingAsApi($accountant)
            ->deleteJson("/api/v1/payments/{$payment->hash_id}")
            ->assertStatus(403)
            ->assertJsonPath('code', 'ACCOUNTANT_READONLY');

        $this->actingAsApi($accountant)
            ->postJson("/api/v1/payments/{$payment->hash_id}/refund", ['reason' => 'Test'])
            ->assertStatus(403)
            ->assertJsonPath('code', 'ACCOUNTANT_READONLY');

        $this->actingAsApi($accountant)
            ->postJson("/api/v1/payments/{$payment->hash_id}/mark-failed", ['reason' => 'Test'])
            ->assertStatus(403)
            ->assertJsonPath('code', 'ACCOUNTANT_READONLY');
    }

    public function test_accountant_can_still_record_expense(): void
    {
        [$owner, $org] = $this->makeOrg();
        $accountant = $this->addMember($org, 'accountant');

        // Expense-entry is the accountant's WRITE lane — must keep working.
        $this->actingAsApi($accountant)
            ->postJson("/api/v1/organizations/{$org->hash_id}/expenses", [
                'category' => 'rent',
                'amount' => 400000,
                'expense_date' => now()->toDateString(),
            ])
            ->assertStatus(201);

        $this->assertSame(1, CenterExpense::where('organization_id', $org->id)->count());
    }

    public function test_refund_is_owner_manager_only_tutor_forbidden(): void
    {
        [$owner, $org] = $this->makeOrg();
        $manager = $this->addMember($org, 'manager');
        $tutor = $this->addMember($org, 'tutor');
        $class = $this->orgClass($org, $tutor);
        $student = $this->studentInClass($class, ['created_by' => $tutor->id]);
        $payment = $this->paidPayment($class, $student);

        // The class tutor (who CAN approve/reject) is NOT allowed to refund money.
        $this->actingAsApi($tutor)
            ->postJson("/api/v1/payments/{$payment->hash_id}/refund", ['reason' => 'Test'])
            ->assertStatus(403)
            ->assertJsonPath('code', 'REFUND_FORBIDDEN');

        // Manager can refund → structured refund fields are written.
        $this->actingAsApi($manager)
            ->postJson("/api/v1/payments/{$payment->hash_id}/refund", [
                'reason' => 'Hoàn 1 phần',
                'refund_amount' => 400000,
            ])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'refunded')
            ->assertJsonPath('data.refunded_amount', 400000);

        $payment->refresh();
        $this->assertSame('400000', (string) $payment->refunded_amount);
        $this->assertNotNull($payment->refunded_at);
    }

    public function test_fractional_amount_and_refund_are_rejected(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');
        $class = $this->orgClass($org, $tutor);
        $student = $this->studentInClass($class, ['created_by' => $tutor->id]);
        $payment = $this->paidPayment($class, $student);

        // Fractional VND on create → 422.
        $this->actingAsApi($tutor)
            ->postJson('/api/v1/payments', [
                'student_id' => $student->hash_id,
                'class_id' => $class->hash_id,
                'amount' => 500000.5,
                'payment_method' => 'cash',
                'month' => now()->format('Y-m'),
            ])
            ->assertStatus(422);

        // Fractional refund amount → 422 (owner refunding).
        $this->actingAsApi($owner)
            ->postJson("/api/v1/payments/{$payment->hash_id}/refund", [
                'reason' => 'Test',
                'refund_amount' => 100.99,
            ])
            ->assertStatus(422);
    }

    public function test_import_rejects_student_not_enrolled_in_class(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');
        $class = $this->orgClass($org, $tutor);
        $student = $this->studentInClass($class, ['created_by' => $tutor->id]);

        // Remove the enrollment — a payment for a non-enrolled student must NOT book revenue.
        Enrollment::where('student_id', $student->id)->where('class_id', $class->id)->delete();

        $rows = [[
            'row_number' => 1,
            'data' => [
                'student_id' => $student->id,
                'class_id' => $class->id,
                'amount' => 1000000,
                'payment_method' => 'cash',
                'status' => 'paid',
            ],
        ]];

        $result = ImportPaymentAction::execute($rows, $tutor->id);

        $this->assertSame(0, $result['success']);
        $this->assertSame(1, $result['failed']);
        $this->assertStringContainsString('chưa đăng ký hoạt động', $result['errors'][0]['errors'][0]);
        $this->assertSame(0, Payment::count());
    }

    public function test_import_succeeds_for_actively_enrolled_student(): void
    {
        [$owner, $org] = $this->makeOrg();
        $tutor = $this->addMember($org, 'tutor');
        $class = $this->orgClass($org, $tutor);
        $student = $this->studentInClass($class, ['created_by' => $tutor->id]);

        $rows = [[
            'row_number' => 1,
            'data' => [
                'student_id' => $student->id,
                'class_id' => $class->id,
                'amount' => 1000000,
                'payment_method' => 'cash',
                'status' => 'paid',
            ],
        ]];

        $result = ImportPaymentAction::execute($rows, $tutor->id);

        $this->assertSame(1, $result['success']);
        $this->assertSame(0, $result['failed']);
        $this->assertDatabaseHas('payments', [
            'student_id' => $student->id,
            'class_id' => $class->id,
            'amount' => 1000000,
        ]);
    }

    public function test_parent_can_decode_only_guarded_child_token(): void
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id, 'status' => 'active']);
        $ownChild = $this->studentInClass($class);
        $otherChild = $this->studentInClass($class);

        $ownPayment = $this->paidPayment($class, $ownChild);
        $otherPayment = $this->paidPayment($class, $otherChild);

        $parent = $this->guardian();
        $this->linkGuardian($parent, $ownChild); // guards ownChild only

        // Own child's token decodes.
        $this->actingAsApi($parent)
            ->getJson('/api/v1/payment/decode/'.PaymentTokenService::generateToken('payment', $ownPayment->id))
            ->assertStatus(200)
            ->assertJsonPath('data.payment._id', $ownPayment->hash_id);

        // A stranger's token fails CLOSED (404 — never leaks existence).
        $this->actingAsApi($parent)
            ->getJson('/api/v1/payment/decode/'.PaymentTokenService::generateToken('payment', $otherPayment->id))
            ->assertStatus(404);
    }
}
