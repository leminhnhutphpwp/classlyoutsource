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
        Schema::create('settings', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('key')->index()->comment('Tên setting (VD: smtp_host, zalo_api_key)');
            $table->text('value')->nullable()->comment('Giá trị setting');
            $table->string('type')->default('string')->comment('Loại dữ liệu: string, boolean, json, array');
            $table->string('group')->default('general')->index()->comment('Nhóm: email, payment, notification, landing_page, backup');
            $table->text('description')->nullable()->comment('Mô tả setting');
            $table->boolean('is_public')->default(false)->comment('Hiển thị trong config công khai');
            $table->boolean('is_encrypted')->default(false)->comment('Mã hóa giá trị');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
