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
        Schema::table('schedule_sessions', function (Blueprint $table) {
            $table->foreign(['class_id'])->references(['id'])->on('classes')->onUpdate('no action')->onDelete('cascade');
            $table->foreign(['completed_by'])->references(['id'])->on('users')->onUpdate('no action')->onDelete('set null');
            $table->foreign(['schedule_id'])->references(['id'])->on('schedules')->onUpdate('no action')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('schedule_sessions', function (Blueprint $table) {
            $table->dropForeign('schedule_sessions_class_id_foreign');
            $table->dropForeign('schedule_sessions_completed_by_foreign');
            $table->dropForeign('schedule_sessions_schedule_id_foreign');
        });
    }
};
