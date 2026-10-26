<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Organization membership pivot with attributes (org_role lives here, NOT in Spatie roles).
 *
 * MVP single-org rule: a user has at most ONE active membership. Enforced softly at the service
 * layer so currentOrganization() = a single `where user_id = me AND status = active` query.
 * The unique(organization_id, user_id) index only prevents duplicate rows in the same org.
 *
 * SQLite-safe: no inline foreign keys; FKs added only on non-sqlite drivers below.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organization_members', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('organization_id')->index();
            $table->unsignedBigInteger('user_id')->index();
            // org_role is an EXTENSIBLE set (owner|manager|accountant|tutor, +receptionist later),
            // so it's a VARCHAR validated by App\Enums\OrgRole at the application layer — NOT a DB enum.
            // A DB enum renders as a CHECK constraint on SQLite; adding a value there needs a table
            // rebuild. String keeps the set open (design §2.1). Kept the index + unique(org,user).
            $table->string('org_role', 20)->default('tutor')->index();
            $table->enum('status', ['active', 'invited', 'removed'])->default('active')->index();
            $table->unsignedBigInteger('invited_by')->nullable();
            $table->timestamp('joined_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['organization_id', 'user_id']);
            $table->index(['user_id', 'status']);
        });

        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            Schema::table('organization_members', function (Blueprint $table) {
                $table->foreign('organization_id')->references('id')->on('organizations')->onUpdate('no action')->onDelete('cascade');
                $table->foreign('user_id')->references('id')->on('users')->onUpdate('no action')->onDelete('cascade');
                $table->foreign('invited_by')->references('id')->on('users')->onUpdate('no action')->onDelete('set null');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('organization_members');
    }
};
