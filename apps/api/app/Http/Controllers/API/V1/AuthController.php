<?php

namespace App\Http\Controllers\API\V1;

use App\Exceptions\SessionRevokedException;
use App\Http\Resources\UserResource;
use App\Models\Media;
use App\Models\PasswordResetCode;
use App\Models\User;
use App\Models\UserLock;
use App\Notifications\EmailVerificationNotification;
use App\Notifications\PasswordResetNotification;
use App\Services\LoginActivityService;
use App\Services\SessionGuard;
use App\Services\TwoFactorService;
use App\Support\CacheKeys;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Tymon\JWTAuth\Exceptions\TokenExpiredException;
use Tymon\JWTAuth\Exceptions\TokenInvalidException;
use Tymon\JWTAuth\Facades\JWTAuth;

class AuthController extends BaseController
{
    /**
     * Login user and return JWT token.
     */
    public function login(Request $request): JsonResponse
    {
        // Bước 1: validate email cơ bản để lấy được user theo email
        $emailValidator = Validator::make($request->all(), [
            'email' => 'required|email',
        ]);

        if ($emailValidator->fails()) {
            return $this->errorResponse(
                'Dữ liệu không hợp lệ',
                $emailValidator,
                'VALIDATION_ERROR',
                422
            );
        }

        $credentials = $request->only('email', 'password');

        // Check if user exists
        $user = User::where('email', $credentials['email'])->first();

        if (! $user) {
            $this->logLoginActivity(null, $request, [
                'email' => $credentials['email'],
                'status' => 'user_not_found',
                'message' => 'Email không tồn tại trong hệ thống',
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Email hoặc mật khẩu không đúng',
                'code' => 'UNAUTHENTICATED',
            ], 401);
        }

        // Ưu tiên check trạng thái tài khoản trước khi kiểm tra mật khẩu,
        // để tài khoản bị khóa/vô hiệu hóa luôn trả về mã lỗi tương ứng,
        // kể cả khi mật khẩu không đạt min length.

        // Check if user is active
        if (! $user->isActive()) {
            $this->logLoginActivity($user, $request, [
                'status' => 'account_inactive',
                'message' => 'Tài khoản đã bị vô hiệu hóa',
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Tài khoản đã bị vô hiệu hóa',
                'code' => 'ACCOUNT_INACTIVE',
            ], 403);
        }

        // Ops-fix A: a center-suspended account cannot log in (orthogonal to status; see isLoginBlocked()).
        if ($user->isLoginBlocked()) {
            $this->logLoginActivity($user, $request, [
                'status' => 'account_suspended',
                'message' => 'Tài khoản đã bị trung tâm tạm khóa',
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Tài khoản của bạn đã bị trung tâm tạm khóa. Vui lòng liên hệ trung tâm để được hỗ trợ.',
                'code' => 'ACCOUNT_SUSPENDED',
            ], 403);
        }

        // Nếu là học viên, check gia sư chủ có inactive/suspended không
        if ($user->isStudent()) {
            $ownerTutor = $user->getOwnerTutor();
            if ($ownerTutor && $ownerTutor->id !== $user->id && (! $ownerTutor->isActive() || $ownerTutor->isLoginBlocked())) {
                $this->logLoginActivity($user, $request, [
                    'status' => 'tutor_inactive',
                    'message' => 'Gia sư của học viên đã bị vô hiệu hóa',
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'Tài khoản gia sư của bạn tạm thời không khả dụng. Vui lòng liên hệ hỗ trợ để được hỗ trợ.',
                    'code' => 'TUTOR_INACTIVE',
                ], 403);
            }
        }

        // Check user lock (login)
        if ($user->isLockedFor('login') || $user->isLockedFor('all')) {
            $this->logLoginActivity($user, $request, [
                'status' => 'account_locked',
                'message' => 'Tài khoản đã bị tạm khóa',
            ]);

            /** @var UserLock|null $lock */
            $lock = $user->activeLocks()->orderByDesc('start_at')->first();

            return response()->json([
                'success' => false,
                'message' => 'Tài khoản đã bị tạm khóa',
                'code' => 'ACCOUNT_LOCKED',
                'data' => [
                    'reason' => $lock?->reason,
                    'locked_from' => $lock?->start_at?->toISOString(),
                    'locked_until' => $lock?->end_at?->toISOString(),
                    'type' => $lock?->type,
                ],
            ], 403);
        }

        // Bước 2: với tài khoản hợp lệ (active + không bị lock), mới validate mật khẩu
        $passwordValidator = Validator::make($request->all(), [
            'password' => 'required|string|min:6',
        ]);

        if ($passwordValidator->fails()) {
            return $this->errorResponse(
                'Dữ liệu không hợp lệ',
                $passwordValidator,
                'VALIDATION_ERROR',
                422
            );
        }

        // Verify password
        if (! Hash::check($credentials['password'], $user->password)) {
            $this->logLoginActivity($user, $request, [
                'email' => $credentials['email'],
                'status' => 'invalid_credentials',
                'message' => 'Sai mật khẩu',
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Email hoặc mật khẩu không đúng',
                'code' => 'UNAUTHENTICATED',
            ], 401);
        }

        //

        if ($sessionBlock = SessionGuard::enforce($user)) {
            $this->logLoginActivity($user, $request, [
                'status' => 'session_blocked',
                'message' => $sessionBlock['message'] ?? null,
                'context' => [
                    'code' => $sessionBlock['code'] ?? null,
                    'details' => $sessionBlock['details'] ?? null,
                ],
            ]);

            return response()->json([
                'success' => false,
                'message' => $sessionBlock['message'],
                'code' => $sessionBlock['code'],
                'details' => $sessionBlock['details'],
            ], $sessionBlock['status']);
        }

        // 2FA gate: if the user has confirmed TOTP 2FA, DO NOT issue a JWT here. Return a
        // short-lived signed challenge bound to this user instead; the real access/refresh
        // tokens are only minted by POST /auth/2fa/verify once the second factor checks out.
        // This guarantees no usable token ever leaves the server before the second factor.
        if ($user->hasTwoFactorEnabled()) {
            $challenge = app(TwoFactorService::class)->issueLoginChallenge($user);

            $this->logLoginActivity($user, $request, [
                'email' => $credentials['email'],
                'status' => '2fa_required',
                'message' => 'Yêu cầu xác thực hai lớp',
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Yêu cầu xác thực hai lớp',
                'data' => [
                    'requires_2fa' => true,
                    'challenge' => $challenge,
                ],
            ]);
        }

        return $this->issueLoginTokens($user, $request, $credentials['email']);
    }

    /**
     * Complete a 2FA login: validate the signed challenge, verify a TOTP or single-use
     * recovery code, then issue the real JWT through the shared token path. Public endpoint,
     * rate-limited under the ':auth' limiter.
     */
    public function verifyTwoFactor(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'challenge' => 'required|string',
            'code' => 'required|string',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse(
                'Dữ liệu không hợp lệ',
                $validator,
                'VALIDATION_ERROR',
                422
            );
        }

        $twoFactor = app(TwoFactorService::class);
        $user = $twoFactor->resolveLoginChallenge($request->input('challenge'));

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Phiên xác thực hai lớp không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
                'code' => 'INVALID_2FA_CHALLENGE',
            ], 401);
        }

        // Re-check account state at verify time (status / lock / suspension may have changed since step 1).
        if (! $user->isActive() || $user->isLoginBlocked()) {
            return response()->json([
                'success' => false,
                'message' => 'Tài khoản đã bị vô hiệu hóa',
                'code' => 'ACCOUNT_INACTIVE',
            ], 403);
        }

        if ($user->isLockedFor('login') || $user->isLockedFor('all')) {
            return response()->json([
                'success' => false,
                'message' => 'Tài khoản đã bị tạm khóa',
                'code' => 'ACCOUNT_LOCKED',
            ], 403);
        }

        if (! $user->hasTwoFactorEnabled()) {
            return response()->json([
                'success' => false,
                'message' => 'Xác thực hai lớp chưa được bật cho tài khoản này',
                'code' => 'TWO_FACTOR_NOT_ENABLED',
            ], 422);
        }

        if (! $twoFactor->verifySecondFactor($user, $request->input('code'))) {
            $this->logLoginActivity($user, $request, [
                'status' => 'invalid_2fa_code',
                'message' => 'Mã xác thực hai lớp không đúng',
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Mã xác thực không đúng',
                'code' => 'INVALID_2FA_CODE',
            ], 422);
        }

        if ($sessionBlock = SessionGuard::enforce($user)) {
            $this->logLoginActivity($user, $request, [
                'status' => 'session_blocked',
                'message' => $sessionBlock['message'] ?? null,
            ]);

            return response()->json([
                'success' => false,
                'message' => $sessionBlock['message'],
                'code' => $sessionBlock['code'],
                'details' => $sessionBlock['details'] ?? null,
            ], $sessionBlock['status']);
        }

        return $this->issueLoginTokens($user, $request);
    }

    /**
     * Issue access + refresh tokens, register the session and log a successful login. This is
     * the single token-minting path shared by password login and 2FA verify, so refresh-token
     * TTL, custom claims and session registration stay identical across both entry points.
     *
     * @param  Request  $request
     * @param  string|null  $email
     * @return JsonResponse
     */
    /**
     * Mint a short-lived access token, tagged `typ=access` so it is the only kind accepted on
     * access-protected endpoints (see AuthenticateApi).
     */
    private function mintAccessToken(User $user): string
    {
        return JWTAuth::customClaims(['typ' => 'access'])->fromUser($user);
    }

    /**
     * Mint a long-lived refresh token, tagged `typ=refresh`. AuthenticateApi rejects it as a bearer
     * credential, so a captured refresh token can never double as a 14-day access token.
     */
    private function mintRefreshToken(User $user): string
    {
        $ttl = (int) config('jwt.refresh_ttl', 20160); // minutes

        return JWTAuth::customClaims([
            'typ' => 'refresh',
            'exp' => now()->addMinutes($ttl)->timestamp,
        ])->fromUser($user);
    }

    private function issueLoginTokens(User $user, Request $request, ?string $email = null): JsonResponse
    {
        // Generate JWT access token (short-lived for security)
        $accessToken = $this->mintAccessToken($user);

        // Generate refresh token (long-lived, separate TTL — 2 weeks default)
        $refreshTokenTTL = (int) config('jwt.refresh_ttl', 20160); // minutes
        $refreshToken = $this->mintRefreshToken($user);

        $session = SessionGuard::register($user, $refreshToken, $request);

        $this->logLoginActivity($user, $request, [
            'email' => $email ?? $user->email,
            'status' => 'success',
            'is_success' => true,
            'message' => 'Đăng nhập thành công',
            'context' => [
                'session_id' => $session->session_id,
            ],
        ]);

        // Only return minimal user info for security
        return response()->json([
            'success' => true,
            'message' => 'Đăng nhập thành công',
            'data' => [
                'token' => $accessToken,
                'refresh_token' => $refreshToken,
                'token_type' => 'bearer',
                'expires_in' => auth('api')->factory()->getTTL() * 60, // Access token TTL (seconds)
                'refresh_expires_in' => $refreshTokenTTL * 60, // Refresh token TTL (seconds)
                'session_id' => $session->session_id,
            ],
        ]);
    }

    private function logLoginActivity(?User $user, Request $request, array $attributes = []): void
    {
        LoginActivityService::record($user, $request, $attributes);
    }

    /**
     * Get the authenticated user.
     */
    public function me(): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Chưa xác thực', null, 'UNAUTHENTICATED', 401);
        }

        // Cache key cho user data
        $cacheKey = CacheKeys::currentUser($user->id);

        // SWR (stale-while-revalidate): serve fresh for 5 min, then serve stale up to 15 min while
        // refreshing in the background. Prevents a thundering herd on this very hot endpoint when the
        // key expires under concurrency. Invalidated on permission sync / profile update.
        $data = Cache::flexible($cacheKey, [300, 900], function () use ($user) {
            // Eager load relationships để tránh N+1 queries
            $user->loadMissing([
                'roles',
                'permissions',
            ]);

            // Get avatar URL from Media if available (lazy load)
            $avatarUrl = null;
            if ($user->avatar_media_id) {
                // Sử dụng relationship nếu có, hoặc query trực tiếp
                $media = Media::find($user->avatar_media_id);
                if ($media) {
                    $avatarUrl = $media->url ?? Storage::disk($media->disk ?? 'public')->url($media->path);
                }
            } elseif ($user->avatar) {
                // Bỏ qua Storage::exists() check để tăng tốc, chỉ generate URL
                $avatarUrl = Storage::disk('public')->url($user->avatar);
            }

            // Lấy permissions trực tiếp từ Spatie (role-based)
            $effectivePermissions = $user->getAllPermissions()->pluck('name')->all();
            $permissionsOrganized = ['all' => $effectivePermissions];

            // Return minimal user info for security
            $data = [
                'user' => [
                    '_id' => $user->hash_id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'pending_email' => $user->pending_email,
                    'email_verified' => $user->email_verified_at !== null,
                    'email_verified_at' => $user->email_verified_at?->toISOString(),
                    'phone' => $user->phone,
                    'avatar' => $avatarUrl,
                    'avatar_path' => $user->avatar,
                    'avatar_media_id' => $user->avatar_media_id,
                    'role' => $user->role,
                    // Vai trò trong TỔ CHỨC + nhãn hiển thị đã tính sẵn.
                    //
                    // Theo thiết kế, mọi người trong trung tâm đều có users.role = 'tutor' — kể cả chủ
                    // trung tâm (xem docs/design/organization-mvp.md §0). Nếu frontend tự map từ
                    // `role` thì giám đốc, quản lý học vụ và kế toán đều bị gắn nhãn "Giáo viên".
                    // Trả sẵn ở đây để mọi màn hình (header, hồ sơ, danh sách người dùng) dùng CHUNG
                    // một nguồn, thay vì mỗi nơi tự đoán một kiểu.
                    'org_role' => $user->orgRole(),
                    'role_label' => $this->roleLabelFor($user),
                    'status' => $user->status,
                    'is_tutor' => $user->isTutor(),
                    'theme_key' => $user->theme_key ?? 'classly-red-white',
                    'mode' => $user->mode ?? 'light',
                    'roles' => $user->getRoleNames()->toArray(), // Convert to array để cache
                    'permissions' => $effectivePermissions, // Flat array for backward compatibility
                    'permissions_organized' => $permissionsOrganized, // Organized by groups
                ],
            ];

            return $data;
        });

        return $this->successResponse($data);
    }

    /**
     * Refresh JWT token using refresh_token.
     */
    public function refresh(Request $request): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                'refresh_token' => 'required|string',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse(
                    'Refresh token là bắt buộc',
                    $validator,
                    'VALIDATION_ERROR',
                    422
                );
            }

            // Set the refresh token as the current token to validate and refresh
            $refreshToken = $request->refresh_token;

            // Try to authenticate with refresh token
            $user = JWTAuth::setToken($refreshToken)->authenticate();

            if (! $user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Refresh token không hợp lệ',
                    'code' => 'INVALID_REFRESH_TOKEN',
                ], 401);
            }

            // Reject an access token presented at the refresh endpoint. Legacy tokens minted before the
            // typ claim existed have no `typ` and are still accepted (transitional) — only an explicit
            // access token is refused here.
            if (JWTAuth::setToken($refreshToken)->getPayload()->get('typ') === 'access') {
                return response()->json([
                    'success' => false,
                    'message' => 'Refresh token không hợp lệ',
                    'code' => 'INVALID_REFRESH_TOKEN',
                ], 401);
            }

            // Generate new access token
            $newAccessToken = $this->mintAccessToken($user);

            // Generate new refresh token (rotate refresh token for security)
            $refreshTokenTTL = (int) config('jwt.refresh_ttl', 20160);
            $newRefreshToken = $this->mintRefreshToken($user);

            // Rotate the session. If the presented refresh token no longer maps
            // to an active session (logged out / password reset / already rotated),
            // this throws and we reject below — never mint a fresh session.
            $session = SessionGuard::rotate($user, $refreshToken, $newRefreshToken, $request);

            // Blacklist old refresh token so it can never be replayed.
            try {
                JWTAuth::setToken($refreshToken)->invalidate();
            } catch (\Exception $e) {
                // Ignore if token is already invalid
            }

            return response()->json([
                'success' => true,
                'message' => 'Làm mới token thành công',
                'data' => [
                    'token' => $newAccessToken,
                    'refresh_token' => $newRefreshToken,
                    'token_type' => 'bearer',
                    'expires_in' => auth('api')->factory()->getTTL() * 60,
                    'refresh_expires_in' => $refreshTokenTTL * 60,
                    'session_id' => $session->session_id,
                ],
            ]);
        } catch (SessionRevokedException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.',
                'code' => 'SESSION_REVOKED',
            ], 401);
        } catch (TokenExpiredException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Refresh token đã hết hạn. Vui lòng đăng nhập lại.',
                'code' => 'REFRESH_TOKEN_EXPIRED',
            ], 401);
        } catch (TokenInvalidException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Refresh token không hợp lệ',
                'code' => 'INVALID_REFRESH_TOKEN',
            ], 401);
        } catch (\Exception $e) {
            Log::channel('auth')->error('Token refresh failed', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Không thể làm mới token',
                'code' => 'TOKEN_REFRESH_FAILED',
            ], 401);
        }
    }

    /**
     * Logout user (invalidate token).
     */
    public function logout(Request $request): JsonResponse
    {
        try {
            // Blacklist the ACCESS token (current bearer token).
            auth('api')->logout();

            // Blacklist the REFRESH token too, otherwise it stays usable for its
            // full 14-day TTL and can mint new access tokens after logout.
            $refreshToken = $request->get('refresh_token');
            if ($refreshToken) {
                try {
                    JWTAuth::setToken($refreshToken)->invalidate();
                } catch (\Exception $e) {
                    // Already invalid/expired — nothing to blacklist.
                }
            }

            // Mark the associated session revoked so any surviving refresh token
            // can no longer rotate (defense in depth if the blacklist is flushed).
            SessionGuard::revokeByRefreshToken($refreshToken);

            return response()->json([
                'success' => true,
                'message' => 'Đăng xuất thành công',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Đăng xuất thất bại',
                'code' => 'LOGOUT_FAILED',
            ], 500);
        }
    }

    /**
     * Update user profile.
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'phone' => 'sometimes|nullable|string|max:20',
            'address' => 'sometimes|nullable|string',
            'bio' => 'sometimes|nullable|string',
            'avatar' => 'sometimes|nullable|url',
            'theme_key' => 'sometimes|nullable|string|max:50',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse(
                'Dữ liệu không hợp lệ',
                $validator,
                'VALIDATION_ERROR',
                422
            );
        }

        try {
            $user->update($request->only(['name', 'phone', 'address', 'bio', 'avatar', 'theme_key']));

            // Clear cache khi update profile
            Cache::forget(CacheKeys::currentUser($user->id));

            return response()->json([
                'success' => true,
                'message' => 'Cập nhật thông tin cá nhân thành công',
                'data' => [
                    'user' => new UserResource($user->fresh()),
                ],
            ]);
        } catch (\Exception $e) {
            Log::channel('auth')->error('Profile update failed', [
                'user_id' => $user->id ?? null,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Cập nhật thất bại',
                'code' => 'UPDATE_FAILED',
            ], 500);
        }
    }

    /**
     * Update user theme mode (light/dark).
     */
    public function updateMode(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Chưa xác thực', null, 'UNAUTHENTICATED', 401);
        }

        $validator = Validator::make($request->all(), [
            'mode' => 'required|string|in:light,dark',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse(
                'Dữ liệu không hợp lệ',
                $validator,
                'VALIDATION_ERROR',
                422
            );
        }

        try {
            $user->update([
                'mode' => $request->mode,
            ]);

            // Clear cache khi update mode
            Cache::forget(CacheKeys::currentUser($user->id));

            return $this->successResponse(
                [
                    'user' => [
                        '_id' => $user->hash_id,
                        'theme_key' => $user->theme_key ?? 'classly-red-white',
                        'mode' => $user->mode ?? 'light',
                    ],
                ],
                'Cập nhật chế độ hiển thị thành công'
            );
        } catch (\Exception $e) {
            Log::channel('auth')->error('Theme mode update failed', [
                'user_id' => $user->id ?? null,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse(
                'Cập nhật chế độ hiển thị thất bại',
                null,
                'UPDATE_FAILED',
                500
            );
        }
    }

    /**
     * Change password.
     */
    public function changePassword(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        $validator = Validator::make($request->all(), [
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse(
                'Dữ liệu không hợp lệ',
                $validator,
                'VALIDATION_ERROR',
                422
            );
        }

        if (! Hash::check($request->current_password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Mật khẩu hiện tại không đúng',
                'code' => 'INVALID_PASSWORD',
            ], 422);
        }

        try {
            $user->update([
                'password' => Hash::make($request->new_password),
            ]);

            // Security: a password change must kill every existing session so a
            // previously-compromised token can no longer be used. Revoking all
            // sessions stops every outstanding refresh token from rotating, and
            // blacklisting the current access token cuts the active bearer off.
            SessionGuard::revokeAllForUser($user);

            try {
                auth('api')->logout();
            } catch (\Exception $e) {
                // No/invalid current token — nothing to blacklist.
            }

            return response()->json([
                'success' => true,
                'message' => 'Đổi mật khẩu thành công',
            ]);
        } catch (\Exception $e) {
            Log::channel('auth')->error('Change password failed', [
                'user_id' => $user->id ?? null,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Đổi mật khẩu thất bại',
                'code' => 'PASSWORD_CHANGE_FAILED',
            ], 500);
        }
    }

    /**
     * Send password reset code via email.
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        // No `exists:` rule: whether the email is registered must not be
        // observable from the response (user enumeration). Any address that
        // isn't a valid, active, unlocked account gets the SAME generic 200
        // below — we simply skip creating/sending a code for it.
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse(
                'Dữ liệu không hợp lệ',
                $validator,
                'VALIDATION_ERROR',
                422
            );
        }

        // Identical response for every outcome so an attacker cannot tell a
        // missing account from an inactive/locked one.
        $genericResponse = response()->json([
            'success' => true,
            'message' => 'Nếu tài khoản tồn tại, mã xác thực đã được gửi.',
        ]);

        try {
            $email = $request->email;
            $user = User::where('email', $email)->first();

            // Silently no-op for accounts that cannot receive a reset code:
            // non-existent, inactive, login-locked, or owned by an inactive tutor.
            if (! $user || ! $user->isActive()) {
                return $genericResponse;
            }

            if ($user->isLockedFor('login') || $user->isLockedFor('all')) {
                return $genericResponse;
            }

            if ($user->isStudent()) {
                $ownerTutor = $user->getOwnerTutor();
                if ($ownerTutor && $ownerTutor->id !== $user->id && (! $ownerTutor->isActive() || $ownerTutor->isLoginBlocked())) {
                    return $genericResponse;
                }
            }

            // Create password reset code
            $resetCode = PasswordResetCode::createForEmail($email);

            // Send notification - wrap trong try-catch riêng để tránh log lỗi không cần thiết
            try {
                // Queue notification để không block response
                $user->notify((new PasswordResetNotification($resetCode->code, $resetCode->getRemainingMinutes()))->delay(now()->addSeconds(2)));
            } catch (\Exception $mailException) {
                // Log lỗi gửi email nhưng vẫn trả về generic response — the code was
                // created and the user can retry; failing here must not leak existence.
                Log::channel('auth')->warning('Failed to send password reset email', [
                    'user_id' => $user->id,
                    'email' => $email,
                    'error' => $mailException->getMessage(),
                ]);
            }

            return $genericResponse;

        } catch (\Exception $e) {
            Log::channel('auth')->error('Password reset code creation failed', [
                'email' => $request->email ?? null,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Still generic: don't turn a server error into an enumeration signal.
            return $genericResponse;
        }
    }

    /**
     * Verify password reset code.
     */
    public function verifyCode(Request $request): JsonResponse
    {
        // No `exists:` rule — a bad email must be indistinguishable from a bad code.
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'code' => 'required|string|size:6',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse(
                'Dữ liệu không hợp lệ',
                $validator,
                'VALIDATION_ERROR',
                422
            );
        }

        // Single generic invalid-code error reused for every failure branch
        // (missing/inactive/locked account OR wrong/expired code) so the response
        // never leaks whether the account exists or its state.
        $invalidCode = response()->json([
            'success' => false,
            'message' => 'Mã xác nhận không hợp lệ hoặc đã hết hạn',
            'code' => 'INVALID_CODE',
        ], 422);

        try {
            $email = $request->email;
            $code = $request->code;

            // Account must exist, be active, unlocked, and (for students) owned by
            // an active tutor — otherwise fall through to the generic invalid-code.
            $user = User::where('email', $email)->first();

            if (! $user || ! $user->isActive() || $user->isLoginBlocked()) {
                return $invalidCode;
            }

            if ($user->isLockedFor('login') || $user->isLockedFor('all')) {
                return $invalidCode;
            }

            if ($user->isStudent()) {
                $ownerTutor = $user->getOwnerTutor();
                if ($ownerTutor && $ownerTutor->id !== $user->id && (! $ownerTutor->isActive() || $ownerTutor->isLoginBlocked())) {
                    return $invalidCode;
                }
            }

            // Verify code (bounded by the per-code attempt counter in the model)
            $resetCode = PasswordResetCode::verifyCode($email, $code);

            if (! $resetCode) {
                return $invalidCode;
            }

            return response()->json([
                'success' => true,
                'message' => 'Mã xác nhận hợp lệ',
                'data' => [
                    'email' => $email,
                    'expires_in' => $resetCode->getRemainingMinutes(),
                ],
            ]);

        } catch (\Exception $e) {
            Log::channel('auth')->error('Verify reset code failed', [
                'email' => $request->email ?? null,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Xác thực mã thất bại',
                'code' => 'VERIFY_CODE_FAILED',
            ], 500);
        }
    }

    /**
     * Reset password with verification code.
     */
    public function resetPassword(Request $request): JsonResponse
    {
        // No `exists:` rule — a bad email must be indistinguishable from a bad code.
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'code' => 'required|string|size:6',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse(
                'Dữ liệu không hợp lệ',
                $validator,
                'VALIDATION_ERROR',
                422
            );
        }

        // Single generic invalid-code error reused for every failure branch
        // (missing/inactive/locked account OR wrong/expired code) so the response
        // never leaks whether the account exists or its state.
        $invalidCode = response()->json([
            'success' => false,
            'message' => 'Mã xác nhận không hợp lệ hoặc đã hết hạn',
            'code' => 'INVALID_CODE',
        ], 422);

        try {
            $email = $request->email;
            $code = $request->code;
            $newPassword = $request->new_password;

            // Get user & check trạng thái trước khi cho reset mật khẩu
            $user = User::where('email', $email)->first();

            if (! $user || ! $user->isActive() || $user->isLoginBlocked()) {
                return $invalidCode;
            }

            if ($user->isLockedFor('login') || $user->isLockedFor('all')) {
                return $invalidCode;
            }

            if ($user->isStudent()) {
                $ownerTutor = $user->getOwnerTutor();
                if ($ownerTutor && $ownerTutor->id !== $user->id && (! $ownerTutor->isActive() || $ownerTutor->isLoginBlocked())) {
                    return $invalidCode;
                }
            }

            // Verify code (bounded by the per-code attempt counter in the model)
            $resetCode = PasswordResetCode::verifyCode($email, $code);

            if (! $resetCode) {
                return $invalidCode;
            }

            // Update password and verify email (since user proved email ownership)
            $user->update([
                'password' => Hash::make($newPassword),
                'email_verified_at' => now(), // Auto-verify email after successful password reset
            ]);

            // Mark code as used
            $resetCode->markAsUsed();

            // Security: a password reset is a compromise-recovery action, so it
            // MUST invalidate any access an attacker already holds. Revoke every
            // active session — this kills all outstanding refresh tokens (they can
            // no longer rotate). Remaining access tokens are short-lived (jwt.ttl)
            // and cannot be renewed once their session is gone.
            SessionGuard::revokeAllForUser($user);

            return response()->json([
                'success' => true,
                'message' => 'Đặt lại mật khẩu thành công',
                'data' => [
                    'email' => $email,
                ],
            ]);

        } catch (\Exception $e) {
            Log::channel('auth')->error('Reset password failed', [
                'email' => $request->email ?? null,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Đặt lại mật khẩu thất bại',
                'code' => 'RESET_PASSWORD_FAILED',
            ], 500);
        }
    }

    /**
     * Send email verification code.
     *
     * Use cases:
     * - User mới đăng ký, chưa xác thực email
     * - User đã đổi email, cần gửi lại mã xác thực cho email mới
     * - User muốn gửi lại mã vì mã cũ hết hạn
     *
     * Sau khi gọi API này, user cần gọi POST /auth/verify-email với mã code.
     */
    public function sendVerificationEmail(): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Chưa xác thực', null, 'UNAUTHENTICATED', 401);
        }

        // Check if user account is active
        if ($user->status !== 'active') {
            return $this->errorResponse('Tài khoản đã bị vô hiệu hóa hoặc đã bị xóa', null, 'ACCOUNT_INACTIVE', 403);
        }

        try {
            // Determine target email (prioritize pending email if change is in progress)
            $targetEmail = $user->pending_email ?: $user->email;
            $isChangeEmail = ! empty($user->pending_email);

            // Create verification code for target email
            $resetCode = PasswordResetCode::createForEmail($targetEmail);

            // Send verification email
            try {
                if ($isChangeEmail) {
                    // Send to pending email - queue notification
                    Notification::route('mail', $targetEmail)
                        ->notify((new EmailVerificationNotification(
                            $resetCode->code,
                            $resetCode->getRemainingMinutes()
                        ))->delay(now()->addSeconds(2)));
                } else {
                    // Send to current email - queue notification
                    $user->notify((new EmailVerificationNotification(
                        $resetCode->code,
                        $resetCode->getRemainingMinutes()
                    ))->delay(now()->addSeconds(2)));
                }
            } catch (\Exception $e) {
                Log::channel('auth')->warning('Failed to send email verification: '.$e->getMessage());

                return $this->errorResponse('Không thể gửi email xác thực. Vui lòng thử lại sau.', null, 'SEND_EMAIL_FAILED', 500);
            }

            return $this->successResponse([
                'email' => $targetEmail,
                'expires_in' => $resetCode->getRemainingMinutes(),
                'message' => 'Mã xác thực đã được gửi đến email '.$targetEmail,
                'next_step' => 'verify_email',
            ], 'Mã xác thực đã được gửi đến email của bạn');
        } catch (\Exception $e) {
            Log::channel('auth')->error('Send verification email failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse('Không thể gửi mã xác thực. Vui lòng thử lại sau.', null, 'SEND_VERIFICATION_ERROR', 500);
        }
    }

    /**
     * Verify email address with code.
     *
     * Flow:
     * 1. User nhận mã 6 số từ email (từ send-verification-email hoặc change-email)
     * 2. Gọi API này với mã code
     * 3. Hệ thống kiểm tra mã có hợp lệ không (theo email hiện tại của user)
     * 4. Nếu hợp lệ: đánh dấu email_verified_at = now() và xóa mã
     *
     * Use cases:
     * - Xác thực email lần đầu sau khi đăng ký
     * - Xác thực email mới sau khi đổi email (change-email tự động gửi mã)
     * - Xác thực lại email nếu đã gửi lại mã (send-verification-email)
     *
     * Note: Mã code phải được tạo cho email hiện tại của user.
     * - Nếu vừa đổi email: mã được tạo cho email MỚI (từ change-email)
     * - Nếu chưa đổi email: mã được tạo cho email hiện tại (từ send-verification-email)
     */
    public function verifyEmail(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Chưa xác thực', null, 'UNAUTHENTICATED', 401);
        }

        $validator = Validator::make($request->all(), [
            'code' => 'required|string|size:6',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        try {
            // Check process: Pending Email Change OR Current Email Verification
            $targetEmail = $user->pending_email ?: $user->email;
            $isChangeEmail = ! empty($user->pending_email);

            // Tìm mã xác thực theo target email
            $resetCode = PasswordResetCode::where('email', $targetEmail)
                ->where('code', $request->code)
                ->where('used', false)
                ->where('expires_at', '>', now())
                ->first();

            if (! $resetCode) {
                return $this->errorResponse('Mã xác thực không hợp lệ hoặc đã hết hạn', null, 'INVALID_CODE', 422);
            }

            // Use database transaction to ensure consistency
            DB::transaction(function () use ($user, $isChangeEmail, $targetEmail, $resetCode) {
                if ($isChangeEmail) {
                    // Finalize email change
                    $user->update([
                        'email' => $targetEmail,
                        'email_verified_at' => now(),
                        'pending_email' => null,
                    ]);
                } else {
                    // Verify current email
                    $user->update([
                        'email_verified_at' => now(),
                    ]);
                }

                // Mark code as used instead of deleting for audit trail
                $resetCode->markAsUsed();
            });

            $message = $isChangeEmail ? 'Đổi email và xác thực thành công' : 'Xác thực email thành công';

            // Clear cache để API /me trả về thông tin mới nhất
            Cache::forget(CacheKeys::currentUser($user->id));

            // Refresh user để đảm bảo có data mới nhất
            $user->refresh();

            return $this->successResponse([
                'user' => new UserResource($user),
                'email_verified' => true,
            ], $message);
        } catch (\Exception $e) {
            Log::channel('auth')->error('Verify email failed', [
                'user_id' => $user->id ?? null,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse('Không thể xác thực email. Vui lòng thử lại sau.', null, 'VERIFY_EMAIL_ERROR', 500);
        }
    }

    /**
     * Nhãn vai trò hiển thị cho người dùng, ưu tiên vai trò trong TỔ CHỨC.
     *
     * users.role của mọi thành viên trung tâm đều là 'tutor' (kể cả chủ trung tâm), nên nếu
     * chỉ dựa vào cột đó thì giám đốc/quản lý/kế toán đều hiện "Giáo viên". Nhãn ở đây khớp với
     * ORG_ROLE_LABELS phía frontend (apps/app/src/app/organization/_components/org-ui.tsx).
     *
     * LƯU Ý: đây chỉ là nhãn HIỂN THỊ. Đừng dùng nó để phân quyền — mọi kiểm tra quyền phải
     * dựa trên org_role / capability / permission.
     */
    private function roleLabelFor(User $user): string
    {
        if ($user->isSuperAdmin()) {
            return 'Quản trị hệ thống';
        }

        return match (true) {
            $user->role === 'admin' => 'Quản trị viên',
            $user->role === 'student' => 'Học viên',
            $user->role === 'parent' => 'Phụ huynh',
            default => match ($user->orgRole()) {
                'owner' => 'Chủ trung tâm',
                'manager' => 'Quản lý',
                'accountant' => 'Kế toán',
                default => 'Giáo viên',
            },
        };
    }
}
