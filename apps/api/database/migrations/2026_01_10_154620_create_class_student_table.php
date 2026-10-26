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
        Schema::create('class_student', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('class_id')->index();
            $table->unsignedBigInteger('student_id')->index();
            $table->date('enrolled_at')->default('2025-10-27')->comment('Ngày đăng ký');
            $table->enum('status', ['active', 'inactive', 'completed', 'dropped'])->default('active')->index()->comment('Trạng thái học');
            $table->boolean('is_paused')->default(false)->index()->comment('Đang tạm dừng học');
            $table->timestamp('paused_at')->nullable()->comment('Thời điểm tạm dừng');
            $table->text('pause_reason')->nullable()->comment('Lý do tạm dừng');
            $table->text('notes')->nullable()->comment('Ghi chú');
            $table->timestamps();

            $table->index(['class_id', 'status']);
            $table->unique(['class_id', 'student_id']);
            $table->index(['student_id', 'class_id'], 'idx_class_student_student_class');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('class_student');
    }
};
