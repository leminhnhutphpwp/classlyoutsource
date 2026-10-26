<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Link a grade back to the submission that produced it, so grading a submission can write
     * straight into the gradebook (no double entry) and stay idempotent on re-grade.
     * FK is added only on drivers that support ALTER-add-foreign-key; SQLite keeps column + index.
     */
    public function up(): void
    {
        Schema::table('grades', function (Blueprint $table) {
            $table->unsignedBigInteger('submission_id')->nullable()->after('assignment_id')->index();
        });

        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            Schema::table('grades', function (Blueprint $table) {
                $table->foreign('submission_id')
                    ->references('id')->on('submissions')
                    ->onUpdate('no action')->onDelete('set null');
            });
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            Schema::table('grades', function (Blueprint $table) {
                $table->dropForeign(['submission_id']);
            });
        }

        Schema::table('grades', function (Blueprint $table) {
            $table->dropIndex(['submission_id']);
            $table->dropColumn('submission_id');
        });
    }
};
