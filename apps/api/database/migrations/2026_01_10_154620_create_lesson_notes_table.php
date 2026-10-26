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
        Schema::create('lesson_notes', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('class_id')->index();
            $table->unsignedBigInteger('tutor_id')->index('lesson_notes_teacher_id_index');
            $table->date('lesson_date')->index()->comment('Ngày học');
            $table->string('topic')->nullable()->comment('Chủ đề bài học');
            $table->text('content')->comment('Nội dung đã dạy');
            $table->text('homework')->nullable()->comment('Bài tập về nhà');
            $table->text('observations')->nullable()->comment('Nhận xét chung về lớp');
            $table->json('student_notes')->nullable()->comment('Ghi chú riêng từng học viên');
            $table->integer('rating')->nullable()->comment('Đánh giá buổi học (1-5)');
            $table->json('attachments')->nullable()->comment('File đính kèm (slide, tài liệu)');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['class_id', 'lesson_date']);
            $table->unique(['class_id', 'lesson_date'], 'unique_lesson_per_day');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('lesson_notes');
    }
};
