<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Resources\UserResource;
use App\Models\Media;
use App\Models\PasswordResetCode;
use App\Models\Setting;
use App\Models\User;
use App\Models\UserBankAccount;
use App\Models\UserNotificationPreference;
use App\Notifications\EmailVerificationNotification;
use App\Services\DataJobService;
use App\Services\MediaUploadService;
use App\Support\SecuritySettings;
use App\Support\VietQrBank;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class SettingsController extends BaseController
{
    /**
     * Upload avatar image.
     */
    public function uploadAvatar(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Chưa xác thực', null, 'UNAUTHENTICATED', 401);
        }

        // Check if user account is active
        if ($user->status !== 'active') {
            return $this->errorResponse('Tài khoản đã bị vô hiệu hóa hoặc đã bị xóa', null, 'ACCOUNT_INACTIVE', 403);
        }

        $validator = Validator::make($request->all(), [
            'avatar' => 'required|image|mimes:jpeg,png,jpg,gif,webp|max:2048', // Max 2MB
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        try {
            $file = $request->file('avatar');

            // Delete old avatar Media if exists (if using Media)
            if ($user->avatar_media_id) {
                MediaUploadService::deleteMedia($user->avatar_media_id);
            } elseif ($user->avatar && Storage::disk('public')->exists($user->avatar)) {
                // Fallback: delete old avatar file if using path directly
                Storage::disk('public')->delete($user->avatar);
            }

            // Upload and create Media record
            $uploadResult = MediaUploadService::uploadAndCreateMedia($file, 'avatars');

            if (! $uploadResult['success']) {
                return $this->errorResponse($uploadResult['message'], null, 'UPLOAD_ERROR', 422);
            }

            // Update user with both path (backward compatible) and media_id
            $user->update([
                'avatar' => $uploadResult['path'], // Keep for backward compatibility
                'avatar_media_id' => $uploadResult['media_id'], // Media ID
            ]);

            return $this->successResponse([
                'avatar' => $uploadResult['url'],
                'avatar_path' => $uploadResult['path'],
                'avatar_media_id' => User::encodeId($uploadResult['media_id']),
                'media' => [
                    '_id' => User::encodeId($uploadResult['media_id']),
                    'url' => $uploadResult['url'],
                    'name' => $uploadResult['name'],
                    'size' => $uploadResult['size'],
                ],
                'user' => new UserResource($user->fresh()),
            ], 'Upload avatar thành công');
        } catch (\Exception $e) {
            return $this->errorResponse('Không thể upload avatar: '.$e->getMessage(), null, 'UPLOAD_ERROR', 500);
        }
    }

    /**
     * Change email address (requires password confirmation).
     *
     * Flow:
     * 1. Xác nhận mật khẩu
     * 2. Đổi email → email mới
     * 3. Hủy xác thực (email_verified_at = null)
     * 4. Tạo mã xác thực cho email MỚI
     * 5. Gửi mã đến email MỚI
     *
     * User cần gọi POST /settings/security/verify-email với mã code để xác thực email mới.
     */
    public function changeEmail(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Chưa xác thực', null, 'UNAUTHENTICATED', 401);
        }

        // Check if user account is active
        if ($user->status !== 'active') {
            return $this->errorResponse('Tài khoản đã bị vô hiệu hóa hoặc đã bị xóa', null, 'ACCOUNT_INACTIVE', 403);
        }

        // Check if new email is the same as current email
        if ($request->new_email === $user->email) {
            return $this->errorResponse('Email mới phải khác email hiện tại', null, 'VALIDATION_ERROR', 422);
        }

        // Check if email already exists (before validation for clearer error message)
        $emailExists = User::where('email', $request->new_email)
            ->where('id', '!=', $user->id)
            ->exists();

        if ($emailExists) {
            return $this->errorResponse('Email này đã được sử dụng bởi tài khoản khác. Vui lòng chọn email khác.', null, 'EMAIL_ALREADY_EXISTS', 422);
        }

        $validator = Validator::make($request->all(), [
            'new_email' => [
                'required',
                'email',
                'unique:users,email,'.$user->id.',id,deleted_at,NULL', // Exclude current user and ignore trashed
            ],
            'password' => 'required|string', // Password confirmation
        ], [
            'new_email.required' => 'Vui lòng nhập email mới',
            'new_email.email' => 'Email không hợp lệ',
            'new_email.unique' => 'Email này đã được sử dụng bởi tài khoản khác. Vui lòng chọn email khác.',
            'password.required' => 'Vui lòng nhập mật khẩu để xác nhận',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        // Verify password
        if (! Hash::check($request->password, $user->password)) {
            return $this->errorResponse('Mật khẩu không đúng', null, 'INVALID_PASSWORD', 422);
        }

        try {
            // Step 1: Store new email in pending_email column
            $user->update([
                'pending_email' => $request->new_email,
            ]);

            // Create verification code and send to new email
            try {
                $resetCode = PasswordResetCode::createForEmail($request->new_email);

                Notification::route('mail', $request->new_email)
                    ->notify((new EmailVerificationNotification(
                        $resetCode->code,
                        $resetCode->getRemainingMinutes()
                    ))->delay(now()->addSeconds(2)));
            } catch (\Exception $e) {
                Log::channel('auth')->warning('Failed to send email verification: '.$e->getMessage());
                // Continue, user can resend code later
            }

            return $this->successResponse([
                'user' => new UserResource($user->fresh()),
                'email_verified' => false, // Email hiện tại vẫn verified (nếu trước đó đã verify)
                'pending_email_verification' => true, // Flag báo client biết đang chờ verify pending email
                'verification_code_sent' => true,
                'message' => 'Mã xác thực đã được gửi đến email mới. Vui lòng xác thực để hoàn tất thay đổi.',
                'next_step' => 'verify_email',
            ], 'Vui lòng kiểm tra email mới để xác thực thay đổi.');
        } catch (\Exception $e) {
            return $this->errorResponse('Không thể bắt đầu quy trình đổi email: '.$e->getMessage(), null, 'CHANGE_EMAIL_ERROR', 500);
        }
    }

    /**
     * Deactivate account (soft delete).
     */
    public function deactivateAccount(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Chưa xác thực', null, 'UNAUTHENTICATED', 401);
        }

        // Super Admin cannot deactivate their account via API (safety)
        if ($user->isSuperAdmin()) {
            return $this->errorResponse('Không thể vô hiệu hóa tài khoản Super Admin qua API. Vui lòng liên hệ hệ thống.', null, 'SUPER_ADMIN_PROTECTED', 403);
        }

        // Check if already deactivated
        if ($user->status === 'inactive' || $user->status === 'deleted') {
            return $this->errorResponse('Tài khoản đã bị vô hiệu hóa hoặc đã bị xóa', null, 'ALREADY_DEACTIVATED', 422);
        }

        $validator = Validator::make($request->all(), [
            'password' => 'required|string', // Password confirmation
            'reason' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        // Verify password
        if (! Hash::check($request->password, $user->password)) {
            return $this->errorResponse('Mật khẩu không đúng', null, 'INVALID_PASSWORD', 422);
        }

        try {
            // Soft delete user (update status only)
            $user->update([
                'status' => 'inactive',
            ]);

            // Logout user (invalidate token)
            auth('api')->logout();

            return $this->successResponse(null, 'Tài khoản đã được vô hiệu hóa. Bạn có thể liên hệ admin để kích hoạt lại.');
        } catch (\Exception $e) {
            return $this->errorResponse('Không thể vô hiệu hóa tài khoản: '.$e->getMessage(), null, 'DEACTIVATE_ERROR', 500);
        }
    }

    /**
     * Delete account permanently (requires admin approval or additional verification).
     * Note: This is a destructive action, consider implementing a grace period.
     */
    public function deleteAccount(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Chưa xác thực', null, 'UNAUTHENTICATED', 401);
        }

        // Super Admin cannot delete their account via API (safety)
        if ($user->isSuperAdmin()) {
            return $this->errorResponse('Không thể xóa tài khoản Super Admin qua API. Vui lòng liên hệ hệ thống.', null, 'SUPER_ADMIN_PROTECTED', 403);
        }

        // Check if already deleted
        if ($user->status === 'deleted') {
            return $this->errorResponse('Tài khoản đã bị xóa', null, 'ALREADY_DELETED', 422);
        }

        $validator = Validator::make($request->all(), [
            'password' => 'required|string',
            'confirmation_text' => 'required|string|in:DELETE', // User must type "DELETE" to confirm
            'reason' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        // Verify password
        if (! Hash::check($request->password, $user->password)) {
            return $this->errorResponse('Mật khẩu không đúng', null, 'INVALID_PASSWORD', 422);
        }

        try {
            // Mark for deletion (soft delete only, don't update metadata if not exists)
            if ($user->status !== 'deleted') {
                $user->update([
                    'status' => 'deleted',
                ]);
            }

            // Logout user (invalidate token)
            auth('api')->logout();

            return $this->successResponse(null, 'Tài khoản đã được đánh dấu để xóa. Vui lòng liên hệ admin để xác nhận.');
        } catch (\Exception $e) {
            return $this->errorResponse('Không thể xóa tài khoản: '.$e->getMessage(), null, 'DELETE_ERROR', 500);
        }
    }

    /**
     * Get user profile.
     */
    public function getProfile(): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Chưa xác thực', null, 'UNAUTHENTICATED', 401);
        }

        return $this->successResponse([
            'user' => new UserResource($user),
        ]);
    }

    /**
     * Update user profile.
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Chưa xác thực', null, 'UNAUTHENTICATED', 401);
        }

        // Check if user account is active
        if ($user->status !== 'active') {
            return $this->errorResponse('Tài khoản đã bị vô hiệu hóa hoặc đã bị xóa', null, 'ACCOUNT_INACTIVE', 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:20',
            'address' => 'nullable|string|max:500',
            'date_of_birth' => 'nullable|date',
            'gender' => 'nullable|string|in:male,female,other',
            'bio' => 'nullable|string|max:1000',
            'theme_key' => 'nullable|string|max:50',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        try {
            $user->update($request->only([
                'name',
                'phone',
                'address',
                'date_of_birth',
                'gender',
                'bio',
                'theme_key',
            ]));

            return $this->successResponse([
                'user' => new UserResource($user->fresh()),
            ], 'Cập nhật thông tin thành công');
        } catch (\Exception $e) {
            return $this->errorResponse('Không thể cập nhật thông tin: '.$e->getMessage(), null, 'UPDATE_ERROR', 500);
        }
    }

    /**
     * Get security settings.
     */
    public function getSecurity(): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Chưa xác thực', null, 'UNAUTHENTICATED', 401);
        }

        // Basic security info
        $securityInfo = [
            'email_verified' => $user->email_verified_at !== null,
            // Real TOTP 2FA state: enabled once the user has confirmed a secret.
            'two_factor_enabled' => $user->hasTwoFactorEnabled(),
        ];

        // If user has advanced security settings capability, include dynamic settings
        if ($this->userHasPermissionFromCapability('security.advanced_settings')) {
            $securityInfo['limits'] = [
                'sessions' => [
                    'max_active' => SecuritySettings::getSessionLimit('max_active', 10),
                ],
                'invites' => [
                    'max_per_user' => SecuritySettings::getInviteLimit('per_user', 'max', 5),
                    'daily_max' => SecuritySettings::getInviteLimit('per_user_daily', 'max', 20),
                ],
            ];
        }

        return $this->successResponse($securityInfo);
    }

    /**
     * Change password.
     */
    public function changePassword(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Chưa xác thực', null, 'UNAUTHENTICATED', 401);
        }

        // Check if user account is active
        if ($user->status !== 'active') {
            return $this->errorResponse('Tài khoản đã bị vô hiệu hóa hoặc đã bị xóa', null, 'ACCOUNT_INACTIVE', 403);
        }

        $validator = Validator::make($request->all(), [
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        // Verify current password
        if (! Hash::check($request->current_password, $user->password)) {
            return $this->errorResponse('Mật khẩu hiện tại không đúng', null, 'INVALID_PASSWORD', 422);
        }

        try {
            $user->update([
                'password' => Hash::make($request->new_password),
            ]);

            return $this->successResponse(null, 'Đổi mật khẩu thành công');
        } catch (\Exception $e) {
            return $this->errorResponse('Không thể đổi mật khẩu: '.$e->getMessage(), null, 'CHANGE_PASSWORD_ERROR', 500);
        }
    }

    /**
     * Get notification preferences.
     */
    public function getNotifications(): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Chưa xác thực', null, 'UNAUTHENTICATED', 401);
        }

        // Get available channels (email only for tutor-only system)
        $availableChannels = [
            [
                'key' => 'email',
                'name' => 'Email',
                'available' => true,
                'description' => 'Luôn có sẵn',
                'icon' => 'email',
            ],
        ];

        // Get notification types filtered by user role
        $notificationTypes = $this->getNotificationTypes($user);

        // Get current preferences from database, or use defaults
        $preferences = [];
        foreach ($notificationTypes as $type) {
            $pref = UserNotificationPreference::getPreference(
                $user->id,
                $type['key']
            );

            if ($pref) {
                $preferences[$type['key']] = [
                    'notification_type' => $pref->notification_type,
                    'channels' => $pref->getChannels(),
                    'is_enabled' => $pref->is_enabled,
                ];
            } else {
                // Default preference
                $preferences[$type['key']] = [
                    'notification_type' => $type['key'],
                    'channels' => $type['default_channels'] ?? ['email'],
                    'is_enabled' => true,
                ];
            }
        }

        return $this->successResponse([
            'available_channels' => $availableChannels,
            'notification_types' => $notificationTypes,
            'preferences' => $preferences,
            'preferences_count' => count($preferences),
        ]);
    }

    /**
     * Update notification preferences.
     */
    public function updateNotifications(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Chưa xác thực', null, 'UNAUTHENTICATED', 401);
        }

        // Get request data - try json() first, then all()
        $requestData = $request->json()->all() ?: $request->all();

        // If preferences is a JSON string, decode it
        if (isset($requestData['preferences']) && is_string($requestData['preferences'])) {
            $decoded = json_decode($requestData['preferences'], true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $requestData['preferences'] = $decoded;
            }
        }

        $validator = Validator::make($requestData, [
            'preferences' => 'required|array|min:1',
            'preferences.*.notification_type' => 'required|string',
            'preferences.*.channels' => 'required|array',
            'preferences.*.channels.*' => 'in:email',
            'preferences.*.is_enabled' => 'boolean',
        ], [
            'preferences.required' => 'Danh sách tùy chọn thông báo không được để trống.',
            'preferences.array' => 'Danh sách tùy chọn thông báo phải là mảng.',
            'preferences.min' => 'Danh sách tùy chọn thông báo phải có ít nhất 1 mục.',
            'preferences.*.notification_type.required' => 'Loại thông báo không được để trống.',
            'preferences.*.channels.required' => 'Kênh thông báo không được để trống.',
            'preferences.*.channels.*.in' => 'Kênh thông báo không hợp lệ.',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        // Get valid notification types
        $validTypes = collect($this->getNotificationTypes($user))->pluck('key')->toArray();

        // Update preferences
        $updated = [];
        foreach ($requestData['preferences'] as $prefData) {
            $notificationType = $prefData['notification_type'];

            // Validate notification type
            if (! in_array($notificationType, $validTypes)) {
                continue; // Skip invalid types
            }

            $preference = UserNotificationPreference::updateOrCreate(
                [
                    'user_id' => $user->id,
                    'notification_type' => $notificationType,
                ],
                [
                    'channels' => $prefData['channels'] ?? ['email'],
                    'is_enabled' => $prefData['is_enabled'] ?? true,
                ]
            );

            $updated[$notificationType] = [
                'notification_type' => $preference->notification_type,
                'channels' => $preference->getChannels(),
                'is_enabled' => $preference->is_enabled,
            ];
        }

        // If none of the submitted preferences matched a valid notification type
        // for this user, nothing was saved. Report that instead of a misleading
        // "success" so the UI doesn't show a fake "updated" toast.
        if (empty($updated)) {
            return $this->errorResponse(
                'Không có tùy chọn thông báo hợp lệ nào được cập nhật.',
                null,
                'NO_VALID_PREFERENCES',
                422
            );
        }

        return $this->successResponse([
            'preferences' => $updated,
            'preferences_count' => count($updated),
        ], 'Cập nhật tùy chọn thông báo thành công');
    }

    /**
     * Get all notification types with labels and descriptions, filtered by user role.
     */
    private function getNotificationTypes($user): array
    {
        $allTypes = [
            // Payment notifications - For Tutors
            [
                'key' => 'payment_success',
                'name' => 'Thanh toán thành công',
                'description' => 'Thông báo khi thanh toán thành công',
                'category' => 'payment',
                'default_channels' => ['email'],
                'roles' => ['tutor', 'admin'],
            ],
            [
                'key' => 'payment_failed',
                'name' => 'Thanh toán thất bại',
                'description' => 'Thông báo khi thanh toán thất bại',
                'category' => 'payment',
                'default_channels' => ['email'],
                'roles' => ['tutor', 'admin'],
            ],
            // Tuition Payment - For Students
            [
                'key' => 'payment_reminder',
                'name' => 'Nhắc đóng học phí',
                'description' => 'Thông báo nhắc nhở khi sắp đến hạn đóng học phí',
                'category' => 'payment',
                'default_channels' => ['email'],
                'roles' => ['student', 'parent'],
            ],
            // Teaching Operations
            [
                'key' => 'daily_schedule_reminder',
                'name' => 'Nhắc lịch hàng ngày',
                'description' => 'Nhắc nhở lịch học/dạy hàng ngày',
                'category' => 'teaching',
                'default_channels' => ['email'],
                'roles' => ['tutor', 'student', 'parent'],
            ],
            [
                'key' => 'attendance_reminder',
                'name' => 'Nhắc điểm danh',
                'description' => 'Nhắc nhở điểm danh học viên sau buổi học',
                'category' => 'teaching',
                'default_channels' => ['email'],
                'roles' => ['tutor'],
            ],
            [
                'key' => 'new_submission',
                'name' => 'Bài nộp mới',
                'description' => 'Thông báo khi có bài tập mới được học viên nộp',
                'category' => 'teaching',
                'default_channels' => ['email'],
                'roles' => ['tutor'],
            ],
            // General
            [
                'key' => 'announcement',
                'name' => 'Thông báo chung',
                'description' => 'Các thông báo quan trọng, tin tức',
                'category' => 'general',
                'default_channels' => ['email'],
                'roles' => ['tutor', 'student', 'parent', 'admin'],
            ],
        ];

        // Filter types based on user role
        // Assuming $user->role is the string identifier (e.g. 'tutor', 'student')
        // Or use helper methods if strictly defined.
        // Let's use loose checking to be safe: check if user has role.

        $userRole = $user->role; // 'tutor', 'student', 'super_admin', ...

        // Normalize super_admin to admin: notification types declare 'admin' in
        // their roles, but the seeded system administrator carries the
        // 'super_admin' role. Without this mapping the admin gets an empty list
        // and the settings page shows "no notification settings".
        if ($userRole === 'super_admin') {
            $userRole = 'admin';
        }

        // Filter first
        $filtered = array_filter($allTypes, function ($type) use ($userRole) {
            // If roles not specified, available for everyone
            if (! isset($type['roles'])) {
                return true;
            }

            // Check if user's role is in the allowed list
            return in_array($userRole, $type['roles']);
        });

        // Remove 'roles' key from output to keep response clean
        return array_values(array_map(function ($type) {
            unset($type['roles']);

            return $type;
        }, $filtered));
    }

    /**
     * Get bank information for current user.
     * Chỉ gia sư/giáo viên mới có quyền xem và quản lý thông tin ngân hàng.
     *
     * @deprecated The tuition flow no longer reads this table — students/parents are shown the
     * CLASS's organization default account (organization_bank_accounts via
     * Organization::bankTransferInfoFor). Kept only for backward compatibility; a tutor's
     * personal account configured here is NOT displayed anywhere in the current payment UI.
     */
    public function getBankInfo(): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Chưa xác thực', null, 'UNAUTHENTICATED', 401);
        }

        // Chỉ tutor mới có quyền truy cập payment settings
        if (! $user->isTutor()) {
            return $this->errorResponse('Chỉ gia sư/giáo viên mới có thể quản lý thông tin ngân hàng', null, 'FORBIDDEN', 403);
        }

        // Get bank info from user_bank_accounts table
        // We assume we use the default one
        $bankAccount = $user->bankAccount;

        $defaultBankInfo = [
            'bank_name' => null,
            'account_number' => null,
            'account_name' => null,
            'branch' => null,
        ];

        if ($bankAccount) {
            $data = [
                'bank_name' => $bankAccount->bank_name,
                'account_number' => $bankAccount->account_number,
                'account_name' => $bankAccount->account_name,
                'branch' => $bankAccount->branch,
            ];
        } else {
            // No bank account yet — return empty defaults (the form starts blank).
            $data = $defaultBankInfo;
        }

        return $this->successResponse($data, 'Lấy thông tin ngân hàng thành công');
    }

    /**
     * Update bank information for current user (Tutor only).
     *
     * Updates the default bank account for the authenticated tutor.
     * Supports both new field names (account_number) and legacy aliases (bank_account_number).
     *
     * The product uses exactly ONE default bank account per tutor (the model supports more, but
     * the UI/controller never creates non-default rows). A unique index on (user_id, is_default)
     * plus the transaction+lock below make that invariant race-safe.
     *
     * @deprecated Same as getBankInfo(): tuition is collected into the center's
     * organization_bank_accounts, not the tutor's personal account. Nothing in the current
     * payment UI displays this data — kept only for backward compatibility.
     */
    public function updateBankInfo(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Chưa xác thực', null, 'UNAUTHENTICATED', 401);
        }

        // Only tutors can update bank info
        if (! $user->isTutor()) {
            return $this->errorResponse('Chỉ gia sư/giáo viên mới có thể cập nhật thông tin ngân hàng', null, 'FORBIDDEN', 403);
        }

        // Normalize inputs (Map aliases + trim)
        $inputs = $request->all();
        if (isset($inputs['bank_account_number']) && ! isset($inputs['account_number'])) {
            $inputs['account_number'] = $inputs['bank_account_number'];
        }
        if (isset($inputs['bank_account_holder']) && ! isset($inputs['account_name'])) {
            $inputs['account_name'] = $inputs['bank_account_holder'];
        }

        foreach (['bank_name', 'account_number', 'account_name', 'branch'] as $field) {
            if (isset($inputs[$field]) && is_string($inputs[$field])) {
                $inputs[$field] = trim($inputs[$field]);
            }
        }
        // Account numbers are digits — drop stray whitespace but keep any other characters intact.
        if (isset($inputs['account_number'])) {
            $inputs['account_number'] = preg_replace('/\s+/', '', (string) $inputs['account_number']);
        }

        // Pass normalized inputs to validator
        // Note: We use 'required' here to prevent DB Not Null errors
        $validator = Validator::make($inputs, [
            'bank_name' => ['required', 'string', 'max:255', function ($attribute, $value, $fail) {
                if (VietQrBank::codeFor((string) $value) === null) {
                    $fail('Ngân hàng không hợp lệ. Vui lòng chọn ngân hàng trong danh sách.');
                }
            }],
            'account_number' => 'required|string|max:50',
            'account_name' => 'required|string|max:255',
            'branch' => 'nullable|string|max:255',
        ], [
            'bank_name.required' => 'Vui lòng nhập tên ngân hàng',
            'account_number.required' => 'Vui lòng nhập số tài khoản',
            'account_name.required' => 'Vui lòng nhập tên chủ tài khoản',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        // Store the canonical display name so the value shown to students/parents is consistent,
        // and QR generation (which maps name -> VietQR code) always resolves.
        $bankName = VietQrBank::canonicalName($inputs['bank_name']) ?? $inputs['bank_name'];

        try {
            // Update or Create in user_bank_accounts table — guarded by a transaction + row lock
            // so two concurrent PUTs can never create duplicate default rows.
            DB::transaction(function () use ($user, $inputs, $bankName) {
                $default = UserBankAccount::where('user_id', $user->id)
                    ->where('is_default', true)
                    ->lockForUpdate()
                    ->first();

                if ($default) {
                    $default->update([
                        'bank_name' => $bankName,
                        'account_number' => $inputs['account_number'],
                        'account_name' => $inputs['account_name'],
                        'branch' => $inputs['branch'] ?? null,
                    ]);
                } else {
                    UserBankAccount::create([
                        'user_id' => $user->id,
                        'bank_name' => $bankName,
                        'account_number' => $inputs['account_number'],
                        'account_name' => $inputs['account_name'],
                        'branch' => $inputs['branch'] ?? null,
                        'is_default' => true,
                    ]);
                }
            });

            return $this->successResponse(null, 'Cập nhật thông tin ngân hàng thành công');
        } catch (\Exception $e) {
            // Log error internally but show generic message to user
            Log::error('Update Bank Info Failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse('Có lỗi xảy ra khi cập nhật thông tin ngân hàng.', null, 'UPDATE_ERROR', 500);
        }
    }

    /**
     * Export system settings.
     *
     * GET /api/v1/settings/export
     */
    public function export(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Only super admin can export settings
        if (! $user->isSuperAdmin()) {
            return $this->errorResponse('Không có quyền export settings', null, 'UNAUTHORIZED', 403);
        }

        $groups = $request->get('groups', []); // Filter by groups if provided

        $job = DataJobService::start('export', 'settings', $user, [
            'format' => 'json',
            'meta' => [
                'path' => $request->path(),
                'groups' => $groups,
            ],
        ]);

        try {
            $query = Setting::query();

            if (! empty($groups)) {
                $groupsArray = is_array($groups) ? $groups : explode(',', $groups);
                $query->whereIn('group', $groupsArray);
            }

            $settings = $query->orderBy('group')->orderBy('key')->get();

            $data = $settings->map(function ($setting) {
                return [
                    'key' => $setting->key,
                    'value' => $setting->value,
                    'type' => $setting->type,
                    'group' => $setting->group,
                    'description' => $setting->description,
                    'is_public' => $setting->is_public,
                    // Note: is_encrypted values are already decrypted when accessed via model
                ];
            })->toArray();

            $responseData = [
                'settings' => $data,
                'total' => count($data),
                'groups' => $groups ?: 'all',
            ];

            DataJobService::finishSuccess($job, [
                'total_rows' => $responseData['total'],
            ]);

            return $this->successResponse($responseData, 'Export settings thành công');
        } catch (\Exception $e) {
            Log::channel('media')->error('Export settings error', [
                'error' => $e->getMessage(),
            ]);

            DataJobService::finishFailed($job, $e->getMessage());

            return $this->errorResponse('Lỗi khi export settings: '.$e->getMessage(), null, 'EXPORT_ERROR', 500);
        }
    }

    /**
     * Import system settings.
     *
     * POST /api/v1/settings/import
     */
    public function import(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Only super admin can import settings
        if (! $user->isSuperAdmin()) {
            return $this->errorResponse('Không có quyền import settings', null, 'UNAUTHORIZED', 403);
        }

        $validator = Validator::make($request->all(), [
            'settings' => 'required|array|min:1',
            'settings.*.key' => 'required|string|max:255',
            'settings.*.value' => 'nullable',
            'settings.*.type' => 'nullable|string|in:string,integer,float,boolean,array,json',
            'settings.*.group' => 'nullable|string|max:255',
            'settings.*.description' => 'nullable|string',
            'settings.*.is_public' => 'nullable|boolean',
            'dry_run' => 'nullable|boolean',
            'overwrite' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        $settings = $request->input('settings');
        $dryRun = $request->boolean('dry_run', false);
        $overwrite = $request->boolean('overwrite', false);

        $job = DataJobService::start('import', 'settings', $user, [
            'format' => 'json',
            'meta' => [
                'path' => $request->path(),
                'dry_run' => $dryRun,
                'overwrite' => $overwrite,
            ],
        ]);

        try {
            $success = 0;
            $updated = 0;
            $skipped = 0;
            $errors = [];
            $preview = [];

            foreach ($settings as $index => $settingData) {
                try {
                    $key = $settingData['key'];
                    $existing = Setting::where('key', $key)->first();

                    if ($existing) {
                        if (! $overwrite) {
                            $skipped++;
                            $errors[] = [
                                'index' => $index,
                                'key' => $key,
                                'error' => 'Setting đã tồn tại. Sử dụng overwrite=true để ghi đè.',
                            ];

                            continue;
                        }

                        $preview[] = [
                            'action' => 'update',
                            'key' => $key,
                            'old_value' => $existing->value,
                            'new_value' => $settingData['value'] ?? $existing->value,
                        ];

                        if (! $dryRun) {
                            $existing->update([
                                'value' => $settingData['value'] ?? $existing->value,
                                'type' => $settingData['type'] ?? $existing->type,
                                'group' => $settingData['group'] ?? $existing->group,
                                'description' => $settingData['description'] ?? $existing->description,
                                'is_public' => $settingData['is_public'] ?? $existing->is_public,
                            ]);
                        }

                        $updated++;
                    } else {
                        $preview[] = [
                            'action' => 'create',
                            'key' => $key,
                            'value' => $settingData['value'] ?? null,
                        ];

                        if (! $dryRun) {
                            Setting::create([
                                'key' => $key,
                                'value' => $settingData['value'] ?? null,
                                'type' => $settingData['type'] ?? 'string',
                                'group' => $settingData['group'] ?? 'general',
                                'description' => $settingData['description'] ?? null,
                                'is_public' => $settingData['is_public'] ?? false,
                            ]);
                        }

                        $success++;
                    }
                } catch (\Exception $e) {
                    $errors[] = [
                        'index' => $index,
                        'key' => $settingData['key'] ?? 'unknown',
                        'error' => $e->getMessage(),
                    ];
                    Log::channel('media')->error('Import setting error', [
                        'index' => $index,
                        'data' => $settingData,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            if (! $dryRun) {
                // Clear settings cache if exists
                if (method_exists(\App\Support\Setting::class, 'clearCache')) {
                    \App\Support\Setting::clearCache();
                }
            }

            Log::channel('media')->info('Settings imported', [
                'user_id' => $user->id,
                'dry_run' => $dryRun,
                'success' => $success,
                'updated' => $updated,
                'skipped' => $skipped,
            ]);

            $total = count($settings);
            $metrics = [
                'total_rows' => $total,
                'success_count' => $success + $updated,
                'failed_count' => 0,
                'skipped_count' => $skipped,
            ];

            if (! empty($errors)) {
                DataJobService::finishPartial($job, $metrics, [
                    'errors' => $errors,
                    'dry_run' => $dryRun,
                ]);
            } else {
                DataJobService::finishSuccess($job, $metrics, [
                    'dry_run' => $dryRun,
                ]);
            }

            return $this->successResponse([
                'dry_run' => $dryRun,
                'total' => $total,
                'created' => $success,
                'updated' => $updated,
                'skipped' => $skipped,
                'errors' => $errors,
                'preview' => $dryRun ? $preview : null,
            ], $dryRun ? 'Dry-run hoàn tất (chưa áp dụng thay đổi)' : 'Import settings hoàn tất');
        } catch (\Exception $e) {
            Log::channel('media')->error('Import settings failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            DataJobService::finishFailed($job, $e->getMessage());

            return $this->errorResponse('Lỗi khi import settings: '.$e->getMessage(), null, 'IMPORT_ERROR', 500);
        }
    }
}
