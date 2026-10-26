<?php

namespace App\Notifications;

use App\Models\ScheduleSession;
use App\Models\Setting;
use App\Notifications\Traits\UsesEmailTemplate;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;

class DailyScheduleReminderNotification extends Notification implements ShouldQueue
{
    use Queueable, UsesEmailTemplate;

    /**
     * Create a new notification instance.
     */
    public function __construct(
        public ScheduleSession $session
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
        $class = $this->session->class;
        $schedule = $this->session->schedule;

        $sessionDate = $this->session->session_date->format('d/m/Y');
        $startTime = $this->session->start_time ? $this->session->start_time->format('H:i') : 'N/A';
        $endTime = $this->session->end_time ? $this->session->end_time->format('H:i') : 'N/A';

        $location = $this->session->isOnline()
            ? "Online - {$this->session->online_platform}"
            : ($this->session->location ?? $this->session->room ?? 'Chưa cập nhật');

        $meetingUrl = $this->session->isOnline() && $this->session->online_meeting_url
            ? $this->session->online_meeting_url
            : null;

        // Chuẩn bị variables cho email template
        $notesText = $this->session->notes ? "\n- Ghi chú: {$this->session->notes}" : '';
        $variables = [
            'name' => $notifiable->name,
            'email' => $notifiable->email,
            'class_name' => $class->name,
            'subject' => $class->subject,
            'session_date' => $sessionDate,
            'start_time' => $startTime,
            'end_time' => $endTime,
            'location' => $location,
            'notes' => $this->session->notes ?? '',
            'notes_text' => $notesText,
            'meeting_url' => $meetingUrl ?? '',
        ];

        // Log notification
        Log::channel('notifications')->info('Daily schedule reminder sent', [
            'user_id' => $notifiable->id,
            'session_id' => $this->session->id,
            'class_id' => $class->id,
            'session_date' => $sessionDate,
        ]);

        // Lấy slug template từ System Settings, fallback 'daily_schedule_reminder'
        $slug = Setting::get('notification.template_daily_schedule_reminder', 'daily_schedule_reminder');

        // Sử dụng EmailTemplate nếu có, fallback về hardcoded message
        return $this->buildMailFromTemplate(
            $slug,
            $variables,
            [],
            function () use ($notifiable, $class, $sessionDate, $startTime, $endTime, $location, $meetingUrl) {
                $message = (new MailMessage)
                    ->subject("Nhắc nhở lịch học: {$class->name} - {$sessionDate}")
                    ->greeting("Xin chào {$notifiable->name}!")
                    ->line('Bạn có lịch học sắp tới:')
                    ->line("**Lớp học:** {$class->name}")
                    ->line("**Môn học:** {$class->subject}")
                    ->line("**Ngày học:** {$sessionDate}")
                    ->line("**Thời gian:** {$startTime} - {$endTime}")
                    ->line("**Địa điểm:** {$location}");

                if ($meetingUrl) {
                    $message->action('Tham gia lớp học', $meetingUrl);
                }

                if ($this->session->notes) {
                    $message->line("**Ghi chú:** {$this->session->notes}");
                }

                $message->line('Vui lòng chuẩn bị đầy đủ và có mặt đúng giờ!')
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
        $class = $this->session->class;
        $sessionDate = $this->session->session_date->format('d/m/Y');
        $startTime = $this->session->start_time ? $this->session->start_time->format('H:i') : 'N/A';

        return [
            'title' => "Nhắc nhở lịch học: {$class->name}",
            'message' => "Bạn có lịch học vào {$sessionDate} lúc {$startTime}",
            'type' => 'daily_schedule_reminder',
            'session_id' => $this->session->id,
            'class_id' => $class->id,
            'class_name' => $class->name,
            'session_date' => $this->session->session_date->toDateString(),
            'start_time' => $this->session->start_time?->format('H:i'),
            'end_time' => $this->session->end_time?->format('H:i'),
        ];
    }
}
