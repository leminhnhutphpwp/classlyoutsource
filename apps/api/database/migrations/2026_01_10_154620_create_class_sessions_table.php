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
        Schema::create('class_sessions', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('class_id')->index();
            $table->unsignedBigInteger('schedule_id')->nullable()->index();
            $table->date('session_date')->index()->comment('Ngày học cụ thể');
            $table->time('start_time')->comment('Giờ bắt đầu');
            $table->time('end_time')->comment('Giờ kết thúc');
            $table->string('room')->nullable()->comment('Phòng học');
            $table->string('location')->nullable()->comment('Địa điểm');
            $table->text('topic')->nullable()->comment('Chủ đề buổi học');
            $table->text('notes')->nullable()->comment('Ghi chú');
            $table->enum('status', ['scheduled', 'completed', 'cancelled', 'rescheduled'])->default('scheduled')->index()->comment('Trạng thái buổi học');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['class_id', 'session_date']);
            $table->unique(['class_id', 'session_date', 'start_time'], 'unique_class_session');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('class_sessions');
    }
};
