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
        Schema::create('schedules', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('class_id')->index();
            $table->enum('day_of_week', ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])->index()->comment('Thứ trong tuần');
            $table->time('start_time')->comment('Giờ bắt đầu');
            $table->time('end_time')->comment('Giờ kết thúc');
            $table->string('room')->nullable()->comment('Phòng học');
            $table->string('location')->nullable()->comment('Địa điểm cụ thể');
            $table->text('notes')->nullable()->comment('Ghi chú');
            $table->boolean('is_active')->default(true)->index()->comment('Đang hoạt động');
            $table->enum('recurring_type', ['single', 'weekly', 'biweekly', 'monthly', 'custom'])->default('weekly')->comment('Loại lặp lại: đơn lẻ, hàng tuần, 2 tuần/lần, hàng tháng');
            $table->json('recurring_days')->nullable()->comment('Các ngày trong tuần lặp lại (JSON array: [1,3,5] = Thứ 2,4,6)');
            $table->date('start_date')->nullable()->comment('Ngày bắt đầu lịch định kỳ');
            $table->date('end_date')->nullable()->comment('Ngày kết thúc lịch định kỳ');
            $table->enum('default_mode', ['offline', 'online'])->default('offline')->comment('Chế độ mặc định: offline hoặc online');
            $table->enum('online_platform', ['zoom', 'google_meet', 'microsoft_teams', 'jitsi', 'other'])->nullable()->comment('Nền tảng học online');
            $table->string('online_meeting_url', 500)->nullable()->comment('Link meeting online');
            $table->string('online_meeting_id')->nullable()->comment('Meeting ID (Zoom, Teams...)');
            $table->string('online_meeting_password')->nullable()->comment('Mật khẩu meeting');
            $table->json('online_config')->nullable()->comment('Cấu hình bổ sung cho online (JSON)');
            $table->boolean('is_alternating')->default(false)->comment('Có xen kẽ offline/online không?');
            $table->json('alternating_pattern')->nullable()->comment('Pattern xen kẽ (VD: [{"week":1,"mode":"offline"},{"week":2,"mode":"online"}])');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['class_id', 'day_of_week', 'is_active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('schedules');
    }
};
