<?php

namespace App\Http\Controllers\API\V1;

use App\Jobs\OptimizeVideoJob;
use App\Models\Media;
use App\Models\User;
use App\Services\MediaOptimizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MediaOptimizationController extends BaseController
{
    public function __construct(
        private MediaOptimizationService $optimizationService
    ) {}

    /**
     * Get optimization status for a media file.
     */
    public function status(Request $request, string $mediaId): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Media public ids are hashids encoded with the User salt (shared salt — see UserResource).
        $decodedId = User::decodeId($mediaId);
        $media = $decodedId ? Media::find($decodedId) : null;
        if (! $media) {
            return $this->errorResponse('Media not found', null, 'NOT_FOUND', 404);
        }

        return $this->successResponse([
            'media_id' => User::encodeId($media->id),
            'optimize_status' => $media->optimize_status ?? 'pending',
            'optimized_at' => $media->optimized_at,
            'optimization_meta' => $media->optimize_meta,
            'has_optimized_version' => $this->optimizationService->hasOptimizedVersion($media),
            'optimized_url' => $this->optimizationService->getOptimizedUrl($media),
        ]);
    }

    /**
     * Get optimization statistics.
     */
    public function stats(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $stats = [
            'total_media' => Media::count(),
            'pending' => Media::where('optimize_status', 'pending')->count(),
            'processing' => Media::where('optimize_status', 'processing')->count(),
            'done' => Media::where('optimize_status', 'done')->count(),
            'failed' => Media::where('optimize_status', 'failed')->count(),
            'skipped' => Media::where('optimize_status', 'skipped')->count(),
        ];

        // Calculate optimization rate
        $stats['optimization_rate'] = $stats['total_media'] > 0
            ? round(($stats['done'] / $stats['total_media']) * 100, 2)
            : 0;

        return $this->successResponse($stats);
    }

    /**
     * Retry failed optimizations.
     */
    public function retryFailed(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Only allow admin users to retry
        if (! $user->hasRole('super_admin')) {
            return $this->errorResponse('Unauthorized', null, 'UNAUTHORIZED', 403);
        }

        $failedMedia = Media::where('optimize_status', 'failed')->get();
        $retryCount = 0;

        foreach ($failedMedia as $media) {
            $media->update(['optimize_status' => 'pending']);

            // Re-trigger optimization
            if (str_starts_with($media->type, 'image')) {
                try {
                    $this->optimizationService->optimizeImage($media);
                    $retryCount++;
                } catch (\Exception $e) {
                    // Will be marked as failed again
                }
            } elseif (str_starts_with($media->type, 'video')) {
                OptimizeVideoJob::dispatch($media->id)
                    ->onQueue('media-optimization');
                $retryCount++;
            }
        }

        return $this->successResponse([
            'message' => "Retried {$retryCount} failed optimizations",
            'retried_count' => $retryCount,
            'total_failed' => $failedMedia->count(),
        ]);
    }
}
