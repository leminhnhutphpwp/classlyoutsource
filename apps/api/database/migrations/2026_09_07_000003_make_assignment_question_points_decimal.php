<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Exam scoring needs fractional marks (0.5-point band steps, partial credit per pair/gap),
     * so question points become decimal(6,2). Existing integer values are preserved as-is.
     */
    public function up(): void
    {
        Schema::table('assignment_questions', function (Blueprint $table) {
            $table->decimal('points', 6, 2)->default(1)->change();
        });
    }

    public function down(): void
    {
        // Round fractional points back to integers on the way down.
        DB::table('assignment_questions')->update([
            'points' => DB::raw('ROUND(points)'),
        ]);

        Schema::table('assignment_questions', function (Blueprint $table) {
            $table->unsignedInteger('points')->default(1)->change();
        });
    }
};
