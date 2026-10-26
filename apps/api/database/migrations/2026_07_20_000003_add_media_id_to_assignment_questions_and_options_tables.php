<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Attach a single Media record to a quiz question and to each answer option.
     *
     * - `assignment_questions.media_id`: audio prompt (English listening) or an image/diagram (Math).
     * - `assignment_question_options.media_id`: an image answer choice.
     *
     * Media is optional — questions/options without media keep working. FK is added only on drivers
     * that support ALTER-add-foreign-key; SQLite keeps the column + index (mirrors the grades migration).
     */
    public function up(): void
    {
        Schema::table('assignment_questions', function (Blueprint $table) {
            $table->unsignedBigInteger('media_id')->nullable()->after('assignment_id')->index();
        });

        Schema::table('assignment_question_options', function (Blueprint $table) {
            $table->unsignedBigInteger('media_id')->nullable()->after('question_id')->index();
        });

        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            Schema::table('assignment_questions', function (Blueprint $table) {
                $table->foreign('media_id')
                    ->references('id')->on('media')
                    ->onUpdate('no action')->onDelete('set null');
            });

            Schema::table('assignment_question_options', function (Blueprint $table) {
                $table->foreign('media_id')
                    ->references('id')->on('media')
                    ->onUpdate('no action')->onDelete('set null');
            });
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            Schema::table('assignment_questions', function (Blueprint $table) {
                $table->dropForeign(['media_id']);
            });

            Schema::table('assignment_question_options', function (Blueprint $table) {
                $table->dropForeign(['media_id']);
            });
        }

        Schema::table('assignment_questions', function (Blueprint $table) {
            $table->dropIndex(['media_id']);
            $table->dropColumn('media_id');
        });

        Schema::table('assignment_question_options', function (Blueprint $table) {
            $table->dropIndex(['media_id']);
            $table->dropColumn('media_id');
        });
    }
};
