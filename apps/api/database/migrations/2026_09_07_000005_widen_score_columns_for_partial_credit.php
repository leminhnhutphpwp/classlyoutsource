<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;

return new class extends Migration
{
    /**
     * Partial credit (per pair / per gap / 0.5 steps) means assignment totals and submission
     * scores must hold fractions too. Both were already decimal but too narrow — submissions
     * used decimal(5) (integer scale) and assignments used an integer column. Widen both to
     * decimal(8,2). grades.score is decimal(5) with default scale 0 — widen as well so the
     * gradebook mirror of an exam with fractional marks doesn't truncate.
     */
    public function up(): void
    {
        Schema::table('submissions', function (Blueprint $table) {
            $table->decimal('score', 8, 2)->nullable()->default(0)->change();
        });

        Schema::table('assignments', function (Blueprint $table) {
            $table->decimal('max_score', 8, 2)->default(100)->change();
        });

        Schema::table('grades', function (Blueprint $table) {
            $table->decimal('score', 8, 2)->default(0)->change();
            $table->decimal('max_score', 8, 2)->default(100)->change();
        });
    }

    public function down(): void
    {
        Schema::table('submissions', function (Blueprint $table) {
            $table->decimal('score', 5)->nullable()->default(0)->change();
        });

        Schema::table('assignments', function (Blueprint $table) {
            $table->integer('max_score')->default(100)->change();
        });

        Schema::table('grades', function (Blueprint $table) {
            $table->decimal('score', 5)->default(0)->change();
            $table->integer('max_score')->default(100)->change();
        });
    }
};
