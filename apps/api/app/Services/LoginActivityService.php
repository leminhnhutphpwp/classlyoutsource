<?php

namespace App\Services;

use App\Models\LoginActivity;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class LoginActivityService
{
    public static function record(?User $user, Request $request, array $attributes = []): void
    {
        try {
            $meta = self::extractRequestMeta($request);
            $userId = $user?->id ?? $attributes['user_id'] ?? null;

            LoginActivity::create([
                'user_id' => $userId,
                'email' => $attributes['email'] ?? $user?->email ?? $request->input('email'),
                'is_success' => (bool) ($attributes['is_success'] ?? false),
                'status' => $attributes['status'] ?? 'unknown',
                'message' => $attributes['message'] ?? null,
                'context' => $attributes['context'] ?? null,
                'ip_address' => $meta['ip_address'],
                'device_id' => $meta['device_id'],
                'device_name' => $meta['device_name'],
                'location' => $meta['location'],
                'user_agent' => $meta['user_agent'],
                'logged_in_at' => $attributes['logged_in_at'] ?? now(),
            ]);

            // Tự động cleanup nếu được bật
            if (config('login_activity.auto_cleanup', true) && $userId) {
                self::cleanupForUser($userId);
            }
        } catch (\Throwable $e) {
            Log::channel('auth')->warning('Unable to record login activity', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Cleanup records cũ cho một user cụ thể
     */
    public static function cleanupForUser(?int $userId): void
    {
        if (! $userId) {
            return;
        }

        try {
            $maxRecords = config('login_activity.max_records_per_user', 100);
            $cleanupOlderThanDays = config('login_activity.cleanup_older_than_days');

            // Đếm số lượng records hiện tại
            $totalRecords = LoginActivity::where('user_id', $userId)->count();

            if ($totalRecords <= $maxRecords && ! $cleanupOlderThanDays) {
                return; // Không cần cleanup
            }

            // Xóa records cũ hơn số ngày quy định
            if ($cleanupOlderThanDays) {
                $cutoffDate = now()->subDays($cleanupOlderThanDays);
                LoginActivity::where('user_id', $userId)
                    ->where('logged_in_at', '<', $cutoffDate)
                    ->delete();
            }

            // Xóa records vượt quá số lượng tối đa (giữ lại N records gần nhất)
            if ($totalRecords > $maxRecords) {
                $idsToKeep = LoginActivity::where('user_id', $userId)
                    ->orderByDesc('logged_in_at')
                    ->orderByDesc('id')
                    ->limit($maxRecords)
                    ->pluck('id');

                if ($idsToKeep->isNotEmpty()) {
                    LoginActivity::where('user_id', $userId)
                        ->whereNotIn('id', $idsToKeep)
                        ->delete();
                }
            }
        } catch (\Throwable $e) {
            Log::channel('auth')->warning('Unable to cleanup login activities for user', [
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Cleanup tất cả users
     */
    public static function cleanupAll(): int
    {
        $deletedCount = 0;

        try {
            $userIds = LoginActivity::distinct()
                ->whereNotNull('user_id')
                ->pluck('user_id')
                ->unique();

            foreach ($userIds as $userId) {
                $beforeCount = LoginActivity::where('user_id', $userId)->count();
                self::cleanupForUser($userId);
                $afterCount = LoginActivity::where('user_id', $userId)->count();
                $deletedCount += ($beforeCount - $afterCount);
            }

            // Cleanup records không có user_id (failed login attempts)
            $cleanupOlderThanDays = config('login_activity.cleanup_older_than_days');
            if ($cleanupOlderThanDays) {
                $cutoffDate = now()->subDays($cleanupOlderThanDays);
                $deletedCount += LoginActivity::whereNull('user_id')
                    ->where('logged_in_at', '<', $cutoffDate)
                    ->delete();
            }
        } catch (\Throwable $e) {
            Log::channel('auth')->error('Unable to cleanup all login activities', [
                'error' => $e->getMessage(),
            ]);
        }

        return $deletedCount;
    }

    protected static function extractRequestMeta(Request $request): array
    {
        $ip = $request->ip();

        // Cố gắng lấy User-Agent thực tế của khách (đặc biệt quan trọng nếu frontend là Next.js/Node server)
        $userAgent = $request->header('X-Original-User-Agent')
            ?? $request->header('X-Client-User-Agent')
            ?? $request->header('X-Forwarded-User-Agent')
            ?? $request->header('X-User-Agent')
            ?? $request->header('X-Real-User-Agent')
            ?? $request->userAgent()
            ?? 'unknown';

        $userAgentLimit = substr($userAgent, 0, 255);

        $deviceId = $request->header('X-Device-Id')
            ?? $request->input('device_id');

        if (! $deviceId) {
            $deviceId = substr(hash('sha256', ($ip ?? '').$userAgentLimit), 0, 64);
        }

        // Lấy tên thiết bị từ header hoặc body
        $inputDeviceName = $request->header('X-Device-Name')
            ?? $request->input('device_name');

        // Nếu input là 'node' hoặc rỗng, thử parse từ User-Agent
        if (! $inputDeviceName || in_array(strtolower($inputDeviceName), ['node', 'unknown', 'server'])) {
            $deviceName = self::detectDeviceName($userAgent);

            // Nếu UA vẫn là node sau khi detect, đánh dấu là Server
            if (str_contains(strtolower($userAgent), 'node') || str_contains(strtolower($userAgent), 'axios') || str_contains(strtolower($userAgent), 'undici')) {
                $deviceName = 'Server-side';
            }
        } else {
            $deviceName = $inputDeviceName;
        }

        $location = $request->header('X-Device-Location')
            ?? $request->input('location')
            ?? $request->header('X-Geo-City')
            ?? $request->header('CF-IPCity')
            ?? 'Unknown';

        return [
            'ip_address' => $ip,
            'user_agent' => $userAgentLimit,
            'device_id' => $deviceId,
            'device_name' => $deviceName,
            'location' => $location,
        ];
    }

    protected static function detectDeviceName(?string $userAgent): string
    {
        if (! $userAgent || $userAgent === 'unknown') {
            return 'Unknown Device';
        }

        $ua = $userAgent;
        $uaLower = strtolower($ua);

        // Check for common dev/testing tools
        if (str_contains($ua, 'PostmanRuntime')) {
            return 'Postman';
        }
        if (str_contains($ua, 'insomnia')) {
            return 'Insomnia';
        }
        if (str_contains($uaLower, 'python-requests')) {
            return 'Python Script';
        }

        // Check for Mobile Devices
        if (str_contains($ua, 'iPhone')) {
            return 'iPhone';
        }
        if (str_contains($ua, 'iPad')) {
            return 'iPad';
        }
        if (str_contains($ua, 'Android')) {
            if (str_contains($ua, 'Mobile')) {
                return 'Android Phone';
            }

            return 'Android Tablet';
        }

        // Check for Desktop OS
        if (str_contains($ua, 'Windows NT 10.0')) {
            return 'Windows 10/11 PC';
        }
        if (str_contains($ua, 'Windows NT 6.1')) {
            return 'Windows 7 PC';
        }
        if (str_contains($ua, 'Windows')) {
            return 'Windows PC';
        }
        if (str_contains($ua, 'Mac OS') || str_contains($ua, 'Macintosh')) {
            return 'macOS Computer';
        }
        if (str_contains($ua, 'Linux')) {
            return 'Linux Computer';
        }

        // Check for specific browsers if no OS detected
        if (str_contains($ua, 'Edg/')) {
            return 'Edge Browser';
        }
        if (str_contains($ua, 'Chrome')) {
            return 'Chrome Browser';
        }
        if (str_contains($ua, 'Firefox')) {
            return 'Firefox Browser';
        }
        if (str_contains($ua, 'Safari')) {
            return 'Safari Browser';
        }

        // Check for Node/Server
        if (str_contains($uaLower, 'node') || str_contains($uaLower, 'axios') || str_contains($uaLower, 'undici')) {
            return 'Server-side (Node.js)';
        }

        // If it's a very short string that's just a browser/process name
        return substr($ua, 0, 50);
    }
}
