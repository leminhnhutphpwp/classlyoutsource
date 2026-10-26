<?php

namespace App\Services\Notifications\Drivers;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * eSMS.vn SMS driver (the common VN brandname-SMS provider). Credentials (ApiKey/SecretKey/Brandname)
 * come from the `sms` NotificationChannel row. Never enabled locally (SMS_DRIVER=log by default).
 *
 * @see https://esms.vn/api
 */
class EsmsDriver implements NotificationDriver
{
    public function send(string $to, string $message, array $credentials = []): array
    {
        $apiKey = $credentials['api_key'] ?? null;
        $secret = $credentials['api_secret'] ?? null;
        $brandname = data_get($credentials, 'config.brandname');

        if (! $apiKey || ! $secret) {
            return ['success' => false, 'provider' => 'esms', 'error' => 'missing_credentials'];
        }

        try {
            $response = Http::timeout(10)->post('https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/', [
                'ApiKey' => $apiKey,
                'SecretKey' => $secret,
                'Phone' => $to,
                'Content' => $message,
                'SmsType' => $brandname ? '2' : '8',
                'Brandname' => $brandname,
            ]);

            $body = $response->json();
            $ok = $response->successful() && (int) ($body['CodeResult'] ?? -1) === 100;

            return [
                'success' => $ok,
                'provider' => 'esms',
                'error' => $ok ? null : ($body['ErrorMessage'] ?? 'esms_send_failed'),
                'response' => $body,
            ];
        } catch (\Throwable $e) {
            Log::error('[notifications:esms] send failed: '.$e->getMessage());

            return ['success' => false, 'provider' => 'esms', 'error' => $e->getMessage()];
        }
    }
}
