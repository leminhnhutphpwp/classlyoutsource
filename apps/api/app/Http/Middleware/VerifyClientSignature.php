<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class VerifyClientSignature
{
    public function handle(Request $request, Closure $next)
    {
        $config = config('fraud.client_signature');

        if (! $config || ! ($config['enabled'] ?? false)) {
            return $next($request);
        }

        $clientId = $request->header('X-Client-Id');
        $signature = $request->header('X-Client-Signature');
        $timestamp = (int) $request->header('X-Client-Timestamp');
        $nonce = $request->header('X-Client-Nonce');

        if (! $clientId || ! $signature || ! $timestamp || ! $nonce) {
            return $this->fail('CLIENT_SIGNATURE_MISSING', 'Thiếu thông tin ký yêu cầu.', 401);
        }

        $clientConfig = $config['allowed_clients'][$clientId] ?? null;
        if (! $clientConfig || empty($clientConfig['secret'])) {
            return $this->fail('CLIENT_SIGNATURE_INVALID', 'Client không được phép.', 401);
        }

        $skew = $config['clock_skew'] ?? 120;
        if (abs(now()->timestamp - $timestamp) > $skew) {
            return $this->fail('CLIENT_SIGNATURE_EXPIRED', 'Yêu cầu đã quá hạn.', 401);
        }

        $replayKey = "client-signature:{$clientId}:{$nonce}";
        $replayTtl = $config['replay_ttl'] ?? 300;
        if (! Cache::add($replayKey, true, $replayTtl)) {
            return $this->fail('CLIENT_SIGNATURE_REPLAY', 'Yêu cầu bị trùng lặp.', 429);
        }

        if (! empty($clientConfig['ips']) && ! in_array($request->ip(), $clientConfig['ips'], true)) {
            return $this->fail('CLIENT_SIGNATURE_IP_DENIED', 'IP không hợp lệ.', 401);
        }

        $payload = $request->getContent();
        $signingString = implode('|', [
            strtoupper($request->getMethod()),
            $request->getPathInfo(),
            $timestamp,
            $nonce,
            hash('sha256', $payload),
        ]);

        $expectedSignature = hash_hmac('sha256', $signingString, $clientConfig['secret']);

        if (! hash_equals($expectedSignature, $signature)) {
            return $this->fail('CLIENT_SIGNATURE_MISMATCH', 'Chữ ký không hợp lệ.', 401);
        }

        return $next($request);
    }

    private function fail(string $code, string $message, int $status): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'code' => $code,
        ], $status);
    }
}
