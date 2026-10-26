<?php

namespace App\Observers;

use App\Models\AssignmentType;
use App\Support\CacheHelper;
use App\Support\CacheKeys;
use Illuminate\Support\Facades\Cache;

class AssignmentTypeObserver
{
    /**
     * Handle the AssignmentType "created" event.
     */
    public function created(AssignmentType $assignmentType): void
    {
        $this->clearCache($assignmentType);
    }

    /**
     * Handle the AssignmentType "updated" event.
     */
    public function updated(AssignmentType $assignmentType): void
    {
        $this->clearCache($assignmentType);
    }

    /**
     * Handle the AssignmentType "deleted" event.
     */
    public function deleted(AssignmentType $assignmentType): void
    {
        $this->clearCache($assignmentType);
    }

    /**
     * Handle the AssignmentType "restored" event.
     */
    public function restored(AssignmentType $assignmentType): void
    {
        $this->clearCache($assignmentType);
    }

    /**
     * Handle the AssignmentType "force deleted" event.
     */
    public function forceDeleted(AssignmentType $assignmentType): void
    {
        $this->clearCache($assignmentType);
    }

    /**
     * Clear relevant caches.
     */
    protected function clearCache(AssignmentType $assignmentType): void
    {
        Cache::forget(CacheKeys::assignmentTypeDetail($assignmentType->id));
        CacheHelper::forgetAssignmentTypes();
    }
}
