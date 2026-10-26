<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Adds a per-code failed-attempt counter so a 6-digit reset code can be
     * invalidated after a small number of wrong guesses (fail closed against
     * cross-IP brute force within the 15-minute TTL). SQLite-safe.
     */
    public function up(): void
    {
        Schema::table('password_reset_codes', function (Blueprint $table) {
            $table->unsignedTinyInteger('attempts')->default(0);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('password_reset_codes', function (Blueprint $table) {
            $table->dropColumn('attempts');
        });
    }
};
