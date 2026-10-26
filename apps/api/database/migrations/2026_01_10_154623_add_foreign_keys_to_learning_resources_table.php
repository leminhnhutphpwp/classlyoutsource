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
        Schema::table('learning_resources', function (Blueprint $table) {
            $table->foreign(['grade_level_id'])->references(['id'])->on('grade_levels')->onUpdate('no action')->onDelete('set null');
            $table->foreign(['media_id'])->references(['id'])->on('media')->onUpdate('no action')->onDelete('set null');
            $table->foreign(['subject_id'])->references(['id'])->on('subjects')->onUpdate('no action')->onDelete('set null');
            $table->foreign(['tutor_id'])->references(['id'])->on('users')->onUpdate('no action')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('learning_resources', function (Blueprint $table) {
            $table->dropForeign('learning_resources_grade_level_id_foreign');
            $table->dropForeign('learning_resources_media_id_foreign');
            $table->dropForeign('learning_resources_subject_id_foreign');
            $table->dropForeign('learning_resources_tutor_id_foreign');
        });
    }
};
