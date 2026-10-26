<?php

namespace App\Observers;

use App\Models\Schedule;
use App\Support\CacheHelper;
use App\Support\CacheKeys;
use Illuminate\Support\Facades\Cache;

class ScheduleObserver
{
    /**
     * Handle the Schedule "created" event.
     */
    public function created(Schedule $schedule): void
    {
        $this->clearCache($schedule);
    }

    /**
     * Handle the Schedule "updated" event.
     */
    public function updated(Schedule $schedule): void
    {
        $this->clearCache($schedule);
    }

    /**
     * Handle the Schedule "deleted" event.
     */
    public function deleted(Schedule $schedule): void
    {
        $this->clearCache($schedule);
    }

    /**
     * Handle the Schedule "restored" event.
     */
    public function restored(Schedule $schedule): void
    {
        $this->clearCache($schedule);
    }

    /**
     * Handle the Schedule "force deleted" event.
     */
    public function forceDeleted(Schedule $schedule): void
    {
        $this->clearCache($schedule);
    }

    /**
     * Clear relevant caches.
     */
    protected function clearCache(Schedule $schedule): void
    {
        // 1. Clear Detail Cache
        Cache::forget(CacheKeys::scheduleDetail($schedule->id));

        // 2. Clear List Cache (invalidate version)
        // Usually schedules are listed by user or class
        CacheHelper::forgetSchedules($schedule->class_id);
    }
}
