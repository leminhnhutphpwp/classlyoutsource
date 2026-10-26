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
        Schema::create('assignments', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('class_id')->index();
            $table->unsignedBigInteger('tutor_id')->index('assignments_teacher_id_index');
            $table->unsignedBigInteger('assignment_type_id')->nullable()->index();
            $table->string('mode', 20)->default('standard');
            $table->string('title');
            $table->text('description')->nullable();
            $table->text('instructions')->nullable()->comment('Hướng dẫn làm bài');
            $table->integer('max_score')->default(100)->comment('Điểm tối đa');
            $table->date('assigned_date')->comment('Ngày giao bài');
            $table->date('due_date')->index()->comment('Hạn nộp');
            $table->dateTime('deadline')->nullable()->comment('Thời gian deadline cụ thể');
            $table->boolean('allow_late_submission')->default(false)->comment('Cho phép nộp muộn');
            $table->unsignedInteger('max_attempts')->nullable()->comment('Giới hạn số lần nộp bài (null = không giới hạn)');
            $table->json('allowed_submission_types')->nullable()->comment('Các định dạng bài nộp được phép: text, file, document, image, video, audio, link');
            $table->json('quiz_settings')->nullable();
            $table->enum('status', ['draft', 'published', 'closed'])->default('draft')->index();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['class_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('assignments');
    }
};
