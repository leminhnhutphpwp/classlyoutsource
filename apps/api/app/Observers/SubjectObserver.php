<?php

namespace App\Observers;

use App\Models\Subject;
use App\Support\CacheHelper;
use App\Support\CacheKeys;
use Illuminate\Support\Facades\Cache;

class SubjectObserver
{
    /**
     * Handle the Subject "created" event.
     */
    public function created(Subject $subject): void
    {
        $this->clearCache($subject);
    }

    /**
     * Handle the Subject "updated" event.
     */
    public function updated(Subject $subject): void
    {
        $this->clearCache($subject);
    }

    /**
     * Handle the Subject "deleted" event.
     */
    public function deleted(Subject $subject): void
    {
        $this->clearCache($subject);
    }

    /**
     * Handle the Subject "restored" event.
     */
    public function restored(Subject $subject): void
    {
        $this->clearCache($subject);
    }

    /**
     * Handle the Subject "force deleted" event.
     */
    public function forceDeleted(Subject $subject): void
    {
        $this->clearCache($subject);
    }

    /**
     * Clear relevant caches.
     */
    protected function clearCache(Subject $subject): void
    {
        Cache::forget(CacheKeys::subjectDetail($subject->id));
        CacheHelper::forgetSubjects();
    }
}
