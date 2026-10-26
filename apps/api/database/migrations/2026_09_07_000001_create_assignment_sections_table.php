<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A "section" (phần thi) groups questions inside a quiz assignment: IELTS Listening Part 1–4,
     * Reading Passage 1–3, TOEIC parts... Each section carries its own title, instruction and an
     * optional media prompt (the listening audio, a reading passage image, ...).
     *
     * Questions attach to a section via `assignment_questions.section_id` (nullable — legacy
     * flat quizzes keep working as an implicit single default section).
     */
    public function up(): void
    {
        Schema::create('assignment_sections', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('assignment_id')->index();
            // listening | reading | writing | speaking | general — rendered by the exam engine.
            $table->string('section_type', 30)->default('general');
            $table->string('title');
            $table->text('instruction')->nullable()->comment('Hướng dẫn riêng của phần thi');
            $table->unsignedBigInteger('media_id')->nullable()->index()->comment('Audio của part nghe / ảnh passage');
            $table->unsignedInteger('order')->default(1);
            $table->json('settings')->nullable()->comment('settings riêng: max_plays, transcript... ');
            $table->timestamps();

            $table->index(['assignment_id', 'order']);
        });

        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            Schema::table('assignment_sections', function (Blueprint $table) {
                $table->foreign('assignment_id')
                    ->references('id')->on('assignments')
                    ->onUpdate('no action')->onDelete('cascade');
                $table->foreign('media_id')
                    ->references('id')->on('media')
                    ->onUpdate('no action')->onDelete('set null');
            });
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            Schema::table('assignment_sections', function (Blueprint $table) {
                $table->dropForeign(['assignment_id']);
                $table->dropForeign(['media_id']);
            });
        }

        Schema::dropIfExists('assignment_sections');
    }
};
