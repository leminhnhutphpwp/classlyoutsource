<?php

namespace App\Notifications;

use App\Models\Payment;
use App\Notifications\Channels\ZaloChannel;
use App\Support\CurrencyHelper;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Receipt sent when a tuition Payment is auto-reconciled by SePay. Goes to the student's User account
 * and their guardians via mail + in-app + Zalo (Zalo self-skips when disabled or the user opted out).
 */
class TuitionReceiptNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(protected Payment $payment) {}

    public function notificationType(): string
    {
        return 'tuition_receipt';
    }

    public function via(object $notifiable): array
    {
        $channels = ['mail', 'database'];
        if (config('notifications.channels.zalo.enabled')) {
            $channels[] = ZaloChannel::class;
        }

        return $channels;
    }

    public function toZalo(object $notifiable): string
    {
        $amount = CurrencyHelper::formatWithoutSign($this->payment->amount);

        return "Classly: Đã nhận thanh toán học phí {$amount} VNĐ."
            .' Mã GD: '.($this->payment->reference_code ?? $this->payment->transaction_id).'. Cảm ơn bạn!';
    }

    public function toMail(object $notifiable): MailMessage
    {
        $amount = CurrencyHelper::formatWithoutSign($this->payment->amount);

        return (new MailMessage)
            ->subject('Đã nhận thanh toán học phí')
            ->line("Chúng tôi đã nhận thanh toán học phí {$amount} VNĐ.")
            ->line('Mã giao dịch: '.($this->payment->reference_code ?? $this->payment->transaction_id))
            ->line('Cảm ơn bạn.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'tuition_receipt',
            'payment_id' => $this->payment->id,
            'amount' => (float) $this->payment->amount,
            'reference_code' => $this->payment->reference_code,
            'month' => $this->payment->month,
        ];
    }
}
