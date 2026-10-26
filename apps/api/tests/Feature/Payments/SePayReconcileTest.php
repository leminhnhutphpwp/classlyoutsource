<?php

namespace Tests\Feature\Payments;

use App\Listeners\SePayWebhookListener;
use App\Models\ClassRoom;
use App\Models\Payment;
use App\Models\Student;
use App\Notifications\TuitionReceiptNotification;
use Illuminate\Support\Facades\Notification;
use SePay\SePay\Datas\SePayWebhookData;
use SePay\SePay\Events\SePayWebhookEvent;
use Tests\TestCase;

class SePayReconcileTest extends TestCase
{
    private function ref(): string
    {
        return strtoupper(config('sepay.pattern').config('sepay.prefixes.payment').'0000000001');
    }

    private function pendingPayment(int $amount = 500000): Payment
    {
        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $studentUser = $this->studentUser();
        $student = Student::factory()->create(['created_by' => $tutor->id, 'class_id' => $class->id, 'user_id' => $studentUser->id]);

        return Payment::factory()->create([
            'student_id' => $student->id, 'class_id' => $class->id,
            'amount' => $amount, 'status' => 'pending', 'reference_code' => $this->ref(),
        ]);
    }

    private function fire(string $content, int $amount, int $txId = 12345): void
    {
        $data = new SePayWebhookData(
            id: $txId,
            gateway: 'VCB',
            transactionDate: '2026-07-19 10:00:00',
            accountNumber: '0123456789',
            subAccount: '',
            code: '',
            content: $content,
            transferType: 'in',
            description: $content,
            transferAmount: $amount,
            referenceCode: 'FT'.$txId,
            accumulated: $amount,
        );
        (new SePayWebhookListener)->handle(new SePayWebhookEvent('test', $data));
    }

    public function test_full_payment_reconciles_and_sends_receipt(): void
    {
        config(['sepay.auto_reconcile_payments' => true]);
        Notification::fake();
        $payment = $this->pendingPayment(500000);

        $this->fire($this->ref(), 500000);

        $this->assertSame('paid', $payment->fresh()->status);
        Notification::assertSentTimes(TuitionReceiptNotification::class, 1);
    }

    public function test_replay_is_idempotent(): void
    {
        config(['sepay.auto_reconcile_payments' => true]);
        Notification::fake();
        $payment = $this->pendingPayment(500000);

        $this->fire($this->ref(), 500000);
        $this->fire($this->ref(), 500000); // retry

        $this->assertSame('paid', $payment->fresh()->status);
        Notification::assertSentTimes(TuitionReceiptNotification::class, 1); // only once
    }

    public function test_underpayment_stays_pending(): void
    {
        config(['sepay.auto_reconcile_payments' => true]);
        $payment = $this->pendingPayment(500000);

        $this->fire($this->ref(), 400000); // short

        $this->assertSame('pending', $payment->fresh()->status);
    }

    public function test_kill_switch_off_does_nothing(): void
    {
        config(['sepay.auto_reconcile_payments' => false]);
        $payment = $this->pendingPayment(500000);

        $this->fire($this->ref(), 500000);

        $this->assertSame('pending', $payment->fresh()->status);
    }

    public function test_unknown_code_is_noop(): void
    {
        config(['sepay.auto_reconcile_payments' => true]);
        $this->fire(strtoupper(config('sepay.pattern').config('sepay.prefixes.payment').'9999999999'), 500000);
        $this->assertTrue(true); // no exception
    }
}
