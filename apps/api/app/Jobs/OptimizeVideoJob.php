<?php

namespace App\Jobs;

use App\Models\Media;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;

class OptimizeVideoJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 600; // 10 minutes

    public $tries = 3;

    public function __construct(
        public int $mediaId
    ) {}

    public function handle(): void
    {
        $media = Media::find($this->mediaId);

        if (! $media || $media->optimize_status !== 'pending') {
            Log::warning('OptimizeVideoJob: Media not found or not pending', ['media_id' => $this->mediaId]);

            return;
        }

        // Double-check to prevent duplicate processing
        $updated = Media::where('id', $this->mediaId)
            ->where('optimize_status', 'pending')
            ->update(['optimize_status' => 'processing']);

        if ($updated === 0) {
            Log::warning('OptimizeVideoJob: Media already being processed', ['media_id' => $this->mediaId]);

            return;
        }

        try {
            $originalPath = Storage::disk($media->disk)->path($media->path);
            $optimizedDir = dirname($originalPath).'/optimized';
            $optimizedFilename = pathinfo($media->name, PATHINFO_FILENAME).'_optimized.mp4';
            $optimizedPath = $optimizedDir.'/'.$optimizedFilename;

            // Create optimized directory
            if (! is_dir($optimizedDir)) {
                mkdir($optimizedDir, 0755, true);
            }

            // FFmpeg optimization via Docker
            $this->optimizeVideo($originalPath, $optimizedPath);

            // Update media record
            $relativePath = str_replace(Storage::disk($media->disk)->path(''), '', $optimizedPath);
            $relativePath = ltrim($relativePath, '/\\');

            $media->fresh()->update([
                'optimized_path' => $relativePath,
                'optimize_status' => 'done',
                'optimized_at' => now(),
                'optimize_meta' => [
                    'original_size' => filesize($originalPath),
                    'optimized_size' => filesize($optimizedPath),
                    'compression_ratio' => round((1 - filesize($optimizedPath) / filesize($originalPath)) * 100, 2),
                ],
            ]);

            // Video optimization completed - no logging needed

        } catch (\Exception $e) {
            $media->fresh()->update([
                'optimize_status' => 'failed',
                'optimize_meta' => ['error' => $e->getMessage()],
            ]);

            Log::error('Video optimization failed', [
                'media_id' => $this->mediaId,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    private function optimizeVideo(string $inputPath, string $outputPath): void
    {
        // Convert host paths to container paths
        // Host: /path/to/storage/app/public/media/...
        // Container: /media/...
        $storagePublicPath = Storage::disk('public')->path('');
        $containerInputPath = str_replace($storagePublicPath, '/media/', $inputPath);
        $containerOutputPath = str_replace($storagePublicPath, '/media/', $outputPath);

        // FFmpeg command for video optimization with CPU limits
        $command = [
            'docker', 'exec', 'ffmpeg-container',
            'ffmpeg', '-i', $containerInputPath,
            '-c:v', 'libx264',           // H.264 codec
            '-preset', 'slow',           // Slower preset = better compression, less CPU intensive
            '-crf', '28',                // Higher CRF = lower quality but faster encoding
            '-threads', '2',             // Limit to 2 threads instead of all cores
            '-c:a', 'aac',               // Audio codec
            '-b:a', '96k',               // Lower audio bitrate
            '-movflags', '+faststart',    // Web optimization
            '-y',                        // Overwrite output
            $containerOutputPath,
        ];

        // FFmpeg command prepared

        $process = new Process($command);
        $process->setTimeout($this->timeout);
        $process->run();

        if (! $process->isSuccessful()) {
            Log::error('FFmpeg process failed', [
                'media_id' => $this->mediaId,
                'exit_code' => $process->getExitCode(),
                'output' => $process->getOutput(),
                'error' => $process->getErrorOutput(),
            ]);
            throw new \RuntimeException('FFmpeg failed: '.$process->getErrorOutput());
        }

        if (! file_exists($outputPath)) {
            throw new \RuntimeException('Optimized file was not created at: '.$outputPath);
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

        Log::error('OptimizeVideoJob failed permanently', [
            'media_id' => $this->mediaId,
            'error' => $exception->getMessage(),
        ]);
    }
}
