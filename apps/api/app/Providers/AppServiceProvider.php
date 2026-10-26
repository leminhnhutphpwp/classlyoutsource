<?php

namespace App\Providers;

use App\Models\Assignment;
use App\Models\AssignmentType;
use App\Models\Attendance;
use App\Models\ClassRoom;
use App\Models\Grade;
use App\Models\GradeLevel;
use App\Models\GradeType;
use App\Models\LearningResource;
use App\Models\Media;
use App\Models\Schedule;
use App\Models\Setting;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Submission;
use App\Models\User;
use App\Observers\AssignmentObserver;
use App\Observers\AssignmentTypeObserver;
use App\Observers\AttendanceObserver;
use App\Observers\ClassRoomObserver;
use App\Observers\GradeLevelObserver;
use App\Observers\GradeObserver;
use App\Observers\GradeTypeObserver;
use App\Observers\LearningResourceObserver;
use App\Observers\MediaObserver;
use App\Observers\ScheduleObserver;
use App\Observers\StudentObserver;
use App\Observers\SubjectObserver;
use App\Observers\SubmissionObserver;
use App\Observers\UserObserver;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Exception Handler handles all authentication exceptions
        // No redirect configuration needed - Exception Handler will return JSON for API requests

        // Register observers
        User::observe(UserObserver::class);
        ClassRoom::observe(ClassRoomObserver::class);
        Assignment::observe(AssignmentObserver::class);
        Schedule::observe(ScheduleObserver::class);
        Submission::observe(SubmissionObserver::class);
        Attendance::observe(AttendanceObserver::class);
        Grade::observe(GradeObserver::class);
        Student::observe(StudentObserver::class);
        Subject::observe(SubjectObserver::class);
        AssignmentType::observe(AssignmentTypeObserver::class);
        GradeType::observe(GradeTypeObserver::class);
        GradeLevel::observe(GradeLevelObserver::class);
        LearningResource::observe(LearningResourceObserver::class);

        // Media optimization observer
        Media::observe(MediaObserver::class);

        $this->loadSystemSettings();
    }

    /**
     * Load system settings from database and apply to config.
     */
    protected function loadSystemSettings(): void
    {
        // Schema::hasTable() chỉ chống THIẾU BẢNG — nó vẫn NÉM EXCEPTION khi không kết nối
        // được database. Provider này chạy ở MỌI lệnh artisan, kể cả những lệnh chạy lúc
        // chưa có DB:
        //   • `composer dump-autoload` → post-autoload-dump → `artisan package:discover`
        //     lúc build Docker (chưa có .env, chưa có MySQL) → build ĐỨT.
        //   • `composer install` trên máy sạch trước khi tạo file sqlite → setup ĐỨT.
        // Đọc cấu hình từ DB chỉ là phần bổ sung: không có DB thì dùng giá trị trong .env,
        // đúng như mong muốn ở giai đoạn build/CLI. Nuốt lỗi kết nối, đừng để nó chặn boot.
        try {
            if (! Schema::hasTable('settings')) {
                return;
            }
        } catch (\Throwable) {
            return;
        }

        $emailSettings = Cache::remember('system_settings_email', 3600, function () {
            return Setting::ofGroup('email')->get()->pluck('value', 'key');
        });

        if ($emailSettings->isEmpty()) {
            return;
        }

        // Map database settings to config keys
        $configMapping = [
            'email.mail_mailer' => 'mail.default',
            'email.mail_host' => 'mail.mailers.smtp.host',
            'email.mail_port' => 'mail.mailers.smtp.port',
            'email.mail_encryption' => 'mail.mailers.smtp.encryption',
            'email.mail_username' => 'mail.mailers.smtp.username',
            'email.mail_password' => 'mail.mailers.smtp.password',
            'email.mail_from_address' => 'mail.from.address',
            'email.mail_from_name' => 'mail.from.name',
        ];

        foreach ($configMapping as $settingKey => $configKey) {
            if ($emailSettings->has($settingKey)) {
                Config::set($configKey, $emailSettings->get($settingKey));
            }
        }

        // Map SePay settings
        $paymentSettings = Cache::remember('system_settings_payment', 3600, function () {
            return Setting::ofGroup('payment')->get()->pluck('value', 'key');
        });

        if ($paymentSettings->isNotEmpty()) {
            if ($paymentSettings->has('payment.sepay_webhook_token')) {
                Config::set('sepay.webhook_token', $paymentSettings->get('payment.sepay_webhook_token'));
            }
        }
    }
}
