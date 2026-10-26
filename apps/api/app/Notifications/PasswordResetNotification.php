<?php

namespace App\Notifications;

use App\Models\Setting;
use App\Notifications\Traits\UsesEmailTemplate;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;

class PasswordResetNotification extends Notification implements ShouldQueue
{
    use Queueable, UsesEmailTemplate;

    protected $code;

    protected $expiresIn;

    public function __construct(string $code, int $expiresIn = 15)
    {
        $this->code = $code;
        $this->expiresIn = $expiresIn;
    }

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
        // Handle AnonymousNotifiable (e.g. from Notification::route)
        $isAnonymous = $notifiable instanceof AnonymousNotifiable;

        $name = $isAnonymous ? 'Bạn' : ($notifiable->name ?? 'Bạn');
        $email = $isAnonymous ? ($notifiable->routes['mail'] ?? '') : ($notifiable->email ?? '');
        $userId = $isAnonymous ? null : ($notifiable->id ?? null);

        // Chuẩn bị variables cho email template
        $variables = [
            'name' => $name,
            'email' => $email,
            'code' => $this->code,
            'expires_in' => $this->expiresIn,
        ];

        // Log notification (không log code vì lý do bảo mật)
        Log::channel('auth')->info('Password reset notification sent', [
            'user_id' => $userId,
            'is_anonymous' => $isAnonymous,
            'target_email' => $email,
            'expires_in' => $this->expiresIn,
        ]);

        // Lấy slug template từ System Settings, fallback 'password-reset'
        $slug = Setting::get('notification.template_password_reset', 'password-reset');

        // Sử dụng EmailTemplate nếu có, fallback về hardcoded message
        return $this->buildMailFromTemplate(
            $slug,
            $variables,
            [],
            function () use ($name) {
                return (new MailMessage)
                    ->subject('Mã xác nhận đặt lại mật khẩu - Classly')
                    ->greeting("Xin chào {$name}!")
                    ->line('Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu hoặc đổi email cho tài khoản của bạn.')
                    ->line("Mã xác nhận của bạn là: **{$this->code}**")
                    ->line("Mã này có hiệu lực trong {$this->expiresIn} phút.")
                    ->line('Nếu bạn không yêu cầu, vui lòng bỏ qua email này.')
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
            'type' => 'password_reset',
            'code' => $this->code,
            'expires_in' => $this->expiresIn,
            'message' => 'Mã xác nhận đặt lại mật khẩu đã được gửi',
        ];
    }
}
