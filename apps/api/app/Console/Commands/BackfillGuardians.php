<?php

namespace App\Console\Commands;

use App\Models\StudentInvite;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Backfills the guardian_student links from data that predates the Guardian model.
 * Conservative + idempotent: only creates links we can prove (accepted parent invites that carry a
 * meta.student_id and whose parent User exists). Never fabricates a User from parent_name alone (there is
 * no parent email on the students table). Re-runnable via firstOrCreate on the unique pivot.
 */
class BackfillGuardians extends Command
{
    protected $signature = 'guardians:backfill {--dry-run : Show planned links without writing}';

    protected $description = 'Link parent Users to their students (guardian_student) from accepted parent invites';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');
        $linked = 0;
        $skipped = 0;

        $invites = StudentInvite::where('role', 'parent')
            ->where('status', 'accepted')
            ->get();

        foreach ($invites as $invite) {
            $studentId = data_get($invite->meta, 'student_id');
            if (! $studentId) {
                $this->warn("Invite #{$invite->id} ({$invite->email}): no meta.student_id — skipped.");
                $skipped++;

                continue;
            }

            $parent = User::where('email', $invite->email)->where('role', 'parent')->first();
            if (! $parent) {
                $this->warn("Invite #{$invite->id} ({$invite->email}): no parent User — skipped.");
                $skipped++;

                continue;
            }

            $exists = DB::table('guardian_student')
                ->where('user_id', $parent->id)->where('student_id', $studentId)->exists();
            if ($exists) {
                continue;
            }

            $this->line("Link parent #{$parent->id} → student #{$studentId}".($dry ? ' (dry-run)' : ''));
            if (! $dry) {
                DB::table('guardian_student')->insert([
                    'user_id' => $parent->id,
                    'student_id' => $studentId,
                    'status' => 'active',
                    'is_primary' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
            $linked++;
        }

        $this->info(($dry ? '[dry-run] ' : '')."Done. Linked: {$linked}, skipped: {$skipped}.");

        return self::SUCCESS;
    }
}
