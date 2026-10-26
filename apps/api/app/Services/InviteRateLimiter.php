<?php

namespace App\Services;

use App\Models\StudentInvite;
use App\Models\User;
use App\Support\SecuritySettings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class InviteRateLimiter
{
    public static function ensureAllowed(User $user, Request $request): ?array
    {
        $config = [
            'per_user' => [
                'window_minutes' => SecuritySettings::getInviteLimit('per_user', 'window_minutes', config('fraud.invites.per_user.window_minutes')),
                'max' => SecuritySettings::getInviteLimit('per_user', 'max', config('fraud.invites.per_user.max')),
            ],
            'per_user_daily' => [
                'window_minutes' => SecuritySettings::getInviteLimit('per_user_daily', 'window_minutes', config('fraud.invites.per_user_daily.window_minutes')),
                'max' => SecuritySettings::getInviteLimit('per_user_daily', 'max', config('fraud.invites.per_user_daily.max')),
            ],
            'per_ip' => [
                'window_minutes' => SecuritySettings::getInviteLimit('per_ip', 'window_minutes', config('fraud.invites.per_ip.window_minutes')),
                'max' => SecuritySettings::getInviteLimit('per_ip', 'max', config('fraud.invites.per_ip.max')),
            ],
        ];

        if (
            (empty($config['per_user']['window_minutes']) && empty($config['per_user']['max'])) &&
            (empty($config['per_user_daily']['window_minutes']) && empty($config['per_user_daily']['max'])) &&
            (empty($config['per_ip']['window_minutes']) && empty($config['per_ip']['max']))
        ) {
            return null;
        }

        $checks = [
            [
                'key' => 'per_user',
                'query' => StudentInvite::where('user_id', $user->id),
                'message' => 'Bạn đã gửi quá nhiều lời mời trong vòng :minutes phút. Vui lòng chờ thêm trước khi gửi tiếp.',
                'code' => 'INVITE_RATE_LIMIT_USER',
            ],
            [
                'key' => 'per_user_daily',
                'query' => StudentInvite::where('user_id', $user->id),
                'message' => 'Bạn đã đạt giới hạn lời mời trong ngày. Vui lòng thử lại sau.',
                'code' => 'INVITE_DAILY_LIMIT',
            ],
            [
                'key' => 'per_ip',
                'query' => StudentInvite::where('ip_address', $request->ip()),
                'message' => 'Địa chỉ IP của bạn đã gửi quá nhiều lời mời trong vòng :minutes phút.',
                'code' => 'INVITE_RATE_LIMIT_IP',
            ],
        ];

        foreach ($checks as $check) {
            $limitConfig = $config[$check['key']] ?? null;
            if (! $limitConfig) {
                continue;
            }

            $count = (clone $check['query'])
                ->where('created_at', '>=', now()->subMinutes($limitConfig['window_minutes']))
                ->count();

            if ($count >= $limitConfig['max']) {
                Log::channel('fraud')->warning('InviteRateLimiter: limit exceeded', [
                    'user_id' => $user->id,
                    'ip' => $request->ip(),
                    'rule' => $check['key'],
                    'count' => $count,
                    'max' => $limitConfig['max'],
                ]);

                return [
                    'message' => str_replace(':minutes', $limitConfig['window_minutes'], $check['message']),
                    'code' => $check['code'],
                    'status' => 429,
                ];
            }
        }

        return null;
    }
}
