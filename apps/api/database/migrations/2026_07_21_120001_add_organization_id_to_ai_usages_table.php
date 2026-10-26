<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ops-fix B (design §2.3): stamp each AI call with the org that paid for it so the monthly pool can be
 * counted by organization_id — immune to member churn (unlike a whereIn(orgTutorIds) which under-counts
 * calls made by tutors who have since left). NULL = a solo tutor's call (no org pool applies).
 *
 * Nullable + additive; composite index matches the pool query (organization_id + feature + month window).
 * FK only on non-sqlite. Legacy rows stay NULL — the pool simply meters correctly from deploy forward.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_usages', function (Blueprint $table) {
            $table->unsignedBigInteger('organization_id')->nullable()->after('user_id');
            $table->index(['organization_id', 'feature', 'created_at']);
        });

        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            Schema::table('ai_usages', function (Blueprint $table) {
                $table->foreign('organization_id')->references('id')->on('organizations')->onUpdate('no action')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            Schema::table('ai_usages', function (Blueprint $table) {
                $table->dropForeign(['organization_id']);
            });
        }

        Schema::table('ai_usages', function (Blueprint $table) {
            $table->dropIndex(['organization_id', 'feature', 'created_at']);
            $table->dropColumn('organization_id');
        });
    }
};
