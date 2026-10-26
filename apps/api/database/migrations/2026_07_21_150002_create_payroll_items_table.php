<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Wave 3 payroll — payroll_items. ONE payslip / member / period. This is the IMMUTABLE money history
 * (design §6 risks 3,4): organization_id + user_id are HARD SNAPSHOTS on the row, so when a member later
 * leaves or moves org, their historical payslip neither disappears nor leaks into the new org. pay_model
 * + every amount are snapshotted too — editing the profile afterwards never rewrites history.
 *
 * Idempotency (design §6 risk 4): unique(payroll_period_id, user_id) means a compute that runs twice for
 * the same period upserts the SAME row — never a duplicate. computation_breakdown = per-signal json for
 * the payslip UI + audit.
 *
 * SQLite-safe: no inline FKs; FKs only on non-sqlite. Money = decimal(12,0); counts = integer.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll_items', function (Blueprint $table) {
            $table->bigIncrements('id');

            // Anchor — denormalized org-column (from the period) for cheap org-scoped filters (pattern b).
            $table->unsignedBigInteger('organization_id')->index();
            $table->unsignedBigInteger('payroll_period_id')->index();
            $table->unsignedBigInteger('user_id')->index(); // the paid member (immutable snapshot)
            $table->unsignedBigInteger('compensation_profile_id')->nullable();

            $table->enum('pay_model', ['fixed_monthly', 'per_session', 'per_student', 'revenue_share', 'hybrid']); // SNAPSHOT

            $table->decimal('base_amount', 12, 0)->default(0);
            $table->integer('sessions_count')->default(0);
            $table->decimal('sessions_amount', 12, 0)->default(0);
            $table->integer('students_count')->default(0);
            $table->decimal('students_amount', 12, 0)->default(0);
            $table->decimal('revenue_base', 12, 0)->default(0);
            $table->decimal('revenue_amount', 12, 0)->default(0);
            $table->decimal('adjustments_total', 12, 0)->default(0);
            $table->decimal('gross_amount', 12, 0)->default(0);

            $table->json('computation_breakdown')->nullable();
            $table->enum('status', ['draft', 'approved', 'paid'])->default('draft')->index();

            $table->softDeletes();
            $table->timestamps();

            // One payslip per member per period — the idempotency key for recompute.
            $table->unique(['payroll_period_id', 'user_id'], 'payroll_items_period_user_unique');
        });

        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            Schema::table('payroll_items', function (Blueprint $table) {
                $table->foreign('organization_id')->references('id')->on('organizations')->onUpdate('no action')->cascadeOnDelete();
                $table->foreign('payroll_period_id')->references('id')->on('payroll_periods')->onUpdate('no action')->cascadeOnDelete();
                $table->foreign('user_id')->references('id')->on('users')->onUpdate('no action')->cascadeOnDelete();
                $table->foreign('compensation_profile_id')->references('id')->on('tutor_compensation_profiles')->onUpdate('no action')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_items');
    }
};
