<?php

namespace App\Observers;

use App\Models\Grade;
use App\Support\CacheHelper;
use App\Support\CacheKeys;
use Illuminate\Support\Facades\Cache;

class GradeObserver
{
    /**
     * Handle the Grade "created" event.
     */
    public function created(Grade $grade): void
    {
        $this->clearCache($grade);
    }

    /**
     * Handle the Grade "updated" event.
     */
    public function updated(Grade $grade): void
    {
        $this->clearCache($grade);
    }

    /**
     * Handle the Grade "deleted" event.
     */
    public function deleted(Grade $grade): void
    {
        $this->clearCache($grade);
    }

    /**
     * Handle the Grade "restored" event.
     */
    public function restored(Grade $grade): void
    {
        $this->clearCache($grade);
    }

    /**
     * Handle the Grade "force deleted" event.
     */
    public function forceDeleted(Grade $grade): void
    {
        $this->clearCache($grade);
    }

    /**
     * Clear relevant caches.
     */
    protected function clearCache(Grade $grade): void
    {
        // 1. Clear Detail Cache
        Cache::forget(CacheKeys::gradeDetail($grade->id));

        // 2. Clear Grades Lists (Class & Student scopes)
        CacheHelper::forgetGrades($grade->class_id, $grade->student_id);

        // 3. Bump the per-class roster version (avg grade may be shown in the student list).
        // Cache::forget on the versioned roster key was a no-op.
        CacheHelper::forgetStudents($grade->class_id);
    }
}
