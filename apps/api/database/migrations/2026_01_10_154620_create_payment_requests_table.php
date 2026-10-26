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
        Schema::create('payment_requests', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('class_id');
            $table->unsignedBigInteger('created_by');
            $table->string('period_name', 100)->comment('Tên đợt: "Đợt 1", "Tháng 1/2025", "Học kỳ 1", etc.');
            $table->string('period_month', 20)->nullable()->index()->comment('Tháng/kỳ: YYYY-MM (để filter dễ dàng)');
            $table->decimal('amount_per_student', 15)->comment('Số tiền mỗi học viên phải đóng');
            $table->date('due_date')->index()->comment('Hạn đóng học phí');
            $table->text('description')->nullable()->comment('Mô tả đợt đóng học phí');
            $table->enum('status', ['pending', 'active', 'cancelled'])->nullable()->default('pending')->index();
            $table->json('metadata')->nullable()->comment('Dữ liệu bổ sung (ví dụ: số đợt, tổng số đợt, etc.)');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['class_id', 'due_date', 'status'], 'idx_payment_requests_class_due_status');
            $table->index(['class_id', 'due_date']);
            $table->index(['class_id', 'status']);
            $table->index(['created_by', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payment_requests');
    }
};
