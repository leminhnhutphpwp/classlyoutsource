<?php

namespace App\Services;

use App\Models\Media;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\ImageManagerStatic as Image;

class MediaOptimizationService
{
    public function __construct()
    {
        // Configure Intervention Image for v2.x
        Image::configure(['driver' => 'gd']);
    }

    public function optimizeImage(Media $media): void
    {
        try {
            // Check if already optimized to avoid duplicate work
            if ($media->optimize_status === 'done' && $media->optimized_path) {
                $disk = $media->disk ?? 'public';
                if (Storage::disk($disk)->exists($media->optimized_path)) {
                    Log::info('Media already optimized, skipping', ['media_id' => $media->id]);

                    return;
                }
            }

            $disk = $media->disk ?? 'public';
            $originalPath = Storage::disk($disk)->path($media->path);

            if (! file_exists($originalPath)) {
                throw new \RuntimeException("Original file not found: {$originalPath}");
            }

            // Delete old optimized file if exists (cleanup before creating new one)
            if ($media->optimized_path && Storage::disk($disk)->exists($media->optimized_path)) {
                Storage::disk($disk)->delete($media->optimized_path);
                Log::info('Deleted old optimized file', [
                    'media_id' => $media->id,
                    'old_path' => $media->optimized_path,
                ]);
            }

            $optimizedDir = dirname($originalPath).'/optimized';
            if (! is_dir($optimizedDir)) {
                mkdir($optimizedDir, 0755, true);
            }

            // Determine output format and filename
            $shouldConvertToWebP = $this->shouldConvertToWebP($media);
            $extension = $shouldConvertToWebP ? 'webp' : $media->ext;

            // Create unique filename using media ID and timestamp to avoid conflicts
            $baseName = pathinfo($media->name, PATHINFO_FILENAME);
            $timestamp = now()->format('YmdHis');
            $optimizedFilename = $baseName.'_'.$media->id.'_'.$timestamp.'_optimized.'.$extension;
            $optimizedPath = $optimizedDir.'/'.$optimizedFilename;

            // Load and optimize image using Intervention Image v2
            $image = Image::make($originalPath);

            // Get original dimensions
            $originalWidth = $image->width();
            $originalHeight = $image->height();

            // Only resize if image is actually large (save processing for small images)
            $needsResize = $originalWidth > 1920;
            if ($needsResize) {
                $image->resize(1920, null, function ($constraint) {
                    $constraint->aspectRatio();
                    $constraint->upsize();
                });
            }

            // Save optimized image with appropriate quality
            if ($shouldConvertToWebP) {
                $image->encode('webp', 85);
            } else {
                switch (strtolower($media->ext)) {
                    case 'jpg':
                    case 'jpeg':
                        $image->encode('jpg', 85);
                        break;
                    case 'png':
                        // Use PNG compression level 6 (good balance of size/quality)
                        $image->encode('png');
                        break;
                    case 'gif':
                        $image->encode('gif');
                        break;
                    default:
                        $image->encode('jpg', 85);
                        break;
                }
            }

            $image->save($optimizedPath);

            // Calculate file sizes and compression ratio
            $originalSize = filesize($originalPath);
            $optimizedSize = filesize($optimizedPath);

            // Skip optimization if the optimized file is larger (rare but possible)
            if ($optimizedSize >= $originalSize) {
                unlink($optimizedPath); // Delete the larger optimized file

                $media->fresh()->update([
                    'optimize_status' => 'skipped',
                    'optimize_meta' => [
                        'reason' => 'optimized_file_larger',
                        'original_size' => $originalSize,
                        'optimized_size' => $optimizedSize,
                    ],
                ]);

                Log::info('Optimization skipped - optimized file larger than original', [
                    'media_id' => $media->id,
                    'original_size' => $originalSize,
                    'optimized_size' => $optimizedSize,
                ]);

                return;
            }

            // Update media record with optimization results
            $relativePath = str_replace(Storage::disk($disk)->path(''), '', $optimizedPath);
            $relativePath = ltrim($relativePath, '/\\');

            $media->fresh()->update([
                'optimized_path' => $relativePath,
                'optimize_status' => 'done',
                'optimized_at' => now(),
                'optimize_meta' => [
                    'original_size' => $originalSize,
                    'optimized_size' => $optimizedSize,
                    'compression_ratio' => round((1 - $optimizedSize / $originalSize) * 100, 2),
                    'converted_to_webp' => $shouldConvertToWebP,
                    'was_resized' => $needsResize,
                    'original_dimensions' => ['width' => $originalWidth, 'height' => $originalHeight],
                    'optimized_dimensions' => ['width' => $image->width(), 'height' => $image->height()],
                ],
            ]);

            Log::info('Image optimization completed', [
                'media_id' => $media->id,
                'original_size' => $originalSize,
                'optimized_size' => $optimizedSize,
                'compression_ratio' => round((1 - $optimizedSize / $originalSize) * 100, 2).'%',
                'converted_to_webp' => $shouldConvertToWebP,
                'was_resized' => $needsResize,
            ]);

        } catch (\Exception $e) {
            // Cleanup any partial files on error
            if (isset($optimizedPath) && file_exists($optimizedPath)) {
                unlink($optimizedPath);
            }

            $media->fresh()->update([
                'optimize_status' => 'failed',
                'optimize_meta' => ['error' => $e->getMessage()],
            ]);

            Log::error('Image optimization failed', [
                'media_id' => $media->id,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    private function shouldConvertToWebP(Media $media): bool
    {
        // Convert to WebP if:
        // 1. Original is JPEG/PNG (not GIF - loses animation)
        // 2. File size > 100KB (small files don't benefit much)
        // 3. WebP conversion is enabled in config

        $convertibleFormats = ['jpg', 'jpeg', 'png'];
        $minSizeForWebP = 100 * 1024; // 100KB

        return in_array(strtolower($media->ext), $convertibleFormats)
            && $media->size > $minSizeForWebP
            && config('media.convert_to_webp', true);
    }

    public function getOptimizedUrl(Media $media): ?string
    {
        if (! $media->optimized_path || $media->optimize_status !== 'done') {
            return null;
        }

        return Storage::disk($media->disk)->url($media->optimized_path);
    }

    public function hasOptimizedVersion(Media $media): bool
    {
        return $media->optimize_status === 'done' && ! empty($media->optimized_path);
    }

    /**
     * Clean up orphaned optimized files (files without corresponding media records).
     * Uses smart batching and caching to minimize database queries.
     */
    public function cleanupOrphanedOptimizedFiles(string $disk = 'public'): array
    {
        $cleaned = [];
        $errors = [];
        $processedCount = 0;
        $batchSize = 100;

        try {
            $optimizedDirs = Storage::disk($disk)->directories('media');

            foreach ($optimizedDirs as $dir) {
                $optimizedSubDir = $dir.'/optimized';

                if (! Storage::disk($disk)->exists($optimizedSubDir)) {
                    continue;
                }

                $optimizedFiles = Storage::disk($disk)->files($optimizedSubDir);

                // Process files in batches to reduce memory usage
                $fileBatches = array_chunk($optimizedFiles, $batchSize);

                foreach ($fileBatches as $batch) {
                    $processedCount += count($batch);

                    // Limit total processing to prevent timeout
                    if ($processedCount > 1000) {
                        Log::info('Cleanup stopped at 1000 files limit', ['processed' => $processedCount]);
                        break 2; // Break out of both batch and dir loops
                    }

                    // Get only the paths we need to check from database
                    $existingPaths = Media::whereIn('optimized_path', $batch)
                        ->whereNotNull('optimized_path')
                        ->pluck('optimized_path')
                        ->toArray();

                    $existingPathsSet = array_flip($existingPaths);

                    // Check each file in this batch
                    foreach ($batch as $filePath) {
                        if (! isset($existingPathsSet[$filePath])) {
                            // Orphaned file - delete it
                            Storage::disk($disk)->delete($filePath);
                            $cleaned[] = $filePath;

                            Log::info('Cleaned up orphaned optimized file', [
                                'file_path' => $filePath,
                            ]);
                        }
                    }

                    // Small delay between batches to reduce server load
                    usleep(100000); // 0.1 second
                }
            }

        } catch (\Exception $e) {
            $errors[] = $e->getMessage();
            Log::error('Error during optimized files cleanup', [
                'error' => $e->getMessage(),
            ]);
        }

        return [
            'cleaned_files' => $cleaned,
            'cleaned_count' => count($cleaned),
            'errors' => $errors,
            'processed_count' => $processedCount,
        ];
    }

    /**
     * Delete optimized file for a specific media.
     * Used when media is being deleted or re-optimized.
     */
    public function deleteOptimizedFile(Media $media): bool
    {
        if (! $media->optimized_path) {
            return true; // Nothing to delete
        }

        try {
            $disk = $media->disk ?? 'public';

            if (Storage::disk($disk)->exists($media->optimized_path)) {
                Storage::disk($disk)->delete($media->optimized_path);

                Log::info('Deleted optimized file', [
                    'media_id' => $media->id,
                    'optimized_path' => $media->optimized_path,
                ]);
            }

            // Clear optimization data from media record
            $media->update([
                'optimized_path' => null,
                'optimize_status' => 'pending',
                'optimized_at' => null,
                'optimize_meta' => null,
            ]);

            return true;

        } catch (\Exception $e) {
            Log::error('Failed to delete optimized file', [
                'media_id' => $media->id,
                'optimized_path' => $media->optimized_path,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }
}
