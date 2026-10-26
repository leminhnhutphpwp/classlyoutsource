<?php

namespace Tests\Feature\Notifications;

use App\Models\NotificationLog;
use App\Models\User;
use App\Models\UserNotificationPreference;
use App\Notifications\Channels\SmsChannel;
use App\Notifications\Channels\ZaloChannel;
use Illuminate\Notifications\Notification;
use Tests\TestCase;

class ZaloSmsChannelTest extends TestCase
{
    /** A minimal notification that opts into both external channels. */
    private function notification(): Notification
    {
        return new class extends Notification
        {
            public function notificationType(): string
            {
                return 'test_note';
            }

            public function toZalo(object $n): string
            {
                return 'hello zalo';
            }

            public function toSms(object $n): string
            {
                return 'hello sms';
            }
        };
    }

    private function userWithPhone(): User
    {
        return User::factory()->create(['phone' => '0900000001']);
    }

    public function test_zalo_channel_sends_via_log_driver_and_records_cost(): void
    {
        config([
            'notifications.channels.zalo.enabled' => true,
            'notifications.channels.zalo.driver' => 'log',
            'notifications.channels.zalo.cost_per_message' => 300,
            'notifications.channels.zalo.monthly_cap' => 0,
        ]);

        app(ZaloChannel::class)->send($this->userWithPhone(), $this->notification());

        $log = NotificationLog::where('channel', 'zalo')->first();
        $this->assertNotNull($log);
        $this->assertSame('sent', $log->status);
        $this->assertSame('0900000001', $log->recipient);
        $this->assertEquals(300.0, (float) $log->cost);
    }

    public function test_sms_channel_uses_phone_and_records_cost(): void
    {
        config([
            'notifications.channels.sms.enabled' => true,
            'notifications.channels.sms.driver' => 'log',
            'notifications.channels.sms.cost_per_message' => 800,
        ]);

        app(SmsChannel::class)->send($this->userWithPhone(), $this->notification());

        $log = NotificationLog::where('channel', 'sms')->first();
        $this->assertNotNull($log);
        $this->assertEquals(800.0, (float) $log->cost);
    }

    public function test_disabled_channel_is_a_noop(): void
    {
        config(['notifications.channels.zalo.enabled' => false]);

        app(ZaloChannel::class)->send($this->userWithPhone(), $this->notification());

        $this->assertSame(0, NotificationLog::where('channel', 'zalo')->count());
    }

    public function test_preference_off_skips_channel(): void
    {
        config(['notifications.channels.zalo.enabled' => true, 'notifications.channels.zalo.driver' => 'log']);
        $user = $this->userWithPhone();

        // User opted this notification type to email only — zalo must be skipped.
        UserNotificationPreference::create([
            'user_id' => $user->id,
            'notification_type' => 'test_note',
            'channels' => ['email'],
            'is_enabled' => true,
        ]);

        app(ZaloChannel::class)->send($user, $this->notification());

        $this->assertSame(0, NotificationLog::where('channel', 'zalo')->count());
    }

    public function test_monthly_cap_blocks_further_sends(): void
    {
        config([
            'notifications.channels.zalo.enabled' => true,
            'notifications.channels.zalo.driver' => 'log',
            'notifications.channels.zalo.monthly_cap' => 1,
        ]);

        NotificationLog::create([
            'notification_type' => 'x', 'channel' => 'zalo', 'recipient' => 'y', 'status' => 'sent',
        ]);

        app(ZaloChannel::class)->send($this->userWithPhone(), $this->notification());

        // Cap of 1 already reached — no new log written.
        $this->assertSame(1, NotificationLog::where('channel', 'zalo')->count());
    }
}
