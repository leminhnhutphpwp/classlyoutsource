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
        Schema::create('payments', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('reference_code')->unique();
            $table->unsignedBigInteger('student_id')->index();
            $table->unsignedBigInteger('class_id')->index();
            $table->unsignedBigInteger('payment_request_id')->nullable()->index();
            $table->string('invoice_number')->unique();
            $table->decimal('amount', 10);
            $table->enum('payment_method', ['cash', 'bank', 'other'])->nullable()->default('cash');
            $table->string('transaction_id')->nullable()->comment('Mã giao dịch từ cổng thanh toán');
            $table->string('month', 20)->index()->comment('Tháng học: YYYY-MM');
            $table->date('payment_date')->nullable();
            $table->date('due_date')->nullable()->comment('Hạn đóng');
            $table->enum('status', ['paid', 'pending', 'failed', 'refunded'])->default('pending')->index();
            $table->text('note')->nullable();
            $table->unsignedBigInteger('collected_by')->nullable()->index()->comment('User thu tiền');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['student_id', 'class_id', 'due_date', 'status'], 'idx_payments_student_class_due_status');
            $table->index(['student_id', 'due_date', 'status'], 'idx_payments_student_due_status');
            $table->index(['class_id', 'month']);
            $table->index(['student_id', 'month']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
