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
        Schema::table('lesson_note_learning_resource', function (Blueprint $table) {
            $table->foreign(['learning_resource_id'])->references(['id'])->on('learning_resources')->onUpdate('no action')->onDelete('cascade');
            $table->foreign(['lesson_note_id'])->references(['id'])->on('lesson_notes')->onUpdate('no action')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lesson_note_learning_resource', function (Blueprint $table) {
            $table->dropForeign('lesson_note_learning_resource_learning_resource_id_foreign');
            $table->dropForeign('lesson_note_learning_resource_lesson_note_id_foreign');
        });
    }
};
