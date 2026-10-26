<?php

namespace App\Services;

use App\Models\LearningResource;
use Carbon\Carbon;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;

class MediaTokenService
{
    /**
     * Generate a signed token for media access.
     *
     * @param  int  $resourceId  Learning resource ID (real ID)
     * @param  int  $userId  User ID requesting access
     * @param  int  $expiresInMinutes  Token expiration in minutes (default: 60)
     * @return string Encrypted token
     */
    public static function generateToken(int $resourceId, int $userId, int $expiresInMinutes = 60): string
    {
        $expiresAt = Carbon::now()->addMinutes($expiresInMinutes);

        $payload = [
            'resource_id' => $resourceId, // Keep real ID for internal validation
            'user_id' => $userId,
            'expires_at' => $expiresAt->timestamp,
            'issued_at' => Carbon::now()->timestamp,
        ];

        // Create signature
        $signature = self::createSignature($payload);
        $payload['signature'] = $signature;

        // Encrypt the payload
        return Crypt::encrypt(json_encode($payload));
    }

    /**
     * Validate and decode a media token.
     *
     * @param  string  $token  Encrypted token
     * @return array|null Decoded payload or null if invalid
     */
    public static function validateToken(string $token): ?array
    {
        try {
            // Decrypt the token
            $decrypted = Crypt::decrypt($token);
            $payload = json_decode($decrypted, true);

            if (! $payload || ! is_array($payload) || ! isset($payload['signature'])) {
                Log::channel('media')->warning('MediaTokenService: Invalid token payload', [
                    'has_payload' => ! empty($payload),
                    'is_array' => is_array($payload),
                    'has_signature' => is_array($payload) && isset($payload['signature']),
                ]);

                return null;
            }

            // Verify signature
            $signature = $payload['signature'];
            unset($payload['signature']);

            if (! self::verifySignature($payload, $signature)) {
                Log::channel('media')->warning('MediaTokenService: Signature verification failed', [
                    'resource_id' => $payload['resource_id'] ?? null,
                    'user_id' => $payload['user_id'] ?? null,
                ]);

                return null;
            }

            // Check expiration
            if (isset($payload['expires_at'])) {
                $expiresAt = Carbon::createFromTimestamp($payload['expires_at']);
                if ($expiresAt->isPast()) {
                    Log::channel('media')->warning('MediaTokenService: Token expired', [
                        'resource_id' => $payload['resource_id'] ?? null,
                        'user_id' => $payload['user_id'] ?? null,
                        'expires_at' => $expiresAt->toISOString(),
                        'now' => Carbon::now()->toISOString(),
                    ]);

                    return null;
                }
            }

            return $payload;
        } catch (DecryptException $e) {
            Log::channel('media')->warning('MediaTokenService: Token decryption failed', [
                'error' => $e->getMessage(),
                'token_preview' => substr($token, 0, 50).'...',
            ]);

            return null;
        } catch (\Exception $e) {
            Log::channel('media')->warning('MediaTokenService: Token validation failed', [
                'error' => $e->getMessage(),
                'error_class' => get_class($e),
                'token_preview' => substr($token, 0, 50).'...',
            ]);

            return null;
        }
    }

    /**
     * Create signature for payload.
     */
    private static function createSignature(array $payload): string
    {
        $data = $payload['resource_id'].'|'.$payload['user_id'].'|'.$payload['expires_at'];
        $secret = config('app.key');

        return hash_hmac('sha256', $data, $secret);
    }

    /**
     * Verify signature.
     */
    private static function verifySignature(array $payload, string $signature): bool
    {
        $expectedSignature = self::createSignature($payload);

        return hash_equals($expectedSignature, $signature);
    }

    /**
     * Generate signed URL for media access.
     * Returns relative path (not absolute URL) to avoid exposing server domain.
     * Client will append to their own base URL.
     *
     * IMPORTANT: This method MUST return relative paths starting with "/" to avoid exposing server domain.
     * Do NOT use url(), asset(), or any helper that generates absolute URLs.
     *
     * @param  string  $action  preview|stream|download|thumbnail
     * @return string Relative path with token (e.g., "/api/v1/learning-resources/1/preview?token=...")
     */
    public static function generateSignedUrl(int $resourceId, int $userId, string $action = 'preview', int $expiresInMinutes = 60): string
    {
        $token = self::generateToken($resourceId, $userId, $expiresInMinutes);

        // Check if LearningResource model exists and supports HashID
        $hashId = $resourceId;
        if (class_exists('\App\Models\LearningResource') && method_exists('\App\Models\LearningResource', 'encodeId')) {
            $hashId = LearningResource::encodeId($resourceId);
        }

        // CRITICAL: Return relative path ONLY (starting with "/")
        // Do NOT use url(), asset(), config('app.url'), or any absolute URL helpers
        // This ensures we don't expose server domain/IP to clients
        $relativePath = "/api/v1/learning-resources/{$hashId}/{$action}?token=".urlencode($token);

        // Validate that we're returning a relative path
        if (! str_starts_with($relativePath, '/')) {
            Log::channel('media')->error('MediaTokenService: Generated URL is not relative!', [
                'resource_id' => $resourceId,
                'action' => $action,
                'generated_path' => $relativePath,
            ]);
            throw new \RuntimeException('MediaTokenService must return relative paths only');
        }

        return $relativePath;
    }
}
