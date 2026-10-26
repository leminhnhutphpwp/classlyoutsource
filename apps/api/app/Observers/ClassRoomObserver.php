<?php

namespace App\Observers;

use App\Models\ClassRoom;
use App\Support\CacheHelper;
use App\Support\CacheKeys;
use Illuminate\Support\Facades\Cache;

class ClassRoomObserver
{
    /**
     * Handle the ClassRoom "created" event.
     */
    public function created(ClassRoom $classRoom): void
    {
        $this->clearCache($classRoom);
    }

    /**
     * Handle the ClassRoom "updated" event.
     */
    public function updated(ClassRoom $classRoom): void
    {
        $this->clearCache($classRoom);
    }

    /**
     * Handle the ClassRoom "deleted" event.
     */
    public function deleted(ClassRoom $classRoom): void
    {
        $this->clearCache($classRoom);
    }

    /**
     * Handle the ClassRoom "restored" event.
     */
    public function restored(ClassRoom $classRoom): void
    {
        $this->clearCache($classRoom);
    }

    /**
     * Handle the ClassRoom "force deleted" event.
     */
    public function forceDeleted(ClassRoom $classRoom): void
    {
        $this->clearCache($classRoom);
    }

    /**
     * Clear relevant caches.
     */
    protected function clearCache(ClassRoom $class): void
    {
        // 1. Clear Detail Cache
        Cache::forget(CacheKeys::classDetail($class->id));

        // 2. Clear List Cache (invalidate version)
        CacheHelper::forgetClasses();

        // 3. Clear Related Caches
        // Students in this class
        CacheHelper::forgetStudents($class->id);

        // Assignments in this class
        CacheHelper::forgetAssignments($class->id);

        // Schedules in this class
        CacheHelper::forgetSchedules($class->id);

        // Attendance logic often depends on class
        CacheHelper::forgetAttendance($class->id);

        // Grades via class
        CacheHelper::forgetGrades($class->id);
    }
}
