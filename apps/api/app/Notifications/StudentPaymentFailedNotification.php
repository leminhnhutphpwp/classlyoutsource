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

class StudentPaymentFailedNotification extends Notification implements ShouldQueue
{
    use Queueable, UsesEmailTemplate;

    public function __construct(
        public Payment $payment,
        public ?string $reason = null
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
        $studentName = $this->payment->student->name ?? 'N/A';
        $className = $this->payment->class->name ?? 'N/A';
        $month = $this->payment->month ?? 'N/A';
        $reason = $this->reason ?? 'Không xác định được lý do';

        // Chuẩn bị variables cho email template
        $variables = [
            'name' => $notifiable->name,
            'email' => $notifiable->email,
            'student_name' => $studentName,
            'class_name' => $className,
            'amount' => $formattedAmount,
            'month' => $month,
            'reason' => $reason,
            'invoice_number' => $this->payment->invoice_number ?? 'N/A',
        ];

        // Log notification
        Log::channel('payments')->warning('Student payment failed notification sent', [
            'user_id' => $notifiable->id,
            'payment_id' => $this->payment->id,
            'student_id' => $this->payment->student_id,
            'class_id' => $this->payment->class_id,
            'amount' => $this->payment->amount,
            'reason' => $reason,
        ]);

        // Lấy slug template từ System Settings, fallback 'student-payment-failed'
        $slug = Setting::get('notification.template_student_payment_failed', 'student-payment-failed');

        // Sử dụng EmailTemplate nếu có, fallback về hardcoded message
        return $this->buildMailFromTemplate(
            $slug,
            $variables,
            [],
            function () use ($notifiable, $studentName, $className, $formattedAmount, $month, $reason) {
                $message = (new MailMessage)
                    ->subject('Thanh toán học phí không thành công')
                    ->greeting("Xin chào {$notifiable->name}!")
                    ->line('Rất tiếc, thanh toán học phí không thành công.')
                    ->line("**Học viên:** {$studentName}")
                    ->line("**Lớp học:** {$className}")
                    ->line("**Tháng:** {$month}")
                    ->line("**Số tiền:** {$formattedAmount} VNĐ");

                if ($reason) {
                    $message->line("**Lý do:** {$reason}");
                }

                $message->line('Vui lòng kiểm tra lại hoặc liên hệ hỗ trợ nếu cần thiết.')
                    ->action('Xem chi tiết', url('/admin/payments'))
                    ->salutation('Trân trọng, Đội ngũ Classly');

                return $message;
            }
        );
    }

    /**
     * Get the array representation of the notification.
     */
    public function toArray(object $notifiable): array
    {
        $studentName = $this->payment->student->name ?? 'N/A';

        return [
            'title' => 'Thanh toán học phí không thành công',
            'message' => "Thanh toán {$this->payment->amount} VNĐ cho học viên {$studentName} thất bại",
            'type' => 'payment_failed',
            'payment_id' => $this->payment->id,
            'student_id' => $this->payment->student_id,
            'amount' => $this->payment->amount,
            'reason' => $this->reason,
        ];
    }
}
