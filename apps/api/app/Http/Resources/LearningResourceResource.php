<?php

namespace App\Http\Resources;

use App\Models\GradeLevel;
use App\Models\LearningResource;
use App\Models\Subject;
use App\Services\MediaOptimizationService;
use App\Services\MediaTokenService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LearningResourceResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            '_id' => $this->hash_id,
            'title' => $this->title,
            'description' => $this->description,
            'type' => $this->type,
            'status' => $this->status,
            'status_label' => $this->getStatusLabel(),
            'subject_id' => Subject::encodeId($this->subject_id),
            'subject' => $this->when($this->subject, fn () => is_object($this->subject) ? ($this->subject->name ?? null) : null),
            'grade_level_id' => GradeLevel::encodeId($this->grade_level_id),
            'grade_level' => $this->when($this->grade_level, fn () => is_object($this->grade_level) ? ($this->grade_level->name ?? null) : null),
            'topic' => $this->topic,
            'tags' => $this->tags,
            'external_url' => $this->external_url,
            'is_public' => $this->is_public,
            'downloads' => $this->downloads,
            'views' => $this->views,

            // Media information (without direct URL for security)
            'media' => $this->when($this->media_id, function () {
                $media = $this->media;

                // Check if media is loaded and is an object
                if (! $this->relationLoaded('media') || ! $media) {
                    // If media not loaded, return basic info with signed URL
                    $userId = auth('api')->id() ?? 0;

                    return [
                        '_id' => LearningResource::encodeId($this->media_id),
                        'download_url' => $userId > 0
                            ? MediaTokenService::generateSignedUrl($this->id, $userId, 'download', 60)
                            : null,
                    ];
                }

                // If media is string (shouldn't happen, but handle it)
                if (! is_object($media)) {
                    \Log::channel('media')->warning('LearningResourceResource: media is not an object', [
                        'resource_id' => $this->id,
                        'media_id' => $this->media_id,
                        'media_type' => gettype($media),
                        'media_value' => is_string($media) ? substr($media, 0, 100) : $media,
                    ]);
                    $userId = auth('api')->id() ?? 0;

                    return [
                        '_id' => LearningResource::encodeId($this->media_id),
                        'download_url' => $userId > 0
                            ? MediaTokenService::generateSignedUrl($this->id, $userId, 'download', 60)
                            : null,
                    ];
                }

                // Helper to read attribute/array keys safely
                $get = function ($key, $default = null) use ($media) {
                    return data_get($media, $key, $default);
                };

                // Format file size safely
                $sizeFormatted = null;
                $sizeValue = $get('size');
                if (isset($sizeValue) && is_numeric($sizeValue)) {
                    $bytes = (int) $sizeValue;
                    $units = ['B', 'KB', 'MB', 'GB'];
                    $power = $bytes > 0 ? floor(log($bytes, 1024)) : 0;
                    $sizeFormatted = number_format($bytes / pow(1024, $power), 2, '.', ',').' '.($units[$power] ?? 'B');
                }

                // Get filename: use media.name, fallback to extracting from path
                $fileName = null;
                $mediaPath = $get('path');
                $mediaExt = $get('ext');
                $mediaName = $get('name');
                if (! empty($mediaName)) {
                    $fileName = $mediaName;
                } elseif (! empty($mediaPath)) {
                    // Extract filename from path if name is null
                    $fileName = basename($mediaPath);
                    // Ensure extension if ext is available
                    if (empty(pathinfo($fileName, PATHINFO_EXTENSION)) && ! empty($mediaExt)) {
                        $fileName .= '.'.$mediaExt;
                    }
                }

                // Generate signed URLs with tokens (expires in 1 hour)
                $userId = auth('api')->id() ?? 0;
                $expiresAt = now()->addHours(1);

                // Check for optimized version
                $optimizationService = app(MediaOptimizationService::class);
                $hasOptimized = $optimizationService->hasOptimizedVersion($media);

                return [
                    '_id' => LearningResource::encodeId($get('id', $this->media_id)),
                    'name' => $fileName, // Always return filename if available
                    'size' => $sizeValue,
                    'size_formatted' => $sizeFormatted,
                    'type' => $get('type'),
                    'ext' => $mediaExt,
                    'mime_type' => $get('mime_type'),

                    // Optimization status
                    'optimize_status' => $get('optimize_status', 'pending'),
                    'optimized_at' => $get('optimized_at'),
                    'optimization_meta' => $get('optimize_meta'),

                    // SECURITY: Do NOT expose path, disk, or direct storage URLs
                    // Use signed URLs with tokens that expire
                    // IMPORTANT: These URLs are RELATIVE PATHS (starting with "/"), not absolute URLs
                    // Client must append their own base URL. This prevents exposing server domain/IP.
                    // Auto-selects optimized version if available, otherwise original
                    'preview_url' => $userId > 0
                        ? MediaTokenService::generateSignedUrl($this->id, $userId, 'preview', 60)
                        : null,

                    // Optimized stream URL (for videos)
                    'stream_url' => $userId > 0 && (
                        in_array($get('type'), ['video', 'audio']) ||
                        $get('mime_type') === 'application/pdf' ||
                        strtolower((string) $mediaExt) === 'pdf'
                    )
                        ? MediaTokenService::generateSignedUrl($this->id, $userId, 'stream', 60)
                        : null,

                    'download_url' => $userId > 0
                        ? MediaTokenService::generateSignedUrl($this->id, $userId, 'download', 60)
                        : null,

                    // Only images get a thumbnail URL; videos return null to avoid unnecessary thumbnail calls
                    'thumbnail_url' => $userId > 0 && $get('type') === 'image'
                        ? MediaTokenService::generateSignedUrl($this->id, $userId, 'thumbnail', 60)
                        : null,
                    'expires_at' => $expiresAt->toISOString(),
                ];
            }),

            // Multiple media files (for image type)
            'media_files' => $this->when($this->type === 'image' && $this->relationLoaded('mediaFiles'), function () {
                return $this->mediaFiles->map(function ($media) {
                    $userId = auth('api')->id() ?? 0;
                    $optimizationService = app(MediaOptimizationService::class);
                    $hasOptimized = $optimizationService->hasOptimizedVersion($media);

                    // Create a temporary learning resource with this media as primary
                    $tempResource = new LearningResource;
                    $tempResource->id = $this->id;
                    $tempResource->media_id = $media->id;
                    $tempResource->setRelation('media', $media);

                    return [
                        '_id' => LearningResource::encodeId($media->id),
                        'name' => $media->name,
                        'size' => $media->size,
                        'size_formatted' => $this->formatFileSize($media->size),
                        'type' => $media->type,
                        'ext' => $media->ext,
                        'mime_type' => $media->mime_type,
                        'order' => $media->pivot->order ?? 0,

                        // Optimization status
                        'optimize_status' => $media->optimize_status ?? 'pending',
                        'optimized_at' => $media->optimized_at,
                        'optimization_meta' => $media->optimize_meta,

                        // Auto-selects optimized version if available, otherwise original
                        'preview_url' => $userId > 0
                            ? MediaTokenService::generateSignedUrl($this->id, $userId, 'preview', 60).'&media_id='.LearningResource::encodeId($media->id)
                            : null,

                        'download_url' => $userId > 0
                            ? MediaTokenService::generateSignedUrl($this->id, $userId, 'download', 60).'&media_id='.LearningResource::encodeId($media->id)
                            : null,
                        'thumbnail_url' => $userId > 0
                            ? MediaTokenService::generateSignedUrl($this->id, $userId, 'thumbnail', 60).'&media_id='.LearningResource::encodeId($media->id)
                            : null,
                    ];
                });
            }),

            // Tutor information
            'tutor' => $this->whenLoaded('tutor', fn () => $this->tutor ? new UserResource($this->tutor) : null),

            // Timestamps
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }

    /**
     * Get status label in Vietnamese.
     */
    protected function getStatusLabel(): string
    {
        return match ($this->status) {
            'active' => 'Đang hoạt động',
            'archived' => 'Đã lưu trữ',
            default => $this->status ?? 'N/A',
        };
    }

    /**
     * Format file size.
     */
    protected function formatFileSize($bytes): ?string
    {
        if (! is_numeric($bytes)) {
            return null;
        }

        $bytes = (int) $bytes;
        $units = ['B', 'KB', 'MB', 'GB'];
        $power = $bytes > 0 ? floor(log($bytes, 1024)) : 0;

        return number_format($bytes / pow(1024, $power), 2, '.', ',').' '.($units[$power] ?? 'B');
    }
}
