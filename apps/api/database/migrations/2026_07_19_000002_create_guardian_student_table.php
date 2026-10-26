<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Guardian ⇄ Student link. A parent User may guard many Students; a Student may have many guardians.
 * Mirrors the class_student pivot (indexes, no inline FK for SQLite compatibility; isolation is enforced
 * in query scoping, not DB FKs).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('guardian_student', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id')->index()->comment('Tài khoản phụ huynh (User role=parent)');
            $table->unsignedBigInteger('student_id')->index();
            $table->string('relationship', 50)->nullable()->comment('mother/father/guardian...');
            $table->boolean('is_primary')->default(false);
            $table->enum('status', ['active', 'revoked'])->default('active')->index();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['user_id', 'student_id']);
            $table->index(['student_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('guardian_student');
    }
};
