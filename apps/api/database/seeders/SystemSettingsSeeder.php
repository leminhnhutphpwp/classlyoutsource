<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SystemSettingsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $settings = [
            // ==========================================
            // GENERAL SETTINGS
            // ==========================================
            [
                'key' => 'site_name',
                'value' => 'Classly',
                'type' => 'string',
                'group' => 'general',
                'description' => 'Tên website',
                'is_public' => true,
            ],
            [
                'key' => 'site_url',
                'value' => config('app.url'),
                'type' => 'string',
                'group' => 'general',
                'description' => 'URL chính của website',
                'is_public' => true,
            ],
            [
                'key' => 'admin_email',
                'value' => 'admin@classly.test',
                'type' => 'string',
                'group' => 'general',
                'description' => 'Email admin nhận thông báo',
                'is_public' => false,
            ],
            [
                'key' => 'support_email',
                'value' => 'support@classly.test',
                'type' => 'string',
                'group' => 'general',
                'description' => 'Email support cho khách hàng',
                'is_public' => true,
            ],
            [
                'key' => 'support_phone',
                'value' => '0901234567',
                'type' => 'string',
                'group' => 'general',
                'description' => 'Số điện thoại hỗ trợ',
                'is_public' => true,
            ],
            [
                'key' => 'timezone',
                'value' => 'Asia/Ho_Chi_Minh',
                'type' => 'string',
                'group' => 'general',
                'description' => 'Timezone mặc định',
                'is_public' => true,
            ],
            [
                'key' => 'locale',
                'value' => 'vi',
                'type' => 'string',
                'group' => 'general',
                'description' => 'Ngôn ngữ mặc định',
                'is_public' => true,
            ],
            [
                'key' => 'currency',
                'value' => 'VND',
                'type' => 'string',
                'group' => 'general',
                'description' => 'Đơn vị tiền tệ',
                'is_public' => true,
            ],
            [
                'key' => 'maintenance_mode',
                'value' => 'false',
                'type' => 'boolean',
                'group' => 'general',
                'description' => 'Chế độ bảo trì',
                'is_public' => false,
            ],
            [
                'key' => 'maintenance_message',
                'value' => 'Hệ thống đang bảo trì để nâng cấp. Vui lòng quay lại sau.',
                'type' => 'string',
                'group' => 'general',
                'description' => 'Thông báo bảo trì',
                'is_public' => true,
            ],
            [
                'key' => 'welcome_title',
                'value' => 'Chào mừng đến với Classly!',
                'type' => 'string',
                'group' => 'general',
                'description' => 'Tiêu đề chào mừng Dashboard',
                'is_public' => true,
            ],
            [
                'key' => 'welcome_content',
                'value' => 'Chúng tôi rất vui được đồng hành cùng bạn trong hành trình giảng dạy chuyên nghiệp.',
                'type' => 'string',
                'group' => 'general',
                'description' => 'Nội dung chào mừng Dashboard',
                'is_public' => true,
            ],

            // ==========================================
            // PAYMENT SETTINGS
            // ==========================================
            [
                'key' => 'bank_transfer_enabled',
                'value' => 'true',
                'type' => 'boolean',
                'group' => 'payment',
                'description' => 'Kích hoạt chuyển khoản ngân hàng',
                'is_public' => true,
            ],
            [
                'key' => 'bank_name',
                'value' => '[TÊN NGÂN HÀNG]',
                'type' => 'string',
                'group' => 'payment',
                'description' => 'Tên ngân hàng',
                'is_public' => true,
            ],
            [
                'key' => 'bank_account_number',
                'value' => '[SỐ TÀI KHOẢN]',
                'type' => 'string',
                'group' => 'payment',
                'description' => 'Số tài khoản',
                'is_public' => true,
            ],
            [
                'key' => 'bank_account_holder',
                'value' => '[CHỦ TÀI KHOẢN]',
                'type' => 'string',
                'group' => 'payment',
                'description' => 'Chủ tài khoản',
                'is_public' => true,
            ],
            [
                'key' => 'bank_branch',
                'value' => '[CHI NHÁNH]',
                'type' => 'string',
                'group' => 'payment',
                'description' => 'Chi nhánh ngân hàng',
                'is_public' => true,
            ],
            [
                'key' => 'bank_transfer_instructions',
                'value' => "Nội dung chuyển khoản: CLASSLY [Mã đơn hàng]\nVD: CLASSLY ORD123456\n\nSau khi chuyển khoản, vui lòng chụp ảnh bill và gửi cho admin để xác nhận.",
                'type' => 'string',
                'group' => 'payment',
                'description' => 'Hướng dẫn chuyển khoản',
                'is_public' => true,
            ],
            [
                'key' => 'bank_transfer_content_template',
                'value' => 'CLASSLY [Mã đơn hàng]',
                'type' => 'string',
                'group' => 'payment',
                'description' => 'Template nội dung chuyển khoản',
                'is_public' => true,
            ],
            [
                'key' => 'bank_auto_verify',
                'value' => 'false',
                'type' => 'boolean',
                'group' => 'payment',
                'description' => 'Tự động xác nhận (SePay)',
                'is_public' => false,
            ],
            [
                'key' => 'sepay_webhook_token',
                'value' => null,
                'type' => 'string',
                'group' => 'payment',
                'description' => 'SePay Webhook Token',
                'is_public' => false,
                'is_encrypted' => true,
            ],

            // ==========================================
            // EMAIL SETTINGS (SMTP)
            // ==========================================
            [
                'key' => 'mail_mailer',
                'value' => config('mail.default', 'smtp'),
                'type' => 'string',
                'group' => 'email',
                'description' => 'Mail driver',
                'is_public' => false,
            ],
            [
                'key' => 'mail_host',
                'value' => config('mail.mailers.smtp.host', 'smtp.gmail.com'),
                'type' => 'string',
                'group' => 'email',
                'description' => 'SMTP Host',
                'is_public' => false,
            ],
            [
                'key' => 'mail_port',
                'value' => (string) config('mail.mailers.smtp.port', 587),
                'type' => 'integer',
                'group' => 'email',
                'description' => 'SMTP Port',
                'is_public' => false,
            ],
            [
                'key' => 'mail_encryption',
                'value' => config('mail.mailers.smtp.encryption', 'tls'),
                'type' => 'string',
                'group' => 'email',
                'description' => 'SMTP Encryption',
                'is_public' => false,
            ],
            [
                'key' => 'mail_username',
                'value' => config('mail.mailers.smtp.username'),
                'type' => 'string',
                'group' => 'email',
                'description' => 'SMTP Username',
                'is_public' => false,
            ],
            [
                'key' => 'mail_password',
                'value' => config('mail.mailers.smtp.password'),
                'type' => 'string',
                'group' => 'email',
                'description' => 'SMTP Password',
                'is_public' => false,
                'is_encrypted' => true,
            ],
            [
                'key' => 'mail_from_address',
                'value' => config('mail.from.address', 'hello@example.com'),
                'type' => 'string',
                'group' => 'email',
                'description' => 'From Email',
                'is_public' => false,
            ],
            [
                'key' => 'mail_from_name',
                'value' => config('mail.from.name', 'Classly'),
                'type' => 'string',
                'group' => 'email',
                'description' => 'From Name',
                'is_public' => false,
            ],

            // ==========================================
            // NOTIFICATION CONFIGURATION
            // ==========================================
            // Toggles & Days
            [
                'key' => 'welcome_email',
                'value' => 'true',
                'type' => 'boolean',
                'group' => 'notification',
                'description' => 'Gửi email chào mừng',
                'is_public' => false,
            ],
            [
                'key' => 'reminder_schedule_days_before',
                'value' => '1',
                'type' => 'integer',
                'group' => 'notification',
                'description' => 'Nhắc lịch học trước (ngày)',
                'is_public' => false,
            ],
            [
                'key' => 'reminder_assignment_days_before',
                'value' => '3',
                'type' => 'integer',
                'group' => 'notification',
                'description' => 'Nhắc bài tập trước (ngày)',
                'is_public' => false,
            ],
            [
                'key' => 'reminder_payment_days_before',
                'value' => '3',
                'type' => 'integer',
                'group' => 'notification',
                'description' => 'Nhắc học phí trước (ngày)',
                'is_public' => false,
            ],

            // Template Selections
            [
                'key' => 'template_announcement',
                'value' => 'announcement',
                'type' => 'string',
                'group' => 'notification',
                'description' => 'Template: Thông báo chung',
                'is_public' => false,
            ],
            [
                'key' => 'template_reminder',
                'value' => 'reminder',
                'type' => 'string',
                'group' => 'notification',
                'description' => 'Template: Nhắc nhở',
                'is_public' => false,
            ],
            [
                'key' => 'template_welcome',
                'value' => 'welcome',
                'type' => 'string',
                'group' => 'notification',
                'description' => 'Template: Chào mừng',
                'is_public' => false,
            ],
            [
                'key' => 'template_password_reset',
                'value' => 'password-reset',
                'type' => 'string',
                'group' => 'notification',
                'description' => 'Template: Quên mật khẩu',
                'is_public' => false,
            ],
            [
                'key' => 'template_email_verification',
                'value' => 'email-verification',
                'type' => 'string',
                'group' => 'notification',
                'description' => 'Template: Xác thực email',
                'is_public' => false,
            ],
            [
                'key' => 'template_new_submission',
                'value' => 'new_submission',
                'type' => 'string',
                'group' => 'notification',
                'description' => 'Template: Bài nộp mới',
                'is_public' => false,
            ],
            [
                'key' => 'template_daily_schedule_reminder',
                'value' => 'daily_schedule_reminder',
                'type' => 'string',
                'group' => 'notification',
                'description' => 'Template: Nhắc lịch học hằng ngày',
                'is_public' => false,
            ],
            [
                'key' => 'template_attendance_reminder',
                'value' => 'attendance_reminder',
                'type' => 'string',
                'group' => 'notification',
                'description' => 'Template: Nhắc điểm danh',
                'is_public' => false,
            ],

            // ==========================================
            // SECURITY SETTINGS
            // ==========================================
            // Rate Limiting
            [
                'key' => 'rate_limiting_api_authenticated_max_attempts',
                'value' => 120,
                'type' => 'integer',
                'group' => 'security',
                'description' => 'API Auth Max Attempts',
                'is_public' => false,
            ],
            [
                'key' => 'rate_limiting_api_authenticated_decay_minutes',
                'value' => 1,
                'type' => 'integer',
                'group' => 'security',
                'description' => 'API Auth Decay',
                'is_public' => false,
            ],
            [
                'key' => 'rate_limiting_api_public_max_attempts',
                'value' => 80,
                'type' => 'integer',
                'group' => 'security',
                'description' => 'API Public Max Attempts',
                'is_public' => false,
            ],
            [
                'key' => 'rate_limiting_api_public_decay_minutes',
                'value' => 1,
                'type' => 'integer',
                'group' => 'security',
                'description' => 'API Public Decay',
                'is_public' => false,
            ],

            // DDoS Protection
            [
                'key' => 'ddos_protection_max_request_size_mb',
                'value' => 10,
                'type' => 'integer',
                'group' => 'security',
                'description' => 'Max Request Size (MB)',
                'is_public' => false,
            ],
            [
                'key' => 'ddos_protection_ip_rate_limit_per_minute',
                'value' => 100,
                'type' => 'integer',
                'group' => 'security',
                'description' => 'IP Rate Limit',
                'is_public' => false,
            ],
            [
                'key' => 'ddos_protection_auto_block_threshold',
                'value' => 200,
                'type' => 'integer',
                'group' => 'security',
                'description' => 'Auto Block Threshold',
                'is_public' => false,
            ],
            [
                'key' => 'ddos_protection_auto_block_suspicious_count',
                'value' => 5,
                'type' => 'integer',
                'group' => 'security',
                'description' => 'Suspicious Count Threshold',
                'is_public' => false,
            ],
            [
                'key' => 'ddos_protection_ip_block_duration_minutes',
                'value' => 60,
                'type' => 'integer',
                'group' => 'security',
                'description' => 'IP Block Duration',
                'is_public' => false,
            ],

            // BotShield
            [
                'key' => 'bot_shield_classes_per_minute',
                'value' => 3, 'type' => 'integer', 'group' => 'security', 'is_public' => false, 'description' => 'Classes per minute',
            ],
            [
                'key' => 'bot_shield_classes_per_hour',
                'value' => 15, 'type' => 'integer', 'group' => 'security', 'is_public' => false, 'description' => 'Classes per hour',
            ],
            [
                'key' => 'bot_shield_students_per_minute',
                'value' => 5, 'type' => 'integer', 'group' => 'security', 'is_public' => false, 'description' => 'Students per minute',
            ],
            [
                'key' => 'bot_shield_students_per_hour',
                'value' => 40, 'type' => 'integer', 'group' => 'security', 'is_public' => false, 'description' => 'Students per hour',
            ],
            [
                'key' => 'bot_shield_submissions_per_minute',
                'value' => 10, 'type' => 'integer', 'group' => 'security', 'is_public' => false, 'description' => 'Submissions per minute',
            ],
            [
                'key' => 'bot_shield_submissions_per_hour',
                'value' => 100, 'type' => 'integer', 'group' => 'security', 'is_public' => false, 'description' => 'Submissions per hour',
            ],

            // Invites Limits
            [
                'key' => 'invites_per_user_max',
                'value' => 5, 'type' => 'integer', 'group' => 'security', 'is_public' => false, 'description' => 'Max invites per request',
            ],
            [
                'key' => 'invites_per_user_window_minutes',
                'value' => 60, 'type' => 'integer', 'group' => 'security', 'is_public' => false, 'description' => 'Invite rate limit window',
            ],
            [
                'key' => 'invites_per_user_daily_max',
                'value' => 20, 'type' => 'integer', 'group' => 'security', 'is_public' => false, 'description' => 'Daily max invites',
            ],
            [
                'key' => 'invites_per_ip_max',
                'value' => 30, 'type' => 'integer', 'group' => 'security', 'is_public' => false, 'description' => 'Daily max invites per IP',
            ],
        ];

        foreach ($settings as $setting) {
            Setting::updateOrCreate(
                [
                    'key' => $setting['key'],
                ],
                $setting
            );
        }

        $this->command->info('✅ Tạo System settings thành công (Included all tabs)!');
    }
}
