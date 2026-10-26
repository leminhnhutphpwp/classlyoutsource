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
        Schema::create('notifications', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('created_by')->nullable()->index();
            $table->string('title');
            $table->text('message');
            $table->enum('type', ['announcement', 'reminder', 'payment', 'attendance', 'grade', 'other'])->default('announcement')->index();
            $table->enum('target', ['student', 'parent', 'all'])->default('all');
            $table->enum('recipient_type', ['all', 'classes', 'students'])->default('all')->comment('Loại người nhận');
            $table->json('recipient_classes')->nullable()->comment('IDs lớp học được chọn');
            $table->json('recipient_students')->nullable()->comment('IDs học viên được chọn');
            $table->json('recipient_ids')->nullable()->comment('Danh sách ID người nhận cuối cùng (tự động tính)');
            $table->enum('channel', ['email', 'in_app'])->default('in_app');
            $table->string('status', 20)->nullable()->default('draft')->index();
            $table->timestamp('scheduled_at')->nullable()->comment('Thời gian hẹn gửi');
            $table->timestamp('sent_at')->nullable()->index();
            $table->integer('sent_count')->default(0)->comment('Số lượng đã gửi');
            $table->integer('failed_count')->default(0)->comment('Số lượng gửi thất bại');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
