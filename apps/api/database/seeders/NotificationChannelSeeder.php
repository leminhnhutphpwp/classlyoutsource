<?php

namespace Database\Seeders;

use App\Models\NotificationChannel;
use Illuminate\Database\Seeder;

class NotificationChannelSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $channels = [
            [
                'channel' => 'in_app',
                'is_enabled' => true,
                'provider' => 'database',
                'description' => 'Thông báo trong ứng dụng',
                'config' => [],
            ],
            [
                'channel' => 'email',
                'is_enabled' => true,
                'provider' => 'smtp',
                'description' => 'Gửi qua Email',
                'config' => [], // Uses system mail config
            ],
        ];

        foreach ($channels as $channel) {
            NotificationChannel::updateOrCreate(
                ['channel' => $channel['channel']],
                $channel
            );
        }

        $this->command->info('✅ Tạo NotificationChannels thành công '.count($channels));
    }
}
