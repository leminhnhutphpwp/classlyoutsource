<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * QR attendance: link an attendance row to the specific ScheduleSession it came from + how it was recorded,
 * and give a session a short human-typable fallback code. Nullable + no inline FK (SQLite-safe).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance', function (Blueprint $table) {
            $table->unsignedBigInteger('schedule_session_id')->nullable()->index()->after('date');
            $table->string('checked_in_via', 20)->nullable()->after('status'); // manual | qr | code
        });

        Schema::table('schedule_sessions', function (Blueprint $table) {
            $table->string('attendance_code', 8)->nullable()->after('status'); // 6-char fallback, set on QR start
        });
    }

    public function down(): void
    {
        Schema::table('attendance', function (Blueprint $table) {
            $table->dropColumn(['schedule_session_id', 'checked_in_via']);
        });

        Schema::table('schedule_sessions', function (Blueprint $table) {
            $table->dropColumn('attendance_code');
        });
    }
};
