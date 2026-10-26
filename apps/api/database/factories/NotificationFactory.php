<?php

namespace Database\Factories;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Notification>
 */
class NotificationFactory extends Factory
{
    protected $model = Notification::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        // Valid types from migration enum
        $type = fake()->randomElement(['announcement', 'reminder', 'payment', 'attendance', 'grade', 'other']);

        $titles = [
            'announcement' => 'Thông báo chung',
            'reminder' => 'Nhắc nhở',
            'payment' => 'Nhắc nhở học phí',
            'attendance' => 'Thông báo điểm danh',
            'grade' => 'Thông báo điểm số',
            'other' => 'Thông báo khác',
        ];

        $messages = [
            'announcement' => 'Đây là thông báo chung từ trung tâm.',
            'reminder' => 'Đây là lời nhắc nhở quan trọng.',
            'payment' => 'Kính gửi Phụ huynh, đây là thông báo nhắc nhở học phí tháng này. Vui lòng thanh toán trước ngày 10.',
            'attendance' => 'Học sinh đã vắng mặt buổi học hôm nay.',
            'grade' => 'Điểm số mới đã được cập nhật.',
            'other' => 'Thông báo khác từ trung tâm.',
        ];

        $hasSent = fake()->boolean(70);

        return [
            'created_by' => User::factory()->tutor(),
            'title' => $titles[$type],
            'message' => $messages[$type],
            'type' => $type,
            'target' => fake()->randomElement(['student', 'parent', 'tutor', 'all']),
            'recipient_ids' => fake()->optional(0.5)->passthrough([1, 2, 3, 4, 5]),
            'channel' => fake()->randomElement(['email', 'zalo', 'sms', 'in_app']),
            'status' => $hasSent ? 'sent' : fake()->randomElement(['draft', 'scheduled']),
            'scheduled_at' => fake()->optional(0.3)->dateTimeBetween('now', '+1 week'),
            'sent_at' => $hasSent ? fake()->dateTimeBetween('-1 month', 'now') : null,
            'sent_count' => $hasSent ? fake()->numberBetween(1, 50) : 0,
            'failed_count' => $hasSent ? fake()->numberBetween(0, 5) : 0,
        ];
    }

    /**
     * Indicate that the notification is sent.
     */
    public function sent(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'sent',
            'sent_at' => fake()->dateTimeBetween('-1 month', 'now'),
        ]);
    }

    /**
     * Indicate that the notification is for payment reminder.
     */
    public function paymentReminder(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'payment',
            'title' => 'Nhắc nhở học phí',
        ]);
    }

    /**
     * Indicate that the notification is an announcement.
     */
    public function announcement(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'announcement',
            'target' => 'all',
        ]);
    }
}
