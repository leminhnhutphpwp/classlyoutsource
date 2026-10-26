<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Payroll hardening: calculation lifecycle/token makes queued computation and approval mutually
 * exclusive; the profile index supports transactional effective-date history validation.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payroll_periods', function (Blueprint $table) {
            $table->string('calculation_status', 20)->default('not_started')->index()->after('status');
            $table->string('calculation_token', 64)->nullable()->index()->after('calculation_status');
            $table->timestamp('calculation_started_at')->nullable()->after('calculation_token');
            $table->text('calculation_error')->nullable()->after('calculation_started_at');
        });

        Schema::table('tutor_compensation_profiles', function (Blueprint $table) {
            $table->index(
                ['organization_id', 'user_id', 'effective_from'],
                'comp_profiles_org_user_effective_from_index'
            );
        });
    }

    public function down(): void
    {
        Schema::table('tutor_compensation_profiles', function (Blueprint $table) {
            $table->dropIndex('comp_profiles_org_user_effective_from_index');
        });

        Schema::table('payroll_periods', function (Blueprint $table) {
            $table->dropIndex(['calculation_status']);
            $table->dropIndex(['calculation_token']);
            $table->dropColumn(['calculation_status', 'calculation_token', 'calculation_started_at', 'calculation_error']);
        });
    }
};
