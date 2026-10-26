<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Finance hardening (design §cash): an expense now has an explicit SETTLEMENT state so cash reports
 * (P&L/cashflow) only count money actually disbursed, while unpaid bills stay in payables.
 *
 * Backfill for existing rows (deterministic, no silent discard):
 *  - legacy row WITH a payment_method → settled, paid_at = expense_date (recorded as disbursed);
 *  - legacy row WITHOUT a payment_method → unpaid (a payable), paid_at = NULL.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('center_expenses', function (Blueprint $table) {
            $table->string('settlement_status', 20)->default('unpaid')->index()->after('payment_method');
            $table->date('paid_at')->nullable()->after('settlement_status');
            $table->string('payment_reference', 64)->nullable()->after('paid_at');
        });

        DB::table('center_expenses')
            ->whereNotNull('payment_method')
            ->update([
                'settlement_status' => 'settled',
                'paid_at' => DB::raw('expense_date'),
            ]);
    }

    public function down(): void
    {
        Schema::table('center_expenses', function (Blueprint $table) {
            $table->dropColumn(['settlement_status', 'paid_at', 'payment_reference']);
        });
    }
};
