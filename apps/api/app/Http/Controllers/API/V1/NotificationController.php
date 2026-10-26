<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Requests\SendNotificationEmailsRequest;
use App\Http\Resources\NotificationRecipientLogResource;
use App\Http\Resources\NotificationResource;
use App\Jobs\SendNotificationEmailJob;
use App\Models\ClassRoom;
use App\Models\Notification;
use App\Models\NotificationRead;
use App\Models\NotificationRecipientLog;
use App\Models\Student;
use App\Models\User;
use App\Rules\ExistsHashId;
use App\Traits\DecodesHashIds;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class NotificationController extends BaseController
{
    use DecodesHashIds;
    // ... [Previous methods index, show, store, update, destroy, send from previous steps remain unchanged] ...

    public function index(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();
        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Học viên: có thể xem notifications của chính họ (không cần capability)
        // Giáo viên: cần capability notifications.manage để xem notifications
        if (! $user->isStudent()) {
            if ($capabilityError = $this->requirePlanCapability('notifications.manage')) {
                return $capabilityError;
            }
        }

        $query = Notification::query()->with(['creator', 'reads']);

        $query = $this->applyDataIsolation($query, 'notifications');

        // Học viên chỉ được thấy thông báo đã gửi (status = sent),
        // không thấy bản nháp hoặc thông báo đang lên lịch
        if ($user && $user->isStudent()) {
            $query->where('status', 'sent');
        }

        // Filter: unread only
        if ($request->has('unread') && $request->boolean('unread')) {
            $readNotificationIds = NotificationRead::where('user_id', $user->id)
                ->pluck('notification_id')
                ->toArray();

            if (! empty($readNotificationIds)) {
                $query->whereNotIn('id', $readNotificationIds);
            }
        }

        // Filter: read only
        if ($request->has('read') && $request->boolean('read')) {
            $readNotificationIds = NotificationRead::where('user_id', $user->id)
                ->pluck('notification_id')
                ->toArray();

            if (! empty($readNotificationIds)) {
                $query->whereIn('id', $readNotificationIds);
            } else {
                // No read notifications
                $query->whereRaw('1 = 0');
            }
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        if ($request->has('target')) {
            $query->where('target', $request->target);
        }

        if ($request->has('channel')) {
            $query->where('channel', $request->channel);
        }

        if ($request->filled('search')) {
            $searchTerm = $request->get('search');
            $query->where(function ($q) use ($searchTerm) {
                $q->where('title', 'like', "%{$searchTerm}%")
                    ->orWhere('message', 'like', "%{$searchTerm}%")
                    ->orWhere('type', 'like', "%{$searchTerm}%")
                    ->orWhere('target', 'like', "%{$searchTerm}%");
            });
        }

        $sortable = ['created_at', 'updated_at', 'scheduled_at', 'sent_at', 'title', 'type', 'status'];
        $sortBy = $request->get('sort', 'created_at');
        if (! in_array($sortBy, $sortable, true)) {
            $sortBy = 'created_at';
        }
        $sortOrder = strtolower($request->get('order', 'desc')) === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sortBy, $sortOrder);

        $perPage = min($request->get('per_page', 15), 100);
        $notifications = $query->paginate($perPage);

        // Calculate statistics (on all data, not filtered/paginated)
        $statsQuery = Notification::query();
        $statsQuery = $this->applyDataIsolation($statsQuery, 'notifications');

        if ($user && $user->isStudent()) {
            $statsQuery->where('status', 'sent');
        }

        // Count unread notifications for current user
        $readNotificationIds = NotificationRead::where('user_id', $user->id)
            ->pluck('notification_id')
            ->toArray();

        $allNotifications = (clone $statsQuery)->pluck('id')->toArray();
        $unreadCount = count(array_diff($allNotifications, $readNotificationIds));

        $statistics = [
            'total' => $statsQuery->count(),
            'unread' => $unreadCount,
            'sent' => (clone $statsQuery)->where('status', 'sent')->count(),
            'failed' => (clone $statsQuery)->where('status', 'failed')->count(),
        ];

        // Check capabilities để frontend biết có nên hiển thị nút quản lý hay không
        $permissions = $this->buildMultiplePermissions([
            'can_manage' => 'notifications.manage',
            'can_send_custom' => 'notifications.send_custom',
        ]);

        return response()->json([
            'success' => true,
            'data' => NotificationResource::collection($notifications),
            'meta' => [
                'current_page' => $notifications->currentPage(),
                'per_page' => $notifications->perPage(),
                'total' => $notifications->total(),
                'last_page' => $notifications->lastPage(),
                'statistics' => $statistics,
            ],
            'permissions' => $permissions,
        ]);
    }

    /**
     * Ensure the authenticated user owns / may access this notification.
     * Returns a 404 (not 403) so a cross-tenant probe cannot even confirm existence.
     */
    private function guardNotificationAccess(Notification $notification): ?JsonResponse
    {
        if (! $notification || ! $notification->exists || ! $notification->id) {
            return $this->errorResponse('Không tìm thấy thông báo', null, 'NOT_FOUND', 404);
        }

        $accessible = $this->applyDataIsolation(
            Notification::where('id', $notification->id),
            'notifications'
        )->exists();

        if (! $accessible) {
            return $this->errorResponse('Không tìm thấy thông báo', null, 'NOT_FOUND', 404);
        }

        return null;
    }

    public function show(Notification $notification): JsonResponse
    {
        if ($denied = $this->guardNotificationAccess($notification)) {
            return $denied;
        }
        // Defensive check: ensure notification was properly resolved
        if (! $notification || ! $notification->exists || ! $notification->id) {
            return $this->errorResponse('Không tìm thấy thông báo', null, 'NOT_FOUND', 404);
        }
        $notification->load(['creator', 'reads']);

        $user = $this->getAuthUser();
        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Học viên không được xem thông báo chưa gửi
        if ($user->isStudent() && $notification->status !== 'sent') {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Use data isolation logic to check access
        // Build a query with the notification and check if it passes isolation
        $query = Notification::where('id', $notification->id);
        $filteredQuery = $this->applyDataIsolation($query, 'notifications');

        // Check if notification passes data isolation
        $accessibleNotification = $filteredQuery->first();

        if (! $accessibleNotification) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        return $this->successResponse(new NotificationResource($notification));
    }

    public function store(Request $request): JsonResponse
    {
        if ($planError = $this->requirePlanCapability('notifications.send_custom')) {
            return $planError;
        }

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'message' => 'required|string',
            'type' => 'nullable|in:announcement,reminder,payment,attendance,grade,other',
            'target' => 'nullable|in:student,parent,tutor,all',
            'recipient_type' => 'required|in:all,classes,students',
            'recipient_classes' => 'nullable|array',
            'recipient_classes.*' => [new ExistsHashId(ClassRoom::class)],
            'recipient_students' => 'nullable|array',
            'recipient_students.*' => [new ExistsHashId(Student::class)],
            'recipient_ids' => 'nullable|array',
            'recipient_ids.*' => [new ExistsHashId(User::class)],
            'channel' => 'required|in:email,zalo,sms,in_app',
            'scheduled_at' => 'nullable|date|after:now',
            'status' => 'nullable|in:draft,scheduled,sent,failed,processing',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        // Decode HashIDs
        $idsToDecode = $request->only(['recipient_classes', 'recipient_students', 'recipient_ids']);
        $this->decodeHashIdArray($idsToDecode, 'recipient_classes', ClassRoom::class);
        $this->decodeHashIdArray($idsToDecode, 'recipient_students', Student::class);
        $this->decodeHashIdArray($idsToDecode, 'recipient_ids', User::class);
        $request->merge($idsToDecode);

        $user = $this->getAuthUser();

        $notificationData = $request->only([
            'title', 'message', 'type', 'target', 'recipient_type',
            'recipient_classes', 'recipient_students', 'recipient_ids',
            'channel', 'scheduled_at', 'status',
        ]);

        $notificationData['type'] = $notificationData['type'] ?? 'announcement';
        $notificationData['target'] = $notificationData['target'] ?? 'all';
        $notificationData['status'] = $notificationData['status'] ?? 'draft';

        if (isset($notificationData['scheduled_at']) && ! isset($request->status)) {
            $notificationData['status'] = 'scheduled';
        }

        $notificationData['created_by'] = $user->id;

        $notification = Notification::create($notificationData);

        $this->seedRecipientLogs($notification, $request);

        Log::channel('notifications')->info('Notification created', [
            'notification_id' => $notification->id,
            'created_by' => $user->id,
            'channel' => $notification->channel,
            'target' => $notification->target,
            'recipient_type' => $notification->recipient_type,
            'status' => $notification->status,
        ]);

        return $this->successResponse(
            new NotificationResource($notification),
            'Tạo thông báo thành công',
            201
        );
    }

    public function update(Request $request, Notification $notification): JsonResponse
    {
        if ($denied = $this->guardNotificationAccess($notification)) {
            return $denied;
        }
        if ($planError = $this->requirePlanCapability('notifications.manage')) {
            return $planError;
        }

        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|string|max:255',
            'message' => 'sometimes|string',
            'type' => 'sometimes|in:announcement,reminder,payment,attendance,grade,other',
            'target' => 'sometimes|in:student,parent,tutor,all',
            'recipient_type' => 'sometimes|in:all,classes,students',
            'recipient_classes' => 'nullable|array',
            'recipient_classes.*' => [new ExistsHashId(ClassRoom::class)],
            'recipient_students' => 'nullable|array',
            'recipient_students.*' => [new ExistsHashId(Student::class)],
            'recipient_ids' => 'nullable|array',
            'recipient_ids.*' => [new ExistsHashId(User::class)],
            'channel' => 'sometimes|in:email,zalo,sms,in_app',
            'scheduled_at' => 'nullable|date',
            'status' => 'sometimes|in:draft,scheduled,sent,failed,processing',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        // Decode HashIDs
        $idsToDecode = $request->only(['recipient_classes', 'recipient_students', 'recipient_ids']);
        $this->decodeHashIdArray($idsToDecode, 'recipient_classes', ClassRoom::class);
        $this->decodeHashIdArray($idsToDecode, 'recipient_students', Student::class);
        $this->decodeHashIdArray($idsToDecode, 'recipient_ids', User::class);
        $request->merge($idsToDecode);

        $updateData = $request->only([
            'title', 'message', 'type', 'target', 'recipient_type',
            'recipient_classes', 'recipient_students', 'recipient_ids',
            'channel', 'scheduled_at', 'status',
        ]);

        if (isset($updateData['scheduled_at']) && ! isset($updateData['status'])) {
            $updateData['status'] = 'scheduled';
        }

        $notification->update($updateData);

        // Re-seed recipient logs if recipients changed
        $recipientFieldsChanged = $request->hasAny([
            'recipient_type', 'recipient_classes', 'recipient_students', 'recipient_ids',
        ]);

        if ($recipientFieldsChanged) {
            // Delete old recipient logs
            NotificationRecipientLog::where('notification_id', $notification->id)->delete();

            // Re-seed with new recipients
            $this->seedRecipientLogs($notification->fresh(), $request);

            Log::channel('notifications')->info('Notification recipients updated', [
                'notification_id' => $notification->id,
                'recipient_type' => $notification->recipient_type,
            ]);
        }

        return $this->successResponse(
            new NotificationResource($notification->fresh()),
            'Cập nhật thông báo thành công'
        );
    }

    public function destroy(Notification $notification): JsonResponse
    {
        if ($denied = $this->guardNotificationAccess($notification)) {
            return $denied;
        }
        if ($planError = $this->requirePlanCapability('notifications.manage')) {
            return $planError;
        }

        $notification->delete();

        return $this->successResponse(null, 'Xóa thông báo thành công');
    }

    public function send(Notification $notification): JsonResponse
    {
        if ($denied = $this->guardNotificationAccess($notification)) {
            return $denied;
        }
        if ($planError = $this->requirePlanCapability('notifications.send_custom')) {
            return $planError;
        }

        $notification->update([
            'status' => 'scheduled',
            'sent_at' => null,
        ]);

        return $this->successResponse(
            new NotificationResource($notification->fresh()),
            'Đã lên lịch gửi, hãy gọi endpoint gửi email theo batch'
        );
    }

    public function recipients(Notification $notification, Request $request): JsonResponse
    {
        if ($denied = $this->guardNotificationAccess($notification)) {
            return $denied;
        }

        $query = NotificationRecipientLog::where('notification_id', $notification->id);

        if ($request->filled('status')) {
            $query->where('status', $request->get('status'));
        }

        $logs = $query->with(['user', 'student', 'notification'])
            ->orderBy('id')
            ->paginate(min($request->get('per_page', 50), 200));

        return $this->successResponse(NotificationRecipientLogResource::collection($logs));
    }

    /**
     * Gửi email theo batch cho danh sách recipient_ids / recipient_student_ids.
     */
    public function sendEmailBatch(Notification $notification, SendNotificationEmailsRequest $request): JsonResponse
    {
        if ($denied = $this->guardNotificationAccess($notification)) {
            return $denied;
        }
        if ($planError = $this->requirePlanCapability('notifications.send_custom')) {
            return $planError;
        }

        if ($notification->channel !== 'email') {
            return $this->errorResponse(
                "Chỉ áp dụng cho thông báo kênh Email. Hiện kênh: {$notification->channel}.",
                null,
                'INVALID_CHANNEL',
                400
            );
        }

        $user = $this->getAuthUser();
        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // resolveRecipients will handle decoding and normalization
        $recipients = $this->resolveRecipients($notification, $request);

        $sentCount = 0;
        $failedCount = 0;
        $processed = 0;
        $totalInBatch = $recipients->count();
        $errors = [];

        Log::channel('notifications')->info('Notification batch send started', [
            'notification_id' => $notification->id,
            'requested_by' => $user->id,
            'total_in_batch' => $totalInBatch,
        ]);

        foreach ($recipients as $recipient) {
            $email = $recipient['email'] ?? null;
            $userId = $recipient['user_id'] ?? null;
            $studentId = $recipient['student_id'] ?? null;

            if (! $email) {
                $processed++;
                $this->logRecipient($notification->id, $userId, $studentId, $email, 'failed', 'No email');

                continue;
            }

            // Create log as pending with a friendly initial message
            $log = $this->logRecipient($notification->id, $userId, $studentId, $email, 'pending');
            $log->update(['error_message' => 'Đang chờ gửi...']);

            // Dispatch Job
            SendNotificationEmailJob::dispatch($notification, $log);

            $processed++;
        }

        // Update notification status to processing
        $notification->update(['status' => 'processing']);

        // Refresh and count pending
        $pendingLeft = NotificationRecipientLog::where('notification_id', $notification->id)
            ->where('status', 'pending')
            ->count();

        return $this->successResponse([
            'processed' => $processed,
            'total_in_batch' => $totalInBatch,
            'pending_left' => $pendingLeft,
            'notification' => new NotificationResource($notification->fresh()),
        ], 'Đã đẩy các email vào hàng đợi xử lý');
    }

    public function resendFailed(Notification $notification, Request $request): JsonResponse
    {
        if ($denied = $this->guardNotificationAccess($notification)) {
            return $denied;
        }
        if ($planError = $this->requirePlanCapability('notifications.send_custom')) {
            return $planError;
        }

        $user = $this->getAuthUser();
        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        $batchSize = min((int) $request->get('batch_size', 50), 200);

        $failedLogs = NotificationRecipientLog::where('notification_id', $notification->id)
            ->where('status', 'failed')
            ->orderBy('id')
            ->limit($batchSize)
            ->get();

        $sentCount = 0;

        foreach ($failedLogs as $log) {
            // Update to pending and clear old error
            $log->update([
                'status' => 'pending',
                'error_message' => 'Đang chuẩn bị gửi lại...',
            ]);

            // Dispatch Job
            SendNotificationEmailJob::dispatch($notification, $log);

            $sentCount++; // We use this as "dispatched count" here
        }

        // Always set to processing when resending
        $notification->update(['status' => 'processing']);

        $pendingLeft = NotificationRecipientLog::where('notification_id', $notification->id)
            ->where('status', 'pending')
            ->count();
        $failedLeft = NotificationRecipientLog::where('notification_id', $notification->id)
            ->where('status', 'failed')
            ->count();

        return $this->successResponse([
            'dispatched_count' => $sentCount,
            'pending_left' => $pendingLeft,
            'failed_left' => $failedLeft,
            'notification' => new NotificationResource($notification->fresh()),
        ], 'Đã đẩy các bản ghi thất bại vào hàng đợi gửi lại');
    }

    private function seedRecipientLogs(Notification $notification, Request $request): void
    {
        $recipients = $this->resolveRecipients($notification, $request);

        foreach ($recipients as $recipient) {
            $this->logRecipient(
                $notification->id,
                $recipient['user_id'] ?? null,
                $recipient['student_id'] ?? null,
                $recipient['email'] ?? null,
                'pending'
            );
        }

        Log::channel('notifications')->info('Notification recipients seeded', [
            'notification_id' => $notification->id,
            'recipient_count' => $recipients->count(),
        ]);
    }

    private function resolveRecipients(Notification $notification, Request $request): Collection
    {
        // Helper to get array from request (hash/raw) or model (int)
        // Priorities: Request Input > Notification Model
        $resolveIds = function ($inputKey, $modelAttribute, $modelClass) use ($request, $notification) {
            // Check request first
            if ($request->has($inputKey)) {
                $vals = $request->input($inputKey, []);

                return collect($vals)->map(function ($v) use ($modelClass) {
                    return is_numeric($v) ? (int) $v : $modelClass::decodeId($v);
                })->filter()->values()->toArray();
            }

            // Fallback to model data (assumed to be already integers as stored in DB)
            return $notification->{$modelAttribute} ?? [];
        };

        // 1. Resolve IDs
        $recipientType = $request->input('recipient_type') ?? $notification->recipient_type;

        // Determine which IDs to use based on type to avoid "leftover" data from UI
        $useClasses = in_array($recipientType, ['classes', 'all', null]);
        $useIndividuals = in_array($recipientType, ['students', 'all', null]);

        $recipientUserIds = $useIndividuals ? $resolveIds('recipient_ids', 'recipient_ids', User::class) : [];

        $inputStudentIdsKey = $request->has('recipient_students') ? 'recipient_students' : 'recipient_student_ids';
        $manualStudentIds = $useIndividuals ? $resolveIds($inputStudentIdsKey, 'recipient_students', Student::class) : [];

        $classIds = $useClasses ? $resolveIds('recipient_classes', 'recipient_classes', ClassRoom::class) : [];

        // 2. Resolve Students from Classes
        // We ALWAYS resolve class students if classes are provided, regardless of recipient_type
        // This makes the system more robust against UI inconsistencies
        $classStudentIds = [];
        if (! empty($classIds)) {
            $classStudentIds = DB::table('class_student')
                ->whereIn('class_id', $classIds)
               // ->where('status', 'active') // Optional: only active students? Let's keep it broad for now or strictly active?
               // Usually we want active students. Let's assume all linked.
                ->pluck('student_id')
                ->toArray();
        }

        // Merge manual students and class students
        $allStudentIds = array_values(array_unique(array_merge($manualStudentIds, $classStudentIds)));

        Log::channel('notifications')->info('Resolving recipients details', [
            'notification_id' => $notification->id,
            'user_ids_count' => count($recipientUserIds),
            'manual_student_ids_count' => count($manualStudentIds),
            'class_ids_count' => count($classIds),
            'resolved_class_student_ids_count' => count($classStudentIds),
            'total_student_ids_count' => count($allStudentIds),
        ]);

        $recipients = collect();

        // 3. Fetch User objects
        if (! empty($recipientUserIds)) {
            $userRecipients = User::whereIn('id', $recipientUserIds)
                ->get(['id', 'email'])
                ->map(fn ($u) => [
                    'user_id' => $u->id,
                    'student_id' => null,
                    'email' => $u->email,
                ]);
            $recipients = $recipients->merge($userRecipients);
        }

        // 4. Fetch Student objects
        if (! empty($allStudentIds)) {
            $studentRecipients = Student::whereIn('id', $allStudentIds)
                ->with('user:id,email,email_verified_at')
                ->get(['id', 'email', 'user_id'])
                ->map(function ($s) {
                    $email = $s->user?->email ?: $s->email;

                    return [
                        'user_id' => $s->user_id,
                        'student_id' => $s->id,
                        'email' => $email,
                    ];
                });
            $recipients = $recipients->merge($studentRecipients);
        }

        // Intelligent deduplication: Merge User and Student info if they share the same email
        return $recipients->groupBy(function ($item) {
            return $item['email'] ?: ('user:'.($item['user_id'] ?? uniqid()));
        })->map(function ($group) {
            // If only one item, return it
            if ($group->count() === 1) {
                return $group->first();
            }

            // If multiple items (same email), merge them to get best possible info
            $merged = $group->first();

            // Try to find missing student_id from duplicates
            if (empty($merged['student_id'])) {
                $studentItem = $group->first(fn ($i) => ! empty($i['student_id']));
                if ($studentItem) {
                    $merged['student_id'] = $studentItem['student_id'];
                }
            }

            // Try to find missing user_id from duplicates
            if (empty($merged['user_id'])) {
                $userItem = $group->first(fn ($i) => ! empty($i['user_id']));
                if ($userItem) {
                    $merged['user_id'] = $userItem['user_id'];
                }
            }

            return $merged;
        })->values();
    }

    private function logRecipient(
        int $notificationId,
        ?int $userId,
        ?int $studentId,
        ?string $email,
        string $status,
        ?string $error = null
    ): NotificationRecipientLog {
        $log = NotificationRecipientLog::where('notification_id', $notificationId)
            ->where('user_id', $userId)
            ->where('student_id', $studentId)
            ->where('email', $email)
            ->first();

        if ($log && $log->status === 'sent') {
            return $log; // already sent
        }

        if ($log) {
            $log->update([
                'status' => $status,
                'error_message' => $error,
            ]);

            return $log;
        }

        return NotificationRecipientLog::create([
            'notification_id' => $notificationId,
            'user_id' => $userId,
            'student_id' => $studentId,
            'email' => $email,
            'channel' => 'email',
            'status' => $status,
            'error_message' => $error,
        ]);
    }

    public function unread(): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        $query = Notification::where('status', 'sent');

        $query = $this->applyDataIsolation($query, 'notifications');

        $readNotificationIds = NotificationRead::where('user_id', $user->id)
            ->pluck('notification_id')
            ->toArray();

        if (! empty($readNotificationIds)) {
            $query->whereNotIn('id', $readNotificationIds);
        }

        $unreadNotifications = $query->latest()->get();

        return $this->successResponse([
            'notifications' => NotificationResource::collection($unreadNotifications->load('reads')),
            'count' => $unreadNotifications->count(),
        ]);
    }

    public function markAsRead(Notification $notification): JsonResponse
    {
        // Defensive check: ensure notification was properly resolved
        if (! $notification || ! $notification->exists || ! $notification->id) {
            return $this->errorResponse('Không tìm thấy thông báo', null, 'NOT_FOUND', 404);
        }
        $user = $this->getAuthUser();
        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        NotificationRead::firstOrCreate([
            'user_id' => $user->id,
            'notification_id' => $notification->id,
        ], [
            'read_at' => now(),
        ]);

        return $this->successResponse(null, 'Đã đánh dấu đã đọc');
    }
}
