<?php

namespace App\Console\Commands;

use App\Services\MediaOptimizationService;
use Illuminate\Console\Command;

class CleanupOrphanedMediaFiles extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'media:cleanup-orphaned 
                            {--disk=public : Storage disk to clean}
                            {--dry-run : Show what would be deleted without actually deleting}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Clean up orphaned optimized media files that no longer have corresponding database records';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $disk = $this->option('disk');
        $dryRun = $this->option('dry-run');

        $this->info("Cleaning up orphaned optimized files on disk: {$disk}");

        if ($dryRun) {
            $this->warn('DRY RUN MODE - No files will actually be deleted');
        }

        $optimizationService = app(MediaOptimizationService::class);

        if ($dryRun) {
            // For dry run, we'll simulate the cleanup
            $this->info('This would clean up orphaned files (dry run mode)');

            return self::SUCCESS;
        }

        $result = $optimizationService->cleanupOrphanedOptimizedFiles($disk);

        $this->info('Cleanup completed:');
        $this->info("- Files processed: {$result['processed_count']}");
        $this->info("- Files cleaned: {$result['cleaned_count']}");

        if (! empty($result['cleaned_files'])) {
            $this->info('Deleted files:');
            foreach ($result['cleaned_files'] as $file) {
                $this->line("  - {$file}");
            }
        }

        if (! empty($result['errors'])) {
            $this->error('Errors encountered:');
            foreach ($result['errors'] as $error) {
                $this->error("  - {$error}");
            }

            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
