<?php

namespace App\Notifications\Channels;

use App\Models\NotificationChannel;
use App\Models\NotificationLog;
use App\Models\UserNotificationPreference;
use App\Services\Notifications\NotificationDriverManager;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;

/**
 * Base for the external delivery channels (Zalo, SMS). A channel self-skips when: the channel is disabled
 * in config, the notification doesn't render for it (no toZalo/toSms), the recipient has no address, the
 * user turned the channel off in their preferences, or the monthly cost cap is hit. Every attempt writes a
 * NotificationLog with the config'd cost — so the cost dashboard reflects reality. Nothing here throws:
 * a send failure is logged, never fatal (a broken Zalo must not kill the mail/database channels).
 */
abstract class AbstractProviderChannel
{
    public function __construct(protected NotificationDriverManager $manager) {}

    /** Config/channel key: 'zalo' | 'sms'. */
    abstract protected function channelKey(): string;

    /** Notifiable attributes to try, in order, when no routeNotificationFor is defined. */
    abstract protected function recipientColumns(): array;

    public function send(object $notifiable, Notification $notification): void
    {
        $channel = $this->channelKey();
        $config = config("notifications.channels.$channel");

        if (empty($config['enabled'])) {
            return;
        }

        $method = 'to'.ucfirst($channel);
        if (! method_exists($notification, $method)) {
            return;
        }

        $to = $this->resolveRecipient($notifiable, $notification, $channel);
        if (! $to) {
            return;
        }

        $type = $this->notificationType($notification);

        // Per-user preference (skipped for on-demand/anonymous notifiables that have no id).
        if (method_exists($notifiable, 'getKey') && $notifiable->getKey()
            && ! UserNotificationPreference::shouldSendNotification($notifiable->getKey(), $type, $channel)) {
            return;
        }

        // Monthly cost cap (0 = unlimited).
        $cap = (int) ($config['monthly_cap'] ?? 0);
        if ($cap > 0 && NotificationLog::getMonthlyUsage($channel) >= $cap) {
            Log::warning("[notifications:$channel] monthly cap ($cap) reached — skipped $type to $to");

            return;
        }

        $rendered = $notification->{$method}($notifiable);
        $message = is_array($rendered) ? ($rendered['text'] ?? json_encode($rendered, JSON_UNESCAPED_UNICODE)) : (string) $rendered;

        $log = NotificationLog::logNotification($type, $channel, (string) $to, $message);

        try {
            $result = $this->manager->driver($config['driver'] ?? 'log')->send((string) $to, $message, $this->credentials($channel));
            $log->update([
                'status' => ($result['success'] ?? false) ? 'sent' : 'failed',
                'sent_at' => now(),
                'cost' => (float) ($config['cost_per_message'] ?? 0),
                'metadata' => $result,
                'error_message' => ($result['success'] ?? false) ? null : ($result['error'] ?? 'send_failed'),
            ]);
        } catch (\Throwable $e) {
            $log->markAsFailed($e->getMessage());
        }
    }

    protected function resolveRecipient(object $notifiable, Notification $notification, string $channel): ?string
    {
        if (method_exists($notifiable, 'routeNotificationFor')) {
            $routed = $notifiable->routeNotificationFor($channel, $notification);
            if ($routed) {
                return (string) $routed;
            }
        }

        foreach ($this->recipientColumns() as $column) {
            if (! empty($notifiable->{$column})) {
                return (string) $notifiable->{$column};
            }
        }

        return null;
    }

    protected function notificationType(Notification $notification): string
    {
        if (method_exists($notification, 'notificationType')) {
            return $notification->notificationType();
        }

        return class_basename($notification);
    }

    /** @return array<string,mixed> */
    protected function credentials(string $channel): array
    {
        $row = NotificationChannel::where('channel', $channel)->where('is_enabled', true)->first();

        return $row ? [
            'api_key' => $row->api_key,
            'api_secret' => $row->api_secret,
            'config' => $row->config,
            'provider' => $row->provider,
        ] : [];
    }
}
