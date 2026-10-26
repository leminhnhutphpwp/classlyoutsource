<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        echo "\n";
        echo "═══════════════════════════════════════════════════════════\n";
        echo "      BẮT ĐẦU SEED DATABASE (HỆ THỐNG GIA SƯ)         \n";
        echo "═══════════════════════════════════════════════════════════\n";
        echo "\n";

        echo "📋 Đang cài đặt hệ thống...\n";
        $this->call([
            SystemSettingsSeeder::class,
            NotificationChannelSeeder::class,
            EmailTemplateSeeder::class,
            PermissionSeeder::class,
            AssignRolesToUsersSeeder::class,

            // Master Data
            SubjectSeeder::class,
            GradeLevelSeeder::class,
            AssignmentTypeSeeder::class,
            GradeTypeSeeder::class,
        ]);
        echo "✅ Đã cài đặt hệ thống!\n\n";

        // ===========================
        // 1. TẠO QUẢN TRỊ VIÊN HỆ THỐNG
        // ===========================
        echo "👤 Đang tạo/kiểm tra quản trị viên...\n";

        $adminEmail = env('SEED_ADMIN_EMAIL', 'admin@classly.io.vn'); // Default Super Admin
        // Set SEED_ADMIN_PASSWORD in .env; otherwise a random one is generated and printed once.
        $adminPassword = env('SEED_ADMIN_PASSWORD') ?: Str::random(20);
        $admin = User::firstOrCreate(
            ['email' => $adminEmail],
            [
                'name' => 'Quản Trị Viên',
                'password' => Hash::make($adminPassword),
                'role' => 'super_admin',
                'phone' => null,
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );

        if ($admin->wasRecentlyCreated && ! env('SEED_ADMIN_PASSWORD')) {
            echo "🔑 Mật khẩu admin ({$adminEmail}): {$adminPassword} — đổi ngay sau khi đăng nhập.\n";
        }

        if (! $admin->hasRole('super_admin')) {
            $admin->assignRole('super_admin');
        }

        echo "✅ Quản trị viên: {$admin->email}\n\n";

        // ===========================
        // 2. DỮ LIỆU DEMO TRUNG TÂM (showcase)
        // ===========================
        echo "🎬 Đang tạo dữ liệu demo trung tâm...\n";
        $this->call(DemoDataSeeder::class);

        // ===========================
        // 2b. ĐỀ MẪU LUYỆN THI IELTS/TOEIC (question-type registry showcase)
        // ===========================
        echo "🎓 Đang tạo đề mẫu luyện thi IELTS/TOEIC...\n";
        $this->call(ExamDemoSeeder::class);

        // ===========================
        // 3. DỌN DẸP CACHE
        // ===========================
        echo "🧹 Đang dọn dẹp cache...\n";
        Artisan::call('permission:cache-reset');
        Artisan::call('config:clear');
        Artisan::call('cache:clear');
        echo "✅ Đã dọn dẹp cache hệ thống!\n\n";

        echo "\n";
        echo "═══════════════════════════════════════════════════════════\n";
        echo "             🎉 HOÀN THÀNH SEED DATABASE 🎉              \n";
        echo "═══════════════════════════════════════════════════════════\n";
    }
}
