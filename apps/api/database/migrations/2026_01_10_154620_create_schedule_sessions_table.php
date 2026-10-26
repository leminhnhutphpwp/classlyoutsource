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
        Schema::create('schedule_sessions', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('schedule_id')->index();
            $table->unsignedBigInteger('class_id')->index();
            $table->date('session_date')->index()->comment('Ngày học cụ thể');
            $table->time('start_time')->comment('Giờ bắt đầu');
            $table->time('end_time')->comment('Giờ kết thúc');
            $table->enum('mode', ['offline', 'online'])->default('offline');
            $table->string('room')->nullable();
            $table->string('location')->nullable();
            $table->enum('online_platform', ['zoom', 'google_meet', 'microsoft_teams', 'jitsi', 'other'])->nullable();
            $table->string('online_meeting_url', 500)->nullable();
            $table->string('online_meeting_id')->nullable();
            $table->string('online_meeting_password')->nullable();
            $table->json('online_config')->nullable();
            $table->enum('status', ['scheduled', 'ongoing', 'completed', 'cancelled', 'postponed'])->default('scheduled')->index()->comment('Trạng thái buổi học');
            $table->timestamp('completed_at')->nullable()->comment('Thời điểm đánh dấu hoàn thành');
            $table->unsignedBigInteger('completed_by')->nullable()->index('schedule_sessions_completed_by_foreign');
            $table->text('notes')->nullable();
            $table->integer('week_number')->nullable()->comment('Tuần thứ mấy trong khóa học');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['class_id', 'session_date', 'status'], 'idx_schedule_sessions_class_date_status');
            $table->index(['session_date', 'status'], 'idx_schedule_sessions_date_status');
            $table->unique(['schedule_id', 'session_date'], 'unique_schedule_session');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('schedule_sessions');
    }
};
