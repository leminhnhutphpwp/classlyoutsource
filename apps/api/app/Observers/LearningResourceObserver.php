<?php

namespace App\Observers;

use App\Models\LearningResource;
use App\Services\MediaUploadService;
use Illuminate\Support\Facades\Log;

class LearningResourceObserver
{
    /**
     * Handle the LearningResource "deleting" event.
     * This runs BEFORE the model is deleted from database.
     */
    public function deleting(LearningResource $learningResource): void
    {
        try {
            // Load relationships before deletion
            $learningResource->loadMissing(['media', 'mediaFiles', 'tutor']);

            $owner = $learningResource->tutor;
            if (! $owner) {
                Log::warning('LearningResource has no tutor, skipping media cleanup', [
                    'resource_id' => $learningResource->id,
                ]);

                return;
            }

            $totalSize = 0;
            $deletedFiles = [];

            // Delete primary media file
            if ($learningResource->media_id && $learningResource->media) {
                $mediaSize = (int) ($learningResource->media->size ?? 0);
                $totalSize += $mediaSize;

                MediaUploadService::deleteMedia($learningResource->media_id);
                $deletedFiles[] = [
                    'type' => 'primary',
                    'media_id' => $learningResource->media_id,
                    'size' => $mediaSize,
                ];
            }

            // Delete multiple media files (for image type)
            if ($learningResource->mediaFiles && $learningResource->mediaFiles->count() > 0) {
                foreach ($learningResource->mediaFiles as $mediaFile) {
                    $mediaSize = (int) ($mediaFile->size ?? 0);
                    $totalSize += $mediaSize;

                    MediaUploadService::deleteMedia($mediaFile->id);
                    $deletedFiles[] = [
                        'type' => 'multiple',
                        'media_id' => $mediaFile->id,
                        'size' => $mediaSize,
                    ];
                }
            }

            Log::info('LearningResource media cleanup completed', [
                'resource_id' => $learningResource->id,
                'deleted_files' => count($deletedFiles),
                'total_size' => $totalSize,
                'files' => $deletedFiles,
            ]);

        } catch (\Exception $e) {
            Log::error('LearningResource media cleanup failed', [
                'resource_id' => $learningResource->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Don't throw exception to prevent blocking the deletion
            // The resource will still be deleted, but media files might remain
        }
    }

    /**
     * Handle the LearningResource "deleted" event.
     * This runs AFTER the model is deleted from database.
     */
    public function deleted(LearningResource $learningResource): void
    {
        Log::info('LearningResource deleted successfully', [
            'resource_id' => $learningResource->id,
            'title' => $learningResource->title,
        ]);
    }
}
