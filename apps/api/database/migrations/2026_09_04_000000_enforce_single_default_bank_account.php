<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Enforce the single-default-bank-account invariant.
     *
     * The product keeps exactly one default bank account per user. Previously nothing enforced
     * that at the DB level, so a race in the old updateOrCreate() could produce duplicate
     * is_default rows. This migration:
     *   1. dedupes existing data (keeps the OLDEST default row per user, demotes the rest),
     *   2. adds a unique index on (user_id, is_default).
     */
    public function up(): void
    {
        // Dedupe: keep the lowest id per (user_id, is_default=1), demote any siblings.
        $defaultRows = DB::table('user_bank_accounts')
            ->where('is_default', true)
            ->orderBy('user_id')
            ->orderBy('id')
            ->get(['id', 'user_id']);

        $seen = [];
        foreach ($defaultRows as $row) {
            if (isset($seen[$row->user_id])) {
                DB::table('user_bank_accounts')
                    ->where('id', $row->id)
                    ->update(['is_default' => false]);
            } else {
                $seen[$row->user_id] = true;
            }
        }

        Schema::table('user_bank_accounts', function (Blueprint $table) {
            $table->unique(['user_id', 'is_default'], 'user_bank_accounts_user_default_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('user_bank_accounts', function (Blueprint $table) {
            $table->dropUnique('user_bank_accounts_user_default_unique');
        });
    }
};
