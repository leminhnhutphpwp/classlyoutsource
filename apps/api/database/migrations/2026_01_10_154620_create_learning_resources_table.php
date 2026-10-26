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
        Schema::create('learning_resources', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tutor_id')->index();
            $table->unsignedBigInteger('media_id')->nullable()->index();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('type')->default('document')->index()->comment('document, video, image, audio, link, other');
            $table->unsignedBigInteger('subject_id')->nullable()->index();
            $table->unsignedBigInteger('grade_level_id')->nullable()->index();
            $table->string('subject')->nullable()->index()->comment('Môn học');
            $table->string('topic')->nullable()->comment('Chủ đề');
            $table->string('grade_level')->nullable()->comment('Cấp độ/Khối');
            $table->json('tags')->nullable()->comment('Tags để tìm kiếm');
            $table->string('external_url')->nullable()->comment('Link bên ngoài (YouTube, Drive, etc)');
            $table->integer('downloads')->default(0)->comment('Số lần tải');
            $table->integer('views')->default(0)->comment('Số lần xem');
            $table->boolean('is_public')->default(false)->comment('Chia sẻ với tutors khác');
            $table->enum('status', ['active', 'archived'])->default('active')->index();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('learning_resources');
    }
};
