<?php

namespace App\Services;

use App\Models\ScheduleSession;
use Carbon\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;

/**
 * Mints and validates the short-lived, HMAC-signed token embedded in a session's attendance QR code
 * (mirrors MediaTokenService). The tutor screen re-issues a fresh token every ~45s so a screenshot shared
 * to a remote student expires within ~60s — that rotation is the anti-cheat. A 6-char fallback code
 * (stored on the session) covers scans that fail.
 */
class AttendanceQrService
{
    /** How long a minted QR token stays valid (seconds). Kept just above the client's rotation interval. */
    public const TOKEN_TTL_SECONDS = 60;

    /**
     * @return array{token:string, expires_at:string, check_in_url:string}
     */
    public static function issueToken(ScheduleSession $session): array
    {
        $expiresAt = Carbon::now()->addSeconds(self::TOKEN_TTL_SECONDS);

        $payload = [
            'schedule_session_id' => $session->id,
            'expires_at' => $expiresAt->timestamp,
            'issued_at' => Carbon::now()->timestamp,
        ];
        $payload['signature'] = self::sign($payload);

        $token = Crypt::encrypt(json_encode($payload));

        return [
            'token' => $token,
            'expires_at' => $expiresAt->toIso8601String(),
            'check_in_url' => rtrim(config('app.frontend_url'), '/').'/attendance/check-in?token='.urlencode($token),
        ];
    }

    /**
     * Validate a token and return the schedule_session_id, or null if invalid/tampered/expired.
     */
    public static function validateToken(string $token): ?int
    {
        try {
            $payload = json_decode(Crypt::decrypt($token), true);
        } catch (\Throwable $e) {
            return null;
        }

        if (! is_array($payload) || ! isset($payload['signature'], $payload['schedule_session_id'], $payload['expires_at'])) {
            return null;
        }

        $signature = $payload['signature'];
        unset($payload['signature']);

        if (! hash_equals(self::sign($payload), $signature)) {
            return null;
        }

        if (Carbon::createFromTimestamp($payload['expires_at'])->isPast()) {
            return null;
        }

        return (int) $payload['schedule_session_id'];
    }

    /** A 6-char uppercased fallback code (unambiguous — no O/0/I/1). */
    public static function generateCode(): string
    {
        return Str::upper(Str::random(6));
    }

    private static function sign(array $payload): string
    {
        $data = $payload['schedule_session_id'].'|'.$payload['expires_at'].'|'.$payload['issued_at'];

        return hash_hmac('sha256', $data, config('app.key'));
    }
}
