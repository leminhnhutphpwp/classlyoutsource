<?php

namespace App\Observers;

use App\Models\Submission;
use App\Support\CacheHelper;
use App\Support\CacheKeys;
use Illuminate\Support\Facades\Cache;

class SubmissionObserver
{
    /**
     * Handle the Submission "created" event.
     */
    public function created(Submission $submission): void
    {
        $this->clearCache($submission);
    }

    /**
     * Handle the Submission "updated" event.
     */
    public function updated(Submission $submission): void
    {
        $this->clearCache($submission);
    }

    /**
     * Handle the Submission "deleted" event.
     */
    public function deleted(Submission $submission): void
    {
        $this->clearCache($submission);
    }

    /**
     * Handle the Submission "restored" event.
     */
    public function restored(Submission $submission): void
    {
        $this->clearCache($submission);
    }

    /**
     * Handle the Submission "force deleted" event.
     */
    public function forceDeleted(Submission $submission): void
    {
        $this->clearCache($submission);
    }

    /**
     * Clear relevant caches.
     */
    protected function clearCache(Submission $submission): void
    {
        // 1. Clear Detail Cache
        Cache::forget(CacheKeys::submissionDetail($submission->id));

        // 2. Clear Submissions Lists
        // This helper increments versions for:
        // - Global submissions list
        // - Submissions by Assignment
        // - Submissions by Student
        CacheHelper::forgetSubmissions($submission->assignment_id, $submission->student_id);
    }
}
