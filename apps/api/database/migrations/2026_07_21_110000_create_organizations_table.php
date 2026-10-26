<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Organizations (trung tâm / multi-tutor). An additive tenant layer over the existing
 * single-tutor model — a ClassRoom may optionally belong to one organization.
 *
 * SQLite-safe: no inline foreign keys (mirrors guardian_student); the FK is added only on
 * non-sqlite drivers below. Isolation is enforced at the query layer, not by DB FKs.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organizations', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('owner_id')->index()->comment('User chủ trung tâm (role=tutor, org_role=owner)');
            $table->string('name');
            $table->string('slug', 120)->unique();
            $table->text('description')->nullable();
            $table->unsignedBigInteger('logo_media_id')->nullable();
            $table->json('settings')->nullable();
            $table->enum('status', ['active', 'suspended'])->default('active')->index();
            $table->timestamps();
            $table->softDeletes();
        });

        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            Schema::table('organizations', function (Blueprint $table) {
                $table->foreign('owner_id')->references('id')->on('users')->onUpdate('no action')->onDelete('cascade');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('organizations');
    }
};
