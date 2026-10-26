<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ops-fix A (design §2.2): let a center SUSPEND an account when it removes the member.
 *
 * Suspension is ORTHOGONAL to the users.status enum (active|inactive) — we deliberately do NOT touch
 * that enum so every existing isActive() call-site keeps its meaning. suspended_at is the single source
 * of truth for "locked out by a center"; provisioned_org_id records which org minted the account so we
 * only auto-suspend accounts THIS org created.
 *
 * All columns nullable + additive. FK (provisioned_org_id → organizations) only on non-sqlite drivers
 * (SQLite can't ALTER TABLE ADD CONSTRAINT); the nullable index is enough locally.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('suspended_at')->nullable()->after('status');
            $table->string('suspended_reason')->nullable()->after('suspended_at');
            $table->unsignedBigInteger('provisioned_org_id')->nullable()->after('suspended_reason')->index();
        });

        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            Schema::table('users', function (Blueprint $table) {
                $table->foreign('provisioned_org_id')->references('id')->on('organizations')->onUpdate('no action')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            Schema::table('users', function (Blueprint $table) {
                $table->dropForeign(['provisioned_org_id']);
            });
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['provisioned_org_id']);
            $table->dropColumn(['suspended_at', 'suspended_reason', 'provisioned_org_id']);
        });
    }
};
