<?php

namespace App\Observers;

use App\Models\Attendance;
use App\Support\CacheHelper;
use App\Support\CacheKeys;
use Illuminate\Support\Facades\Cache;

class AttendanceObserver
{
    /**
     * Handle the Attendance "created" event.
     */
    public function created(Attendance $attendance): void
    {
        $this->clearCache($attendance);
    }

    /**
     * Handle the Attendance "updated" event.
     */
    public function updated(Attendance $attendance): void
    {
        $this->clearCache($attendance);
    }

    /**
     * Handle the Attendance "deleted" event.
     */
    public function deleted(Attendance $attendance): void
    {
        $this->clearCache($attendance);
    }

    /**
     * Handle the Attendance "restored" event.
     */
    public function restored(Attendance $attendance): void
    {
        $this->clearCache($attendance);
    }

    /**
     * Handle the Attendance "force deleted" event.
     */
    public function forceDeleted(Attendance $attendance): void
    {
        $this->clearCache($attendance);
    }

    /**
     * Clear relevant caches.
     */
    protected function clearCache(Attendance $attendance): void
    {
        // 1. Clear Detail
        Cache::forget(CacheKeys::attendanceDetail($attendance->id));

        // 2. Clear Lists (Class & Student)
        CacheHelper::forgetAttendance($attendance->class_id, $attendance->student_id);

        // 3. Clear Class Students Cache (May affect attendance stats in student list)
        CacheHelper::forgetStudents($attendance->class_id);
    }
}
