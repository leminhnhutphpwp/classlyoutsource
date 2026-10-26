<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Widen GradeType.weight from integer to decimal so tutors can express fractional
     * weightings (e.g. 1.5, 0.5). Default stays 1. DB-agnostic (SQLite + MySQL).
     */
    public function up(): void
    {
        Schema::table('grade_types', function (Blueprint $table) {
            $table->decimal('weight', 8, 2)->default(1)->change();
        });
    }

    public function down(): void
    {
        Schema::table('grade_types', function (Blueprint $table) {
            $table->integer('weight')->default(1)->change();
        });
    }
};
