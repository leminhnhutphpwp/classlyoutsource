<?php

namespace App\Console\Commands;

use App\Http\Controllers\API\V1\NotificationController;
use App\Jobs\SendNotificationEmailJob;
use App\Models\EmailTemplate;
use App\Models\Notification;
use App\Models\NotificationRecipientLog;
use App\Models\Setting;
use App\Models\Student;
use App\Models\User;
use App\Models\UserNotificationPreference;
use Illuminate\Console\Command;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SendScheduledNotifications extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'notifications:send-scheduled';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Gửi thông báo theo lịch trình đến hạn';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Đang kiểm tra các thông báo đã lên lịch...');

        // Find notifications that are scheduled and due
        $notifications = Notification::where('status', 'scheduled')
            ->where('scheduled_at', '<=', now())
            ->get();

        if ($notifications->isEmpty()) {
            $this->info('Không tìm thấy thông báo đã lên lịch để gửi.');

            return 0;
        }

        $this->info("Tìm thấy {$notifications->count()} thông báo để gửi.");

        // Reuse logic from NotificationController to maintain consistency
        // We'll instantiate the controller but we need to be careful about dependencies
        // Ideally, the sending logic should be in a Service, but for now we'll call the controller method
        // or replicate the core logic here to avoid Request dependency issues.
        // Replicating/Refactoring logic is safer for CLI execution.

        foreach ($notifications as $notification) {
            $this->info("Đang xử lý thông báo ID: {$notification->id} - {$notification->title}");

            try {
                $this->processNotification($notification);
                $this->info("Thành công gửi thông báo ID: {$notification->id}");
            } catch (\Exception $e) {
                $this->error("Thất bại khi gửi thông báo ID: {$notification->id}. Error: ".$e->getMessage());
                Log::channel('notifications')->error('Scheduled notification send error', [
                    'notification_id' => $notification->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return 0;
    }

    private function processNotification(Notification $notification)
    {
        // 1. Resolve recipients (if not already resolved/seeded)
        // For scheduled notifications, we expect recipients might already be in logs if seeded,
        // or we need to resolve them now.
        // Let's assume we use the resolver from controller logic adapted here.

        // Actually, NotificationController::sendEmailBatch resolves them on the fly.
        // Let's look at how to resolve properly.

        // Use a mock request to reuse the Controller's logic if possible,
        // OR better: Extract the logic to a Trait or Service.
        // Given constraint, I'll adapt the logic here.

        $recipients = $this->resolveRecipients($notification);

        if ($recipients->isEmpty()) {
            $this->warn("Không tìm thấy người nhận cho thông báo {$notification->id}");
            // Mark as sent (but with 0 count) to avoid stuck loop
            $notification->markAsSent(0, 0);

            return;
        }

        $total = $recipients->count();
        $sentCount = 0;
        $failedCount = 0;
        $errors = [];

        // Determine Email Template Slug
        $templateSlug = null;
        if ($notification->type) {
            $keyVariant1 = 'template_'.$notification->type;
            $templateSlug = Setting::get($keyVariant1);

            if (! $templateSlug) {
                $keyVariant2 = 'notification.template_'.$notification->type;
                $templateSlug = Setting::get($keyVariant2);
            }
        }
        $emailTemplate = $templateSlug ? EmailTemplate::where('slug', $templateSlug)->first() : null;

        foreach ($recipients as $recipient) {
            try {
                // Log attempt (get or create log)
                $log = NotificationRecipientLog::firstOrCreate(
                    [
                        'notification_id' => $notification->id,
                        'email' => $recipient['email'],
                    ],
                    [
                        'user_id' => $recipient['user_id'],
                        'student_id' => $recipient['student_id'],
                        'channel' => 'email', // Force email for now
                        'status' => 'pending',
                        'attempt' => 0,
                    ]
                );

                if ($log->status === 'sent') {
                    $sentCount++;

                    continue;
                }

                // Check User Preference
                $notifType = $notification->type ?: 'announcement';
                if ($recipient['user_id'] && ! UserNotificationPreference::shouldSendNotification($recipient['user_id'], $notifType)) {
                    $log->update([
                        'status' => 'skipped',
                        'error_message' => 'User disabled this notification type',
                        'sent_at' => null,
                    ]);

                    // Count as processed/failed or ignored? Let's ignore from sent count.
                    // But we should probably count it somewhere?
                    // For now, just continue.
                    continue;
                }

                // Prepare message content
                $messageContent = $notification->message;
                if ($emailTemplate) {
                    $variables = [
                        'name' => $recipient['name'] ?? 'Bạn',
                        'title' => $notification->title,
                        'content' => nl2br($notification->message),
                        'message' => nl2br($notification->message), // Add 'message' for compatibility with both content styles
                        'email' => $recipient['email'],
                        'sender_name' => $notification->creator->name ?? 'Classly',
                    ];
                    $htmlContent = $emailTemplate->render($variables);
                } else {
                    $htmlContent = null;
                }

                // Send Email via Job (Queue) để không block command
                SendNotificationEmailJob::dispatch($notification, $log);

                // Mark as processing (job will update to sent/failed later)
                $log->update([
                    'status' => 'processing',
                    'attempt' => $log->attempt + 1,
                ]);

                $sentCount++; // Count as queued

                // Rate limit (mild)
                usleep(10000); // 10ms - just to avoid overwhelming queue

            } catch (\Throwable $e) {
                $failedCount++;
                if (isset($log)) {
                    $log->update([
                        'status' => 'failed',
                        'sent_at' => null,
                        'attempt' => $log->attempt + 1,
                        'error_message' => $e->getMessage(),
                    ]);
                }
                $errors[] = $e->getMessage();
            }
        }

        // Finalize Notification Status
        $notification->markAsSent($sentCount, $failedCount);

        Log::channel('notifications')->info('Scheduled notification sent', [
            'notification_id' => $notification->id,
            'sent' => $sentCount,
            'failed' => $failedCount,
        ]);
    }

    private function resolveRecipients(Notification $notification): Collection
    {
        $recipientType = $notification->recipient_type;
        $useClasses = in_array($recipientType, ['classes', 'all', null]);
        $useIndividuals = in_array($recipientType, ['students', 'all', null]);

        $recipientUserIds = $useIndividuals ? ($notification->recipient_ids ?? []) : [];
        $manualStudentIds = $useIndividuals ? ($notification->recipient_students ?? []) : [];
        $classIds = $useClasses ? ($notification->recipient_classes ?? []) : [];

        // Always resolve class students if classes present
        $classStudentIds = [];
        if (! empty($classIds)) {
            $classStudentIds = DB::table('class_student')
                ->whereIn('class_id', $classIds)
                ->pluck('student_id')
                ->toArray();
        }

        // Merge all student IDs
        $allStudentIds = array_values(array_unique(array_merge($manualStudentIds, $classStudentIds)));

        $recipients = collect();

        if (! empty($recipientUserIds)) {
            $userRecipients = User::whereIn('id', $recipientUserIds)
                ->get(['id', 'email', 'name'])
                ->map(fn ($u) => [
                    'user_id' => $u->id,
                    'student_id' => null,
                    'email' => $u->email,
                    'name' => $u->name,
                ]);
            $recipients = $recipients->merge($userRecipients);
        }

        if (! empty($allStudentIds)) {
            $studentRecipients = Student::whereIn('id', $allStudentIds)
                ->with('user:id,email,name,email_verified_at')
                ->get(['id', 'email', 'user_id', 'name'])
                ->map(function ($s) {
                    $email = $s->user?->email ?: $s->email;
                    $name = $s->name ?: ($s->user?->name ?? 'Bạn');

                    return [
                        'user_id' => $s->user_id,
                        'student_id' => $s->id,
                        'email' => $email,
                        'name' => $name,
                    ];
                });
            $recipients = $recipients->merge($studentRecipients);
        }

        // Apply strict deduplication by email unique
        return $recipients->unique(function ($item) {
            return $item['email'] ?: ('user:'.($item['user_id'] ?? uniqid()));
        })->values();
    }
}
