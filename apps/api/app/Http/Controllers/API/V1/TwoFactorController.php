<?php

namespace App\Http\Controllers\API\V1;

use App\Models\User;
use App\Services\TwoFactorService;
use App\Support\CacheKeys;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

/**
 * TOTP two-factor management for the authenticated user (enable → confirm → disable,
 * plus recovery-code regeneration). The login-time challenge/verify half lives in
 * AuthController so it can reuse the exact token-issuing path.
 *
 * Fail-closed: enabling requires the current password; disabling / regenerating requires a
 * valid second factor (TOTP or recovery code) OR the current password.
 */
class TwoFactorController extends BaseController
{
    public function __construct(private readonly TwoFactorService $twoFactor) {}

    /**
     * Step 1 — generate (but do NOT yet confirm) a secret and return the provisioning URI +
     * raw secret so the client can render a QR / offer manual entry. Requires the current
     * password so a hijacked session can't silently arm 2FA.
     */
    public function enable(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();
        if (! $user) {
            return $this->errorResponse('Chưa xác thực', null, 'UNAUTHENTICATED', 401);
        }

        $validator = Validator::make($request->all(), [
            'password' => 'required|string',
        ]);
        if ($validator->fails()) {
            return $this->errorResponse('Dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        if (! Hash::check($request->input('password'), $user->password)) {
            return $this->errorResponse('Mật khẩu hiện tại không đúng', null, 'INVALID_PASSWORD', 422);
        }

        if ($user->hasTwoFactorEnabled()) {
            return $this->errorResponse(
                'Xác thực hai lớp đã được bật. Vui lòng tắt trước khi thiết lập lại.',
                null,
                'TWO_FACTOR_ALREADY_ENABLED',
                409
            );
        }

        // Generate a fresh secret and stash it (unconfirmed). Recovery codes are only minted
        // at confirm-time, so a half-finished enable leaves nothing usable behind.
        $secret = $this->twoFactor->generateSecret();
        $user->two_factor_secret = $secret;
        $user->two_factor_recovery_codes = null;
        $user->two_factor_confirmed_at = null;
        $user->save();

        return $this->successResponse([
            'secret' => $secret,
            'provisioning_uri' => $this->twoFactor->provisioningUri($user, $secret),
        ], 'Quét mã QR bằng ứng dụng xác thực, sau đó nhập mã 6 số để xác nhận');
    }

    /**
     * Step 2 — confirm the pending secret with a live TOTP code. On success we mark 2FA
     * confirmed and return the one-time recovery codes (shown to the user exactly once).
     */
    public function confirm(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();
        if (! $user) {
            return $this->errorResponse('Chưa xác thực', null, 'UNAUTHENTICATED', 401);
        }

        $validator = Validator::make($request->all(), [
            'code' => 'required|string',
        ]);
        if ($validator->fails()) {
            return $this->errorResponse('Dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        if ($user->hasTwoFactorEnabled()) {
            return $this->errorResponse(
                'Xác thực hai lớp đã được bật.',
                null,
                'TWO_FACTOR_ALREADY_ENABLED',
                409
            );
        }

        $secret = $user->two_factor_secret;
        if (! is_string($secret) || $secret === '') {
            return $this->errorResponse(
                'Chưa có yêu cầu bật xác thực hai lớp. Vui lòng bắt đầu lại.',
                null,
                'TWO_FACTOR_NOT_PENDING',
                422
            );
        }

        if (! $this->twoFactor->verifyCode($secret, $request->input('code'))) {
            return $this->errorResponse('Mã xác thực không đúng hoặc đã hết hạn', null, 'INVALID_2FA_CODE', 422);
        }

        $recoveryCodes = $this->twoFactor->generateRecoveryCodes();
        $user->two_factor_recovery_codes = $recoveryCodes;
        $user->two_factor_confirmed_at = now();
        $user->save();

        Cache::forget(CacheKeys::currentUser($user->id));

        return $this->successResponse([
            'recovery_codes' => $recoveryCodes,
            'two_factor_enabled' => true,
        ], 'Đã bật xác thực hai lớp. Hãy lưu các mã khôi phục ở nơi an toàn.');
    }

    /**
     * Turn 2FA off, clearing the secret, recovery codes and confirmation. Requires a valid
     * second factor (TOTP or recovery code) OR the current password.
     */
    public function disable(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();
        if (! $user) {
            return $this->errorResponse('Chưa xác thực', null, 'UNAUTHENTICATED', 401);
        }

        if (! $user->hasTwoFactorEnabled()) {
            return $this->errorResponse('Xác thực hai lớp chưa được bật', null, 'TWO_FACTOR_NOT_ENABLED', 422);
        }

        if ($denied = $this->requireSecondFactorOrPassword($request, $user)) {
            return $denied;
        }

        $user->two_factor_secret = null;
        $user->two_factor_recovery_codes = null;
        $user->two_factor_confirmed_at = null;
        $user->save();

        Cache::forget(CacheKeys::currentUser($user->id));

        return $this->successResponse([
            'two_factor_enabled' => false,
        ], 'Đã tắt xác thực hai lớp');
    }

    /**
     * Issue a fresh set of recovery codes (invalidating the old set). Requires a valid second
     * factor or the current password.
     */
    public function regenerateRecoveryCodes(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();
        if (! $user) {
            return $this->errorResponse('Chưa xác thực', null, 'UNAUTHENTICATED', 401);
        }

        if (! $user->hasTwoFactorEnabled()) {
            return $this->errorResponse('Xác thực hai lớp chưa được bật', null, 'TWO_FACTOR_NOT_ENABLED', 422);
        }

        if ($denied = $this->requireSecondFactorOrPassword($request, $user)) {
            return $denied;
        }

        $recoveryCodes = $this->twoFactor->generateRecoveryCodes();
        $user->two_factor_recovery_codes = $recoveryCodes;
        $user->save();

        return $this->successResponse([
            'recovery_codes' => $recoveryCodes,
        ], 'Đã tạo lại mã khôi phục. Các mã cũ không còn hiệu lực.');
    }

    /**
     * Gate for destructive 2FA actions: accept either a valid `code` (TOTP or recovery code —
     * a matching recovery code IS consumed) or the current `password`. Returns an error
     * response when neither is supplied/valid, null when the caller is authorized.
     */
    private function requireSecondFactorOrPassword(Request $request, User $user): ?JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'code' => 'nullable|string',
            'password' => 'nullable|string',
        ]);
        if ($validator->fails()) {
            return $this->errorResponse('Dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        $code = trim((string) $request->input('code', ''));
        $password = (string) $request->input('password', '');

        if ($code !== '' && $this->twoFactor->verifySecondFactor($user, $code)) {
            return null;
        }

        if ($password !== '' && Hash::check($password, $user->password)) {
            return null;
        }

        return $this->errorResponse(
            'Cần nhập mã xác thực hợp lệ hoặc mật khẩu hiện tại',
            null,
            'INVALID_2FA_CREDENTIALS',
            422
        );
    }
}
