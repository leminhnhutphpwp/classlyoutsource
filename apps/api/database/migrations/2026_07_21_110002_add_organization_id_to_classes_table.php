<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds classes.organization_id (nullable). NULL = solo tutor's private class (invisible to any org);
 * a value = the class belongs to that organization, with classes.tutor_id as the lead teacher.
 *
 * FK is nullOnDelete so soft/hard org removal leaves classes intact as solo. Added only on
 * non-sqlite drivers (SQLite can't ALTER TABLE ADD CONSTRAINT); the nullable index is enough on SQLite.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('classes', function (Blueprint $table) {
            $table->unsignedBigInteger('organization_id')->nullable()->after('tutor_id')->index();
        });

        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            Schema::table('classes', function (Blueprint $table) {
                $table->foreign('organization_id')->references('id')->on('organizations')->onUpdate('no action')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            Schema::table('classes', function (Blueprint $table) {
                $table->dropForeign(['organization_id']);
            });
        }

        Schema::table('classes', function (Blueprint $table) {
            $table->dropIndex(['organization_id']);
            $table->dropColumn('organization_id');
        });
    }
};
