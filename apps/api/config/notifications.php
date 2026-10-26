<?php

use App\Services\Notifications\Drivers\EsmsDriver;
use App\Services\Notifications\Drivers\LogDriver;
use App\Services\Notifications\Drivers\ZaloOaDriver;

return [
    /*
    |--------------------------------------------------------------------------
    | Notification channels
    |--------------------------------------------------------------------------
    | Registry for the extra delivery channels (Zalo OA, SMS). Each channel picks a driver by config
    | key; the driver reads its live credentials from the NotificationChannel DB row (encrypted), so
    | swapping providers = change the env + the DB credentials, never code. Locally everything defaults
    | to the `log` driver (mirrors mail=log) so tests/dev never hit a paid provider.
    */
    'channels' => [
        'email' => [
            'enabled' => true,
        ],

        'zalo' => [
            'enabled' => (bool) env('ZALO_OA_ENABLED', false),
            'driver' => env('ZALO_DRIVER', 'log'),      // 'zalo_oa' in prod
            'cost_per_message' => (float) env('ZALO_COST_PER_MESSAGE', 300),   // VND, for NotificationLog
            // Safety ceiling (messages/month) so an unbounded loop or abuse can't run up an
            // uncapped provider bill. 0 = no cap; keep a non-zero default. Enforced in
            // App\Notifications\Channels\AbstractProviderChannel::send.
            'monthly_cap' => (int) env('ZALO_MONTHLY_CAP', 800),
        ],

        'sms' => [
            'enabled' => (bool) env('SMS_ENABLED', false),
            'driver' => env('SMS_DRIVER', 'log'),       // 'esms' in prod
            'cost_per_message' => (float) env('SMS_COST_PER_MESSAGE', 800),    // VND
            // Safety ceiling (messages/month) — see Zalo note above. 0 = no cap.
            'monthly_cap' => (int) env('SMS_MONTHLY_CAP', 300),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Driver registry
    |--------------------------------------------------------------------------
    | Maps a driver key to its implementation. Resolved by NotificationDriverManager. `log` writes to
    | the log channel instead of sending (default for local/dev/tests).
    */
    'drivers' => [
        'log' => LogDriver::class,
        'zalo_oa' => ZaloOaDriver::class,
        'esms' => EsmsDriver::class,
    ],
];
