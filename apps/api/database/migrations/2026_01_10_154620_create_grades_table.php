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
        Schema::create('grades', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('student_id')->index();
            $table->unsignedBigInteger('class_id')->index();
            $table->unsignedBigInteger('assignment_id')->nullable()->index();
            $table->unsignedBigInteger('tutor_id')->index('grades_teacher_id_index');
            $table->unsignedBigInteger('grade_type_id')->nullable()->index();
            $table->string('title')->comment('Tên bài/môn/kỳ thi');
            $table->decimal('score', 5)->comment('Điểm số');
            $table->integer('max_score')->default(100)->comment('Điểm tối đa');
            $table->text('comments')->nullable()->comment('Nhận xét');
            $table->date('grade_date')->comment('Ngày chấm điểm');
            $table->string('semester')->nullable()->index()->comment('Học kỳ/tháng');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['class_id', 'grade_type_id']);
            $table->index(['student_id', 'class_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('grades');
    }
};
