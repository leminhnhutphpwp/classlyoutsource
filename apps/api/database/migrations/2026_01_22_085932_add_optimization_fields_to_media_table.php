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
        Schema::table('media', function (Blueprint $table) {
            $table->string('optimized_path')->nullable()->after('path')->comment('Path to optimized file');
            $table->enum('optimize_status', ['pending', 'processing', 'done', 'failed', 'skipped'])
                ->default('pending')
                ->after('optimized_path')
                ->comment('Optimization status');
            $table->json('optimize_meta')->nullable()->after('optimize_status')->comment('Optimization metadata');
            $table->timestamp('optimized_at')->nullable()->after('optimize_meta');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('media', function (Blueprint $table) {
            $table->dropColumn(['optimized_path', 'optimize_status', 'optimize_meta', 'optimized_at']);
        });
    }
};
