<?php

use App\Models\Media;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Storage;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Move files from learning-resources/images/ to learning-resources/
        $mediaFiles = Media::where('path', 'like', 'learning-resources/images/%')->get();

        foreach ($mediaFiles as $media) {
            $oldPath = $media->path;
            $newPath = str_replace('learning-resources/images/', 'learning-resources/', $oldPath);

            try {
                // Check if old file exists
                if (Storage::disk($media->disk)->exists($oldPath)) {
                    // Check if new path already exists
                    if (! Storage::disk($media->disk)->exists($newPath)) {
                        // Move the file
                        Storage::disk($media->disk)->move($oldPath, $newPath);
                    }

                    // Update database record
                    $media->update([
                        'path' => $newPath,
                        'directory' => 'learning-resources',
                    ]);
                }
            } catch (Exception $e) {
                Log::error("Failed to move media file: {$oldPath} -> {$newPath}", ['error' => $e->getMessage()]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Move files back from learning-resources/ to learning-resources/images/
        $mediaFiles = Media::where('path', 'like', 'learning-resources/%')
            ->where('path', 'not like', 'learning-resources/images/%')
            ->where('type', 'image')
            ->get();

        foreach ($mediaFiles as $media) {
            $oldPath = $media->path;
            $newPath = str_replace('learning-resources/', 'learning-resources/images/', $oldPath);

            try {
                if (Storage::disk($media->disk)->exists($oldPath)) {
                    if (! Storage::disk($media->disk)->exists($newPath)) {
                        Storage::disk($media->disk)->move($oldPath, $newPath);
                    }

                    $media->update([
                        'path' => $newPath,
                        'directory' => 'learning-resources/images',
                    ]);
                }
            } catch (Exception $e) {
                Log::error("Failed to rollback media file: {$oldPath} -> {$newPath}", ['error' => $e->getMessage()]);
            }
        }
    }
};
