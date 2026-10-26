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
        Schema::create('submissions', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('assignment_id')->index();
            $table->unsignedBigInteger('student_id')->index();
            $table->text('content')->nullable()->comment('Nội dung bài làm (text)');
            $table->unsignedBigInteger('media_id')->nullable()->index();
            $table->string('external_url', 500)->nullable()->comment('URL liên kết bài nộp (cho link submission)');
            $table->json('attachments')->nullable()->comment('Legacy: File đính kèm bài nộp');
            $table->timestamp('submitted_at')->nullable()->index()->comment('Thời gian nộp bài');
            $table->timestamp('started_at')->nullable()->comment('Thời gian học viên bắt đầu làm bài (cho quiz)');
            $table->integer('time_spent_minutes')->nullable()->comment('Thời gian làm bài tính bằng phút (cho quiz)');
            $table->boolean('is_late')->default(false)->comment('Nộp muộn hay không');
            $table->decimal('score', 5)->nullable()->comment('Điểm số');
            $table->text('feedback')->nullable()->comment('Nhận xét của giáo viên');
            $table->unsignedBigInteger('graded_by')->nullable()->index('submissions_graded_by_foreign');
            $table->timestamp('graded_at')->nullable()->comment('Thời gian chấm bài');
            $table->enum('status', ['not_submitted', 'submitted', 'graded', 'returned'])->default('not_submitted')->index();
            $table->string('submission_type', 50)->nullable();
            $table->integer('attempt_number')->default(1)->comment('Lần nộp thứ mấy');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['assignment_id', 'student_id']);
            $table->index(['student_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('submissions');
    }
};
