<?php

namespace App\Console\Commands;

use App\Models\ScheduleSession;
use Illuminate\Console\Command;

class AutoCompleteSessions extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'sessions:auto-complete';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Tự động hoàn tất các buổi học đã qua giờ kết thúc (đóng phiên + thu hồi mã QR điểm danh).';

    /**
     * Execute the console command.
     *
     * Closes any still-open session whose end time has passed. This is the scheduled counterpart to the
     * lazy autoCompleteIfNeeded() run on session reads — without it, a session opened for QR check-in but
     * never manually completed would stay 'ongoing' with a live attendance_code, letting an enrolled
     * student re-use that code on a later day. Completing the session clears the code (see the model).
     */
    public function handle(): int
    {
        $completed = 0;

        ScheduleSession::query()
            ->whereIn('status', ['scheduled', 'ongoing'])
            ->whereDate('session_date', '<=', now()->toDateString())
            ->orderBy('id')
            ->chunkById(200, function ($sessions) use (&$completed) {
                foreach ($sessions as $session) {
                    // The model decides precisely (session_date + end_time + 5-min buffer) and clears the code.
                    if ($session->autoCompleteIfNeeded()) {
                        $completed++;
                    }
                }
            });

        $this->info("Hoàn thành: {$completed} buổi học đã được tự động đóng.");

        return self::SUCCESS;
    }
}
