<?php

namespace App\Services\Notifications\Drivers;

use Illuminate\Support\Facades\Log;

/**
 * Default driver for local/dev/tests — writes the message to the log instead of hitting a paid provider
 * (mirrors mail=log). Always "succeeds" so the pipeline (NotificationLog cost tracking, preferences) is
 * exercised end-to-end without external calls.
 */
class LogDriver implements NotificationDriver
{
    public function send(string $to, string $message, array $credentials = []): array
    {
        Log::channel(config('logging.default'))->info('[notifications:log-driver] would send', [
            'to' => $to,
            'message' => $message,
        ]);

        return ['success' => true, 'provider' => 'log'];
    }
}
