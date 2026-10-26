<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Attach a question to its exam section (Listening Part, Reading Passage...).
     * Nullable: legacy flat quizzes (no sections) keep section_id = NULL and are treated as a
     * single implicit default section.
     * FK is added only on drivers that support ALTER-add-foreign-key; SQLite keeps column + index
     * (mirrors the media_id migration).
     */
    public function up(): void
    {
        Schema::table('assignment_questions', function (Blueprint $table) {
            $table->unsignedBigInteger('section_id')->nullable()->after('assignment_id')->index();
        });

        Schema::table('assignment_questions', function (Blueprint $table) {
            $table->index(['section_id', 'order']);
        });

        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            Schema::table('assignment_questions', function (Blueprint $table) {
                $table->foreign('section_id')
                    ->references('id')->on('assignment_sections')
                    ->onUpdate('no action')->onDelete('cascade');
            });
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            Schema::table('assignment_questions', function (Blueprint $table) {
                $table->dropForeign(['section_id']);
            });
        }

        Schema::table('assignment_questions', function (Blueprint $table) {
            $table->dropIndex(['section_id', 'order']);
            $table->dropIndex(['section_id']);
            $table->dropColumn('section_id');
        });
    }
};
