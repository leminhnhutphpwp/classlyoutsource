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
        Schema::table('assignments', function (Blueprint $table) {
            $table->foreign(['assignment_type_id'])->references(['id'])->on('assignment_types')->onUpdate('no action')->onDelete('set null');
            $table->foreign(['class_id'])->references(['id'])->on('classes')->onUpdate('no action')->onDelete('cascade');
            $table->foreign(['tutor_id'], 'assignments_teacher_id_foreign')->references(['id'])->on('users')->onUpdate('no action')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('assignments', function (Blueprint $table) {
            $table->dropForeign('assignments_assignment_type_id_foreign');
            $table->dropForeign('assignments_class_id_foreign');
            $table->dropForeign('assignments_teacher_id_foreign');
        });
    }
};
