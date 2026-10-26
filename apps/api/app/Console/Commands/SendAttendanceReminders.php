<?php

namespace App\Console\Commands;

use App\Models\ScheduleSession;
use App\Models\UserNotificationPreference;
use App\Notifications\AttendanceReminderNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SendAttendanceReminders extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'notifications:send-attendance-reminders 
                            {--days=1 : Số ngày trước đó để gửi nhắc nhở (mặc định: 1 cho ngày mai)}';

    /**
     * The console command description.
     */
    protected $description = 'Gửi thông báo nhắc nhở điểm danh cho gia sư cho các buổi học sắp tới';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $daysAhead = (int) $this->option('days');
        $targetDate = now()->addDays($daysAhead)->startOfDay();

        $this->info("Đang gửi nhắc nhở điểm danh cho các buổi học ngày {$targetDate->format('d/m/Y')}...");

        // Query sessions for target date (not cancelled, not completed)
        $sessions = ScheduleSession::whereDate('session_date', $targetDate)
            ->where('status', '!=', 'cancelled')
            ->where('status', '!=', 'completed')
            ->with(['class.tutor'])
            ->get();

        if ($sessions->isEmpty()) {
            $this->info('Không tìm thấy buổi học nào sắp tới.');

            return Command::SUCCESS;
        }

        $sentCount = 0;
        $errorCount = 0;

        foreach ($sessions as $session) {
            $class = $session->class;

            if (! $class) {
                $this->warn("Bỏ qua buổi học #{$session->id}: thiếu thông tin lớp");

                continue;
            }

            // Only send to tutor
            if (! $class->tutor) {
                $this->warn("Bỏ qua buổi học #{$session->id}: thiếu thông tin gia sư");

                continue;
            }

            // Check verified email
            if (! $class->tutor->hasVerifiedEmail()) {
                // $this->warn("Bỏ qua gia sư: {$class->tutor->name} (email chưa xác thực)");
                continue;
            }

            try {
                if (UserNotificationPreference::shouldSendNotification($class->tutor->id, 'attendance_reminder', 'email')) {
                    $class->tutor->notify((new AttendanceReminderNotification($session))->delay(now()->addSeconds(2)));
                    $sentCount++;
                    $this->line("Đã gửi nhắc nhở tới: {$class->tutor->name} ({$class->tutor->email}) - Lớp: {$class->name}");
                } else {
                    $this->line("Bỏ qua gia sư: {$class->tutor->name} (đã tắt thông báo)");
                }
            } catch (\Exception $e) {
                $errorCount++;
                $this->error("Gửi thất bại tới gia sư {$class->tutor->email}: {$e->getMessage()}");
                Log::channel('notifications')->error('Gửi nhắc nhở điểm danh thất bại', [
                    'session_id' => $session->id,
                    'tutor_id' => $class->tutor->id,
                    'class_id' => $class->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $this->info("Gửi thành công {$sentCount} nhắc nhở điểm danh");
        if ($errorCount > 0) {
            $this->warn("Gửi thất bại {$errorCount} nhắc nhở");
        }
        $this->info('Hoàn thành!');

        // Log summary
        Log::channel('notifications')->info('Attendance reminders sent', [
            'target_date' => $targetDate->toDateString(),
            'sessions_count' => $sessions->count(),
            'sent_count' => $sentCount,
            'error_count' => $errorCount,
        ]);

        return Command::SUCCESS;
    }
}
