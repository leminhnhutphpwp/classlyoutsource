<?php

namespace App\Http\Controllers\API\V1;

use App\Actions\ImportAttendanceAction;
use App\Http\Requests\ImportAttendanceRequest;
use App\Http\Resources\AttendanceResource;
use App\Http\Resources\ClassRoomResource;
use App\Models\Attendance;
use App\Models\ClassRoom;
use App\Models\Student;
use App\Rules\ExistsHashId;
use App\Services\DataJobService;
use App\Services\ImportService;
use App\Support\CacheHelper;
use App\Support\CacheKeys;
use App\Support\CacheTtl;
use App\Support\CacheVersion;
use App\Traits\DecodesHashIds;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class AttendanceController extends BaseController
{
    use DecodesHashIds;

    /**
     * Get validation rules for attendance.
     */
    private function getValidationRules(bool $isUpdate = false, bool $isBulk = false): array
    {
        if ($isBulk) {
            return [
                'updates' => 'required|array|min:1',
                'updates.*.id' => ['required', new ExistsHashId(Attendance::class)],
                'updates.*.status' => 'sometimes|in:present,absent,late,excused',
                'updates.*.check_in_time' => 'nullable|date_format:H:i',
                'updates.*.check_out_time' => 'nullable|date_format:H:i',
                'updates.*.note' => 'nullable|string',
            ];
        }

        if ($isUpdate) {
            return [
                'status' => 'sometimes|in:present,absent,late,excused',
                'check_in_time' => 'nullable|date_format:H:i',
                'check_out_time' => 'nullable|date_format:H:i',
                'note' => 'nullable|string',
            ];
        }

        return [
            'class_id' => ['required', new ExistsHashId(ClassRoom::class)],
            'date' => 'required|date',
            'attendances' => 'required|array|min:1',
            'attendances.*.student_id' => ['required', new ExistsHashId(Student::class)],
            'attendances.*.status' => 'required|in:present,absent,late,excused',
            'attendances.*.check_in_time' => 'nullable|date_format:H:i',
            'attendances.*.check_out_time' => 'nullable|date_format:H:i',
            'attendances.*.note' => 'nullable|string',
        ];
    }

    /**
     * Apply filters (class_id, student_id, date, status, search, sort) to query.
     */
    private function applyFilters($query, Request $request)
    {
        if ($request->has('class_id')) {
            $query->where('class_id', $request->class_id);
        }

        if ($request->has('student_id')) {
            $query->where('student_id', $request->student_id);
        }

        if ($request->has('date')) {
            $query->whereDate('date', $request->date);
        }

        if ($request->has('date_from')) {
            $query->whereDate('date', '>=', $request->date_from);
        }

        if ($request->has('date_to')) {
            $query->whereDate('date', '<=', $request->date_to);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Search by student name/email/code
        if ($request->has('search')) {
            $query->where(function ($q) use ($request) {
                $q->whereHas('student', function ($q) use ($request) {
                    $q->where('name', 'like', "%{$request->search}%")
                        ->orWhere('email', 'like', "%{$request->search}%")
                        ->orWhere('student_code', 'like', "%{$request->search}%");
                })
                    ->orWhereHas('class', function ($q) use ($request) {
                        $q->where('name', 'like', "%{$request->search}%")
                            ->orWhere('subject', 'like', "%{$request->search}%");
                    })
                    ->orWhereHas('tutor', function ($q) use ($request) {
                        $q->where('name', 'like', "%{$request->search}%")
                            ->orWhere('email', 'like', "%{$request->search}%");
                    });
            });
        }

        // Sort
        $sortable = ['date', 'status', 'check_in_time', 'check_out_time', 'created_at', 'updated_at'];
        $sortBy = $request->get('sort', 'date');
        if (! in_array($sortBy, $sortable, true)) {
            $sortBy = 'date';
        }
        $sortOrder = strtolower($request->get('order', 'desc')) === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sortBy, $sortOrder);

        return $query;
    }

    /**
     * List all attendance records (with data isolation).
     */
    public function index(Request $request): JsonResponse
    {
        // Decode filter IDs if present
        // Decode filter IDs if present
        $this->decodeHashId($request, 'class_id', ClassRoom::class);
        $this->decodeHashId($request, 'student_id', Student::class);

        $user = $this->getAuthUser();
        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Học viên: có thể xem attendance của chính họ (không cần capability)
        // Giáo viên: cần capability attendance.manage để xem attendance
        if (! $user->isStudent()) {
            if ($capabilityError = $this->requirePlanCapability('attendance.manage')) {
                return $capabilityError;
            }
        }

        $filters = [
            'class_id' => $request->get('class_id'),
            'student_id' => $request->get('student_id'),
            'date' => $request->get('date'),
            'date_from' => $request->get('date_from'),
            'date_to' => $request->get('date_to'),
            'status' => $request->get('status'),
            'search' => $request->get('search'),
            'sort' => $request->get('sort', 'date'),
            'order' => $request->get('order', 'desc'),
            'per_page' => $request->get('per_page', 15),
            'page' => $request->get('page', 1),
        ];
        $cacheKey = CacheKeys::attendanceList($user->id, $filters);

        $result = Cache::remember($cacheKey, CacheTtl::LIST, function () use ($request, $filters) {
            $query = Attendance::query()->with(['class', 'student', 'tutor']);

            // Apply data isolation
            $query = $this->applyDataIsolation($query, 'attendances');

            // Apply filters
            $query = $this->applyFilters($query, $request);

            // Pagination - explicitly pass page parameter
            // IMPORTANT: Use $filters['page'] not $request->get('page') to avoid reading from global request
            $perPage = (int) min($filters['per_page'] ?? 15, 100);
            $page = (int) ($filters['page'] ?? 1);

            $attendances = $query->paginate($perPage, ['*'], 'page', $page);

            // Calculate statistics (on all data, not filtered/paginated)
            $statsQuery = Attendance::query();
            $statsQuery = $this->applyDataIsolation($statsQuery, 'attendances');

            $presentCount = (clone $statsQuery)->where('status', 'present')->count();
            $absentCount = (clone $statsQuery)->where('status', 'absent')->count();
            $lateCount = (clone $statsQuery)->where('status', 'late')->count();
            $totalCount = $statsQuery->count();
            $attendanceRate = $totalCount > 0 ? ($presentCount / $totalCount) * 100 : 0;

            $statistics = [
                'total' => $totalCount,
                'present' => $presentCount,
                'absent' => $absentCount,
                'late' => $lateCount,
                'attendance_rate' => round($attendanceRate, 2),
            ];

            return [
                'data' => AttendanceResource::collection($attendances),
                'meta' => [
                    'current_page' => $attendances->currentPage(),
                    'per_page' => $attendances->perPage(),
                    'total' => $attendances->total(),
                    'last_page' => $attendances->lastPage(),
                    'statistics' => $statistics,
                ],
            ];
        });

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('attendance.manage');

        return response()->json([
            'success' => true,
            'data' => $result['data'],
            'meta' => $result['meta'],
            'permissions' => $permissions,
        ]);
    }

    /**
     * Get attendance status options.
     * Returns all available attendance statuses with metadata.
     */
    public function statusOptions(): JsonResponse
    {
        $statuses = [
            [
                'value' => 'present',
                'label' => 'Có mặt',
                'label_en' => 'Present',
                'color' => 'success',
                'icon' => 'check-circle',
                'description' => 'Học sinh có mặt đầy đủ trong buổi học',
            ],
            [
                'value' => 'absent',
                'label' => 'Vắng',
                'label_en' => 'Absent',
                'color' => 'danger',
                'icon' => 'x-circle',
                'description' => 'Học sinh vắng mặt không có lý do',
            ],
            [
                'value' => 'late',
                'label' => 'Đi muộn',
                'label_en' => 'Late',
                'color' => 'warning',
                'icon' => 'clock',
                'description' => 'Học sinh đến muộn so với giờ quy định',
            ],
            [
                'value' => 'excused',
                'label' => 'Có phép',
                'label_en' => 'Excused',
                'color' => 'info',
                'icon' => 'document-check',
                'description' => 'Học sinh vắng mặt nhưng có phép',
            ],
        ];

        return $this->successResponse($statuses, 'Danh sách trạng thái điểm danh');
    }

    /**
     * Get attendance details.
     */
    public function show(Attendance $attendance): JsonResponse
    {
        // Defensive check: ensure attendance was properly resolved
        if (! $attendance || ! $attendance->exists || ! $attendance->id) {
            return $this->errorResponse('Không tìm thấy bản ghi điểm danh', null, 'NOT_FOUND', 404);
        }
        try {
            $cacheKey = CacheKeys::attendanceDetail($attendance->id);

            $attendance = Cache::remember($cacheKey, CacheTtl::DETAIL, function () use ($attendance) {
                return $attendance->load(['class', 'student', 'tutor']);
            });

            // Check if class exists (in case class was deleted)
            if (! $attendance->class) {
                return $this->errorResponse('Lớp học không tồn tại hoặc đã bị xóa', null, 'NOT_FOUND', 404);
            }

            $user = $this->getAuthUser();

            // Học viên: có thể xem attendance của chính họ (không cần capability)
            // Giáo viên: cần capability attendance.manage để xem attendance
            if ($user && ! $user->isStudent()) {
                if ($capabilityError = $this->requirePlanCapability('attendance.manage')) {
                    return $capabilityError;
                }
            }

            // Student: chỉ có thể xem điểm danh của chính họ
            if ($user && $user->isStudent()) {
                $student = $this->getCurrentStudent();
                if ($student && $attendance->student_id === $student->id) {
                    // Kiểm tra xem student có tham gia lớp học này không
                    $isEnrolled = $this->isStudentEnrolledInClass($student, $attendance->class_id);
                    if ($isEnrolled) {
                        // Học viên có thể xem attendance detail (không cần capability)
                        // Nhưng vẫn trả về permissions để frontend biết
                        $permissions = $this->buildViewManagePermissions('attendance.manage');
                        $response = $this->successResponse(new AttendanceResource($attendance));
                        $responseData = $response->getData(true);
                        $responseData['permissions'] = $permissions;

                        return response()->json($responseData, $response->getStatusCode());
                    }
                }

                return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }

            // Other roles: use canManageResource
            // Check access via class
            if (! $this->canManageResource($attendance->class)) {
                return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }

            // Build permissions: học viên có can_view, tutor có can_manage
            $permissions = $this->buildViewManagePermissions('attendance.manage');

            $response = $this->successResponse(new AttendanceResource($attendance));
            $responseData = $response->getData(true);
            $responseData['permissions'] = $permissions;

            return response()->json($responseData, $response->getStatusCode());
        } catch (\Exception $e) {
            return $this->errorResponse(
                'Đã xảy ra lỗi khi lấy thông tin điểm danh',
                config('app.debug') ? $e->getMessage() : null,
                'SERVER_ERROR',
                500
            );
        }
    }

    /**
     * Create attendance record (single or bulk).
     */
    public function store(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Check capability for attendance management
        if ($capabilityError = $this->requirePlanCapability('attendance.manage')) {
            return $capabilityError;
        }

        $validator = Validator::make($request->all(), $this->getValidationRules());

        if ($validator->fails()) {
            return $this->errorResponse(
                'Lỗi xác thực dữ liệu',
                $validator,
                'VALIDATION_ERROR',
                422
            );
        }

        // Decode HashIDs to integer IDs
        $dataToDecode = $request->only(['class_id', 'attendances']);
        $this->decodeHashId($dataToDecode, 'class_id', ClassRoom::class);
        $this->decodeNestedHashIds($dataToDecode, 'attendances', 'student_id', Student::class);
        $request->merge($dataToDecode);

        // Check if user can manage this class
        $class = ClassRoom::find($request->class_id);
        if (! $class || ! $this->canManageResource($class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }
        $pausedStudentIds = $class->students()
            ->wherePivot('is_paused', true)
            ->pluck('students.id')
            ->toArray();
        $createdAttendances = [];

        DB::beginTransaction();
        try {
            foreach ($request->attendances as $attendanceData) {
                if (in_array($attendanceData['student_id'], $pausedStudentIds, true)) {
                    DB::rollBack();

                    return $this->errorResponse(
                        'Không thể điểm danh cho học sinh đang tạm dừng',
                        ['student_id' => $attendanceData['student_id']],
                        'STUDENT_PAUSED',
                        422
                    );
                }

                // Check if attendance already exists for this student, class, and date
                $existing = Attendance::where('class_id', $request->class_id)
                    ->where('student_id', $attendanceData['student_id'])
                    ->whereDate('date', $request->date)
                    ->first();

                if ($existing) {
                    // Update existing attendance instead of creating duplicate
                    $existing->update([
                        'tutor_id' => $user->id,
                        'check_in_time' => $attendanceData['check_in_time'] ?? $existing->check_in_time,
                        'check_out_time' => $attendanceData['check_out_time'] ?? $existing->check_out_time,
                        'status' => $attendanceData['status'],
                        'note' => $attendanceData['note'] ?? $existing->note,
                    ]);
                    $createdAttendances[] = $existing->fresh();
                } else {
                    // Create new attendance
                    $attendance = Attendance::create([
                        'class_id' => $request->class_id,
                        'student_id' => $attendanceData['student_id'],
                        'tutor_id' => $user->id,
                        'date' => $request->date,
                        'check_in_time' => $attendanceData['check_in_time'] ?? null,
                        'check_out_time' => $attendanceData['check_out_time'] ?? null,
                        'status' => $attendanceData['status'],
                        'note' => $attendanceData['note'] ?? null,
                    ]);
                    $createdAttendances[] = $attendance;
                }
            }

            DB::commit();

            // Cache clearing handled by AttendanceObserver

            return $this->successResponse([
                'attendances' => AttendanceResource::collection($createdAttendances),
                'count' => count($createdAttendances),
            ], 'Tạo bản ghi điểm danh thành công', 201);

        } catch (\Exception $e) {
            DB::rollBack();

            return $this->errorResponse(
                'Không thể tạo bản ghi điểm danh',
                ['error' => $e->getMessage()],
                'CREATION_FAILED',
                500
            );
        }
    }

    /**
     * Update attendance record.
     */
    public function update(Request $request, Attendance $attendance): JsonResponse
    {
        // Defensive check: ensure attendance was properly resolved
        if (! $attendance || ! $attendance->exists || ! $attendance->id) {
            return $this->errorResponse('Không tìm thấy bản ghi điểm danh', null, 'NOT_FOUND', 404);
        }

        if (! $this->canManageResource($attendance->class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Check capability for attendance management
        if ($capabilityError = $this->requirePlanCapability('attendance.manage')) {
            return $capabilityError;
        }

        $validator = Validator::make($request->all(), $this->getValidationRules(true));

        if ($validator->fails()) {
            return $this->errorResponse(
                'Lỗi xác thực dữ liệu',
                $validator,
                'VALIDATION_ERROR',
                422
            );
        }

        $attendance->update($request->only([
            'status', 'check_in_time', 'check_out_time', 'note',
        ]));

        // Cache clearing handled by AttendanceObserver

        return $this->successResponse(
            new AttendanceResource($attendance->fresh()),
            'Cập nhật điểm danh thành công'
        );
    }

    /**
     * Delete attendance record.
     */
    public function destroy(Attendance $attendance): JsonResponse
    {
        // Defensive check: ensure attendance was properly resolved
        if (! $attendance || ! $attendance->exists || ! $attendance->id) {
            return $this->errorResponse('Không tìm thấy bản ghi điểm danh', null, 'NOT_FOUND', 404);
        }

        if (! $this->canManageResource($attendance->class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Check capability for attendance management
        if ($capabilityError = $this->requirePlanCapability('attendance.manage')) {
            return $capabilityError;
        }

        $studentId = $attendance->student_id;
        $classId = $attendance->class_id;
        $userId = auth('api')->id();
        $attendance->delete();

        // Cache clearing handled by AttendanceObserver

        return $this->successResponse(null, 'Xóa điểm danh thành công');
    }

    /**
     * Get attendance by class.
     */
    public function byClass(Request $request, ClassRoom $classRoom): JsonResponse
    {
        $class = $classRoom;
        $classId = $class->id;

        $user = $this->getAuthUser();

        // Student: chỉ có thể xem điểm danh của chính họ trong lớp họ tham gia
        if ($user->isStudent()) {
            $student = $this->getCurrentStudent();
            if ($student) {
                $isEnrolled = $this->isStudentEnrolledInClass($student, $classId);
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
        }

        $filters = [
            'status' => $request->get('status'),
            'student_id' => $request->get('student_id'),
            'date' => $request->get('date'),
            'date_from' => $request->get('date_from'),
            'date_to' => $request->get('date_to'),
            'search' => $request->get('search'),
            'sort' => $request->get('sort', 'date'),
            'order' => $request->get('order', 'desc'),
            'per_page' => $request->get('per_page', 15),
            'page' => $request->get('page', 1),
            'user_id' => $user->id,
        ];

        $cacheKey = CacheKeys::classAttendance((int) $classId, $filters);

        $result = Cache::remember($cacheKey, CacheTtl::NESTED_DATA, function () use ($class, $classId, $request, $user, $filters) {
            try {
                $query = Attendance::where('class_id', $classId)
                    ->with(['student', 'tutor']);

                // Student: chỉ xem điểm danh của chính họ
                $student = null;
                if ($user && $user->isStudent()) {
                    $student = $this->getCurrentStudent();
                    if ($student) {
                        $query->where('student_id', $student->id);
                    }
                }

                // Apply filters
                $query = $this->applyFilters($query, $request);

                // Pagination - explicitly pass page parameter
                // IMPORTANT: Use $filters['page'] not $request->get('page') to avoid reading from global request
                $perPage = (int) min($filters['per_page'] ?? 15, 100);
                $page = (int) ($filters['page'] ?? 1);
                $attendances = $query->paginate($perPage, ['*'], 'page', $page);

                // Statistics
                $totalCount = Attendance::where('class_id', $classId)->count();
                $statusCounts = Attendance::where('class_id', $classId)
                    ->selectRaw('status, COUNT(*) as count')
                    ->groupBy('status')
                    ->pluck('count', 'status')
                    ->toArray();

                return [
                    'class' => new ClassRoomResource($class),
                    'attendances' => AttendanceResource::collection($attendances),
                    'statistics' => [
                        'total_count' => $totalCount,
                        'status_counts' => $statusCounts,
                    ],
                    'meta' => [
                        'current_page' => $attendances->currentPage(),
                        'per_page' => $attendances->perPage(),
                        'total' => $attendances->total(),
                        'last_page' => $attendances->lastPage(),
                    ],
                ];
            } catch (\Exception $e) {
                throw $e;
            }
        });

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('attendance.manage');

        return response()->json([
            'success' => true,
            'data' => [
                'class' => $result['class'],
                'attendances' => $result['attendances'],
                'statistics' => $result['statistics'],
            ],
            'meta' => $result['meta'],
            'permissions' => $permissions,
        ]);
    }

    /**
     * Get attendance by student with filters, pagination, and search.
     */
    public function byStudent(Request $request, Student $student): JsonResponse
    {
        $studentId = $student->id;

        $user = $this->getAuthUser();

        // Student: chỉ có thể xem điểm danh của chính họ
        if ($user->isStudent()) {
            $studentProfile = $this->getCurrentStudent();
            if (! $studentProfile || $student->id !== $studentProfile->id) {
                return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }
        } elseif ($user->isTutor()) {
            // Check if user can view this student
            // Allow if tutor created the student OR student is in tutor's classes,
            // OR the caller is an org owner/manager and the student belongs to their org.
            $hasAccess = ($student->created_by === $user->id) || $student->classes()
                ->where('tutor_id', $user->id)
                ->exists() || $this->orgOwnsStudent($student);

            if (! $hasAccess) {
                return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }

            // Giáo viên cần capability students.manage để xem attendance của học viên
            if ($capabilityError = $this->requirePlanCapability('students.manage')) {
                return $capabilityError;
            }
        } else {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        $filters = [
            'status' => $request->get('status'),
            'class_id' => $request->get('class_id'),
            'date' => $request->get('date'),
            'date_from' => $request->get('date_from'),
            'date_to' => $request->get('date_to'),
            'search' => $request->get('search'),
            'sort' => $request->get('sort', 'date'),
            'order' => $request->get('order', 'desc'),
            'per_page' => $request->get('per_page', 15),
            'page' => $request->get('page', 1),
            'user_id' => $user->id,
        ];

        $cacheKey = CacheKeys::studentAttendance((int) $studentId, $filters);
        $controller = $this; // Lưu reference để dùng trong closure

        // Shared-student safety: a tutor may only see attendance from classes they own.
        // Org owner/manager instead see every attendance of the student within their org (design §4.3).
        $scopeTutorId = ($user->isTutor() && ! $user->isOrgViewerAll()) ? $user->id : null;
        $scopeOrgId = $user->isOrgViewerAll() ? $user->currentOrganization()?->id : null;

        $result = Cache::remember($cacheKey, CacheTtl::NESTED_DATA, function () use ($student, $studentId, $request, $filters, $controller, $scopeTutorId, $scopeOrgId) {
            try {
                $query = Attendance::where('student_id', $studentId)
                    ->with(['class', 'tutor']);

                if ($scopeTutorId) {
                    $query->whereHas('class', fn ($q) => $q->where('tutor_id', $scopeTutorId));
                } elseif ($scopeOrgId) {
                    $query->whereHas('class', fn ($q) => $q->where('organization_id', $scopeOrgId));
                }

                // Filters
                if ($request->has('status')) {
                    $query->where('status', $request->status);
                }

                if ($request->has('class_id')) {
                    $query->where('class_id', $request->class_id);
                }

                if ($request->has('date')) {
                    $query->whereDate('date', $request->date);
                }

                if ($request->has('date_from')) {
                    $query->whereDate('date', '>=', $request->date_from);
                }

                if ($request->has('date_to')) {
                    $query->whereDate('date', '<=', $request->date_to);
                }

                // Search by class name or tutor name
                if ($request->has('search')) {
                    $query->where(function ($q) use ($request) {
                        $q->whereHas('class', function ($q) use ($request) {
                            $q->where('name', 'like', "%{$request->search}%")
                                ->orWhere('subject', 'like', "%{$request->search}%");
                        })
                            ->orWhereHas('tutor', function ($q) use ($request) {
                                $q->where('name', 'like', "%{$request->search}%")
                                    ->orWhere('email', 'like', "%{$request->search}%");
                            });
                    });
                }

                // Sorting
                $sortable = ['date', 'status', 'check_in_time', 'check_out_time', 'created_at', 'updated_at'];
                $sortBy = $request->get('sort', 'date');
                if (! in_array($sortBy, $sortable, true)) {
                    $sortBy = 'date';
                }
                $sortOrder = strtolower($request->get('order', 'desc')) === 'asc' ? 'asc' : 'desc';
                $query->orderBy($sortBy, $sortOrder);

                // Pagination - explicitly pass page parameter
                // IMPORTANT: Use $filters['page'] not $request->get('page') to avoid reading from global request
                $perPage = (int) min($filters['per_page'] ?? 15, 100);
                $page = (int) ($filters['page'] ?? 1);
                $attendances = $query->paginate($perPage, ['*'], 'page', $page);

                // Calculate statistics (before filters for accurate counts), scoped like the list.
                $statsBase = fn () => Attendance::where('student_id', $studentId)
                    ->when($scopeTutorId, fn ($q) => $q->whereHas('class', fn ($c) => $c->where('tutor_id', $scopeTutorId)))
                    ->when($scopeOrgId, fn ($q) => $q->whereHas('class', fn ($c) => $c->where('organization_id', $scopeOrgId)));
                $totalCount = $statsBase()->count();
                $statusCounts = $statsBase()
                    ->selectRaw('status, COUNT(*) as count')
                    ->groupBy('status')
                    ->pluck('count', 'status')
                    ->toArray();

                // Calculate attendance rate
                $presentCount = $statusCounts['present'] ?? 0;
                $attendanceRate = $totalCount > 0
                    ? ($presentCount / $totalCount) * 100
                    : 0;

                return [
                    'attendances' => AttendanceResource::collection($attendances),
                    'student_id' => $student->id,
                    'student_name' => $student->name,
                    'statistics' => [
                        'total_count' => $totalCount,
                        'status_counts' => $statusCounts,
                        'present_count' => $presentCount,
                        'absent_count' => $statusCounts['absent'] ?? 0,
                        'late_count' => $statusCounts['late'] ?? 0,
                        'excused_count' => $statusCounts['excused'] ?? 0,
                        'attendance_rate' => $attendanceRate,
                        'attendance_rate_formatted' => $controller->formatPercentage($attendanceRate),
                    ],
                    'meta' => [
                        'current_page' => $attendances->currentPage(),
                        'per_page' => $attendances->perPage(),
                        'total' => $attendances->total(),
                        'last_page' => $attendances->lastPage(),
                    ],
                ];
            } catch (\Exception $e) {
                throw $e;
            }
        });

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('attendance.manage');

        return response()->json([
            'success' => true,
            'data' => [
                'attendances' => $result['attendances'],
                'student_id' => $result['student_id'],
                'student_name' => $result['student_name'],
                'statistics' => $result['statistics'],
            ],
            'meta' => $result['meta'],
            'permissions' => $permissions,
        ]);
    }

    /**
     * Bulk update attendance.
     */
    public function bulkUpdate(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Decode update IDs
        // Decode update IDs
        $this->decodeNestedHashIds($request, 'updates', 'id', Attendance::class);

        // Check capability for attendance management
        if ($capabilityError = $this->requirePlanCapability('attendance.manage')) {
            return $capabilityError;
        }

        $validator = Validator::make($request->all(), $this->getValidationRules(false, true));

        if ($validator->fails()) {
            return $this->errorResponse(
                'Lỗi xác thực dữ liệu',
                $validator,
                'VALIDATION_ERROR',
                422
            );
        }

        DB::beginTransaction();
        try {
            $updated = 0;
            $affectedStudentIds = [];
            $affectedClassIds = [];

            foreach ($request->updates as $updateData) {
                $attendance = Attendance::find($updateData['id']);

                if ($attendance && $this->canManageResource($attendance->class)) {
                    $attendance->update([
                        'status' => $updateData['status'] ?? $attendance->status,
                        'check_in_time' => $updateData['check_in_time'] ?? $attendance->check_in_time,
                        'check_out_time' => $updateData['check_out_time'] ?? $attendance->check_out_time,
                        'note' => $updateData['note'] ?? $attendance->note,
                    ]);
                    $updated++;

                    // Track affected IDs for cache invalidation
                    $affectedStudentIds[] = $attendance->student_id;
                    $affectedClassIds[] = $attendance->class_id;
                }
            }

            DB::commit();

            // Clear cache — bump the global attendance version, then per affected class the
            // attendance-by-class and roster (students_class) versions. The previous code passed the
            // USER id into the $classId slot and used Cache::forget on versioned keys (a no-op), so
            // by-class attendance lists stayed stale after a bulk update.
            CacheHelper::forgetAttendance();
            foreach (array_unique($affectedClassIds) as $classId) {
                CacheHelper::forgetAttendance($classId);
                CacheHelper::forgetStudents($classId);
            }

            // Clear individual attendance records and student attendance cache
            $affectedStudentIds = [];
            foreach ($request->updates as $updateData) {
                Cache::forget(CacheKeys::attendanceDetail($updateData['id']));

                // Collect student IDs for cache clearing
                $attendance = Attendance::find($updateData['id']);
                if ($attendance && $attendance->student_id) {
                    $affectedStudentIds[] = $attendance->student_id;
                }
            }

            // Clear student attendance cache for affected students
            foreach (array_unique($affectedStudentIds) as $studentId) {
                $studentIdStr = (string) $studentId;
                CacheVersion::increment('attendance_student', $studentIdStr);
            }

            return $this->successResponse([
                'updated_count' => $updated,
            ], 'Cập nhật bản ghi điểm danh thành công');

        } catch (\Exception $e) {
            DB::rollBack();

            return $this->errorResponse(
                'Không thể cập nhật bản ghi điểm danh',
                ['error' => $e->getMessage()],
                'UPDATE_FAILED',
                500
            );
        }
    }

    /**
     * Import attendance from CSV/XLSX file.
     *
     * POST /api/v1/attendance/import
     *
     * Body:
     * - file: CSV/XLSX file (required)
     * - override_existing: boolean (optional, default: false)
     */
    public function import(ImportAttendanceRequest $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Student cannot import
        if ($user->isStudent()) {
            return $this->errorResponse('Không có quyền import điểm danh', null, 'UNAUTHORIZED', 403);
        }

        // Check capability for data import
        if ($capabilityError = $this->requirePlanCapability('data.import')) {
            return $capabilityError;
        }

        // Also check attendance.manage to ensure user can manage attendance
        if ($capabilityError = $this->requirePlanCapability('attendance.manage')) {
            return $capabilityError;
        }

        $file = $request->file('file');
        $overrideExisting = $request->boolean('override_existing', false);

        $job = DataJobService::start('import', 'attendance', $user, [
            'file_name' => $file?->getClientOriginalName(),
            'format' => $file?->getClientOriginalExtension(),
            'meta' => [
                'path' => $request->path(),
                'override_existing' => $overrideExisting,
            ],
        ]);

        // Read file
        $fileData = ImportService::readFile($file);

        if (! empty($fileData['errors'])) {
            DataJobService::finishFailed($job, 'FILE_READ_ERROR', ['file_errors' => $fileData['errors']]);

            return $this->errorResponse(
                'Lỗi khi đọc file',
                ['file_errors' => $fileData['errors']],
                'FILE_READ_ERROR',
                422
            );
        }

        if (empty($fileData['rows'])) {
            DataJobService::finishFailed($job, 'EMPTY_FILE');

            return $this->errorResponse('File không có dữ liệu', null, 'EMPTY_FILE', 422);
        }

        // Import attendance
        $result = ImportAttendanceAction::execute(
            $fileData['rows'],
            $user->id,
            $overrideExisting
        );

        // Build response
        $response = [
            'success' => true,
            'message' => 'Import hoàn tất',
            'data' => [
                'total_rows' => count($fileData['rows']),
                'success' => $result['success'],
                'failed' => $result['failed'],
                'skipped' => $result['skipped'],
                'errors' => $result['errors'],
            ],
        ];

        $metrics = [
            'total_rows' => count($fileData['rows']),
            'success_count' => $result['success'],
            'failed_count' => $result['failed'],
            'skipped_count' => $result['skipped'],
        ];

        if ($result['failed'] > 0 || $result['skipped'] > 0) {
            DataJobService::finishPartial($job, $metrics, ['errors' => $result['errors']]);

            return response()->json($response, 207); // 207 Multi-Status
        }

        DataJobService::finishSuccess($job, $metrics);

        return $this->successResponse($response['data'], 'Import thành công');
    }
}
