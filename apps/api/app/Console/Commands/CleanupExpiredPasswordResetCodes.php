<?php

namespace App\Console\Commands;

use App\Models\PasswordResetCode;
use Illuminate\Console\Command;

class CleanupExpiredPasswordResetCodes extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'password-reset:cleanup';

    /**
     * The console command description.
     */
    protected $description = 'Dọn dẹp các mã đặt lại mật khẩu đã hết hạn';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $deletedCount = PasswordResetCode::cleanupExpired();

        $this->info("Đã xóa {$deletedCount} mã đặt lại mật khẩu hết hạn.");

        return Command::SUCCESS;
    }
}
