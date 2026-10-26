<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Structured answer for the richer exam question types (matching pair picks, ordering
     * sequence, gap_fill per-gap texts, true_false_not_given choice). JSON: [identifier => value].
     * The legacy columns (selected_option_id, selected_option_ids, text_answer) stay and keep
     * serving single/multiple choice + short_answer so old submissions remain readable.
     */
    public function up(): void
    {
        Schema::table('assignment_question_submissions', function (Blueprint $table) {
            $table->json('response')->nullable()->after('text_answer')->comment('Structured answer for matching/ordering/gap_fill/tfn');
        });
    }

    public function down(): void
    {
        Schema::table('assignment_question_submissions', function (Blueprint $table) {
            $table->dropColumn('response');
        });
    }
};
