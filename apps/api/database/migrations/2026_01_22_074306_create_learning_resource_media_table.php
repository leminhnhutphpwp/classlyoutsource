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
        Schema::create('learning_resource_media', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('learning_resource_id')->index();
            $table->unsignedBigInteger('media_id')->index();
            $table->integer('order')->default(0)->comment('Thứ tự hiển thị');
            $table->timestamps();

            $table->foreign('learning_resource_id')->references('id')->on('learning_resources')->onDelete('cascade');
            $table->foreign('media_id')->references('id')->on('media')->onDelete('cascade');

            $table->unique(['learning_resource_id', 'media_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('learning_resource_media');
    }
};
