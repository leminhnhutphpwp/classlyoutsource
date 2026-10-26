<?php

namespace App\Console\Commands;

use App\Jobs\OptimizeImageJob;
use App\Jobs\OptimizeVideoJob;
use App\Models\Media;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class RetryPendingOptimizations extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'media:retry-pending 
                            {--older-than=30 : Only retry media older than X minutes}
                            {--limit=100 : Maximum number of media to process}
                            {--dry-run : Show what would be processed without actually queuing jobs}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Retry optimization for media files stuck in pending status';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $olderThanMinutes = (int) $this->option('older-than');
        $limit = (int) $this->option('limit');
        $dryRun = $this->option('dry-run');

        $this->info('Finding media files stuck in pending status...');

        if ($dryRun) {
            $this->warn('DRY RUN MODE - No jobs will actually be queued');
        }

        // Find media stuck in pending status
        $query = Media::where('optimize_status', 'pending')
            ->where('created_at', '<', now()->subMinutes($olderThanMinutes))
            ->whereIn('type', ['image', 'video']) // Only process optimizable types
            ->limit($limit);

        $pendingMedia = $query->get();

        if ($pendingMedia->isEmpty()) {
            $this->info("No pending media found older than {$olderThanMinutes} minutes.");

            return self::SUCCESS;
        }

        $this->info("Found {$pendingMedia->count()} media files to retry:");

        $imageCount = 0;
        $videoCount = 0;
        $skippedCount = 0;

        foreach ($pendingMedia as $media) {
            $this->line("Processing Media ID {$media->id} ({$media->type}):");
            $this->line("  - Path: {$media->path}");
            $this->line("  - Created: {$media->created_at->diffForHumans()}");

            // Verify file still exists
            $disk = $media->disk ?? 'public';
            if (! Storage::disk($disk)->exists($media->path)) {
                $this->warn('  - File not found, marking as skipped');

                if (! $dryRun) {
                    $media->update([
                        'optimize_status' => 'skipped',
                        'optimize_meta' => ['error' => 'File not found during retry'],
                    ]);
                }

                $skippedCount++;

                continue;
            }

            // Queue appropriate optimization job
            if (! $dryRun) {
                if (str_starts_with($media->type, 'image')) {
                    OptimizeImageJob::dispatch($media->id)
                        ->onQueue('media-optimization')
                        ->delay(now()->addSeconds(2));

                    $this->info('  - Queued image optimization job');
                    $imageCount++;

                } elseif (str_starts_with($media->type, 'video')) {
                    OptimizeVideoJob::dispatch($media->id)
                        ->onQueue('media-optimization')
                        ->delay(now()->addSeconds(5));

                    $this->info('  - Queued video optimization job');
                    $videoCount++;
                }
            } else {
                if (str_starts_with($media->type, 'image')) {
                    $this->info('  - Would queue image optimization job');
                    $imageCount++;
                } elseif (str_starts_with($media->type, 'video')) {
                    $this->info('  - Would queue video optimization job');
                    $videoCount++;
                }
            }
        }

        $this->info("\nSummary:");
        $this->info('- Image jobs '.($dryRun ? 'would be ' : '')."queued: {$imageCount}");
        $this->info('- Video jobs '.($dryRun ? 'would be ' : '')."queued: {$videoCount}");
        $this->info("- Files skipped (not found): {$skippedCount}");

        if (! $dryRun && ($imageCount > 0 || $videoCount > 0)) {
            $this->info("\nJobs have been queued. Monitor your queue worker to see progress.");
            $this->info('You can check job status with: php artisan queue:work --queue=media-optimization');
        }

        return self::SUCCESS;
    }
}
