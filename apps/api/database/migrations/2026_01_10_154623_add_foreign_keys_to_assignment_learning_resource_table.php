<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('assignment_learning_resource', function (Blueprint $table) {
            $table->foreign(['assignment_id'])->references(['id'])->on('assignments')->onUpdate('no action')->onDelete('cascade');
            $table->foreign(['learning_resource_id'])->references(['id'])->on('learning_resources')->onUpdate('no action')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('assignment_learning_resource', function (Blueprint $table) {
            $table->dropForeign('assignment_learning_resource_assignment_id_foreign');
            $table->dropForeign('assignment_learning_resource_learning_resource_id_foreign');
        });
    }
};
