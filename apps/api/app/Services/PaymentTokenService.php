<?php

namespace App\Services;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;

class PaymentTokenService
{
    /**
     * Generate a payment token for payment
     *
     * @param  string  $type  Payment type: 'payment' (tuition fee)
     * @param  int  $id  The ID of the payment item
     * @return string Encrypted payment token
     */
    public static function generateToken(string $type, int $id): string
    {
        // Create payload with type, id, and timestamp for expiry check
        $payload = [
            'type' => $type,
            'id' => $id,
            'timestamp' => now()->timestamp,
        ];

        // Encrypt the payload
        $encrypted = Crypt::encryptString(json_encode($payload));

        // Return base64 encoded (URL safe)
        return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($encrypted));
    }

    /**
     * Decode payment token and return payment information
     *
     * @param  string  $token  Payment token
     * @return array|null Returns ['type' => string, 'id' => int] or null if invalid
     */
    public static function decodeToken(string $token): ?array
    {
        try {
            // Decode from URL-safe base64
            $token = str_replace(['-', '_'], ['+', '/'], $token);

            // Add padding if needed
            $padding = strlen($token) % 4;
            if ($padding) {
                $token .= str_repeat('=', 4 - $padding);
            }

            $decoded = base64_decode($token);

            if (! $decoded) {
                return null;
            }

            // Decrypt
            $decrypted = Crypt::decryptString($decoded);
            $payload = json_decode($decrypted, true);

            if (! $payload || ! isset($payload['type'], $payload['id'], $payload['timestamp'])) {
                return null;
            }

            // Optional: Check token expiry (e.g., 7 days)
            $expiryDays = 7;
            $expiryTimestamp = $payload['timestamp'] + ($expiryDays * 24 * 60 * 60);

            if (time() > $expiryTimestamp) {
                return null; // Token expired
            }

            return [
                'type' => $payload['type'],
                'id' => (int) $payload['id'],
            ];
        } catch (\Exception $e) {
            Log::channel('payments')->error('Payment token decode failed', [
                'token' => substr($token, 0, 20).'...',
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Generate payment page URL with token
     *
     * @param  string  $type  Payment type: 'payment' (tuition fee)
     * @param  int  $id  The ID of the payment item
     * @return string Payment page URL
     */
    public static function getPaymentUrl(string $type, int $id): string
    {
        $token = self::generateToken($type, $id);

        return config('app.url').'/payment/'.$token;
    }
}
