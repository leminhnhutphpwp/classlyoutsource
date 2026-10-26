<?php

namespace App\Jobs;

use App\Models\EmailTemplate;
use App\Models\Notification;
use App\Models\NotificationRecipientLog;
use App\Models\Setting;
use App\Models\User;
use App\Models\UserNotificationPreference;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class SendNotificationEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     *
     * @var int
     */
    public $tries = 3;

    /**
     * The number of seconds to wait before retrying the job.
     *
     * @var int
     */
    public $backoff = 60;

    /**
     * Create a new job instance.
     */
    public function __construct(
        protected Notification $notification,
        protected NotificationRecipientLog $log
    ) {}

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $log = $this->log;
        $notification = $this->notification;
        $email = $log->email;

        // Clear previous error when starting a new attempt
        $log->update(['error_message' => 'Đang xử lý...']);

        if (! $email) {
            $this->updateLogStatus('failed', 'No email address provided');

            return;
        }

        // Strict Email Verification Check (Security/Fraud Prevention)
        if ($log->user_id) {
            $user = User::find($log->user_id);
            if ($user && ! $user->hasVerifiedEmail()) {
                $this->updateLogStatus('failed', 'Email address has not been verified yet');
                $this->updateNotificationSummary(false);

                return;
            }
        }

        // Check User Preference
        $notifType = $notification->type ?: 'announcement';
        if ($log->user_id && ! UserNotificationPreference::shouldSendNotification($log->user_id, $notifType)) {
            $this->updateLogStatus('skipped', 'User disabled this notification type');

            return;
        }

        try {
            $emailTemplate = $this->resolveTemplate();

            if ($emailTemplate) {
                // Prepare variables for template
                $variables = [
                    'title' => $notification->title,
                    'message' => nl2br($notification->message), // Convert newlines
                    'email' => $email,
                    'name' => 'Bạn', // TODO: Fetch real name if possible in the future
                    'sender_name' => $notification->creator->name ?? 'Classly',
                ];

                // Render template
                $rendered = $emailTemplate->render($variables);

                Mail::send('emails.template', [
                    'body_html' => $rendered['body_html'],
                    'subject' => $rendered['subject'],
                ], function ($message) use ($email, $rendered) {
                    $message->to($email)
                        ->subject($rendered['subject']);
                });
            } else {
                // Fallback to raw text if no template found
                Mail::raw($notification->message, function ($message) use ($email, $notification) {
                    $message->to($email)->subject($notification->title);
                });
            }

            $this->updateLogStatus('sent');
            $this->updateNotificationSummary(true);

        } catch (Throwable $e) {
            Log::channel('notifications')->error('Failed to send notification email', [
                'job_id' => $this->job ? $this->job->getJobId() : 'direct',
                'log_id' => $log->id,
                'email' => $email,
                'error' => $e->getMessage(),
            ]);

            $this->updateLogStatus('failed', $e->getMessage());
            $this->updateNotificationSummary(false);

            // We don't re-throw $e here to prevent the queue from retrying
            // dồn dập when SMTP is clearly down. This keeps the worker stable.
            return;
        }
    }

    /**
     * Resolve email template based on notification type.
     */
    protected function resolveTemplate(): ?EmailTemplate
    {
        if (! $this->notification->type) {
            return null;
        }

        $templateSlug = Setting::get('template_'.$this->notification->type);

        if (! $templateSlug) {
            $templateSlug = Setting::get('notification.template_'.$this->notification->type);
        }

        return $templateSlug ? EmailTemplate::getBySlug($templateSlug) : null;
    }

    /**
     * Update recipient log status.
     */
    protected function updateLogStatus(string $status, ?string $error = null): void
    {
        $friendlyError = $error ? $this->formatUserFriendlyError($error) : null;

        $this->log->update([
            'status' => $status,
            'sent_at' => $status === 'sent' ? now() : $this->log->sent_at,
            'attempt' => $this->log->attempt + 1,
            'error_message' => $friendlyError,
        ]);
    }

    /**
     * Map technical errors to user-friendly Vietnamese messages.
     */
    protected function formatUserFriendlyError(string $error): string
    {
        if (str_contains($error, 'closed unexpectedly')) {
            return 'Máy chủ email ngắt kết nối đột ngột (SMTP Closed).';
        }

        if (str_contains($error, 'timed out') || str_contains($error, 'Timeout')) {
            return 'Kết nối tới máy chủ email hết thời gian chờ.';
        }

        if (str_contains($error, 'Authentication failed') || str_contains($error, '535 5.7.8')) {
            return 'Lỗi xác thực tài khoản gửi mail (Sai Username/Password).';
        }

        if (str_contains($error, 'Recipient address rejected') || str_contains($error, 'Address error')) {
            return 'Địa chỉ email người nhận không hợp lệ hoặc bị từ chối.';
        }

        if (str_contains($error, 'No email address')) {
            return 'Người nhận chưa được thiết lập địa chỉ email.';
        }

        if (str_contains($error, 'User disabled this notification')) {
            return 'Người dùng đã tắt nhận loại thông báo này.';
        }

        if (str_contains($error, 'not been verified')) {
            return 'Địa chỉ email chưa được xác thực. Vui lòng xác thực email để nhận thông báo.';
        }

        return 'Lỗi kỹ thuật khi gửi mail. Vui lòng thử lại sau.';

    }

    /**
     * Update notification total counts and final status if necessary.
     */
    protected function updateNotificationSummary(bool $isSuccess): void
    {
        if ($isSuccess) {
            $this->notification->increment('sent_count');
        } else {
            $this->notification->increment('failed_count');
        }

        // Logic to update final status is complex in concurrent jobs.
        // We'll let the NotificationController or a separate cleanup job handle final "sent/failed" status
        // based on aggregate counts if needed, but for now we update based on current state.

        $pendingLeft = NotificationRecipientLog::where('notification_id', $this->notification->id)
            ->where('status', 'pending')
            ->count();

        if ($pendingLeft === 0) {
            $totalSent = NotificationRecipientLog::where('notification_id', $this->notification->id)
                ->where('status', 'sent')
                ->count();

            if ($totalSent > 0) {
                $this->notification->update([
                    'status' => 'sent',
                    'sent_at' => $this->notification->sent_at ?: now(),
                ]);
            } else {
                $this->notification->update(['status' => 'failed']);
            }
        } else {
            $this->notification->update(['status' => 'processing']);
        }
    }
}
