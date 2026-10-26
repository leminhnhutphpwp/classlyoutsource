<?php

namespace App\Services;

use App\Exceptions\SessionRevokedException;
use App\Models\User;
use App\Models\UserSession;
use App\Support\AbuseMonitor;
use App\Support\SecuritySettings;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SessionGuard
{
    public static function enforce(User $user): ?array
    {
        $config = [
            'max_active' => SecuritySettings::getSessionLimit('max_active', config('fraud.sessions.max_active')),
            'alert_on_ip_change' => SecuritySettings::getSessionLimit('alert_on_ip_change', config('fraud.sessions.alert_on_ip_change')),
            'max_idle_minutes' => SecuritySettings::getSessionLimit('max_idle_minutes', config('fraud.sessions.max_idle_minutes')),
            'force_revoke_oldest' => SecuritySettings::getSessionLimit('force_revoke_oldest', config('fraud.sessions.force_revoke_oldest', true)),
        ];

        $maxActive = $config['max_active'] ?? null;
        if (! $maxActive) {
            return null;
        }

        self::cleanupStaleSessions($user, $config);

        $activeCount = UserSession::where('user_id', $user->id)->active()->count();
        if ($activeCount < $maxActive) {
            return null;
        }

        if ($config['force_revoke_oldest'] ?? true) {
            $forceRevoked = self::forceRevokeOldest($user);
            if ($forceRevoked) {
                $activeCount = UserSession::where('user_id', $user->id)->active()->count();
            }
        }

        if ($activeCount >= $maxActive) {
            return [
                'message' => 'Bạn đã đăng nhập quá số phiên cho phép. Vui lòng đăng xuất khỏi thiết bị khác.',
                'code' => 'SESSION_LIMIT',
                'status' => 429,
                'details' => [
                    'max_active' => $maxActive,
                ],
            ];
        }

        return null;
    }

    public static function register(User $user, string $refreshToken, Request $request): UserSession
    {
        $meta = self::resolveDeviceMeta($request);

        $session = UserSession::create([
            'user_id' => $user->id,
            'session_id' => (string) Str::uuid(),
            'refresh_token_hash' => self::hashToken($refreshToken),
            'device_id' => $meta['id'],
            'device_name' => $meta['name'],
            'location' => $meta['location'],
            'ip_address' => $request->ip(),
            'user_agent' => substr($request->userAgent() ?? 'unknown', 0, 255),
            'last_active_at' => now(),
        ]);

        self::checkIpChange($user, $session);

        return $session;
    }

    public static function rotate(User $user, string $oldRefreshToken, string $newRefreshToken, Request $request): UserSession
    {
        $hash = self::hashToken($oldRefreshToken);
        $session = UserSession::where('user_id', $user->id)
            ->where('refresh_token_hash', $hash)
            ->active()
            ->first();

        if ($session) {
            $meta = self::resolveDeviceMeta($request);

            $session->update([
                'refresh_token_hash' => self::hashToken($newRefreshToken),
                'ip_address' => $request->ip(),
                'user_agent' => substr($request->userAgent() ?? 'unknown', 0, 255),
                'device_id' => $meta['id'] ?? $session->device_id,
                'device_name' => $meta['name'] ?? $session->device_name,
                'location' => $meta['location'] ?? $session->location,
                'last_active_at' => now(),
            ]);
            self::checkIpChange($user, $session);

            return $session;
        }

        // No ACTIVE session matches this refresh token: it was either revoked
        // (logout / password change / reset) or already rotated away. REJECT —
        // do NOT register() a brand-new session, otherwise a revoked or stolen
        // refresh token would silently resurrect access for its full TTL.
        throw new SessionRevokedException('Refresh token does not map to an active session.');
    }

    /**
     * Revoke every active session for a user (kills all outstanding refresh
     * tokens so they can no longer rotate). Used on password change/reset.
     *
     * @return int number of sessions revoked
     */
    public static function revokeAllForUser(User $user): int
    {
        return UserSession::where('user_id', $user->id)
            ->active()
            ->update(['revoked_at' => now()]);
    }

    public static function revokeByRefreshToken(?string $refreshToken): void
    {
        if (! $refreshToken) {
            return;
        }

        UserSession::where('refresh_token_hash', self::hashToken($refreshToken))
            ->active()
            ->update(['revoked_at' => now()]);
    }

    protected static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    protected static function checkIpChange(User $user, UserSession $session): void
    {
        $config = [
            'alert_on_ip_change' => SecuritySettings::getSessionLimit('alert_on_ip_change', config('fraud.sessions.alert_on_ip_change')),
        ];

        if (($config['alert_on_ip_change'] ?? false) === false) {
            return;
        }

        $latest = UserSession::where('user_id', $user->id)
            ->where('id', '!=', $session->id)
            ->latest('last_active_at')
            ->first();

        if ($latest && $latest->ip_address && $session->ip_address && $latest->ip_address !== $session->ip_address) {
            AbuseMonitor::record($user, 'sessions', [
                'type' => 'IP_CHANGE',
                'previous_ip' => $latest->ip_address,
                'current_ip' => $session->ip_address,
                'session_id' => $session->session_id,
            ]);
        }
    }

    protected static function cleanupStaleSessions(User $user, array $config): void
    {
        $maxIdle = $config['max_idle_minutes'] ?? null;
        if (! $maxIdle) {
            return;
        }

        $threshold = now()->subMinutes($maxIdle);

        $staleSessions = UserSession::where('user_id', $user->id)
            ->active()
            ->where(function ($query) use ($threshold) {
                $query->whereNull('last_active_at')
                    ->orWhere('last_active_at', '<', $threshold);
            })
            ->get();

        if ($staleSessions->isEmpty()) {
            return;
        }

        UserSession::whereIn('id', $staleSessions->pluck('id'))
            ->update(['revoked_at' => now()]);

        AbuseMonitor::record($user, 'sessions', [
            'type' => 'STALE_SESSION_CLEANUP',
            'count' => $staleSessions->count(),
        ]);
    }

    protected static function forceRevokeOldest(User $user): bool
    {
        $oldest = UserSession::where('user_id', $user->id)
            ->active()
            ->orderBy('last_active_at')
            ->orderBy('created_at')
            ->first();

        if (! $oldest) {
            return false;
        }

        $oldest->update(['revoked_at' => now()]);

        AbuseMonitor::record($user, 'sessions', [
            'type' => 'FORCE_REVOKE_OLDEST',
            'session_id' => $oldest->session_id,
        ]);

        return true;
    }

    protected static function resolveDeviceMeta(Request $request): array
    {
        $deviceId = $request->header('X-Device-Id')
            ?? $request->input('device_id');

        if (! $deviceId) {
            $deviceId = substr(hash('sha256', ($request->ip() ?? '').($request->userAgent() ?? 'unknown')), 0, 32);
        }

        $deviceName = $request->header('X-Device-Name')
            ?? $request->input('device_name');

        if (! $deviceName) {
            $deviceName = self::detectDeviceName($request->userAgent());
        }

        $location = $request->header('X-Device-Location')
            ?? $request->input('location')
            ?? $request->header('X-Geo-City')
            ?? $request->header('CF-IPCity');

        if (! $location) {
            $location = 'Unknown';
        }

        return [
            'id' => $deviceId,
            'name' => $deviceName,
            'location' => $location,
        ];
    }

    protected static function detectDeviceName(?string $userAgent): string
    {
        if (! $userAgent) {
            return 'Unknown Device';
        }

        if (str_contains($userAgent, 'iPhone')) {
            return 'iPhone';
        }

        if (str_contains($userAgent, 'iPad')) {
            return 'iPad';
        }

        if (str_contains($userAgent, 'Android')) {
            return 'Android Device';
        }

        if (str_contains($userAgent, 'Windows')) {
            return 'Windows Device';
        }

        if (str_contains($userAgent, 'Mac OS')) {
            return 'macOS Device';
        }

        return substr($userAgent, 0, 50);
    }
}
