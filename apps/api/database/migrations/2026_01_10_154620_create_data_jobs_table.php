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
        Schema::create('data_jobs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('type');
            $table->string('module');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('status')->default('processing');
            $table->string('file_name')->nullable();
            $table->string('format')->nullable();
            $table->unsignedInteger('total_rows')->nullable();
            $table->unsignedInteger('success_count')->nullable();
            $table->unsignedInteger('failed_count')->nullable();
            $table->unsignedInteger('skipped_count')->nullable();
            $table->string('download_path')->nullable();
            $table->text('message')->nullable();
            $table->json('meta')->nullable();
            $table->string('ip')->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'type', 'module', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('data_jobs');
    }
};
