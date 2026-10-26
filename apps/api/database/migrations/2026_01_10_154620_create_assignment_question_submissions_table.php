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
        Schema::create('assignment_question_submissions', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('submission_id');
            $table->unsignedBigInteger('question_id')->index('assignment_question_submissions_question_id_foreign');
            $table->unsignedBigInteger('selected_option_id')->nullable()->index('assignment_question_submissions_selected_option_id_foreign');
            $table->json('selected_option_ids')->nullable();
            $table->text('text_answer')->nullable();
            $table->decimal('score')->default(0);
            $table->boolean('is_correct')->default(false);
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['submission_id', 'question_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('assignment_question_submissions');
    }
};
