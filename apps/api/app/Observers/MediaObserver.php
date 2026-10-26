<?php

namespace App\Observers;

use App\Jobs\OptimizeImageJob;
use App\Jobs\OptimizeVideoJob;
use App\Models\Media;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class MediaObserver
{
    public function created(Media $media): void
    {
        try {
            // Skip if already processed or no mime type
            if (! $media->type || $media->optimize_status !== 'pending') {
                return;
            }

            // Skip if file doesn't exist (test records, etc.)
            $fullPath = Storage::disk($media->disk)->path($media->path);
            if (! file_exists($fullPath)) {
                // File not found, skipping optimization
                $media->update(['optimize_status' => 'skipped']);

                return;
            }

            // Processing new media

            match (true) {
                // Images: optimize immediately
                str_starts_with($media->type, 'image') => $this->handleImageOptimization($media),

                // Videos: queue for background processing
                str_starts_with($media->type, 'video') => $this->handleVideoOptimization($media),

                // Other files: skip optimization
                default => $this->skipOptimization($media)
            };

        } catch (\Exception $e) {
            Log::error('MediaObserver failed', [
                'media_id' => $media->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            $media->update([
                'optimize_status' => 'failed',
                'optimize_meta' => ['error' => $e->getMessage()],
            ]);
        }
    }

    private function handleImageOptimization(Media $media): void
    {
        // Queue image optimization (consistent with video)
        OptimizeImageJob::dispatch($media->id)
            ->onQueue('media-optimization')
            ->delay(now()->addSeconds(2)); // Small delay to ensure file is fully written
    }

    private function handleVideoOptimization(Media $media): void
    {
        // Queue video optimization (slow operation)
        OptimizeVideoJob::dispatch($media->id)
            ->onQueue('media-optimization')
            ->delay(now()->addSeconds(5)); // Small delay to ensure file is fully written

        // Video optimization queued
    }

    private function skipOptimization(Media $media): void
    {
        $media->update(['optimize_status' => 'skipped']);

        // Media optimization skipped
    }
}
