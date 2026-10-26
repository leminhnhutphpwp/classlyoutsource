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
        Schema::table('lesson_notes', function (Blueprint $table) {
            $table->foreign(['class_id'])->references(['id'])->on('classes')->onUpdate('no action')->onDelete('cascade');
            $table->foreign(['tutor_id'])->references(['id'])->on('users')->onUpdate('no action')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lesson_notes', function (Blueprint $table) {
            $table->dropForeign('lesson_notes_class_id_foreign');
            $table->dropForeign('lesson_notes_tutor_id_foreign');
        });
    }
};
