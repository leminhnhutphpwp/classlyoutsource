<?php

namespace App\Console\Commands;

use App\Models\LoginActivity;
use App\Services\LoginActivityService;
use Illuminate\Console\Command;

class CleanupOldLoginActivities extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'login-activity:cleanup 
                            {--user-id= : Cleanup cho một user cụ thể}
                            {--force : Bỏ qua auto_cleanup config và chạy cleanup}';

    /**
     * The console command description.
     */
    protected $description = 'Xóa các login activity records cũ (giữ lại số lượng tối đa cho mỗi user)';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $userId = $this->option('user-id');
        $force = $this->option('force');

        $maxRecords = config('login_activity.max_records_per_user', 100);
        $cleanupOlderThanDays = config('login_activity.cleanup_older_than_days');

        $this->info('Bắt đầu cleanup login activities...');
        $this->line('Cấu hình:');
        $this->line("  - Số lượng tối đa mỗi user: {$maxRecords}");
        $this->line('  - Xóa records cũ hơn: '.($cleanupOlderThanDays ? "{$cleanupOlderThanDays} ngày" : 'Không giới hạn'));

        if ($userId) {
            $this->info("Hoàn thành: Cleanup cho user ID: {$userId}");
            $beforeCount = LoginActivity::where('user_id', $userId)->count();
            LoginActivityService::cleanupForUser((int) $userId);
            $afterCount = LoginActivity::where('user_id', $userId)->count();
            $deletedCount = $beforeCount - $afterCount;

            $this->info("Hoàn thành: Đã xóa {$deletedCount} records cho user {$userId}.");
            $this->line("Còn lại: {$afterCount} records");
        } else {
            $this->info('Hoàn thành: Cleanup cho tất cả users...');
            $beforeCount = LoginActivity::count();
            $deletedCount = LoginActivityService::cleanupAll();
            $afterCount = LoginActivity::count();

            $this->info("Hoàn thành: Đã xóa tổng cộng {$deletedCount} records.");
            $this->line("Trước: {$beforeCount} records");
            $this->line("Sau: {$afterCount} records");
        }

        return Command::SUCCESS;
    }
}
