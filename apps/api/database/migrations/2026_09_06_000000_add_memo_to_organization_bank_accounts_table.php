<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Mã gợi nhớ (memo) — nội dung chuyển khoản mặc định gắn với tài khoản ngân hàng
     * của trung tâm, được điền sẵn khi tạo mã QR chuyển khoản học phí.
     */
    public function up(): void
    {
        Schema::table('organization_bank_accounts', function (Blueprint $table) {
            $table->string('memo')->nullable()->after('branch');
        });
    }

    public function down(): void
    {
        Schema::table('organization_bank_accounts', function (Blueprint $table) {
            $table->dropColumn('memo');
        });
    }
};
