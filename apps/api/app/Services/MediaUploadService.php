<?php

namespace App\Services;

use App\Models\Media;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MediaUploadService
{
    /**
     * Upload file and create Media record (following Media convention).
     *
     * @param  string  $subdirectory  Subdirectory within media folder (e.g., 'avatars', 'bank-qr-codes', 'learning-resources')
     * @param  array  $options  Additional options:
     *                          - 'allowed_mimes': array of allowed MIME types (default: media config)
     *                          - 'max_size': max file size in bytes
     *                          - 'disk': storage disk (default: media config)
     * @return array ['success' => bool, 'media_id' => int|null, 'path' => string|null, 'url' => string|null, 'message' => string|null]
     */
    public static function uploadAndCreateMedia(UploadedFile $file, string $subdirectory = 'general', array $options = []): array
    {
        try {
            // Get options
            $allowedMimes = $options['allowed_mimes'] ?? [
                'image/jpeg',
                'image/png',
                'image/webp',
                'image/svg+xml',
                'application/pdf',
            ];
            $maxSize = $options['max_size'] ?? null;
            $disk = $options['disk'] ?? 'public';

            // Validate file type
            $mimeType = $file->getMimeType();
            if (! in_array($mimeType, $allowedMimes)) {
                return [
                    'success' => false,
                    'message' => 'Loại file không được phép. Chỉ chấp nhận: '.implode(', ', $allowedMimes),
                ];
            }

            // Validate file size if specified
            if ($maxSize && $file->getSize() > $maxSize) {
                return [
                    'success' => false,
                    'message' => 'File quá lớn. Kích thước tối đa: '.number_format($maxSize / 1024 / 1024, 2).' MB',
                ];
            }

            // Generate unique filename
            $extension = $file->getClientOriginalExtension();
            $originalName = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
            $filename = Str::slug($originalName).'_'.time().'_'.Str::random(8).'.'.$extension;

            // Store in media directory structure
            $baseDirectory = 'media';
            $directory = $baseDirectory.'/'.$subdirectory.'/'.date('Y/m');
            $path = $file->storeAs($directory, $filename, $disk);

            // Get file info
            $size = $file->getSize();
            $width = null;
            $height = null;

            // Get image dimensions if it's an image
            if (str_starts_with($mimeType, 'image/')) {
                try {
                    $imageInfo = @getimagesize($file->getPathname());
                    if ($imageInfo) {
                        $width = $imageInfo[0];
                        $height = $imageInfo[1];
                    }
                } catch (\Exception $e) {
                    // Ignore if can't read image
                }
            }

            // Determine media type
            $mediaType = 'document';
            if (str_starts_with($mimeType, 'image/')) {
                $mediaType = 'image';
            } elseif (str_starts_with($mimeType, 'video/')) {
                $mediaType = 'video';
            } elseif (str_starts_with($mimeType, 'audio/')) {
                $mediaType = 'audio';
            }

            // Create Media record
            $media = Media::create([
                'disk' => $disk,
                'directory' => $baseDirectory,
                'visibility' => 'public',
                'name' => $originalName.'.'.$extension,
                'path' => $path,
                'width' => $width,
                'height' => $height,
                'size' => $size,
                'type' => $mediaType,
                'ext' => $extension,
                'alt' => $originalName,
                'title' => $originalName,
                'optimize_status' => 'pending', // Ensure optimization is triggered
            ]);

            // Get URL using Media accessor (handles Glide/CDN automatically)
            $mediaUrl = $media->url ?? Storage::disk($disk)->url($path);

            return [
                'success' => true,
                'media_id' => $media->id,
                'path' => $path,
                'url' => $mediaUrl,
                'name' => $file->getClientOriginalName(),
                'size' => $size,
                'mime_type' => $mimeType,
                'width' => $width,
                'height' => $height,
            ];
        } catch (\Exception $e) {
            Log::channel('media')->error('MediaUploadService::uploadAndCreateMedia failed', [
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            return [
                'success' => false,
                'message' => 'Lỗi khi upload file: '.$e->getMessage(),
            ];
        }
    }

    /**
     * Delete media file and record.
     *
     * @param  int|null  $mediaId  Media ID to delete
     * @return bool True if deleted successfully
     */
    public static function deleteMedia(?int $mediaId): bool
    {
        if (! $mediaId) {
            return false;
        }

        try {
            $media = Media::find($mediaId);
            if (! $media) {
                Log::info('Media not found for deletion', ['media_id' => $mediaId]);

                return true; // Consider it "deleted" if it doesn't exist
            }

            $disk = $media->disk ?? 'public';
            $deletedFiles = [];

            // Delete original file
            if (Storage::disk($disk)->exists($media->path)) {
                Storage::disk($disk)->delete($media->path);
                $deletedFiles[] = $media->path;
            }

            // Delete optimized file using MediaOptimizationService
            if ($media->optimized_path) {
                $optimizationService = app(MediaOptimizationService::class);
                $optimizationService->deleteOptimizedFile($media);
                $deletedFiles[] = $media->optimized_path;
            }

            // Delete media record from database
            $media->delete();

            Log::info('Media deleted successfully', [
                'media_id' => $mediaId,
                'deleted_files' => $deletedFiles,
                'file_count' => count($deletedFiles),
            ]);

            return true;

        } catch (\Exception $e) {
            Log::channel('media')->error('MediaUploadService::deleteMedia failed', [
                'media_id' => $mediaId,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Get extended allowed MIME types for learning resources (includes documents, videos, audio).
     */
    public static function getLearningResourceAllowedMimes(): array
    {
        $baseTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/svg+xml',
            'application/pdf',
        ];

        $additionalTypes = [
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'image/gif',
            'video/mp4',
            'video/quicktime',
            'audio/mpeg',
            'audio/mp3',
        ];

        return array_unique(array_merge($baseTypes, $additionalTypes));
    }
}
