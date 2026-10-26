<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Persist the AI grading rubrics (criteria) and the model's own confidence so the
     * tutor-side review queue can sort by "AI không chắc" and the result screen can
     * render the per-criteria breakdown long after the HTTP response is gone.
     */
    public function up(): void
    {
        Schema::table('submissions', function (Blueprint $table) {
            $table->decimal('ai_confidence', 3, 2)->nullable()->after('ai_graded_at');
            $table->json('ai_criteria')->nullable()->after('ai_confidence');
        });
    }

    public function down(): void
    {
        Schema::table('submissions', function (Blueprint $table) {
            $table->dropColumn(['ai_confidence', 'ai_criteria']);
        });
    }
};
