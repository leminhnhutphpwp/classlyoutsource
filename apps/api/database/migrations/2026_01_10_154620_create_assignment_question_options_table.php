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
        Schema::create('assignment_question_options', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('question_id');
            // 500: matching questions store the full item text in `label` (not just A-D letters).
            $table->string('label', 500)->nullable();
            $table->text('content');
            $table->boolean('is_correct')->default(false);
            $table->text('feedback')->nullable();
            $table->unsignedInteger('order')->default(1);
            $table->timestamps();

            $table->index(['question_id', 'order']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('assignment_question_options');
    }
};
