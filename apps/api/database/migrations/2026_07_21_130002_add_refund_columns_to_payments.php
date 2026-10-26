<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Structured partial refund (design §cash, payment security): a refund is no longer a free-text note —
 * it records refunded_amount + refunded_at on the payment so finance can sum real money returned.
 * refunded_amount is nullable: NULL = never refunded; a value = the exact whole-VND amount returned
 * (full or partial — status 'refunded' with refunded_amount < amount is a PARTIAL refund).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->decimal('refunded_amount', 12, 0)->nullable()->after('amount');
            $table->timestamp('refunded_at')->nullable()->after('refunded_amount');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['refunded_amount', 'refunded_at']);
        });
    }
};
