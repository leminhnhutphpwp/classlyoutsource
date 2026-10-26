<?php

namespace App\Listeners;

use App\Models\Payment;
use App\Models\User;
use App\Notifications\TuitionReceiptNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use SePay\SePay\Events\SePayWebhookEvent;

class SePayWebhookListener
{
    public function handle(SePayWebhookEvent $event): void
    {
        $data = $event->sePayWebhookData;

        // Chỉ xử lý giao dịch tiền vào
        if ($data->transferType !== 'in') {
            return;
        }

        $content = $data->content;
        $sepayPrefix = config('sepay.pattern', 'CLS');
        $paymentPrefix = config('sepay.prefixes.payment', 'P');

        $matches = [];
        // Regex: tìm mã thanh toán P-prefix trong nội dung chuyển khoản
        $pattern = '/('.preg_quote($sepayPrefix, '/').')('.preg_quote($paymentPrefix, '/').')([A-Z0-9]{5,15})/i';

        if (preg_match($pattern, $content, $matches)) {
            $fullCode = strtoupper($matches[0]);
            $this->handlePayment($fullCode, $data);
        } else {
            Log::channel('sepay')->warning('SePay Webhook: Cannot parse transaction content', ['content' => $content]);
        }
    }

    protected function handlePayment($code, $sePayData): void
    {
        // Kill-switch: auto-reconciliation ships OFF and is enabled in prod only after feature tests pass.
        if (! config('sepay.auto_reconcile_payments')) {
            Log::channel('sepay')->info("SePay Webhook: auto-reconcile disabled — skipped Payment $code (manual).");

            return;
        }

        DB::beginTransaction();
        try {
            // Idempotent match by the P-prefixed reference_code (unique, stamped at Payment creation).
            $payment = Payment::where('reference_code', $code)->lockForUpdate()->first();

            if (! $payment) {
                Log::channel('sepay')->warning("SePay Webhook: Payment not found [Code: $code]");
                DB::rollBack();

                return;
            }

            // Replay guard — webhooks retry; a second delivery is a no-op.
            if ($payment->isPaid()) {
                Log::channel('sepay')->info("SePay Webhook: Payment #{$payment->id} already paid — skipped.");
                DB::rollBack();

                return;
            }

            // Duplicate bank-reference guard (same SePay tx mapped elsewhere).
            $sepayTxId = $sePayData->id ?? null;
            if ($sepayTxId && Payment::where('transaction_id', (string) $sepayTxId)->exists()) {
                Log::channel('sepay')->warning("SePay Webhook: duplicate SePay tx {$sepayTxId} — skipped Payment #{$payment->id}.");
                DB::rollBack();

                return;
            }

            $expected = (float) $payment->amount;
            $received = (float) $sePayData->transferAmount;
            $tolerance = (float) config('sepay.tolerance', 0);

            // Underpayment: never auto-complete. Leave pending + flag for manual review.
            if ($received + $tolerance < $expected) {
                $payment->update([
                    'note' => trim(($payment->note ?? '')."\n[SePay] Nhận thiếu: {$received}/{$expected} — cần xác nhận thủ công."),
                ]);
                DB::commit();
                Log::channel('sepay')->warning("SePay Webhook: underpayment for Payment #{$payment->id} ({$received}<{$expected}).");

                return;
            }

            // Full payment (or overpayment — surplus logged).
            $payment->update([
                'status' => 'paid',
                'payment_date' => now(),
                'payment_method' => 'bank',
                'transaction_id' => (string) ($sepayTxId ?? $payment->transaction_id),
                'note' => trim(($payment->note ?? '')."\n[SePay] Đã đối soát tự động."),
            ]);

            DB::commit();
            Log::channel('sepay')->info("SePay Webhook: reconciled Payment #{$payment->id} (received {$received}).");

            $this->sendReceipt($payment);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::channel('sepay')->error("SePay Webhook: Error processing Payment $code: ".$e->getMessage());
        }
    }

    /** Notify the student's User + their guardians that tuition was received. */
    protected function sendReceipt(Payment $payment): void
    {
        try {
            $student = $payment->student;
            if (! $student) {
                return;
            }

            $recipients = collect();
            if ($student->user_id && $studentUser = User::find($student->user_id)) {
                $recipients->push($studentUser);
            }
            $recipients = $recipients->merge($student->guardians)->unique('id');

            if ($recipients->isNotEmpty()) {
                Notification::send(
                    $recipients,
                    new TuitionReceiptNotification($payment)
                );
            }
        } catch (\Throwable $e) {
            Log::channel('sepay')->error('SePay Webhook: receipt notify failed: '.$e->getMessage());
        }
    }
}
