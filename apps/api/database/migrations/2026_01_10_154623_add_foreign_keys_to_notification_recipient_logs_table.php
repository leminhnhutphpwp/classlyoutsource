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
        Schema::table('notification_recipient_logs', function (Blueprint $table) {
            $table->foreign(['notification_id'])->references(['id'])->on('notifications')->onUpdate('no action')->onDelete('cascade');
            $table->foreign(['student_id'])->references(['id'])->on('students')->onUpdate('no action')->onDelete('set null');
            $table->foreign(['user_id'])->references(['id'])->on('users')->onUpdate('no action')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('notification_recipient_logs', function (Blueprint $table) {
            $table->dropForeign('notification_recipient_logs_notification_id_foreign');
            $table->dropForeign('notification_recipient_logs_student_id_foreign');
            $table->dropForeign('notification_recipient_logs_user_id_foreign');
        });
    }
};
