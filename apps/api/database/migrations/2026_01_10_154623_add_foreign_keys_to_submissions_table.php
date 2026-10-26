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
        Schema::table('submissions', function (Blueprint $table) {
            $table->foreign(['assignment_id'])->references(['id'])->on('assignments')->onUpdate('no action')->onDelete('cascade');
            $table->foreign(['graded_by'])->references(['id'])->on('users')->onUpdate('no action')->onDelete('set null');
            $table->foreign(['media_id'])->references(['id'])->on('media')->onUpdate('no action')->onDelete('set null');
            $table->foreign(['student_id'])->references(['id'])->on('students')->onUpdate('no action')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('submissions', function (Blueprint $table) {
            $table->dropForeign('submissions_assignment_id_foreign');
            $table->dropForeign('submissions_graded_by_foreign');
            $table->dropForeign('submissions_media_id_foreign');
            $table->dropForeign('submissions_student_id_foreign');
        });
    }
};
