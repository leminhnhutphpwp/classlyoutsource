<?php

namespace App\Observers;

use App\Models\GradeLevel;
use App\Support\CacheHelper;
use App\Support\CacheKeys;
use Illuminate\Support\Facades\Cache;

class GradeLevelObserver
{
    /**
     * Handle the GradeLevel "created" event.
     */
    public function created(GradeLevel $gradeLevel): void
    {
        $this->clearCache($gradeLevel);
    }

    /**
     * Handle the GradeLevel "updated" event.
     */
    public function updated(GradeLevel $gradeLevel): void
    {
        $this->clearCache($gradeLevel);
    }

    /**
     * Handle the GradeLevel "deleted" event.
     */
    public function deleted(GradeLevel $gradeLevel): void
    {
        $this->clearCache($gradeLevel);
    }

    /**
     * Handle the GradeLevel "restored" event.
     */
    public function restored(GradeLevel $gradeLevel): void
    {
        $this->clearCache($gradeLevel);
    }

    /**
     * Handle the GradeLevel "force deleted" event.
     */
    public function forceDeleted(GradeLevel $gradeLevel): void
    {
        $this->clearCache($gradeLevel);
    }

    /**
     * Clear relevant caches.
     */
    protected function clearCache(GradeLevel $gradeLevel): void
    {
        Cache::forget(CacheKeys::gradeLevelDetail($gradeLevel->id));
        CacheHelper::forgetGradeLevels();
    }
}
