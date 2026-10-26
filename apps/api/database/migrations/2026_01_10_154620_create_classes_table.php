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
        Schema::create('classes', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tutor_id')->nullable()->index('classes_teacher_id_index');
            $table->unsignedBigInteger('subject_id')->nullable()->index('classes_subject_id_foreign');
            $table->string('name');
            $table->string('subject', 100)->nullable();
            $table->date('start_date')->nullable()->index();
            $table->date('end_date')->nullable();
            $table->json('schedule')->nullable()->comment('Lịch học: {"days": ["mon", "wed", "fri"], "time": "18:00-20:00"}');
            $table->decimal('tuition_fee', 10)->default(0)->comment('Học phí/tháng');
            $table->integer('max_students')->default(30)->comment('Số lượng học viên tối đa');
            $table->text('description')->nullable();
            $table->enum('status', ['active', 'inactive', 'completed'])->default('active')->index();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('classes');
    }
};
