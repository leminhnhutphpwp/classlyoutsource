<?php

namespace App\Http\Controllers\API\V1;

use App\Models\UserNotificationPreference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class NotificationPreferenceController extends BaseController
{
    /**
     * Get user's notification preferences
     *
     * NOTE: Notification preferences system is not yet implemented for tutor-only system.
     * This endpoint returns default preferences.
     */
    public function index(): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Return default preferences (email only for now)
        $preferences = [
            [
                'notification_type' => 'announcement',
                'channels' => ['email'],
                'is_enabled' => true,
            ],
            [
                'notification_type' => 'reminder',
                'channels' => ['email'],
                'is_enabled' => true,
            ],
            [
                'notification_type' => 'payment',
                'channels' => ['email'],
                'is_enabled' => true,
            ],
            [
                'notification_type' => 'attendance',
                'channels' => ['email'],
                'is_enabled' => true,
            ],
            [
                'notification_type' => 'grade',
                'channels' => ['email'],
                'is_enabled' => true,
            ],
        ];

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('notification_preferences.manage');

        return $this->successResponse([
            'preferences' => $preferences,
            'permissions' => $permissions,
        ]);
    }

    /**
     * Get preference for a specific notification type
     */
    public function show(string $type): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        if ($planError = $this->requirePlanCapability('notification_preferences.manage')) {
            return $planError;
        }

        // Return default preference
        $preference = [
            'notification_type' => $type,
            'channels' => ['email'],
            'is_enabled' => true,
        ];

        return $this->successResponse($preference);
    }

    /**
     * Update notification preference
     *
     * NOTE: Notification preferences system is not yet implemented.
     * This endpoint returns success but doesn't persist changes.
     */
    public function update(Request $request, string $type): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        if ($planError = $this->requirePlanCapability('notification_preferences.manage')) {
            return $planError;
        }

        $validator = Validator::make($request->all(), [
            'channels' => 'required|array',
            'channels.*' => 'in:email,zalo,sms',
            'is_enabled' => 'boolean',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        // Persist preference
        $preference = UserNotificationPreference::updateOrCreate(
            [
                'user_id' => $user->id,
                'notification_type' => $type,
            ],
            [
                'channels' => $request->input('channels', ['email']),
                'is_enabled' => $request->input('is_enabled', true),
            ]
        );

        return $this->successResponse([
            'notification_type' => $preference->notification_type,
            'channels' => $preference->getChannels(),
            'is_enabled' => $preference->is_enabled,
        ], 'Cập nhật tùy chọn thông báo thành công');
    }

    /**
     * Bulk update preferences
     *
     * NOTE: Notification preferences system is not yet implemented.
     */
    public function bulkUpdate(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        if ($planError = $this->requirePlanCapability('notification_preferences.manage')) {
            return $planError;
        }

        $validator = Validator::make($request->all(), [
            'preferences' => 'required|array',
            'preferences.*.notification_type' => 'required|string',
            'preferences.*.channels' => 'required|array',
            'preferences.*.channels.*' => 'in:email,zalo,sms',
            'preferences.*.is_enabled' => 'boolean',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        // Persist preferences
        $updated = [];
        foreach ($request->preferences as $prefData) {
            $preference = UserNotificationPreference::updateOrCreate(
                [
                    'user_id' => $user->id,
                    'notification_type' => $prefData['notification_type'],
                ],
                [
                    'channels' => $prefData['channels'] ?? ['email'],
                    'is_enabled' => $prefData['is_enabled'] ?? true,
                ]
            );

            $updated[] = [
                'notification_type' => $preference->notification_type,
                'channels' => $preference->getChannels(),
                'is_enabled' => $preference->is_enabled,
            ];
        }

        return $this->successResponse(
            ['preferences' => $updated],
            'Cập nhật tùy chọn thông báo thành công'
        );
    }

    /**
     * Get available notification channels for user
     */
    public function availableChannels(): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        if ($planError = $this->requirePlanCapability('notification_preferences.manage')) {
            return $planError;
        }

        $channels = [
            [
                'key' => 'email',
                'name' => 'Email',
                'available' => true,
                'description' => 'Luôn có sẵn cho tất cả người dùng',
            ],
            [
                'key' => 'zalo',
                'name' => 'Zalo OA',
                'available' => (bool) config('notifications.channels.zalo.enabled'),
                'description' => 'Gửi thông báo qua Zalo Official Account',
            ],
            [
                'key' => 'sms',
                'name' => 'SMS',
                'available' => (bool) config('notifications.channels.sms.enabled'),
                'description' => 'Tin nhắn SMS (áp dụng phí theo tin)',
            ],
        ];

        return $this->successResponse($channels);
    }
}
