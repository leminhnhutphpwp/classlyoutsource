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
        Schema::create('assignment_learning_resource', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('assignment_id');
            $table->unsignedBigInteger('learning_resource_id')->index('assignment_learning_resource_learning_resource_id_foreign');
            $table->integer('order')->default(0)->comment('Thứ tự hiển thị');
            $table->timestamps();

            $table->unique(['assignment_id', 'learning_resource_id'], 'assignment_resource_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('assignment_learning_resource');
    }
};
