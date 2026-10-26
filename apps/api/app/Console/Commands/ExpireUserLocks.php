<?php

namespace App\Console\Commands;

use App\Models\UserLock;
use Illuminate\Console\Command;
use Spatie\Permission\PermissionRegistrar;

class ExpireUserLocks extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'user-locks:expire';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Đánh dấu các khóa người dùng đã lên lịch/đang hoạt động là đã hoàn tất khi thời gian kết thúc đã trôi qua.';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $now = now();
        $updatedCount = 0;

        UserLock::query()
            ->whereIn('status', [UserLock::STATUS_ACTIVE, UserLock::STATUS_SCHEDULED])
            ->whereNotNull('end_at')
            ->where('end_at', '<=', $now)
            ->orderBy('id')
            ->chunkById(100, function ($locks) use (&$updatedCount, $now) {
                foreach ($locks as $lock) {
                    $lock->update([
                        'status' => UserLock::STATUS_DONE,
                        'unlocked_at' => $now,
                        'unlocked_by' => null,
                    ]);

                    $updatedCount++;
                }
            });

        if ($updatedCount > 0) {
            // Clear permission cache to ensure lock status is reflected immediately
            app(PermissionRegistrar::class)->forgetCachedPermissions();
        }

        $this->info("Hoàn thành: {$updatedCount} khóa người dùng đã hết hạn");

        return self::SUCCESS;
    }
}
