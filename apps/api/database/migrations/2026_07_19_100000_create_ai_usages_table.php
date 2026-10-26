<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Cost-metering ledger for AI calls. One row per successful Anthropic call.
     * Mirrors the intent of notification_logs.cost so AI spend is auditable per user/feature.
     */
    public function up(): void
    {
        Schema::create('ai_usages', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('feature', 30); // grade | generate
            $table->string('model', 64);
            $table->unsignedInteger('input_tokens')->default(0);
            $table->unsignedInteger('output_tokens')->default(0);
            $table->decimal('estimated_cost', 12, 6)->default(0); // USD
            // Polymorphic link to the thing the call was about (submission / assignment).
            $table->nullableMorphs('subject');
            $table->timestamp('created_at')->nullable();

            $table->index(['user_id', 'feature']);
            $table->index(['feature', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_usages');
    }
};
