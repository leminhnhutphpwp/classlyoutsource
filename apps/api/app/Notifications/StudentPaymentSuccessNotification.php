<?php

namespace App\Notifications;

use App\Models\Payment;
use App\Models\Setting;
use App\Notifications\Traits\UsesEmailTemplate;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;

class StudentPaymentSuccessNotification extends Notification implements ShouldQueue
{
    use Queueable, UsesEmailTemplate;

    public function __construct(
        public Payment $payment
    ) {}

    /**
     * Get the notification's delivery channels.
     */
    public function via(object $notifiable): array
    {
        // Chỉ gửi email, không ghi vào bảng notifications mặc định của Laravel
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $formattedAmount = number_format($this->payment->amount, 0, ',', '.');
        $paymentDate = $this->payment->payment_date?->format('d/m/Y H:i') ?? now()->format('d/m/Y H:i');
        $studentName = $this->payment->student->name ?? 'N/A';
        $className = $this->payment->class->name ?? 'N/A';
        $month = $this->payment->month ?? 'N/A';

        // Chuẩn bị variables cho email template
        $variables = [
            'name' => $notifiable->name,
            'email' => $notifiable->email,
            'student_name' => $studentName,
            'class_name' => $className,
            'amount' => $formattedAmount,
            'payment_date' => $paymentDate,
            'month' => $month,
            'invoice_number' => $this->payment->invoice_number ?? 'N/A',
            'payment_method' => $this->payment->payment_method ?? 'N/A',
        ];

        // Log notification
        Log::channel('payments')->info('Student payment success notification sent', [
            'user_id' => $notifiable->id,
            'payment_id' => $this->payment->id,
            'student_id' => $this->payment->student_id,
            'class_id' => $this->payment->class_id,
            'amount' => $this->payment->amount,
        ]);

        // Lấy slug template từ System Settings, fallback 'student-payment-success'
        $slug = Setting::get('notification.template_student_payment_success', 'student-payment-success');

        // Sử dụng EmailTemplate nếu có, fallback về hardcoded message
        return $this->buildMailFromTemplate(
            $slug,
            $variables,
            [],
            function () use ($notifiable, $studentName, $className, $formattedAmount, $paymentDate, $month) {
                return (new MailMessage)
                    ->subject('Thanh toán học phí thành công')
                    ->greeting("Xin chào {$notifiable->name}!")
                    ->line('Thanh toán học phí đã được xác nhận thành công.')
                    ->line("**Học viên:** {$studentName}")
                    ->line("**Lớp học:** {$className}")
                    ->line("**Tháng:** {$month}")
                    ->line("**Số tiền:** {$formattedAmount} VNĐ")
                    ->line("**Thời gian:** {$paymentDate}")
                    ->action('Xem chi tiết', url('/admin/payments'))
                    ->line('Cảm ơn bạn đã tin tưởng Classly!')
                    ->salutation('Trân trọng, Đội ngũ Classly');
            }
        );
    }

    /**
     * Get the array representation of the notification.
     */
    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Thanh toán học phí thành công',
            'message' => "Đã xác nhận thanh toán {$this->payment->amount} VNĐ cho học viên ".($this->payment->student?->name ?? 'N/A'),
            'type' => 'payment_success',
            'payment_id' => $this->payment->id,
            'student_id' => $this->payment->student_id,
            'amount' => $this->payment->amount,
        ];
    }
}
