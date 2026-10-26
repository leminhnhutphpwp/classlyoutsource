<?php

namespace App\Observers;

use App\Models\GradeType;
use App\Support\CacheHelper;
use App\Support\CacheKeys;
use Illuminate\Support\Facades\Cache;

class GradeTypeObserver
{
    /**
     * Handle the GradeType "created" event.
     */
    public function created(GradeType $gradeType): void
    {
        $this->clearCache($gradeType);
    }

    /**
     * Handle the GradeType "updated" event.
     */
    public function updated(GradeType $gradeType): void
    {
        $this->clearCache($gradeType);
    }

    /**
     * Handle the GradeType "deleted" event.
     */
    public function deleted(GradeType $gradeType): void
    {
        $this->clearCache($gradeType);
    }

    /**
     * Handle the GradeType "restored" event.
     */
    public function restored(GradeType $gradeType): void
    {
        $this->clearCache($gradeType);
    }

    /**
     * Handle the GradeType "force deleted" event.
     */
    public function forceDeleted(GradeType $gradeType): void
    {
        $this->clearCache($gradeType);
    }

    /**
     * Clear relevant caches.
     */
    protected function clearCache(GradeType $gradeType): void
    {
        Cache::forget(CacheKeys::gradeTypeDetail($gradeType->id));
        CacheHelper::forgetGradeTypes();
    }
}
