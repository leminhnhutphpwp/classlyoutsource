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
        Schema::create('notification_logs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('notification_type', 100);
            $table->string('channel', 50);
            $table->string('status', 50)->default('pending');
            $table->string('recipient');
            $table->text('content')->nullable();
            $table->text('error_message')->nullable();
            $table->json('metadata')->nullable();
            $table->decimal('cost', 10)->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();

            $table->index(['channel', 'status']);
            $table->index(['notification_type', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notification_logs');
    }
};
