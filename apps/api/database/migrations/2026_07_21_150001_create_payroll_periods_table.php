<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Wave 3 payroll — payroll_periods. One pay run of an org (default: a calendar month, but period_start/
 * period_end are stored EXPLICITLY so bi-weekly/custom cadence needs no migration — design §5 QĐ 6).
 * Org-anchored pattern (b): organization_id NOT NULL + indexed. reference_code is a unique public code
 * (HasHashId gives the hashid; ReferenceCode gives the human code). status drives the state machine
 * draft → approved → paid (cancel only from draft). unique(org, period_start, period_end) blocks
 * duplicate runs of the same window (design §2.4).
 *
 * SQLite-safe: no inline FKs; FKs only on non-sqlite. Money = decimal(12,0).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll_periods', function (Blueprint $table) {
            $table->bigIncrements('id');

            $table->unsignedBigInteger('organization_id')->index(); // anchor (pattern b)
            $table->string('reference_code')->unique();

            $table->date('period_start');
            $table->date('period_end');
            $table->string('label'); // "Tháng 7/2026"

            $table->enum('status', ['draft', 'approved', 'paid', 'cancelled'])->default('draft')->index();

            $table->timestamp('computed_at')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->unsignedBigInteger('paid_by')->nullable();
            $table->timestamp('paid_at')->nullable();

            $table->decimal('total_amount', 12, 0)->default(0); // denormalized run total for dashboards

            $table->softDeletes();
            $table->timestamps();

            // A window can only be run ONCE per org (blocks accidental double periods).
            $table->unique(['organization_id', 'period_start', 'period_end'], 'payroll_periods_org_window_unique');
        });

        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            Schema::table('payroll_periods', function (Blueprint $table) {
                $table->foreign('organization_id')->references('id')->on('organizations')->onUpdate('no action')->cascadeOnDelete();
                $table->foreign('approved_by')->references('id')->on('users')->onUpdate('no action')->nullOnDelete();
                $table->foreign('paid_by')->references('id')->on('users')->onUpdate('no action')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_periods');
    }
};
