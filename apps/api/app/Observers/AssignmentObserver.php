<?php

namespace App\Observers;

use App\Models\Assignment;
use App\Support\CacheHelper;
use App\Support\CacheKeys;
use Illuminate\Support\Facades\Cache;

class AssignmentObserver
{
    /**
     * Handle the Assignment "created" event.
     */
    public function created(Assignment $assignment): void
    {
        $this->clearCache($assignment);
    }

    /**
     * Handle the Assignment "updated" event.
     */
    public function updated(Assignment $assignment): void
    {
        $this->clearCache($assignment);
    }

    /**
     * Handle the Assignment "deleted" event.
     */
    public function deleted(Assignment $assignment): void
    {
        $this->clearCache($assignment);
    }

    /**
     * Handle the Assignment "restored" event.
     */
    public function restored(Assignment $assignment): void
    {
        $this->clearCache($assignment);
    }

    /**
     * Handle the Assignment "force deleted" event.
     */
    public function forceDeleted(Assignment $assignment): void
    {
        $this->clearCache($assignment);
    }

    /**
     * Clear relevant caches.
     */
    protected function clearCache(Assignment $assignment): void
    {
        // 1. Clear Detail Cache
        Cache::forget(CacheKeys::assignmentDetail($assignment->id));

        // 2. Clear List Cache for assignments (often filtered by class)
        CacheHelper::forgetAssignments($assignment->class_id);

        // 3. Clear Submissions related to this assignment
        CacheHelper::forgetSubmissions($assignment->id);

        // 4. Grades may be affected by max_score changes
        CacheHelper::forgetGrades($assignment->class_id);
    }
}
