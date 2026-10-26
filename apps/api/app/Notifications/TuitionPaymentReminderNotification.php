<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Carbon;

class TuitionPaymentReminderNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public $data;

    /**
     * Create a new notification instance.
     *
     * @param  array  $reminderData  Data formatted similar to ReminderService
     */
    public function __construct(array $reminderData)
    {
        $this->data = $reminderData;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $amount = number_format($this->data['amount'], 0, ',', '.');
        $dueDate = Carbon::parse($this->data['due_date'])->format('d/m/Y');
        $className = $this->data['class_name'] ?? 'Lớp học';

        return (new MailMessage)
            ->subject('Nhắc nhở đóng học phí: '.$className)
            ->greeting('Xin chào '.$notifiable->name.'!')
            ->line("Bạn có khoản học phí {$amount} VNĐ cho lớp {$className} sắp đến hạn vào ngày {$dueDate}.")
            ->line($this->data['message'] ?? '')
            ->action('Xem chi tiết', url('/payments'))
            ->line('Vui lòng thanh toán đúng hạn để đảm bảo quá trình học tập không bị gián đoạn.');
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Học phí sắp đến hạn',
            'message' => $this->data['message'],
            'type' => 'payment_reminder',
            'category' => 'payment',
            'amount' => $this->data['amount'],
            'due_date' => $this->data['due_date'],
            'class_id' => $this->data['class_id'] ?? null,
            'payment_id' => $this->data['payment_id'] ?? null,
            'payment_request_id' => $this->data['payment_request_id'] ?? null,
        ];
    }
}
