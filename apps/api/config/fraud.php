<?php

return [
    // Single-tenant outsource build: no per-plan count limits. Only generic abuse controls remain.

    'abuse_detection' => [
        'spike_threshold' => 2.5, // so với trung bình 30 ngày
        'rapid_create_delete' => 5, // số lần trong 60 phút
        'lockout_minutes' => 15,
    ],

    'sessions' => [
        'max_active' => 10,
        'alert_on_ip_change' => false,
        'max_idle_minutes' => null,
        'force_revoke_oldest' => true,
    ],

    'invites' => [
        'per_user' => [
            'window_minutes' => 60,
            'max' => 5,
        ],
        'per_user_daily' => [
            'window_minutes' => 1440,
            'max' => 20,
        ],
        'per_ip' => [
            'window_minutes' => 60,
            'max' => 30,
        ],
    ],

    'client_signature' => [
        'enabled' => env('CLIENT_SIGNATURE_ENABLED', false),
        'clock_skew' => 120, // seconds
        'replay_ttl' => 300, // seconds to store nonce
        'allowed_clients' => [
            // 'nextjs-app' => [
            //     'secret' => env('CLIENT_SIGNATURE_SECRET_NEXTJS'),
            //     'ips' => ['1.2.3.4'],
            // ],
        ],
    ],

    'bot_shield' => [
        'classes' => [
            'per_minute' => 3,
            'per_hour' => 15,
        ],
        'students' => [
            'per_minute' => 5,
            'per_hour' => 40,
        ],
        'submissions' => [
            'per_minute' => 10,
            'per_hour' => 100,
        ],
    ],

    'upload' => [
        'max_file_mb' => 10, // giới hạn dung lượng mỗi file (chống lạm dụng, không phải quota)
    ],

    'webhooks' => [
        'enabled' => true,
        'default_replay_ttl' => 3600, // 1 giờ cho mỗi giao dịch
        'gateways' => [],
    ],
];
