<?php

namespace App\Http\Middleware;

use App\Support\SecuritySettings;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

/**
 * Rate limiting middleware cho API routes.
 *
 * - Authenticated users: Higher limits
 * - Unauthenticated users: Lower limits
 * - Per-IP tracking
 * - Configurable từ system settings
 */
class RateLimitApi
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, string $limiter = 'api'): Response
    {
        $user = auth('api')->user();

        // Determine limiter based on authentication status
        $limiterName = $user
            ? "api:authenticated:{$limiter}"
            : "api:public:{$limiter}";

        // Get limits from settings
        $maxAttempts = $user
            ? SecuritySettings::getRateLimit('api_authenticated', 'max_attempts', 120) // 120 requests
            : SecuritySettings::getRateLimit('api_public', 'max_attempts', 60); // 60 requests

        $decayMinutes = $user
            ? SecuritySettings::getRateLimit('api_authenticated', 'decay_minutes', 1) // Per minute
            : SecuritySettings::getRateLimit('api_public', 'decay_minutes', 1); // Per minute

        // Create unique key per user/IP
        $key = $user
            ? "{$limiterName}:user:{$user->id}"
            : "{$limiterName}:ip:{$request->ip()}";

        // Auth endpoints (login/forgot/reset/verify) need a MUCH stricter, per-account throttle to
        // defend against brute-force — the generic 60/min-per-IP is far too loose. Previously the
        // ':auth' limiter argument only changed the key namespace, not the limit.
        if ($limiter === 'auth') {
            $maxAttempts = SecuritySettings::getRateLimit('api_auth', 'max_attempts', 8);
            $decayMinutes = SecuritySettings::getRateLimit('api_auth', 'decay_minutes', 1);
            $email = strtolower(trim((string) $request->input('email')));
            // Per-IP AND per-email so one attacker can't spray many accounts from one IP, and one
            // account can't be hammered from many IPs.
            $key = "api:auth:ip:{$request->ip()}".($email !== '' ? ':email:'.sha1($email) : '');
        }

        // Check rate limit
        if (RateLimiter::tooManyAttempts($key, $maxAttempts)) {
            $seconds = RateLimiter::availableIn($key);

            return response()->json([
                'success' => false,
                'message' => 'Quá nhiều yêu cầu. Vui lòng thử lại sau '.ceil($seconds / 60).' phút.',
                'code' => 'RATE_LIMIT_EXCEEDED',
                'retry_after' => $seconds,
            ], 429)
                ->header('Retry-After', $seconds)
                ->header('X-RateLimit-Limit', $maxAttempts)
                ->header('X-RateLimit-Remaining', 0);
        }

        // Increment rate limit
        RateLimiter::hit($key, $decayMinutes * 60);

        // Get remaining attempts
        $remaining = $maxAttempts - RateLimiter::attempts($key);

        // Add rate limit headers
        $response = $next($request);

        // Check if response supports header() method (not StreamedResponse)
        if (method_exists($response, 'header')) {
            return $response
                ->header('X-RateLimit-Limit', $maxAttempts)
                ->header('X-RateLimit-Remaining', max(0, $remaining));
        }

        // For StreamedResponse or other response types, use headers->set()
        $response->headers->set('X-RateLimit-Limit', $maxAttempts);
        $response->headers->set('X-RateLimit-Remaining', max(0, $remaining));

        return $response;
    }
}
