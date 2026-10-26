<?php

namespace Database\Factories;

use App\Models\Setting;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Setting>
 */
class SettingFactory extends Factory
{
    protected $model = Setting::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $settings = [
            'smtp_host' => ['value' => 'smtp.gmail.com', 'type' => 'string', 'description' => 'SMTP host server'],
            'smtp_port' => ['value' => '587', 'type' => 'integer', 'description' => 'SMTP port'],
            'smtp_username' => ['value' => fake()->email(), 'type' => 'string', 'description' => 'SMTP username'],
            'smtp_password' => ['value' => fake()->password(), 'type' => 'string', 'description' => 'SMTP password'],
            'zalo_oa_id' => ['value' => fake()->numerify('##########'), 'type' => 'string', 'description' => 'Zalo OA ID'],
            'zalo_access_token' => ['value' => fake()->uuid(), 'type' => 'string', 'description' => 'Zalo access token'],
            'payment_due_day' => ['value' => '10', 'type' => 'integer', 'description' => 'Ngày đến hạn thanh toán học phí'],
            'late_fee_amount' => ['value' => '50000', 'type' => 'integer', 'description' => 'Phí trễ hạn'],
            'allow_late_submission' => ['value' => 'true', 'type' => 'boolean', 'description' => 'Cho phép nộp bài muộn'],
            'auto_send_payment_reminder' => ['value' => 'true', 'type' => 'boolean', 'description' => 'Tự động gửi nhắc học phí'],
            'auto_send_attendance_notification' => ['value' => 'false', 'type' => 'boolean', 'description' => 'Tự động gửi thông báo vắng học'],
        ];

        $key = fake()->randomElement(array_keys($settings));
        $config = $settings[$key];

        return [
            'key' => $key,
            'value' => $config['value'],
            'type' => $config['type'],
            'description' => $config['description'],
            'is_public' => fake()->boolean(30),
        ];
    }

    /**
     * Create SMTP settings.
     */
    public function smtp(): static
    {
        return $this->state(fn (array $attributes) => [
            'key' => 'smtp_host',
            'value' => 'smtp.gmail.com',
            'type' => 'string',
        ]);
    }
}
