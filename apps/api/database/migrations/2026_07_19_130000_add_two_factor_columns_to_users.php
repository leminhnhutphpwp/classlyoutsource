<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TOTP two-factor authentication columns on `users`.
 *
 * All three are nullable so existing rows (2FA off) stay valid. The secret and
 * recovery codes are encrypted at the model layer (`encrypted` / `encrypted:array`
 * casts), so the columns hold ciphertext — `text` keeps them SQLite/MySQL safe.
 * A non-null `two_factor_confirmed_at` is the single source of truth for "2FA on".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('two_factor_secret')->nullable()->after('password');
            $table->text('two_factor_recovery_codes')->nullable()->after('two_factor_secret');
            $table->timestamp('two_factor_confirmed_at')->nullable()->after('two_factor_recovery_codes');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'two_factor_secret',
                'two_factor_recovery_codes',
                'two_factor_confirmed_at',
            ]);
        });
    }
};
