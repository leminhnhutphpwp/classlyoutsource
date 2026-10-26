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
        Schema::table('grades', function (Blueprint $table) {
            $table->foreign(['assignment_id'])->references(['id'])->on('assignments')->onUpdate('no action')->onDelete('set null');
            $table->foreign(['class_id'])->references(['id'])->on('classes')->onUpdate('no action')->onDelete('cascade');
            $table->foreign(['grade_type_id'])->references(['id'])->on('grade_types')->onUpdate('no action')->onDelete('set null');
            $table->foreign(['student_id'])->references(['id'])->on('students')->onUpdate('no action')->onDelete('cascade');
            $table->foreign(['tutor_id'])->references(['id'])->on('users')->onUpdate('no action')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('grades', function (Blueprint $table) {
            $table->dropForeign('grades_assignment_id_foreign');
            $table->dropForeign('grades_class_id_foreign');
            $table->dropForeign('grades_grade_type_id_foreign');
            $table->dropForeign('grades_student_id_foreign');
            $table->dropForeign('grades_tutor_id_foreign');
        });
    }
};
