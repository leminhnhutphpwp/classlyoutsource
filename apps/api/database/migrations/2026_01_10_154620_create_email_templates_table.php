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
        Schema::create('email_templates', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('name')->unique()->comment('Tên template (welcome, etc.)');
            $table->string('slug')->index()->comment('Slug cho query');
            $table->string('subject')->comment('Subject email');
            $table->text('body_html')->nullable()->comment('HTML content (rich text)');
            $table->text('body_text')->nullable()->comment('Plain text fallback');
            $table->json('variables')->nullable()->comment('Available variables: {name}, etc.');
            $table->text('description')->nullable()->comment('Mô tả template');
            $table->string('category')->default('notification')->index()->comment('Phân loại: notification, marketing, system');
            $table->boolean('is_active')->default(true)->index()->comment('Bật/tắt template');
            $table->timestamps();

            $table->unique(['slug']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('email_templates');
    }
};
