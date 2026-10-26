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
        Schema::create('notification_recipient_logs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('notification_id');
            $table->unsignedBigInteger('user_id')->nullable()->index('notification_recipient_logs_user_id_foreign');
            $table->unsignedBigInteger('student_id')->nullable()->index('notification_recipient_logs_student_id_foreign');
            $table->string('email')->nullable();
            $table->string('channel')->default('email');
            $table->string('status')->default('pending');
            $table->unsignedInteger('attempt')->default(0);
            $table->timestamp('sent_at')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();

            $table->index(['notification_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notification_recipient_logs');
    }
};
