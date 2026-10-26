<?php

namespace App\Services;

use App\Models\User;
use App\Support\AbuseMonitor;
use App\Support\SecuritySettings;
use Illuminate\Support\Facades\Cache;

class BotShield
{
    public static function check(User $user, string $resource, array $context = []): ?array
    {
        // Lấy limits từ System Settings (fallback config)
        $config = [
            'per_minute' => SecuritySettings::getBotShieldLimit($resource, 'per_minute', config("fraud.bot_shield.{$resource}.per_minute")),
            'per_hour' => SecuritySettings::getBotShieldLimit($resource, 'per_hour', config("fraud.bot_shield.{$resource}.per_hour")),
        ];

        if (empty($config['per_minute']) && empty($config['per_hour'])) {
            return null;
        }

        $limits = [
            ['key' => 'per_minute', 'ttl' => 60, 'label' => 'phút'],
            ['key' => 'per_hour', 'ttl' => 3600, 'label' => 'giờ'],
        ];

        foreach ($limits as $limit) {
            $max = $config[$limit['key']] ?? null;
            if (! $max) {
                continue;
            }

            $cacheKey = self::cacheKey($user->id, $resource, $limit['key']);
            $count = Cache::increment($cacheKey);
            if ($count === 1) {
                Cache::put($cacheKey, $count, $limit['ttl']);
            }

            if ($count > $max) {
                $message = sprintf(
                    'Bạn đang thao tác quá nhanh với %s. Vui lòng chờ ít nhất %s trước khi thử lại.',
                    self::resourceLabel($resource),
                    $limit['label']
                );

                AbuseMonitor::record($user, $resource, [
                    'type' => 'BOT_SHIELD',
                    'window' => $limit['key'],
                    'limit' => $max,
                    'context' => $context,
                ]);

                return [
                    'message' => $message,
                    'code' => 'BOT_SHIELD',
                    'status' => 429,
                    'details' => [
                        'window' => $limit['key'],
                        'limit' => $max,
                        'resource' => $resource,
                    ],
                ];
            }
        }

        return null;
    }

    protected static function cacheKey(int $userId, string $resource, string $window): string
    {
        return "bot_shield:{$resource}:{$window}:user:{$userId}";
    }

    protected static function resourceLabel(string $resource): string
    {
        return match ($resource) {
            'classes' => 'lớp học',
            'students' => 'học sinh',
            'submissions' => 'bài nộp',
            default => 'tài nguyên',
        };
    }
}
