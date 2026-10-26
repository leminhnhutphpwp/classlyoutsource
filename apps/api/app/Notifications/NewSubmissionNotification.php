<?php

namespace App\Notifications;

use App\Models\Setting;
use App\Models\Submission;
use App\Notifications\Traits\UsesEmailTemplate;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;

class NewSubmissionNotification extends Notification implements ShouldQueue
{
    use Queueable, UsesEmailTemplate;

    /**
     * Create a new notification instance.
     */
    public function __construct(
        public Submission $submission
    ) {}

    /**
     * Get the notification's delivery channels.
     */
    public function via(object $notifiable): array
    {
        // Chỉ gửi email, KHÔNG sử dụng database notifications mặc định của Laravel
        // vì hệ thống đã có bảng notifications riêng cho in-app notification.
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $assignment = $this->submission->assignment;
        $class = $assignment->class;
        $student = $this->submission->student;

        $submittedAt = $this->submission->submitted_at
            ? $this->submission->submitted_at->format('d/m/Y H:i')
            : now()->format('d/m/Y H:i');

        $isLate = $this->submission->is_late ? ' (Nộp muộn)' : '';
        $contentPreview = $this->submission->content
            ? mb_substr(strip_tags($this->submission->content), 0, 100)
            : '';

        // Chuẩn bị variables cho email template
        $attemptText = ($this->submission->attempt_number ?? 1) > 1
            ? "\n- Lần nộp: {$this->submission->attempt_number}"
            : '';
        $contentText = $contentPreview
            ? "\n- Nội dung: {$contentPreview}..."
            : '';

        $variables = [
            'name' => $notifiable->name,
            'email' => $notifiable->email,
            'class_name' => $class->name,
            'assignment_title' => $assignment->title,
            'student_name' => $student->name,
            'submitted_at' => $submittedAt,
            'is_late' => $this->submission->is_late ? 'Có' : 'Không',
            'is_late_text' => $isLate,
            'attempt_number' => $this->submission->attempt_number ?? 1,
            'attempt_text' => $attemptText,
            'content_preview' => $contentPreview,
            'content_text' => $contentText,
            'submission_url' => url("/admin/submissions/{$this->submission->id}"),
        ];

        // Log notification
        Log::channel('notifications')->info('New submission notification sent', [
            'user_id' => $notifiable->id,
            'submission_id' => $this->submission->id,
            'assignment_id' => $assignment->id,
            'class_id' => $class->id,
            'student_id' => $student->id,
            'is_late' => $this->submission->is_late,
        ]);

        // Lấy slug template từ System Settings, fallback 'new_submission'
        $slug = Setting::get('notification.template_new_submission', 'new_submission');

        // Sử dụng EmailTemplate nếu có, fallback về hardcoded message
        return $this->buildMailFromTemplate(
            $slug,
            $variables,
            [],
            function () use ($notifiable, $assignment, $class, $student, $submittedAt, $isLate, $contentPreview) {
                $message = (new MailMessage)
                    ->subject("Bài nộp mới: {$assignment->title} - {$student->name}")
                    ->greeting("Xin chào {$notifiable->name}!")
                    ->line('Bạn có bài nộp mới từ học viên:')
                    ->line("**Lớp học:** {$class->name}")
                    ->line("**Bài tập:** {$assignment->title}")
                    ->line("**Học viên:** {$student->name}")
                    ->line("**Thời gian nộp:** {$submittedAt}{$isLate}");

                if ($this->submission->attempt_number > 1) {
                    $message->line("**Lần nộp:** {$this->submission->attempt_number}");
                }

                if ($contentPreview) {
                    $message->line("**Nội dung:** {$contentPreview}...");
                }

                $message->action('Xem bài nộp', url("/admin/submissions/{$this->submission->id}"))
                    ->line('Vui lòng chấm điểm và phản hồi cho học viên!')
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
        $assignment = $this->submission->assignment;
        $class = $assignment->class;
        $student = $this->submission->student;

        return [
            'title' => "Bài nộp mới: {$assignment->title}",
            'message' => "{$student->name} đã nộp bài tập {$assignment->title}",
            'type' => 'new_submission',
            'submission_id' => $this->submission->id,
            'assignment_id' => $assignment->id,
            'assignment_title' => $assignment->title,
            'class_id' => $class->id,
            'class_name' => $class->name,
            'student_id' => $student->id,
            'student_name' => $student->name,
            'submitted_at' => $this->submission->submitted_at?->toDateTimeString(),
            'is_late' => $this->submission->is_late,
        ];
    }
}
