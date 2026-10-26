<?php

namespace App\Console\Commands;

use App\Models\Media;
use Illuminate\Console\Command;

class MediaOptimizationStatus extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'media:optimization-status 
                            {--detailed : Show detailed breakdown by type}
                            {--failed : Show only failed optimizations}
                            {--pending : Show only pending optimizations}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Show media optimization status summary';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $detailed = $this->option('detailed');
        $showFailed = $this->option('failed');
        $showPending = $this->option('pending');

        $this->info('Media Optimization Status Report');
        $this->info('Generated: '.now()->format('Y-m-d H:i:s'));
        $this->line('');

        // Overall statistics
        if (! $showFailed && ! $showPending) {
            $this->showOverallStats();
        }

        // Detailed breakdown by type
        if ($detailed && ! $showFailed && ! $showPending) {
            $this->showDetailedBreakdown();
        }

        // Show failed optimizations
        if ($showFailed) {
            $this->showFailedOptimizations();
        }

        // Show pending optimizations
        if ($showPending) {
            $this->showPendingOptimizations();
        }

        return self::SUCCESS;
    }

    private function showOverallStats(): void
    {
        $stats = Media::selectRaw('
            optimize_status,
            COUNT(*) as count,
            AVG(CASE WHEN optimize_status = "done" THEN 
                JSON_EXTRACT(optimize_meta, "$.compression_ratio") 
            END) as avg_compression
        ')
            ->whereIn('type', ['image', 'video'])
            ->groupBy('optimize_status')
            ->get()
            ->keyBy('optimize_status');

        $total = $stats->sum('count');

        $this->info('Overall Statistics:');
        $this->table(
            ['Status', 'Count', 'Percentage', 'Avg Compression'],
            $stats->map(function ($stat) use ($total) {
                $percentage = $total > 0 ? round(($stat->count / $total) * 100, 1) : 0;
                $compression = $stat->optimize_status === 'done' && $stat->avg_compression
                    ? round($stat->avg_compression, 1).'%'
                    : 'N/A';

                return [
                    ucfirst($stat->optimize_status ?? 'unknown'),
                    number_format($stat->count),
                    $percentage.'%',
                    $compression,
                ];
            })->toArray()
        );

        $this->line('');
        $this->info('Total optimizable media: '.number_format($total));
    }

    private function showDetailedBreakdown(): void
    {
        $breakdown = Media::selectRaw('
            type,
            optimize_status,
            COUNT(*) as count,
            AVG(CASE WHEN optimize_status = "done" THEN 
                JSON_EXTRACT(optimize_meta, "$.original_size") 
            END) as avg_original_size,
            AVG(CASE WHEN optimize_status = "done" THEN 
                JSON_EXTRACT(optimize_meta, "$.optimized_size") 
            END) as avg_optimized_size
        ')
            ->whereIn('type', ['image', 'video'])
            ->groupBy('type', 'optimize_status')
            ->orderBy('type')
            ->orderBy('optimize_status')
            ->get();

        $this->info('Detailed Breakdown by Type:');

        $currentType = null;
        foreach ($breakdown as $item) {
            if ($currentType !== $item->type) {
                $currentType = $item->type;
                $this->line('');
                $this->info(strtoupper($currentType).'S:');
            }

            $avgOriginal = $item->avg_original_size ? $this->formatBytes($item->avg_original_size) : 'N/A';
            $avgOptimized = $item->avg_optimized_size ? $this->formatBytes($item->avg_optimized_size) : 'N/A';

            $this->line('  '.ucfirst($item->optimize_status ?? 'unknown').': '.
                       number_format($item->count).' files');

            if ($item->optimize_status === 'done' && $item->avg_original_size) {
                $this->line("    Avg original size: {$avgOriginal}");
                $this->line("    Avg optimized size: {$avgOptimized}");
            }
        }
    }

    private function showFailedOptimizations(): void
    {
        $failed = Media::where('optimize_status', 'failed')
            ->whereIn('type', ['image', 'video'])
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get();

        if ($failed->isEmpty()) {
            $this->info('No failed optimizations found.');

            return;
        }

        $this->error('Failed Optimizations (last 20):');
        $this->table(
            ['ID', 'Type', 'Path', 'Error', 'Created'],
            $failed->map(function ($media) {
                $error = 'Unknown error';
                if ($media->optimize_meta && is_array($media->optimize_meta)) {
                    $error = $media->optimize_meta['error'] ?? 'Unknown error';
                }

                return [
                    $media->id,
                    $media->type,
                    substr($media->path, 0, 50).(strlen($media->path) > 50 ? '...' : ''),
                    substr($error, 0, 40).(strlen($error) > 40 ? '...' : ''),
                    $media->created_at->format('M j, H:i'),
                ];
            })->toArray()
        );
    }

    private function showPendingOptimizations(): void
    {
        $pending = Media::where('optimize_status', 'pending')
            ->whereIn('type', ['image', 'video'])
            ->orderBy('created_at', 'asc')
            ->get();

        if ($pending->isEmpty()) {
            $this->info('No pending optimizations found.');

            return;
        }

        $this->warn("Pending Optimizations ({$pending->count()} total):");

        // Group by age
        $now = now();
        $groups = [
            'Recent (< 5 min)' => $pending->filter(fn ($m) => $m->created_at->diffInMinutes($now) < 5),
            'Waiting (5-30 min)' => $pending->filter(fn ($m) => $m->created_at->diffInMinutes($now) >= 5 && $m->created_at->diffInMinutes($now) < 30),
            'Stuck (> 30 min)' => $pending->filter(fn ($m) => $m->created_at->diffInMinutes($now) >= 30),
        ];

        foreach ($groups as $label => $items) {
            if ($items->count() > 0) {
                $this->line('');
                $this->info("{$label}: {$items->count()} files");

                if ($items->count() <= 10) {
                    foreach ($items as $media) {
                        $this->line("  ID {$media->id}: {$media->type} - {$media->created_at->diffForHumans()}");
                    }
                } else {
                    $this->line('  (showing first 5)');
                    foreach ($items->take(5) as $media) {
                        $this->line("  ID {$media->id}: {$media->type} - {$media->created_at->diffForHumans()}");
                    }
                }
            }
        }

        $stuckCount = $groups['Stuck (> 30 min)']->count();
        if ($stuckCount > 0) {
            $this->line('');
            $this->warn("⚠️  {$stuckCount} files appear to be stuck. Consider running:");
            $this->line('   php artisan media:retry-pending --older-than=30');
        }
    }

    private function formatBytes(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB'];
        $power = $bytes > 0 ? floor(log($bytes, 1024)) : 0;

        return number_format($bytes / pow(1024, $power), 1).' '.($units[$power] ?? 'B');
    }
}
