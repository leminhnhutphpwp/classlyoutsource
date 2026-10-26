<?php

namespace App\Notifications;

use App\Models\StudentInvite;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Delivers a student/parent invite. Carries the RAW token (the DB stores only its sha256 hash) so the
 * recipient can open the accept link. via() is mail now; Zalo/SMS can be added in Phase 5.
 */
class StudentInviteNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        protected string $rawToken,
        protected StudentInvite $invite,
        protected ?string $tutorName = null,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $acceptUrl = rtrim(config('app.frontend_url'), '/').'/auth/accept-invite?token='.$this->rawToken;
        $isParent = $this->invite->role === 'parent';
        $who = $isParent ? 'phụ huynh' : 'học viên';
        $inviter = $this->tutorName ? " từ gia sư {$this->tutorName}" : '';

        return (new MailMessage)
            ->subject('Lời mời tham gia Classly')
            ->greeting('Xin chào '.($this->invite->name ?: 'bạn').',')
            ->line("Bạn được mời tham gia Classly với vai trò {$who}{$inviter}.")
            ->line('Nhấn nút bên dưới để đặt mật khẩu và kích hoạt tài khoản (lời mời hết hạn sau 7 ngày).')
            ->action('Kích hoạt tài khoản', $acceptUrl)
            ->line('Nếu bạn không mong đợi lời mời này, hãy bỏ qua email.');
    }
}
