<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * AI grading is advisory: it writes a SUGGESTED score (+ suggested feedback) for the
     * tutor to review and accept via the normal grade flow. It never overwrites the final
     * score/graded_by — the tutor stays in the loop.
     */
    public function up(): void
    {
        Schema::table('submissions', function (Blueprint $table) {
            $table->decimal('ai_suggested_score', 8, 2)->nullable()->after('score');
            $table->text('ai_feedback')->nullable()->after('ai_suggested_score');
            $table->timestamp('ai_graded_at')->nullable()->after('ai_feedback');
        });
    }

    public function down(): void
    {
        Schema::table('submissions', function (Blueprint $table) {
            $table->dropColumn(['ai_suggested_score', 'ai_feedback', 'ai_graded_at']);
        });
    }
};
