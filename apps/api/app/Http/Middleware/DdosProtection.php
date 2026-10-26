<?php

namespace App\Http\Middleware;

use App\Support\SecuritySettings;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * DDoS Protection Middleware.
 *
 * - Request size limiting
 * - Connection timeout
 * - IP-based rate limiting
 * - Auto-block suspicious IPs
 */
class DdosProtection
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $ip = $request->ip();

        // Check if IP is blocked
        if ($this->isIpBlocked($ip)) {
            return response()->json([
                'success' => false,
                'message' => 'Địa chỉ IP của bạn đã bị chặn do hoạt động đáng ngờ.',
                'code' => 'IP_BLOCKED',
            ], 403);
        }

        // Check request size
        $maxRequestSize = SecuritySettings::getDdosProtection('max_request_size_mb', 10); // 10MB default
        $contentLength = $request->header('Content-Length', 0);

        if ($contentLength > ($maxRequestSize * 1024 * 1024)) {
            $this->recordSuspiciousActivity($ip, 'REQUEST_SIZE_EXCEEDED', [
                'size' => $contentLength,
                'max' => $maxRequestSize * 1024 * 1024,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Request quá lớn. Kích thước tối đa: '.$maxRequestSize.'MB',
                'code' => 'REQUEST_SIZE_EXCEEDED',
            ], 413);
        }

        // IP-based rate limiting (stricter than user-based)
        $ipRateLimit = SecuritySettings::getDdosProtection('ip_rate_limit_per_minute', 100);
        $ipKey = "ddos:ip:{$ip}";

        $ipRequests = Cache::increment($ipKey);
        if ($ipRequests === 1) {
            Cache::put($ipKey, $ipRequests, 60); // 1 minute
        }

        if ($ipRequests > $ipRateLimit) {
            $this->recordSuspiciousActivity($ip, 'IP_RATE_LIMIT_EXCEEDED', [
                'requests' => $ipRequests,
                'limit' => $ipRateLimit,
            ]);

            // Auto-block if exceeds threshold
            $autoBlockThreshold = SecuritySettings::getDdosProtection('auto_block_threshold', 200);
            if ($ipRequests > $autoBlockThreshold) {
                $this->blockIp($ip, 'Auto-blocked due to excessive requests');
            }

            return response()->json([
                'success' => false,
                'message' => 'Quá nhiều yêu cầu từ địa chỉ IP này. Vui lòng thử lại sau.',
                'code' => 'IP_RATE_LIMIT_EXCEEDED',
            ], 429);
        }

        return $next($request);
    }

    /**
     * Check if IP is blocked.
     */
    protected function isIpBlocked(string $ip): bool
    {
        $blockedKey = "ddos:blocked:{$ip}";

        return Cache::has($blockedKey);
    }

    /**
     * Block an IP address.
     */
    protected function blockIp(string $ip, string $reason, int $durationMinutes = 60): void
    {
        $blockedKey = "ddos:blocked:{$ip}";
        $duration = SecuritySettings::getDdosProtection('ip_block_duration_minutes', 60);

        Cache::put($blockedKey, [
            'reason' => $reason,
            'blocked_at' => now()->toDateTimeString(),
        ], $duration * 60);

        Log::channel('fraud')->warning('IP blocked by DDoS protection', [
            'ip' => $ip,
            'reason' => $reason,
            'duration_minutes' => $duration,
        ]);
    }

    /**
     * Record suspicious activity.
     */
    protected function recordSuspiciousActivity(string $ip, string $type, array $data = []): void
    {
        $activityKey = "ddos:activity:{$ip}";
        $activities = Cache::get($activityKey, []);

        $activities[] = [
            'type' => $type,
            'data' => $data,
            'timestamp' => now()->toDateTimeString(),
        ];

        // Keep only last 10 activities
        $activities = array_slice($activities, -10);

        Cache::put($activityKey, $activities, 3600); // 1 hour

        Log::channel('fraud')->warning('DDoS protection: Suspicious activity detected', [
            'ip' => $ip,
            'type' => $type,
            'data' => $data,
        ]);

        // Auto-block if too many suspicious activities
        $autoBlockCount = SecuritySettings::getDdosProtection('auto_block_suspicious_count', 5);
        if (count($activities) >= $autoBlockCount) {
            $this->blockIp($ip, "Auto-blocked due to {$autoBlockCount} suspicious activities");
        }
    }
}
