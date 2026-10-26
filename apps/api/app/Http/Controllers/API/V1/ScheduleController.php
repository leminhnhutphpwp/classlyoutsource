<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Resources\ClassRoomResource;
use App\Http\Resources\ScheduleResource;
use App\Http\Resources\ScheduleSessionResource;
use App\Models\ClassRoom;
use App\Models\Schedule;
use App\Models\ScheduleSession;
use App\Rules\ExistsHashId;
use App\Support\CacheKeys;
use App\Support\CacheTtl;
use App\Traits\DecodesHashIds;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Validator;

class ScheduleController extends BaseController
{
    use DecodesHashIds;

    /**
     * Get validation rules for schedule.
     */
    private function getValidationRules(bool $isUpdate = false): array
    {
        $rules = [
            'recurring_type' => ($isUpdate ? 'sometimes|' : '').'required|in:daily,weekly,monthly,custom,once',
            'recurring_days' => 'nullable|array',
            'start_date' => ($isUpdate ? 'sometimes|' : '').'required|date',
            'end_date' => 'nullable|date|after:start_date',
            'start_time' => ($isUpdate ? 'sometimes|' : '').'required|date_format:H:i',
            'end_time' => ($isUpdate ? 'sometimes|' : '').'required|date_format:H:i'.($isUpdate ? '' : '|after:start_time'),
            'room' => 'nullable|string|max:255',
            'location' => 'nullable|string',
            'default_mode' => ($isUpdate ? 'sometimes|' : '').'required|in:offline,online',
            'online_platform' => 'nullable|string|max:100',
            'online_meeting_url' => 'nullable|url',
            'online_meeting_id' => 'nullable|string|max:255',
            'online_meeting_password' => 'nullable|string|max:255',
            'is_alternating' => 'nullable|boolean',
            'alternating_pattern' => 'nullable|array',
            'is_active' => 'nullable|boolean',
            'notes' => 'nullable|string',
        ];

        if (! $isUpdate) {
            $rules['class_id'] = ['required', new ExistsHashId(ClassRoom::class)];
            $rules['recurring_days'] = 'required_if:recurring_type,weekly,custom|array';
        }

        return $rules;
    }

    /**
     * Apply filters (class_id, is_active, recurring_type, sort) to query.
     */
    private function applyFilters($query, Request $request)
    {
        if ($request->has('class_id')) {
            $query->where('class_id', $request->class_id);
        }

        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->filled('status')) {
            switch ($request->status) {
                case 'upcoming':
                    $query->upcoming();
                    break;
                case 'in_progress':
                    $query->inProgress();
                    break;
                case 'paused':
                    $query->paused();
                    break;
                case 'completed':
                    $query->completed();
                    break;
                    // 'all' case is handled by default (no filter applied)
            }
        }

        if ($request->has('recurring_type')) {
            $query->where('recurring_type', $request->recurring_type);
        }

        if ($request->has('mode')) {
            $query->where('default_mode', $request->mode);
        } elseif ($request->has('default_mode')) {
            $query->where('default_mode', $request->default_mode);
        }

        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where(function ($q) use ($search) {
                $q->where('notes', 'like', "%{$search}%")
                    ->orWhere('location', 'like', "%{$search}%")
                    ->orWhere('room', 'like', "%{$search}%")
                    ->orWhereHas('class', function ($classQuery) use ($search) {
                        $classQuery->where('name', 'like', "%{$search}%")
                            ->orWhere('description', 'like', "%{$search}%");
                    });
            });
        }

        // Sort
        $sortable = ['created_at', 'updated_at', 'start_date', 'end_date', 'day_of_week', 'start_time', 'end_time', 'room', 'location', 'is_active'];
        $sortBy = $request->get('sort', 'created_at');
        if (! in_array($sortBy, $sortable, true)) {
            $sortBy = 'created_at';
        }
        $sortOrder = strtolower($request->get('order', 'desc')) === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sortBy, $sortOrder);

        return $query;
    }

    /**
     * List all schedules (with data isolation).
     */
    public function index(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();
        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Học viên: có thể xem schedules của chính họ (không cần capability)
        // Giáo viên: cần capability schedules.manage để xem schedules
        if (! $user->isStudent()) {
            if ($capabilityError = $this->requirePlanCapability('schedules.manage')) {
                return $capabilityError;
            }
        }

        // Cache result
        $filters = $request->all();
        $cacheKey = CacheKeys::schedulesList($user->id, $filters);

        $result = Cache::remember($cacheKey, CacheTtl::LIST, function () use ($request) {
            return $this->buildScheduleListResponse($request);
        });

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('schedules.manage');

        return response()->json([
            'success' => true,
            'data' => $result['data'],
            'meta' => $result['meta'],
            'permissions' => $permissions,
        ]);
    }

    /**
     * Get schedule details.
     */
    public function show(Schedule $schedule): JsonResponse
    {
        // Defensive check: ensure schedule was properly resolved
        if (! $schedule || ! $schedule->exists || ! $schedule->id) {
            return $this->errorResponse('Không tìm thấy lịch học', null, 'NOT_FOUND', 404);
        }
        $cacheKey = CacheKeys::scheduleDetail($schedule->id);

        $schedule = Cache::remember($cacheKey, CacheTtl::DETAIL, function () use ($schedule) {
            return $schedule->load(['class.tutor']);
        });

        $user = $this->getAuthUser();

        // Student: chỉ cần kiểm tra xem họ có tham gia lớp học này không
        if ($user && $user->isStudent()) {
            $student = $this->getCurrentStudent();
            if ($student) {
                $isEnrolled = $this->isStudentEnrolledInClass($student, $schedule->class_id);
                if ($isEnrolled) {
                    // Học viên có thể xem schedule detail (không cần capability)
                    // Nhưng vẫn trả về permissions để frontend biết
                    $permissions = $this->buildViewManagePermissions('schedules.manage');
                    $response = $this->successResponse(new ScheduleResource($schedule));
                    $responseData = $response->getData(true);
                    $responseData['permissions'] = $permissions;

                    return response()->json($responseData, $response->getStatusCode());
                }
            }

            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Other roles: use canManageResource
        // Check access via class
        if (! $this->canManageResource($schedule->class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Giáo viên cần capability schedules.manage để xem schedule
        if (! $user->isStudent()) {
            if ($capabilityError = $this->requirePlanCapability('schedules.manage')) {
                return $capabilityError;
            }
        }

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('schedules.manage');

        $response = $this->successResponse(new ScheduleResource($schedule));
        $responseData = $response->getData(true);
        $responseData['permissions'] = $permissions;

        return response()->json($responseData, $response->getStatusCode());
    }

    /**
     * Create a new schedule.
     */
    public function store(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $validator = Validator::make($request->all(), $this->getValidationRules());

        if ($validator->fails()) {
            return $this->errorResponse(
                'Dữ liệu không hợp lệ',
                $validator,
                'VALIDATION_ERROR',
                422
            );
        }

        // Check if user can manage this class
        $this->decodeHashId($request, 'class_id', ClassRoom::class);
        $class = ClassRoom::find($request->class_id);
        if (! $class || ! $this->canManageResource($class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Check capability for schedules management
        if ($capabilityError = $this->requirePlanCapability('schedules.manage')) {
            return $capabilityError;
        }

        $scheduleData = $request->only([
            'class_id', 'recurring_type', 'recurring_days', 'start_date', 'end_date',
            'start_time', 'end_time', 'room', 'location', 'default_mode',
            'online_platform', 'online_meeting_url', 'online_meeting_id',
            'online_meeting_password', 'online_config', 'is_alternating',
            'alternating_pattern', 'notes',
        ]);

        $scheduleData['is_active'] = true;

        $schedule = Schedule::create($scheduleData);

        // Cache clearing handled by ScheduleObserver

        return $this->successResponse(
            new ScheduleResource($schedule->load('class.tutor')),
            'Tạo lịch học thành công',
            201
        );
    }

    /**
     * Update schedule.
     */
    public function update(Request $request, Schedule $schedule): JsonResponse
    {
        // Defensive check: ensure schedule was properly resolved
        if (! $schedule || ! $schedule->exists || ! $schedule->id) {
            return $this->errorResponse('Không tìm thấy lịch học', null, 'NOT_FOUND', 404);
        }

        if (! $this->canManageResource($schedule->class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Check capability for schedules management
        if ($capabilityError = $this->requirePlanCapability('schedules.manage')) {
            return $capabilityError;
        }

        $validator = Validator::make($request->all(), $this->getValidationRules(true));

        if ($validator->fails()) {
            return $this->errorResponse(
                'Dữ liệu không hợp lệ',
                $validator,
                'VALIDATION_ERROR',
                422
            );
        }

        $schedule->update($request->only([
            'recurring_type', 'recurring_days', 'start_date', 'end_date',
            'start_time', 'end_time', 'room', 'location', 'default_mode',
            'online_platform', 'online_meeting_url', 'online_meeting_id',
            'online_meeting_password', 'online_config', 'is_alternating',
            'alternating_pattern', 'is_active', 'notes',
        ]));

        // Cache clearing handled by ScheduleObserver

        // Load relationships after update
        $schedule->load('class.tutor');

        return $this->successResponse(
            new ScheduleResource($schedule),
            'Cập nhật lịch học thành công'
        );
    }

    /**
     * Delete schedule.
     */
    public function destroy(Schedule $schedule): JsonResponse
    {
        // Defensive check: ensure schedule was properly resolved
        if (! $schedule || ! $schedule->exists || ! $schedule->id) {
            return $this->errorResponse('Không tìm thấy lịch học', null, 'NOT_FOUND', 404);
        }

        if (! $this->canManageResource($schedule->class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Check capability for schedules management
        if ($capabilityError = $this->requirePlanCapability('schedules.manage')) {
            return $capabilityError;
        }

        $classId = $schedule->class_id;
        $schedule->delete();

        $userId = auth('api')->id();
        // Cache clearing handled by ScheduleObserver

        return $this->successResponse(null, 'Xóa lịch học thành công');
    }

    /**
     * Generate sessions from schedule (create new sessions only, skip existing).
     */
    public function generateSessions(Schedule $schedule): JsonResponse
    {
        $schedule->load('class.tutor');

        if (! $this->canManageResource($schedule->class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Check capability for schedules management
        if ($capabilityError = $this->requirePlanCapability('schedules.manage')) {
            return $capabilityError;
        }

        try {
            $count = $schedule->generateSessions();

            // Load created sessions
            $sessions = $schedule->sessions()
                ->where('session_date', '>=', now()->startOfDay())
                ->orderBy('session_date')
                ->orderBy('start_time')
                ->get();

            return $this->successResponse([
                'sessions_created' => $count,
                'total_sessions' => $sessions->count(),
                'sessions' => ScheduleSessionResource::collection($sessions),
            ], "Đã tạo {$count} buổi học mới");
        } catch (\Exception $e) {
            return $this->errorResponse(
                'Không thể tạo buổi học',
                ['error' => $e->getMessage()],
                'GENERATION_FAILED',
                500
            );
        }
    }

    /**
     * Regenerate sessions from schedule (delete future sessions and create new ones).
     */
    public function regenerateSessions(Schedule $schedule): JsonResponse
    {
        $schedule->load('class.tutor');

        if (! $this->canManageResource($schedule->class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Check capability for schedules management
        if ($capabilityError = $this->requirePlanCapability('schedules.manage')) {
            return $capabilityError;
        }

        try {
            $count = $schedule->regenerateSessions();

            // Load regenerated sessions
            $sessions = $schedule->sessions()
                ->where('session_date', '>=', now()->startOfDay())
                ->orderBy('session_date')
                ->orderBy('start_time')
                ->get();

            return $this->successResponse([
                'sessions_regenerated' => $count,
                'total_future_sessions' => $sessions->count(),
                'sessions' => ScheduleSessionResource::collection($sessions),
            ], "Đã tạo lại {$count} buổi học. Các buổi học đã hoàn thành hoặc đã hủy được giữ nguyên.");
        } catch (\Exception $e) {
            return $this->errorResponse(
                'Không thể tạo lại buổi học',
                ['error' => $e->getMessage()],
                'REGENERATION_FAILED',
                500
            );
        }
    }

    /**
     * Get generated sessions for schedule (grouped by week).
     */
    public function sessions(Schedule $schedule): JsonResponse
    {
        $schedule->load(['sessions', 'class.tutor']);

        $user = $this->getAuthUser();

        // Student: chỉ cần kiểm tra xem họ có tham gia lớp học này không
        if ($user && $user->isStudent()) {
            $student = $this->getCurrentStudent();
            if ($student) {
                $isEnrolled = $this->isStudentEnrolledInClass($student, $schedule->class_id);
                if (! $isEnrolled) {
                    return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
                }
            } else {
                return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }
        } else {
            // Other roles: use canManageResource
            if (! $this->canManageResource($schedule->class)) {
                return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }

            // Giáo viên cần capability schedules.manage để xem sessions
            if ($capabilityError = $this->requirePlanCapability('schedules.manage')) {
                return $capabilityError;
            }
        }

        // Auto-complete sessions that have passed their end time
        $sessionsToAutoComplete = $schedule->sessions()
            ->where('status', '!=', 'completed')
            ->where('status', '!=', 'cancelled')
            ->get()
            ->filter(fn ($session) => $session->shouldBeAutoCompleted());

        foreach ($sessionsToAutoComplete as $session) {
            $session->autoCompleteIfNeeded();
        }

        // Get all sessions ordered by date (eager load relationships to avoid MissingValue errors)
        // Only get sessions within schedule date range
        $query = $schedule->sessions()
            ->with(['schedule', 'class', 'completedBy'])
            ->orderBy('session_date')
            ->orderBy('start_time');

        // Filter by schedule date range if exists
        if ($schedule->start_date) {
            $query->where('session_date', '>=', $schedule->start_date);
        }
        if ($schedule->end_date) {
            $query->where('session_date', '<=', $schedule->end_date);
        }

        $allSessions = $query->get();

        // Group sessions by learning week (from schedule start_date, every 7 days = 1 week)
        // Not calendar week (Monday-Sunday), but actual learning weeks
        $weeks = [];

        if ($schedule->start_date && $allSessions->isNotEmpty()) {
            $scheduleStartDate = Carbon::parse($schedule->start_date)->startOfDay();
            $scheduleEndDate = $schedule->end_date
                ? Carbon::parse($schedule->end_date)->endOfDay()
                : null;

            // Use array to track weeks by week_key to avoid duplicates
            $weeksMap = [];

            foreach ($allSessions as $session) {
                $sessionDate = $session->session_date->startOfDay();

                // Skip sessions before start_date (shouldn't happen due to query filter, but double-check)
                if ($sessionDate->lt($scheduleStartDate)) {
                    continue;
                }

                // Calculate which learning week this session belongs to
                // Week starts from schedule start_date, every 7 days = 1 week
                $daysFromStart = $scheduleStartDate->diffInDays($sessionDate);

                // Only count forward days (ignore negative)
                if ($daysFromStart < 0) {
                    continue;
                }

                $learningWeekNumber = floor($daysFromStart / 7) + 1;

                // Calculate week start and end dates (7 days from schedule start)
                $weekStart = $scheduleStartDate->copy()->addDays(($learningWeekNumber - 1) * 7);
                $weekEnd = $weekStart->copy()->addDays(6);

                // Clamp to schedule end_date if needed
                if ($scheduleEndDate && $weekEnd->gt($scheduleEndDate)) {
                    $weekEnd = $scheduleEndDate->copy();
                }

                $weekKey = $weekStart->toDateString();

                // Get or create week entry
                if (! isset($weeksMap[$weekKey])) {
                    $weeksMap[$weekKey] = [
                        'week_number' => $learningWeekNumber,
                        'week_start' => $weekStart->toDateString(),
                        'week_end' => $weekEnd->toDateString(),
                        'sessions' => [],
                    ];
                }

                // Add session to week (convert to array for proper serialization)
                $weeksMap[$weekKey]['sessions'][] = (new ScheduleSessionResource($session))->toArray(request());
            }

            // Convert map to array and sort by week_number
            $weeks = array_values($weeksMap);
            usort($weeks, fn ($a, $b) => $a['week_number'] <=> $b['week_number']);

        } else {
            // Fallback to calendar weeks if no start_date
            $currentWeek = null;
            $weekNumber = 0;

            foreach ($allSessions as $session) {
                $sessionWeek = $session->session_date->copy()->startOfWeek()->toDateString();
                $weekKey = $sessionWeek;

                // Check if this is a new week
                if (! $currentWeek || $currentWeek['week_start'] !== $weekKey) {
                    $weekNumber++;
                    $currentWeek = [
                        'week_number' => $weekNumber,
                        'week_start' => $weekKey,
                        'week_end' => $session->session_date->copy()->endOfWeek()->toDateString(),
                        'sessions' => [],
                    ];
                    $weeks[] = $currentWeek;
                }

                // Add session to current week
                $weeks[count($weeks) - 1]['sessions'][] = (new ScheduleSessionResource($session))->toArray(request());
            }
        }

        // Calculate statistics
        $totalWeeks = count($weeks);
        $totalSessions = $allSessions->count();
        $sessionsPerWeek = $totalWeeks > 0 ? round($totalSessions / $totalWeeks, 1) : 0;

        // Count sessions per week
        foreach ($weeks as &$week) {
            $week['total_sessions'] = count($week['sessions']);
        }
        unset($week); // Break reference

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('schedules.manage');

        $response = $this->successResponse([
            'schedule' => new ScheduleResource($schedule),
            'statistics' => [
                'total_weeks' => $totalWeeks,
                'total_sessions' => $totalSessions,
                'average_sessions_per_week' => $sessionsPerWeek,
                'date_range' => [
                    'start' => $allSessions->first()?->session_date?->toDateString(),
                    'end' => $allSessions->last()?->session_date?->toDateString(),
                ],
            ],
            'weeks' => $weeks,
            // Keep flat list for backward compatibility
            'sessions' => ScheduleSessionResource::collection($allSessions),
        ]);
        $responseData = $response->getData(true);
        $responseData['permissions'] = $permissions;

        return response()->json($responseData, $response->getStatusCode());
    }

    /**
     * Get schedules by class with filters, pagination, and search.
     */
    public function byClass(Request $request, ClassRoom $classRoom): JsonResponse
    {
        $class = $classRoom;
        $id = $class->id;

        $user = $this->getAuthUser();

        // Student: chỉ cần kiểm tra xem họ có tham gia lớp học này không
        if ($user->isStudent()) {
            $student = $this->getCurrentStudent();
            if ($student) {
                $isEnrolled = $this->isStudentEnrolledInClass($student, $id);
                if (! $isEnrolled) {
                    return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
                }
            } else {
                return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }
        } else {
            // Other roles: use canManageResource
            if (! $this->canManageResource($class)) {
                return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }

            // Giáo viên cần capability schedules.manage để xem lịch học trong lớp
            if ($capabilityError = $this->requirePlanCapability('schedules.manage')) {
                return $capabilityError;
            }
        }

        $result = $this->buildClassSchedulesResponse($class, $request, $id);

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('schedules.manage');

        return response()->json([
            'success' => true,
            'data' => [
                'class' => $result['class'],
                'schedules' => $result['schedules'],
                'statistics' => $result['statistics'],
            ],
            'meta' => $result['meta'],
            'permissions' => $permissions,
        ]);
    }

    /**
     * Toggle schedule mode (online/offline).
     */
    public function toggleMode(Request $request, Schedule $schedule): JsonResponse
    {

        if (! $this->canManageResource($schedule->class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Check capability for schedules management
        if ($capabilityError = $this->requirePlanCapability('schedules.manage')) {
            return $capabilityError;
        }

        $validator = Validator::make($request->all(), [
            'mode' => 'required|in:offline,online',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse(
                'Dữ liệu không hợp lệ',
                $validator,
                'VALIDATION_ERROR',
                422
            );
        }

        $schedule->update([
            'default_mode' => $request->mode,
        ]);

        // Load relationships after update
        $schedule->load('class.tutor');

        return $this->successResponse(
            new ScheduleResource($schedule),
            "Đã thay đổi chế độ lịch học sang {$request->mode}"
        );
    }

    /**
     * Get a specific schedule session.
     */
    public function showSession(string $scheduleSession): JsonResponse
    {
        $session = ScheduleSession::findByHashId($scheduleSession);

        // Defensive check: ensure schedule session was properly resolved
        if (! $session || ! $session->exists) {
            return $this->errorResponse('Không tìm thấy buổi học', null, 'NOT_FOUND', 404);
        }

        $session->load(['schedule', 'class.tutor', 'completedBy']);

        $user = $this->getAuthUser();

        // Student: check enrollment
        if ($user && $user->isStudent()) {
            $student = $this->getCurrentStudent();
            if (! $student || ! $this->isStudentEnrolledInClass($student, $session->class_id)) {
                return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }
        } else {
            // Other roles: check management permission
            if (! $this->canManageResource($session->class)) {
                return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }
        }

        return $this->successResponse(new ScheduleSessionResource($session));
    }

    /**
     * Mark a schedule session as completed.
     */
    public function completeSession(string $scheduleSession): JsonResponse
    {
        $session = ScheduleSession::findByHashId($scheduleSession);

        // Defensive check: ensure schedule session was properly resolved
        if (! $session || ! $session->exists) {
            return $this->errorResponse('Không tìm thấy buổi học', null, 'NOT_FOUND', 404);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $session->load(['schedule', 'class']);

        // Check if user can manage this class
        if (! $this->canManageResource($session->class)) {
            return $this->errorResponse('Chỉ giáo viên mới có thể đánh dấu buổi học hoàn thành', null, 'UNAUTHORIZED', 403);
        }

        // Check capability for schedules management
        if ($capabilityError = $this->requirePlanCapability('schedules.manage')) {
            return $capabilityError;
        }

        // Check if already completed
        if ($session->isCompleted()) {
            return $this->errorResponse('Buổi học đã được đánh dấu hoàn thành', null, 'ALREADY_COMPLETED', 400);
        }

        // Mark as completed
        $session->markAsCompleted($user->id);

        return $this->successResponse(
            new ScheduleSessionResource($session->fresh(['schedule', 'class', 'completedBy'])),
            'Đã đánh dấu buổi học hoàn thành'
        );
    }

    /**
     * Cancel a schedule session.
     */
    public function cancelSession(string $scheduleSession): JsonResponse
    {
        $session = ScheduleSession::findByHashId($scheduleSession);

        // Defensive check: ensure schedule session was properly resolved
        if (! $session || ! $session->exists) {
            return $this->errorResponse('Không tìm thấy buổi học', null, 'NOT_FOUND', 404);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $session->load(['schedule', 'class']);

        // Check if user can manage this class
        if (! $this->canManageResource($session->class)) {
            return $this->errorResponse('Chỉ giáo viên mới có thể hủy buổi học', null, 'UNAUTHORIZED', 403);
        }

        // Check capability for schedules management
        if ($capabilityError = $this->requirePlanCapability('schedules.manage')) {
            return $capabilityError;
        }

        // Check if already cancelled or completed
        if ($session->status === 'cancelled') {
            return $this->errorResponse('Buổi học đã được hủy', null, 'ALREADY_CANCELLED', 400);
        }

        if ($session->status === 'completed') {
            return $this->errorResponse('Không thể hủy buổi học đã hoàn thành', null, 'CANNOT_CANCEL_COMPLETED', 400);
        }

        // Cancel session
        $session->update([
            'status' => 'cancelled',
            'attendance_code' => null, // retire the QR fallback code once the session is closed
        ]);

        return $this->successResponse(
            new ScheduleSessionResource($session->fresh(['schedule', 'class'])),
            'Đã hủy buổi học'
        );
    }

    /**
     * Update a schedule session.
     */
    public function updateSession(Request $request, string $scheduleSession): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $session = ScheduleSession::findByHashId($scheduleSession);

        if (! $session || ! $session->exists) {
            return $this->errorResponse('Không tìm thấy buổi học', null, 'NOT_FOUND', 404);
        }

        $session->load(['schedule', 'class']);

        // Check if user can manage this class
        if (! $this->canManageResource($session->class)) {
            return $this->errorResponse('Chỉ giáo viên mới có thể cập nhật buổi học', null, 'UNAUTHORIZED', 403);
        }

        // Check capability for schedules management
        if ($capabilityError = $this->requirePlanCapability('schedules.manage')) {
            return $capabilityError;
        }

        // Validation rules
        $validator = Validator::make($request->all(), [
            'session_date' => 'sometimes|date',
            'start_time' => 'sometimes|date_format:H:i',
            'end_time' => 'sometimes|date_format:H:i|after:start_time',
            'mode' => 'sometimes|in:offline,online',
            'room' => 'nullable|string|max:255',
            'location' => 'nullable|string|max:500',
            'online_platform' => 'nullable|string|max:100',
            'online_meeting_url' => 'nullable|url|max:500',
            'online_meeting_id' => 'nullable|string|max:255',
            'online_meeting_password' => 'nullable|string|max:255',
            'status' => 'sometimes|in:scheduled,ongoing,completed,cancelled,postponed',
            'notes' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse(
                'Dữ liệu không hợp lệ',
                $validator,
                'VALIDATION_ERROR',
                422
            );
        }

        // Prevent updating completed or cancelled sessions (except status change)
        if ($session->status === 'completed' && $request->has('status') && $request->status !== 'completed') {
            // Allow changing status from completed
        } elseif ($session->status === 'completed' && ! $request->has('status')) {
            return $this->errorResponse('Không thể cập nhật buổi học đã hoàn thành', null, 'CANNOT_UPDATE_COMPLETED', 400);
        }

        if ($session->status === 'cancelled' && $request->has('status') && $request->status !== 'cancelled') {
            // Allow changing status from cancelled
        } elseif ($session->status === 'cancelled' && ! $request->has('status')) {
            return $this->errorResponse('Không thể cập nhật buổi học đã hủy', null, 'CANNOT_UPDATE_CANCELLED', 400);
        }

        // Prepare update data
        $updateData = $request->only([
            'session_date',
            'start_time',
            'end_time',
            'mode',
            'room',
            'location',
            'online_platform',
            'online_meeting_url',
            'online_meeting_id',
            'online_meeting_password',
            'status',
            'notes',
        ]);

        // Remove null values
        $updateData = array_filter($updateData, function ($value) {
            return $value !== null;
        });

        // Update session
        $session->update($updateData);

        return $this->successResponse(
            new ScheduleSessionResource($session->fresh(['schedule', 'class', 'completedBy'])),
            'Cập nhật buổi học thành công'
        );
    }

    /**
     * Reschedule a session (change date/time).
     */
    public function rescheduleSession(Request $request, string $scheduleSession): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $session = ScheduleSession::findByHashId($scheduleSession);

        if (! $session || ! $session->exists) {
            return $this->errorResponse('Không tìm thấy buổi học', null, 'NOT_FOUND', 404);
        }

        $session->load(['schedule', 'class']);

        // Check if user can manage this class
        if (! $this->canManageResource($session->class)) {
            return $this->errorResponse('Chỉ giáo viên mới có thể dời lịch buổi học', null, 'UNAUTHORIZED', 403);
        }

        // Check capability for schedules management
        if ($capabilityError = $this->requirePlanCapability('schedules.manage')) {
            return $capabilityError;
        }

        $validator = Validator::make($request->all(), [
            'session_date' => 'required|date',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'status' => 'nullable|in:scheduled,postponed',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse(
                'Dữ liệu không hợp lệ',
                $validator,
                'VALIDATION_ERROR',
                422
            );
        }

        // Update session
        $session->update([
            'session_date' => $request->session_date,
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
            'status' => $request->status ?? 'postponed',
        ]);

        return $this->successResponse(
            new ScheduleSessionResource($session->fresh(['schedule', 'class'])),
            'Đã dời lịch buổi học'
        );
    }

    /**
     * Build response for schedule index.
     */
    private function buildScheduleListResponse(Request $request): array
    {
        $query = Schedule::query()->with(['class.tutor']);
        $query = $this->applyDataIsolation($query, 'schedules');
        $query = $this->applyFilters($query, $request);

        $perPage = min($request->get('per_page', 15), 100);
        $page = (int) $request->get('page', 1);
        $schedules = $query->paginate($perPage, ['*'], 'page', $page);

        // Calculate statistics (on all data, not filtered/paginated)
        $statsQuery = Schedule::query();
        $statsQuery = $this->applyDataIsolation($statsQuery, 'schedules');

        $now = now();

        $statistics = [
            'total' => $statsQuery->count(),
            'in_progress' => (clone $statsQuery)
                ->where('start_date', '<=', $now)
                ->where(function ($q) use ($now) {
                    $q->whereNull('end_date')
                        ->orWhere('end_date', '>=', $now);
                })
                ->where('is_active', true)
                ->count(),
            'upcoming' => (clone $statsQuery)
                ->where('start_date', '>', $now)
                ->where('is_active', true)
                ->count(),
            'completed' => (clone $statsQuery)
                ->where('end_date', '<', $now)
                ->count(),
        ];

        return [
            'data' => ScheduleResource::collection($schedules),
            'meta' => [
                'current_page' => $schedules->currentPage(),
                'per_page' => $schedules->perPage(),
                'total' => $schedules->total(),
                'last_page' => $schedules->lastPage(),
                'statistics' => $statistics,
            ],
        ];
    }

    /**
     * Build response for schedules filtered by class.
     */
    private function buildClassSchedulesResponse(ClassRoom $class, Request $request, int $classId): array
    {
        $query = Schedule::where('class_id', $classId)
            ->with(['class.tutor']);

        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->has('recurring_type')) {
            $query->where('recurring_type', $request->recurring_type);
        }

        if ($request->has('default_mode')) {
            $query->where('default_mode', $request->default_mode);
        }

        if ($request->has('start_date_from')) {
            $query->whereDate('start_date', '>=', $request->start_date_from);
        }

        if ($request->has('start_date_to')) {
            $query->whereDate('start_date', '<=', $request->start_date_to);
        }

        if ($request->has('end_date_from')) {
            $query->whereDate('end_date', '>=', $request->end_date_from);
        }

        if ($request->has('end_date_to')) {
            $query->whereDate('end_date', '<=', $request->end_date_to);
        }

        if ($request->has('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('notes', 'like', "%{$request->search}%")
                    ->orWhere('day_of_week', 'like', "%{$request->search}%")
                    ->orWhere('room', 'like', "%{$request->search}%")
                    ->orWhere('location', 'like', "%{$request->search}%");
            });
        }

        $sortable = ['created_at', 'updated_at', 'start_date', 'end_date', 'day_of_week', 'start_time', 'end_time', 'room', 'location', 'is_active'];
        $sortBy = $request->get('sort', 'start_date');
        if (! in_array($sortBy, $sortable, true)) {
            $sortBy = 'start_date';
        }
        $sortOrder = strtolower($request->get('order', 'desc')) === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sortBy, $sortOrder);

        $perPage = (int) min($request->get('per_page', 15), 100);
        $page = (int) $request->get('page', 1);
        $schedules = $query->paginate($perPage, ['*'], 'page', $page);

        $totalCount = Schedule::where('class_id', $classId)->count();
        $activeCount = Schedule::where('class_id', $classId)->where('is_active', true)->count();
        $recurringTypesCount = Schedule::where('class_id', $classId)
            ->selectRaw('recurring_type, COUNT(*) as count')
            ->groupBy('recurring_type')
            ->pluck('count', 'recurring_type')
            ->toArray();

        return [
            'class' => new ClassRoomResource($class),
            'schedules' => ScheduleResource::collection($schedules),
            'statistics' => [
                'total_count' => $totalCount,
                'active_count' => $activeCount,
                'recurring_types' => $recurringTypesCount,
            ],
            'meta' => [
                'current_page' => $schedules->currentPage(),
                'per_page' => $schedules->perPage(),
                'total' => $schedules->total(),
                'last_page' => $schedules->lastPage(),
            ],
        ];
    }
}
