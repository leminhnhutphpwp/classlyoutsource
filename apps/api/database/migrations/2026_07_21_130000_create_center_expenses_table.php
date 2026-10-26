<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Wave 2 finance — center_expenses. The ONLY new finance table (revenue reuses payments,
 * receivables reuse payment_requests). Anchored with pattern (b) org-column: an expense (rent,
 * marketing, ...) does NOT belong to a class, so it carries its OWN organization_id (NOT NULL,
 * indexed) and is isolated directly by where('organization_id', $orgId) — see design §2.5.
 *
 * SQLite-safe: additive, nullable where optional; FKs added ONLY on non-sqlite drivers (SQLite can't
 * ALTER TABLE ADD CONSTRAINT). Money = decimal(12,0) (VND integer — wider than payments.amount(10,0)
 * because rent/payroll-adjacent totals can exceed 10 digits). category/payment_method are VARCHAR so
 * the category set can evolve without a migration.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('center_expenses', function (Blueprint $table) {
            $table->bigIncrements('id');

            // Anchor — org-column isolation (pattern b). NOT NULL: an expense always has an owning org.
            $table->unsignedBigInteger('organization_id')->index();

            $table->string('category', 50)->index();
            $table->decimal('amount', 12, 0);
            $table->date('expense_date')->index();
            $table->string('description', 255)->nullable();

            // Optional attribution for per-class / per-tutor profit (Wave 4). NULL class_id = overhead.
            $table->unsignedBigInteger('class_id')->nullable()->index();
            $table->unsignedBigInteger('tutor_id')->nullable()->index();

            $table->string('payment_method', 20)->nullable();
            $table->unsignedBigInteger('created_by')->index();

            $table->softDeletes();
            $table->timestamps();
        });

        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            Schema::table('center_expenses', function (Blueprint $table) {
                $table->foreign('organization_id')->references('id')->on('organizations')->onUpdate('no action')->cascadeOnDelete();
                $table->foreign('class_id')->references('id')->on('classes')->onUpdate('no action')->nullOnDelete();
                $table->foreign('tutor_id')->references('id')->on('users')->onUpdate('no action')->nullOnDelete();
                $table->foreign('created_by')->references('id')->on('users')->onUpdate('no action')->restrictOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('center_expenses');
    }
};
