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

class AttendanceReminderNotification extends Notification implements ShouldQueue
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
        $sessionDate = $this->session->session_date->format('d/m/Y');
        $startTime = $this->session->start_time ? $this->session->start_time->format('H:i') : 'N/A';

        // Đếm số học viên trong lớp
        $studentCount = $class->students()->where('class_student.status', 'active')->count();
        $location = $this->session->location ?? $this->session->room ?? '';

        // Chuẩn bị variables cho email template
        $locationText = $location ? "\n- Địa điểm: {$location}" : '';
        $variables = [
            'name' => $notifiable->name,
            'email' => $notifiable->email,
            'class_name' => $class->name,
            'subject' => $class->subject,
            'session_date' => $sessionDate,
            'start_time' => $startTime,
            'student_count' => $studentCount,
            'location' => $location,
            'location_text' => $locationText,
            'attendance_url' => url('/admin/attendance'),
        ];

        // Log notification
        Log::channel('notifications')->info('Attendance reminder sent', [
            'user_id' => $notifiable->id,
            'session_id' => $this->session->id,
            'class_id' => $class->id,
            'session_date' => $sessionDate,
            'student_count' => $studentCount,
        ]);

        // Lấy slug template từ System Settings, fallback 'attendance_reminder'
        $slug = Setting::get('notification.template_attendance_reminder', 'attendance_reminder');

        // Sử dụng EmailTemplate nếu có, fallback về hardcoded message
        return $this->buildMailFromTemplate(
            $slug,
            $variables,
            [],
            function () use ($notifiable, $class, $sessionDate, $startTime, $studentCount, $location) {
                $message = (new MailMessage)
                    ->subject("Nhắc nhở điểm danh: {$class->name} - {$sessionDate}")
                    ->greeting("Xin chào {$notifiable->name}!")
                    ->line('Bạn có buổi học sắp tới cần điểm danh:')
                    ->line("**Lớp học:** {$class->name}")
                    ->line("**Môn học:** {$class->subject}")
                    ->line("**Ngày học:** {$sessionDate}")
                    ->line("**Thời gian:** {$startTime}")
                    ->line("**Số học viên:** {$studentCount} học viên");

                if ($location) {
                    $message->line("**Địa điểm:** {$location}");
                }

                $message->action('Điểm danh ngay', url('/admin/attendance'))
                    ->line('Vui lòng điểm danh học viên trước hoặc sau buổi học!')
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
            'title' => "Nhắc nhở điểm danh: {$class->name}",
            'message' => "Bạn có buổi học vào {$sessionDate} lúc {$startTime} cần điểm danh",
            'type' => 'attendance_reminder',
            'session_id' => $this->session->id,
            'class_id' => $class->id,
            'class_name' => $class->name,
            'session_date' => $this->session->session_date->toDateString(),
            'start_time' => $this->session->start_time?->format('H:i'),
        ];
    }
}
