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
        Schema::create('notification_channels', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('channel', 50)->unique();
            $table->boolean('is_enabled')->default(false);
            $table->string('provider', 50)->nullable();
            $table->text('api_key')->nullable();
            $table->text('api_secret')->nullable();
            $table->json('config')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notification_channels');
    }
};
