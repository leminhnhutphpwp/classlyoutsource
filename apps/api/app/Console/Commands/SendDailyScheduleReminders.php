<?php

namespace App\Console\Commands;

use App\Models\ScheduleSession;
use App\Models\UserNotificationPreference;
use App\Notifications\DailyScheduleReminderNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SendDailyScheduleReminders extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'notifications:send-schedule-reminders 
                            {--days=1 : Number of days ahead to send reminders (default: 1 for tomorrow)}';

    /**
     * The console command description.
     */
    protected $description = 'Gửi nhắc nhở lịch học hàng ngày cho học sinh và gia sư cho các buổi học sắp tới';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $daysAhead = (int) $this->option('days');
        $targetDate = now()->addDays($daysAhead)->startOfDay();

        $this->info("Đang gửi nhắc nhở lịch học cho ngày {$targetDate->format('d/m/Y')}...");

        // Query sessions for target date (not cancelled, not completed)
        $sessions = ScheduleSession::whereDate('session_date', $targetDate)
            ->where('status', '!=', 'cancelled')
            ->where('status', '!=', 'completed')
            ->with([
                'class.tutor',
                'class.students' => function ($query) {
                    $query->wherePivot('status', 'active')
                        ->wherePivot('is_paused', false);
                },
                'class.students.user',
            ])
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

            // Send to tutor (check preferences first)
            if ($class->tutor && $class->tutor->hasVerifiedEmail()) { // Check email verified
                try {
                    if (UserNotificationPreference::shouldSendNotification($class->tutor->id, 'daily_schedule_reminder', 'email')) {
                        $class->tutor->notify((new DailyScheduleReminderNotification($session))->delay(now()->addSeconds(2)));
                        $sentCount++;
                        $this->line("Đã gửi nhắc nhở tới gia sư: {$class->tutor->name} ({$class->tutor->email})");
                    } else {
                        $this->line("Bỏ qua gia sư: {$class->tutor->name} (đã tắt thông báo)");
                    }
                } catch (\Exception $e) {
                    $errorCount++;
                    $this->error("Gửi thất bại tới gia sư {$class->tutor->email}: {$e->getMessage()}");
                    Log::channel('notifications')->error('Failed to send schedule reminder to tutor', [
                        'session_id' => $session->id,
                        'tutor_id' => $class->tutor->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            // Send to all active students
            // Filter students that are active and not paused
            $activeStudents = $class->students->filter(function ($student) {
                return $student->pivot->status === 'active'
                    && ! $student->pivot->is_paused
                    && $student->user
                    && $student->user->hasVerifiedEmail(); // Only send to verified students
            });

            foreach ($activeStudents as $student) {
                try {
                    if (UserNotificationPreference::shouldSendNotification($student->user->id, 'daily_schedule_reminder', 'email')) {
                        $student->user->notify((new DailyScheduleReminderNotification($session))->delay(now()->addSeconds(2)));
                        $sentCount++;
                        $this->line("Đã gửi nhắc nhở tới học sinh: {$student->name} ({$student->user->email})");
                    } else {
                        $this->line("Bỏ qua học sinh: {$student->name} (đã tắt thông báo)");
                    }
                } catch (\Exception $e) {
                    $errorCount++;
                    $this->error("Gửi thất bại tới học sinh {$student->user->email}: {$e->getMessage()}");
                    Log::channel('notifications')->error('Failed to send schedule reminder to student', [
                        'session_id' => $session->id,
                        'student_id' => $student->id,
                        'user_id' => $student->user->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }

        $this->info("Gửi thành công {$sentCount} nhắc nhở");
        if ($errorCount > 0) {
            $this->warn("Gửi thất bại {$errorCount} nhắc nhở");
        }
        $this->info('Hoàn thành!');

        // Log summary
        Log::channel('notifications')->info('Daily schedule reminders sent', [
            'target_date' => $targetDate->toDateString(),
            'sessions_count' => $sessions->count(),
            'sent_count' => $sentCount,
            'error_count' => $errorCount,
        ]);

        return Command::SUCCESS;
    }
}
