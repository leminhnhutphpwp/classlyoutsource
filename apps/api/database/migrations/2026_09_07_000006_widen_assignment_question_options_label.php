<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The `label` column was sized for choice letters (A-D). Matching items store their full
     * item text in `label`, so widen it to 500 (MySQL varchar(10) truncates / errors; the
     * matching take widget renders the item from `label`).
     */
    public function up(): void
    {
        Schema::table('assignment_question_options', function (Blueprint $table) {
            $table->string('label', 500)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('assignment_question_options', function (Blueprint $table) {
            $table->string('label', 10)->nullable()->change();
        });
    }
};
