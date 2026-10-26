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
        Schema::create('lesson_note_learning_resource', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('lesson_note_id')->index();
            $table->unsignedBigInteger('learning_resource_id')->index();
            $table->integer('order')->default(0)->index()->comment('Thứ tự hiển thị');
            $table->timestamps();

            $table->unique(['lesson_note_id', 'learning_resource_id'], 'lesson_note_resource_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('lesson_note_learning_resource');
    }
};
