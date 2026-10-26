<?php

namespace App\Services\Notifications\Drivers;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Zalo Official Account driver. Sends a message to a user's Zalo user-id via the OA `message` API using
 * the access token stored (encrypted) on the `zalo` NotificationChannel row. Never enabled locally
 * (ZALO_DRIVER=log by default); wired for prod once the OA is verified.
 *
 * @see https://developers.zalo.me/docs/official-account/tin-nhan/tin-nhan-tu-van
 */
class ZaloOaDriver implements NotificationDriver
{
    public function send(string $to, string $message, array $credentials = []): array
    {
        $accessToken = $credentials['api_key'] ?? null;
        if (! $accessToken) {
            return ['success' => false, 'provider' => 'zalo_oa', 'error' => 'missing_access_token'];
        }

        try {
            $response = Http::withHeaders(['access_token' => $accessToken])
                ->timeout(10)
                ->post('https://openapi.zalo.me/v3.0/oa/message/cs', [
                    'recipient' => ['user_id' => $to],
                    'message' => ['text' => $message],
                ]);

            $body = $response->json();
            $ok = $response->successful() && (int) ($body['error'] ?? 0) === 0;

            return [
                'success' => $ok,
                'provider' => 'zalo_oa',
                'error' => $ok ? null : ($body['message'] ?? 'zalo_send_failed'),
                'response' => $body,
            ];
        } catch (\Throwable $e) {
            Log::error('[notifications:zalo_oa] send failed: '.$e->getMessage());

            return ['success' => false, 'provider' => 'zalo_oa', 'error' => $e->getMessage()];
        }
    }
}
