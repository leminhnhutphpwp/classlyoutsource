<?php

namespace App\Observers;

use App\Models\User;
use App\Support\CacheKeys;
use Illuminate\Support\Facades\Cache;

/**
 * Observer để xóa cache khi user được cập nhật (giữ UI luôn phản ánh dữ liệu mới).
 */
class UserObserver
{
    /**
     * Handle the User "updated" event.
     */
    public function updated(User $user): void
    {
        // Luôn xóa cache của user khi có bất kỳ update nào để UI cập nhật ngay lập tức
        Cache::forget(CacheKeys::currentUser($user->id));
    }
}
