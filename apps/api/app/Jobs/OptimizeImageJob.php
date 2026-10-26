<?php

namespace App\Jobs;

use App\Models\Media;
use App\Services\MediaOptimizationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class OptimizeImageJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 120; // 2 minutes

    public $tries = 3;

    public function __construct(
        public int $mediaId
    ) {}

    public function handle(): void
    {
        $media = Media::find($this->mediaId);

        if (! $media || $media->optimize_status !== 'pending') {
            Log::warning('OptimizeImageJob: Media not found or not pending', ['media_id' => $this->mediaId]);

            return;
        }

        // Double-check to prevent duplicate processing
        $updated = Media::where('id', $this->mediaId)
            ->where('optimize_status', 'pending')
            ->update(['optimize_status' => 'processing']);

        if ($updated === 0) {
            Log::warning('OptimizeImageJob: Media already being processed', ['media_id' => $this->mediaId]);

            return;
        }

        try {
            // Use existing service
            $service = app(MediaOptimizationService::class);
            $service->optimizeImage($media->fresh());

        } catch (\Exception $e) {
            $media->update([
                'optimize_status' => 'failed',
                'optimize_meta' => ['error' => $e->getMessage()],
            ]);

            Log::error('Image optimization failed', [
                'media_id' => $this->mediaId,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    public function failed(\Throwable $exception): void
    {
        $media = Media::find($this->mediaId);
        if ($media) {
            $media->update([
                'optimize_status' => 'failed',
                'optimize_meta' => ['error' => $exception->getMessage()],
            ]);
        }

        Log::error('OptimizeImageJob failed permanently', [
            'media_id' => $this->mediaId,
            'error' => $exception->getMessage(),
        ]);
    }
}
