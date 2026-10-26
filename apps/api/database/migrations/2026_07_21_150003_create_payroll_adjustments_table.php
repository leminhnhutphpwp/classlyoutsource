<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Wave 3 payroll — payroll_adjustments. Manual bonus / deduction / advance / correction against a
 * payslip. This is how an APPROVED/PAID item changes: never an in-place edit (that would break the
 * immutable snapshot), always a NEW adjustment row that folds into the item's adjustments_total on the
 * next fold (design §2.4, §6 risk 4). Org-anchored pattern (b): organization_id NOT NULL + indexed.
 *
 * SQLite-safe: no inline FKs; FKs only on non-sqlite. amount is signed (bonus/advance +, deduction −).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll_adjustments', function (Blueprint $table) {
            $table->bigIncrements('id');

            $table->unsignedBigInteger('organization_id')->index(); // anchor (pattern b)
            $table->unsignedBigInteger('payroll_item_id')->index();

            $table->enum('type', ['bonus', 'deduction', 'advance', 'correction']);
            $table->decimal('amount', 12, 0); // signed: bonus/advance +, deduction/correction may be −
            $table->string('reason'); // required — audit trail
            $table->unsignedBigInteger('created_by');

            $table->softDeletes();
            $table->timestamps();
        });

        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            Schema::table('payroll_adjustments', function (Blueprint $table) {
                $table->foreign('organization_id')->references('id')->on('organizations')->onUpdate('no action')->cascadeOnDelete();
                $table->foreign('payroll_item_id')->references('id')->on('payroll_items')->onUpdate('no action')->cascadeOnDelete();
                $table->foreign('created_by')->references('id')->on('users')->onUpdate('no action')->restrictOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_adjustments');
    }
};
