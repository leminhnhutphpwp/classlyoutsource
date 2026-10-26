<?php

namespace App\Services;

use App\Models\DataJob;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class DataJobService
{
    public static function start(string $type, string $module, ?User $user, array $context = []): ?DataJob
    {
        try {
            $now = Carbon::now();

            return DataJob::create([
                'type' => $type,
                'module' => $module,
                'user_id' => $user?->id,
                'status' => 'processing',
                'file_name' => $context['file_name'] ?? null,
                'format' => $context['format'] ?? null,
                'download_path' => $context['download_path'] ?? null,
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'meta' => $context['meta'] ?? null,
                'started_at' => $now,
            ]);
        } catch (\Throwable $e) {
            Log::channel('notifications')->error('Failed to start data job log', [
                'type' => $type,
                'module' => $module,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    public static function finish(?DataJob $job, string $status, array $metrics = [], array $meta = [], ?string $message = null): void
    {
        if (! $job) {
            return;
        }

        try {
            $finishedAt = Carbon::now();
            $durationMs = null;

            if ($job->started_at) {
                $durationMs = $job->started_at->diffInMilliseconds($finishedAt);
            }

            $job->update([
                'status' => $status,
                'total_rows' => $metrics['total_rows'] ?? $job->total_rows,
                'success_count' => $metrics['success_count'] ?? $job->success_count,
                'failed_count' => $metrics['failed_count'] ?? $job->failed_count,
                'skipped_count' => $metrics['skipped_count'] ?? $job->skipped_count,
                'download_path' => $metrics['download_path'] ?? $job->download_path,
                'message' => $message,
                'meta' => ! empty($meta) ? $meta : $job->meta,
                'finished_at' => $finishedAt,
                'duration_ms' => $durationMs,
            ]);
        } catch (\Throwable $e) {
            Log::channel('notifications')->error('Failed to finish data job log', [
                'job_id' => $job->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public static function finishSuccess(?DataJob $job, array $metrics = [], array $meta = []): void
    {
        self::finish($job, 'success', $metrics, $meta);
    }

    public static function finishPartial(?DataJob $job, array $metrics = [], array $meta = [], ?string $message = null): void
    {
        self::finish($job, 'partial', $metrics, $meta, $message);
    }

    public static function finishFailed(?DataJob $job, ?string $message = null, array $meta = []): void
    {
        self::finish($job, 'failed', [], $meta, $message);
    }
}
