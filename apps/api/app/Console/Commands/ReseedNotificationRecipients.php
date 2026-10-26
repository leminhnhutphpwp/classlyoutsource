<?php

namespace App\Console\Commands;

use App\Jobs\SendNotificationEmailJob;
use App\Models\Notification;
use App\Models\NotificationRecipientLog;
use App\Models\Student;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ReseedNotificationRecipients extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'notifications:reseed-recipients 
                            {--notification-id= : Mã định danh thông báo cụ thể để khôi phục lại.} 
                            {--send : Gửi ngay lập tức sau khi khôi phục lại}
                            {--dry-run : Chỉ hiển thị những gì sẽ được thực hiện mà không thực hiện thay đổi}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Khôi phục lại danh sách người nhận thông báo và tùy chọn gửi chúng';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $notificationId = $this->option('notification-id');
        $dryRun = $this->option('dry-run');
        $shouldSend = $this->option('send');

        if ($dryRun) {
            $this->warn('🔍 CHẾ ĐỘ CHẠY THỬ - Không có thay đổi nào được thực hiện');
        }

        $query = Notification::query();

        if ($notificationId) {
            if (! is_numeric($notificationId)) {
                $decoded = Notification::decodeId($notificationId);
                if (! $decoded) {
                    $this->error("Không thể decode ID: {$notificationId}");

                    return 1;
                }
                $notificationId = $decoded;
            }
            $query->where('id', $notificationId);
        }

        $notifications = $query->get();

        if ($notifications->isEmpty()) {
            $this->error('Không tìm thấy thông báo nào!');

            return 1;
        }

        $this->info("Đã tìm thấy {$notifications->count()} thông báo để xử lý");

        $bar = $this->output->createProgressBar($notifications->count());
        $bar->start();

        $stats = [
            'processed' => 0,
            'seeded' => 0,
            'skipped' => 0,
            'errors' => 0,
            'dispatched' => 0,
        ];

        foreach ($notifications as $notification) {
            try {
                $bar->advance();

                $this->newLine();
                $this->line("Processing: {$notification->title} (ID: {$notification->id})");

                // Get recipients based on notification settings
                $recipients = $this->resolveRecipients($notification);

                if ($recipients->isEmpty()) {
                    $this->warn('Không tìm thấy người nhận - bỏ qua');
                    $stats['skipped']++;

                    continue;
                }

                $this->info("Đã tìm thấy {$recipients->count()} người nhận");

                if (! $dryRun) {
                    // Reset notification status/counts
                    $notification->update([
                        'status' => 'processing',
                        'sent_count' => 0,
                        'failed_count' => 0,
                        'sent_at' => null,
                    ]);

                    // Delete old logs
                    $deletedCount = NotificationRecipientLog::where('notification_id', $notification->id)->delete();
                    $this->line("Đã xóa {$deletedCount} log cũ");

                    // Create new logs and optionally dispatch
                    foreach ($recipients as $recipient) {
                        $log = NotificationRecipientLog::create([
                            'notification_id' => $notification->id,
                            'user_id' => $recipient['user_id'] ?? null,
                            'student_id' => $recipient['student_id'] ?? null,
                            'email' => $recipient['email'] ?? null,
                            'status' => 'pending',
                        ]);

                        if ($shouldSend && $log->email) {
                            SendNotificationEmailJob::dispatch($notification, $log);
                            $stats['dispatched']++;
                        }
                    }

                    $this->info("Đã tạo {$recipients->count()} log mới");
                    if ($shouldSend) {
                        $this->info("Đã gửi {$recipients->count()} mail jobs");
                    }
                    $stats['seeded']++;
                } else {
                    $this->line("[DRY RUN] Sẽ tạo {$recipients->count()} log mới");
                }

                $stats['processed']++;

            } catch (\Exception $e) {
                $this->error("Error: {$e->getMessage()}");
                $stats['errors']++;
                Log::error('ReseedNotificationRecipients error', [
                    'notification_id' => $notification->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $bar->finish();
        $this->newLine(2);

        // Summary
        $this->info('Tổng kết:');
        $this->table(
            ['Metric', 'Count'],
            [
                ['Processed Notifications', $stats['processed']],
                ['Seeded (Success)', $stats['seeded']],
                ['Skipped', $stats['skipped']],
                ['Errors', $stats['errors']],
                ['Jobs Dispatched', $stats['dispatched']],
            ]
        );

        if ($dryRun) {
            $this->warn('Đây là chế độ chạy thử - không có thay đổi nào được thực hiện');
        } else {
            $this->info('Hoàn thành!');
        }

        return 0;
    }

    /**
     * Resolve recipients for a notification
     */
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

        // Get user recipients
        if (! empty($recipientUserIds)) {
            $userRecipients = User::whereIn('id', $recipientUserIds)
                ->get(['id', 'email'])
                ->map(fn ($u) => [
                    'user_id' => $u->id,
                    'student_id' => null,
                    'email' => $u->email,
                ]);
            $recipients = $recipients->merge($userRecipients);
        }

        // Get student recipients
        if (! empty($allStudentIds)) {
            $studentRecipients = Student::whereIn('id', $allStudentIds)
                ->with('user:id,email,email_verified_at')
                ->get(['id', 'email', 'user_id'])
                ->map(function ($s) {
                    $email = $s->user?->email ?: $s->email;

                    return [
                        'user_id' => $s->user_id,
                        'student_id' => $s->id,
                        'email' => $email,
                    ];
                });
            $recipients = $recipients->merge($studentRecipients);
        }

        // Deduplicate by email
        return $recipients->groupBy(function ($item) {
            return $item['email'] ?: ('user:'.($item['user_id'] ?? uniqid()));
        })->map(function ($group) {
            if ($group->count() === 1) {
                return $group->first();
            }

            // Merge user and student info
            $merged = [
                'user_id' => null,
                'student_id' => null,
                'email' => null,
            ];

            foreach ($group as $item) {
                if ($item['user_id']) {
                    $merged['user_id'] = $item['user_id'];
                }
                if ($item['student_id']) {
                    $merged['student_id'] = $item['student_id'];
                }
                if ($item['email']) {
                    $merged['email'] = $item['email'];
                }
            }

            return $merged;
        })->values();
    }
}
