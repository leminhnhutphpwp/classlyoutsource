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
        Schema::create('notification_reads', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('notification_id')->index();
            $table->unsignedBigInteger('user_id')->index();
            $table->timestamp('read_at')->useCurrent()->index()->comment('Thời điểm đánh dấu đã đọc');
            $table->timestamps();

            $table->index(['user_id', 'read_at']);
            $table->unique(['notification_id', 'user_id'], 'unique_notification_user_read');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notification_reads');
    }
};
