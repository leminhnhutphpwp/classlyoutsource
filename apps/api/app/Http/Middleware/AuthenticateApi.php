<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Tymon\JWTAuth\Exceptions\TokenExpiredException;
use Tymon\JWTAuth\Facades\JWTAuth;

class AuthenticateApi extends Middleware
{
    /**
     * Handle an incoming request.
     *
     * @param  Request  $request
     * @param  string[]  ...$guards
     * @return mixed
     */
    public function handle($request, Closure $next, ...$guards)
    {
        // CRITICAL: Check if this is API request FIRST
        $isApi = $this->isApiRequest($request);

        // For API requests, check authentication manually and return JSON if unauthenticated
        if ($isApi) {
            if (empty($guards)) {
                $guards = ['api']; // Default to 'api' guard for API requests
            }

            // Try to authenticate with each guard
            foreach ($guards as $guard) {
                try {
                    // Set the guard first
                    $this->auth->shouldUse($guard);

                    // Try to authenticate the request (this will parse JWT token from Authorization header)
                    if ($this->auth->guard($guard)->check()) {
                        // A refresh token must never be accepted as an access credential — otherwise the
                        // long-lived (14-day) refresh token would work as a bearer access token, defeating
                        // the short access TTL. Read typ from the exact bearer the client sent (not the
                        // guard's payload, which can carry singleton state); legacy tokens without a `typ`
                        // claim are still allowed. Only block when we can positively read typ=refresh.
                        if ($this->bearerTokenType($request) === 'refresh') {
                            break;
                        }

                        // Ops-fix A: a center-suspended account is revoked IMMEDIATELY even with a still-valid
                        // (unexpired) access token. This is the real "revoke session" — killing refresh tokens
                        // alone would leave the live bearer working until its short TTL. Reject at the auth
                        // resolution point so EVERY protected route fails closed for a suspended user.
                        $authUser = $this->auth->guard($guard)->user();
                        if ($authUser instanceof User && $authUser->isLoginBlocked()) {
                            return response()->json([
                                'success' => false,
                                'message' => 'Tài khoản của bạn đã bị trung tâm tạm khóa. Vui lòng liên hệ trung tâm để được hỗ trợ.',
                                'code' => 'ACCOUNT_SUSPENDED',
                            ], 401);
                        }

                        return $next($request);
                    }
                } catch (\Exception $e) {
                    // JWT parsing error - continue to next guard or return 401
                    continue;
                }
            }

            // User is not authenticated - return JSON response directly WITHOUT throwing exception
            // This prevents Exception Handler from calling redirectTo() which tries to route('login')
            // CRITICAL: Return immediately, do NOT call parent::handle() which would throw exception

            // Distinguish a well-formed but EXPIRED access token from an
            // absent/invalid one so the client knows to refresh vs re-login.
            // (The guard's check() swallows TokenExpiredException, so we probe
            // the bearer directly here where getPayload() actually throws.)
            if ($this->bearerTokenExpired($request)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Phiên đăng nhập đã hết hạn. Vui lòng làm mới token.',
                    'code' => 'TOKEN_EXPIRED',
                ], 401);
            }

            return response()->json([
                'success' => false,
                'message' => 'Chưa xác thực. Vui lòng đăng nhập.',
                'code' => 'UNAUTHENTICATED',
            ], 401);
        }

        // For web requests, use parent behavior (will throw exception for redirect)
        // But ensure redirectTo() returns null if route doesn't exist
        return parent::handle($request, $next, ...$guards);
    }

    /**
     * Read the `typ` claim from the request's bearer token, or null if there's no readable token.
     * Isolated from the guard/JWTAuth singleton state so it reflects exactly what the client sent.
     */
    protected function bearerTokenType(Request $request): ?string
    {
        $bearer = $request->bearerToken();
        if (! $bearer) {
            return null;
        }

        try {
            return JWTAuth::setToken($bearer)->getPayload()->get('typ');
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * Whether the request carries a well-formed but expired bearer token.
     * getPayload() validates the `exp` claim and throws TokenExpiredException,
     * unlike the guard's check() which silently swallows it. Any other failure
     * (absent/malformed/otherwise-invalid token) returns false so it falls back
     * to the generic UNAUTHENTICATED response.
     */
    protected function bearerTokenExpired(Request $request): bool
    {
        $bearer = $request->bearerToken();
        if (! $bearer) {
            return false;
        }

        try {
            JWTAuth::setToken($bearer)->getPayload();

            return false;
        } catch (TokenExpiredException $e) {
            return true;
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * Get the path the user should be redirected to when they are not authenticated.
     */
    protected function redirectTo(Request $request): ?string
    {
        // For API requests, don't redirect - return null to prevent RouteNotFoundException
        if ($this->isApiRequest($request)) {
            return null;
        }

        // For web requests, try to redirect to login but return null if route doesn't exist
        try {
            if (Route::has('login')) {
                return route('login');
            }
        } catch (\Exception $e) {
            // Route doesn't exist
        }

        // Fallback: return null to prevent RouteNotFoundException
        return null;
    }

    /**
     * Determine if the request is an API request.
     */
    protected function isApiRequest(Request $request): bool
    {
        // Check if request is to API routes (starts with /api)
        if ($request->is('api/*')) {
            return true;
        }

        // Check if request expects JSON response
        if ($request->expectsJson()) {
            return true;
        }

        // Check if request has Accept: application/json header
        if ($request->header('Accept') === 'application/json') {
            return true;
        }

        return false;
    }
}
