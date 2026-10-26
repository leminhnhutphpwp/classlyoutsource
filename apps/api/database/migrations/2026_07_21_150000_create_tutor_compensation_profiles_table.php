<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Wave 3 payroll — tutor_compensation_profiles. The pay RULE per member (one active profile/member,
 * history kept via effective_from/to). Org-anchored pattern (b): the row carries its OWN
 * organization_id (NOT NULL, indexed) and isolates directly by where('organization_id', $orgId) —
 * salary rules attach to a MEMBER, not a class (design §2.4, §6 risk 1). Never class-derived.
 *
 * SQLite-safe: no inline FKs (SQLite can't ALTER TABLE ADD CONSTRAINT); FKs only on non-sqlite. Money =
 * decimal(12,0) (VND integer, no float); percent = decimal(5,2). pay_model / session_basis / status are
 * PERMANENTLY-fixed sets → DB enum is fine (design §2.0). components = json for future hybrid rules.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tutor_compensation_profiles', function (Blueprint $table) {
            $table->bigIncrements('id');

            // Anchor — org-column isolation (pattern b). NOT NULL: a profile always has an owning org.
            $table->unsignedBigInteger('organization_id')->index();
            $table->unsignedBigInteger('user_id')->index(); // the member (tutor) this rule pays.

            $table->enum('pay_model', ['fixed_monthly', 'per_session', 'per_student', 'revenue_share', 'hybrid']);

            $table->decimal('base_salary', 12, 0)->nullable();      // fixed_monthly / hybrid floor
            $table->decimal('rate_per_session', 12, 0)->nullable(); // per_session
            $table->decimal('rate_per_student', 12, 0)->nullable(); // per_student (v2 — schema only)
            $table->decimal('revenue_share_pct', 5, 2)->nullable(); // revenue_share
            $table->json('components')->nullable();                 // hybrid rule list (v2)

            $table->enum('session_basis', ['completed_session', 'attendance_taught'])->default('completed_session');
            $table->char('currency', 3)->default('VND');

            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->enum('status', ['active', 'archived'])->default('active')->index();

            $table->softDeletes();
            $table->timestamps();

            // Fast lookup of "the active profile for this member in this org".
            $table->index(['organization_id', 'user_id', 'status']);
        });

        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            Schema::table('tutor_compensation_profiles', function (Blueprint $table) {
                $table->foreign('organization_id')->references('id')->on('organizations')->onUpdate('no action')->cascadeOnDelete();
                $table->foreign('user_id')->references('id')->on('users')->onUpdate('no action')->cascadeOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('tutor_compensation_profiles');
    }
};
