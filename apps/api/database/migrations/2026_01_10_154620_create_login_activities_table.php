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
        Schema::create('login_activities', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('email')->nullable()->index();
            $table->boolean('is_success')->default(false);
            $table->string('status', 50)->default('unknown')->index();
            $table->string('ip_address', 45)->nullable();
            $table->string('device_id', 64)->nullable();
            $table->string('device_name')->nullable();
            $table->string('location')->nullable();
            $table->string('user_agent')->nullable();
            $table->text('message')->nullable();
            $table->json('context')->nullable();
            $table->timestamp('logged_in_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'logged_in_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('login_activities');
    }
};
