<?php

namespace App\Http\Middleware;

use App\Support\AbuseMonitor;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\IpUtils;

/**
 * Fail-closed guard for the vendor SePay webhook (POST /api/sepay/webhook).
 *
 * We cannot edit vendor/, and the vendor controller skips auth entirely when
 * `config('sepay.webhook_token')` is empty and compares with a non-constant-time
 * `!==`. This middleware runs first (appended to the `api` group) and:
 *   1. FAILS CLOSED — rejects when no webhook token is configured.
 *   2. Compares the presented token in constant time via hash_equals().
 *   3. Optionally enforces an IP allowlist from config/fraud.php
 *      (webhooks.gateways.sepay.allowed_ips), a no-op when unconfigured.
 *
 * It is a pure pass-through for every request that is not the SePay webhook,
 * so it is safe to attach to the whole `api` group.
 */
class VerifySePayWebhook
{
    /**
     * The SePay webhook path (vendor route: prefix `api/sepay`, uri `/webhook`).
     */
    private const WEBHOOK_PATH = 'api/sepay/webhook';

    public function handle(Request $request, Closure $next)
    {
        // Only guard the SePay webhook; everything else passes straight through.
        if (! $request->is(self::WEBHOOK_PATH)) {
            return $next($request);
        }

        $configuredToken = config('sepay.webhook_token');

        // FAIL CLOSED: an unconfigured token must NOT mean "no auth". Reject.
        if (! is_string($configuredToken) || $configuredToken === '') {
            Log::warning('SePay webhook rejected: webhook token is not configured (fail-closed).', [
                'ip' => $request->ip(),
            ]);

            return $this->deny('Webhook không được cấu hình xác thực.', 'WEBHOOK_NOT_CONFIGURED', 401);
        }

        $providedToken = $this->bearerToken($request);

        if (! is_string($providedToken) || ! hash_equals($configuredToken, $providedToken)) {
            Log::warning('SePay webhook rejected: invalid token.', [
                'ip' => $request->ip(),
            ]);

            return $this->deny('Token không hợp lệ.', 'WEBHOOK_INVALID_TOKEN', 401);
        }

        // Optional IP allowlist (no-op unless configured for the sepay gateway).
        if ($ipDenied = $this->enforceIpAllowlist($request)) {
            return $ipDenied;
        }

        return $next($request);
    }

    /**
     * Enforce the IP allowlist for the sepay gateway when configured.
     * Returns a deny response, or null when allowed / not configured.
     */
    private function enforceIpAllowlist(Request $request): ?JsonResponse
    {
        if (! config('fraud.webhooks.enabled', true)) {
            return null;
        }

        $config = config('fraud.webhooks.gateways.sepay');

        if (! is_array($config)) {
            return null;
        }

        if (($config['skip_ip_check_on_local'] ?? false) && app()->environment('local', 'testing')) {
            return null;
        }

        $allowedIps = $this->normalizeIps($config['allowed_ips'] ?? []);

        if (empty($allowedIps)) {
            return null;
        }

        $ip = $request->ip();

        foreach ($allowedIps as $allowed) {
            if ($ip !== null && IpUtils::checkIp($ip, $allowed)) {
                return null;
            }
        }

        Log::warning('SePay webhook blocked by IP guard.', [
            'ip' => $ip,
        ]);

        if ($user = auth()->user()) {
            AbuseMonitor::record($user, 'payment_webhook', [
                'type' => 'INVALID_IP',
                'gateway' => 'sepay',
                'ip' => $ip,
            ]);
        }

        return $this->deny('IP không được phép.', 'WEBHOOK_IP_NOT_ALLOWED', 403);
    }

    /**
     * Extract the token from an `Authorization: Apikey <token>` header, matching
     * the vendor controller's extraction so a correct token still passes through.
     */
    private function bearerToken(Request $request): ?string
    {
        $header = $request->header('Authorization', '');

        $position = strrpos($header, 'Apikey ');

        if ($position !== false) {
            $header = substr($header, $position + 7);

            return str_contains($header, ',') ? (strstr($header, ',', true) ?: null) : $header;
        }

        return null;
    }

    private function normalizeIps(array|string $ips): array
    {
        if (is_string($ips)) {
            $ips = array_map('trim', explode(',', $ips));
        }

        return array_filter($ips);
    }

    private function deny(string $message, string $code, int $status): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'code' => $code,
        ], $status);
    }
}
