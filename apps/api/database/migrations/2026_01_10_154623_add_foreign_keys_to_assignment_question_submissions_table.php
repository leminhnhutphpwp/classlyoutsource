<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('assignment_question_submissions', function (Blueprint $table) {
            $table->foreign(['question_id'])->references(['id'])->on('assignment_questions')->onUpdate('no action')->onDelete('cascade');
            $table->foreign(['selected_option_id'])->references(['id'])->on('assignment_question_options')->onUpdate('no action')->onDelete('set null');
            $table->foreign(['submission_id'])->references(['id'])->on('submissions')->onUpdate('no action')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('assignment_question_submissions', function (Blueprint $table) {
            $table->dropForeign('assignment_question_submissions_question_id_foreign');
            $table->dropForeign('assignment_question_submissions_selected_option_id_foreign');
            $table->dropForeign('assignment_question_submissions_submission_id_foreign');
        });
    }
};
