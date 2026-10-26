<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('class_student', function (Blueprint $table) {
            // When a paused enrollment is resumed we stamp this; paused/resumed are cleared as the pair flips.
            $table->timestamp('resumed_at')->nullable()->after('paused_at')->comment('Thời điểm kích hoạt lại');
        });
    }

    public function down(): void
    {
        Schema::table('class_student', function (Blueprint $table) {
            $table->dropColumn('resumed_at');
        });
    }
};
