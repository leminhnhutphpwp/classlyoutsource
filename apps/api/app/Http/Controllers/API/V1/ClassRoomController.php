<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Resources\ClassRoomResource;
use App\Http\Resources\StudentResource;
use App\Models\ClassRoom;
use App\Models\Enrollment;
use App\Models\Student;
use App\Models\Subject;
use App\Rules\ExistsHashId;
use App\Services\BotShield;
use App\Services\EnrollmentService;
use App\Support\CacheHelper;
use App\Support\CacheKeys;
use App\Support\CacheTtl;
use App\Traits\DecodesHashIds;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Validator;

class ClassRoomController extends BaseController
{
    use DecodesHashIds;

    /**
     * Get validation rules for class.
     */
    private function getValidationRules(bool $isUpdate = false, $user = null, $classId = null): array
    {
        $rules = [
            'name' => ($isUpdate ? 'sometimes|' : '').'required|string|max:255',
            'class_code' => 'nullable|string|max:50'.($isUpdate && $classId ? '|unique:classes,class_code,'.$classId.',id,deleted_at,NULL' : '|unique:classes,class_code,NULL,id,deleted_at,NULL'),
            'subject' => ($isUpdate ? 'sometimes|' : '').'required|string|max:255',
            'subject_id' => ['nullable', new ExistsHashId(Subject::class)],
            'start_date' => ($isUpdate ? 'sometimes|' : '').'required|date',
            'end_date' => 'nullable|date|after:start_date',
            'tuition_fee' => 'nullable|numeric|min:0',
            'max_students' => 'nullable|integer|min:1',
            'description' => 'nullable|string',
            'status' => 'nullable|in:active,inactive,completed,cancelled',
        ];

        // Tutor-only system: tutor_id is automatically set to current user

        return $rules;
    }

    /**
     * Apply filters (search, sort, status) to query.
     */
    private function applyFilters($query, Request $request)
    {
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                    ->orWhere('subject', 'like', "%{$request->search}%");
            });
        }

        // Sort
        $sortable = ['created_at', 'updated_at', 'name', 'subject', 'start_date', 'end_date', 'tuition_fee', 'max_students', 'status'];
        $sortBy = $request->get('sort', 'created_at');
        if (! in_array($sortBy, $sortable, true)) {
            $sortBy = 'created_at';
        }
        $sortOrder = strtolower($request->get('order', 'desc')) === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sortBy, $sortOrder);

        return $query;
    }

    /**
     * List all classes (with data isolation).
     */
    public function index(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();
        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Học viên: có thể xem classes của chính họ (không cần capability)
        // Giáo viên: cần capability classes.manage để xem classes
        if (! $user->isStudent()) {
            if ($capabilityError = $this->requirePlanCapability('classes.manage')) {
                return $capabilityError;
            }
        }

        // 1. Build Cache Key Params
        $filters = $request->all();
        // Ensure isolation context is part of the cache key (handled by user ID)

        $cacheKey = CacheKeys::classList($user->id, $filters);

        // 2. Cache Result
        $result = Cache::remember($cacheKey, CacheTtl::LIST, function () use ($request) {
            return $this->buildClassListResponse($request);
        });

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewAndManagePermissions('classes.manage', true);

        return response()->json([
            'success' => true,
            'data' => $result['data'],
            'meta' => $result['meta'],
            'permissions' => $permissions,
        ]);
    }

    /**
     * Get class details.
     */
    public function show(ClassRoom $classRoom): JsonResponse
    {
        // Defensive check: ensure class room was properly resolved
        if (! $classRoom || ! $classRoom->exists || ! $classRoom->id) {
            return $this->errorResponse('Không tìm thấy lớp học', null, 'NOT_FOUND', 404);
        }

        $class = $classRoom->load(['tutor', 'subject']);

        $user = $this->getAuthUser();

        // Student: chỉ cần kiểm tra xem họ có tham gia lớp học này không
        if ($user && $user->isStudent()) {
            $student = $this->getCurrentStudent();
            if ($student) {
                $isEnrolled = $this->isStudentEnrolledInClass($student, $class->id);
                if ($isEnrolled) {
                    // Học viên có thể xem class detail (không cần capability)
                    // Nhưng vẫn trả về permissions để frontend biết
                    $permissions = $this->buildViewManagePermissions('classes.manage');
                    $response = $this->successResponse(new ClassRoomResource($class));
                    $responseData = $response->getData(true);
                    $responseData['permissions'] = $permissions;

                    return response()->json($responseData, $response->getStatusCode());
                }
            }

            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Other roles: cần capability classes.manage để xem
        if (! $this->canManageResource($class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Giáo viên cần capability classes.manage để xem classes
        if ($capabilityError = $this->requirePlanCapability('classes.manage')) {
            return $capabilityError;
        }

        // Check capabilities để frontend biết có nên hiển thị nút quản lý hay không
        $permissions = $this->buildViewManagePermissions('classes.manage');

        $response = $this->successResponse(new ClassRoomResource($class));
        $responseData = $response->getData(true);
        $responseData['permissions'] = $permissions;

        return response()->json($responseData, $response->getStatusCode());
    }

    /**
     * Create a new class.
     */
    public function store(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Check capability for classes management
        if ($capabilityError = $this->requirePlanCapability('classes.manage')) {
            return $capabilityError;
        }

        // (no plan-based limits in single-tenant mode)
        if ($limitError = $this->checkSubscriptionLimits('class')) {
            return $limitError;
        }

        if ($botBlock = BotShield::check($user, 'classes', ['action' => 'create'])) {
            return $this->errorResponse(
                $botBlock['message'],
                $botBlock['details'],
                $botBlock['code'],
                $botBlock['status']
            );
        }

        $validator = Validator::make($request->all(), $this->getValidationRules(false, $user));

        if ($validator->fails()) {
            return $this->errorResponse(
                'Dữ liệu không hợp lệ',
                $validator,
                'VALIDATION_ERROR',
                422
            );
        }

        $classData = $request->only([
            'name', 'class_code', 'subject', 'subject_id', 'start_date', 'end_date',
            'tuition_fee', 'max_students', 'description', 'status',
        ]);

        // Set tutor - tutor automatically assigns to themselves
        if ($user->isTutor()) {
            $classData['tutor_id'] = $user->id;
        }

        // Org context is derived from the caller, NEVER from request input (design §5e/R11):
        // a class created by an org member auto-belongs to that org; a solo tutor's class stays NULL.
        $classData['organization_id'] = $user->currentOrganization()?->id;

        // Decode subject_id
        if (! empty($classData['subject_id'])) {
            $this->decodeHashId($request, 'subject_id', Subject::class);
            $classData['subject_id'] = $request->subject_id;
        }

        $classData['status'] = $classData['status'] ?? 'active';

        $class = ClassRoom::create($classData);

        // Cache clearing handled by ClassRoomObserver

        return $this->successResponse(
            new ClassRoomResource($class->load(['tutor'])),
            'Tạo lớp học thành công',
            201
        );
    }

    /**
     * Update class.
     */
    public function update(Request $request, ClassRoom $classRoom): JsonResponse
    {
        // Defensive check: ensure class room was properly resolved
        if (! $classRoom || ! $classRoom->exists || ! $classRoom->id) {
            return $this->errorResponse('Không tìm thấy lớp học', null, 'NOT_FOUND', 404);
        }

        $class = $classRoom;

        if (! $this->canManageResource($class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Check capability for classes management
        if ($capabilityError = $this->requirePlanCapability('classes.manage')) {
            return $capabilityError;
        }

        // Validation rules based on user type
        $rules = $this->getValidationRules(true, $user, $class->id);

        // Tutor can only update their own classes (data isolation)
        // tutor_id cannot be changed

        $validator = Validator::make($request->all(), $rules);

        if ($validator->fails()) {
            return $this->errorResponse(
                'Dữ liệu không hợp lệ',
                $validator,
                'VALIDATION_ERROR',
                422
            );
        }

        $updateData = $request->only([
            'name', 'class_code', 'subject', 'subject_id', 'start_date', 'end_date',
            'tuition_fee', 'max_students', 'description', 'status',
        ]);

        // Tutor cannot change tutor_id - keep existing
        if ($user->isTutor()) {
            unset($updateData['tutor_id']);
        }

        // Decode subject_id
        if (! empty($updateData['subject_id'])) {
            $this->decodeHashId($request, 'subject_id', Subject::class);
            $updateData['subject_id'] = $request->subject_id;
        }

        $class->update($updateData);

        // Cache clearing handled by ClassRoomObserver

        return $this->successResponse(
            new ClassRoomResource($class->fresh()),
            'Cập nhật lớp học thành công'
        );
    }

    /**
     * Delete class.
     */
    public function destroy(ClassRoom $classRoom): JsonResponse
    {
        // Defensive check: ensure class room was properly resolved
        if (! $classRoom || ! $classRoom->exists || ! $classRoom->id) {
            return $this->errorResponse('Không tìm thấy lớp học', null, 'NOT_FOUND', 404);
        }

        $class = $classRoom;

        if (! $this->canManageResource($class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Check capability for classes management
        if ($capabilityError = $this->requirePlanCapability('classes.manage')) {
            return $capabilityError;
        }

        $userId = auth('api')->id();
        $class->delete();

        // Cache clearing handled by ClassRoomObserver

        return $this->successResponse(null, 'Xóa lớp học thành công');
    }

    /**
     * Get enrolled students with filters, pagination, and search.
     */
    public function students(Request $request, ClassRoom $classRoom): JsonResponse
    {
        $class = $classRoom;

        if (! $class) {
            return $this->errorResponse('Không tìm thấy lớp học', null, 'NOT_FOUND', 404);
        }

        // Roster chứa PII của TOÀN BỘ học viên trong lớp (điện thoại, email, địa chỉ, phụ huynh,
        // ghi chú riêng của giáo viên) → nhân sự-only. canManageResource() KHÔNG đủ: nhánh student
        // của nó cho mọi học viên đã ghi danh đi qua, nên trước đây một học viên gọi endpoint này
        // đọc được hồ sơ đầy đủ của mọi bạn cùng lớp.
        if ($guardError = $this->guardClassStaffAccess($class)) {
            return $guardError;
        }

        // Giáo viên cần capability classes.manage để xem danh sách học viên trong lớp
        if ($capabilityError = $this->requirePlanCapability('classes.manage')) {
            return $capabilityError;
        }

        // Build filters (no caching to avoid stale enrollment states)
        $filters = [
            'enrollment_status' => $request->get('enrollment_status'),
            'status' => $request->get('status'),
            'search' => $request->get('search'),
            'is_paused' => $request->get('is_paused'),
            'sort' => $request->get('sort', 'class_student.enrolled_at'),
            'order' => $request->get('order', 'desc'),
            'per_page' => $request->get('per_page', 15),
            'page' => $request->get('page', 1),
        ];
        $result = $this->buildClassStudentsResponse($class, $request, $filters);

        // Check capabilities để frontend biết có nên hiển thị nút quản lý hay không
        $permissions = $this->buildMultiplePermissions([
            'can_manage_students' => 'students.manage',
            'can_manage_class' => 'classes.manage',
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'students' => $result['students'],
                'class_id' => $result['class_id'],
                'class_name' => $result['class_name'],
                'statistics' => $result['statistics'],
            ],
            'meta' => $result['meta'],
            'permissions' => $permissions,
        ]);
    }

    /**
     * Enroll student in class.
     */
    public function enrollStudent(Request $request, ClassRoom $classRoom): JsonResponse
    {
        $class = $classRoom;

        if (! $class) {
            return $this->errorResponse('Không tìm thấy lớp học', null, 'NOT_FOUND', 404);
        }

        if (! $this->canManageResource($class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Check capability for students management
        if ($capabilityError = $this->requirePlanCapability('students.manage')) {
            return $capabilityError;
        }

        $validator = Validator::make($request->all(), [
            'student_id' => ['required', new ExistsHashId(Student::class)],
            'notes' => 'nullable|string',
            'status' => 'nullable|in:active,inactive,suspended,completed',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse(
                'Dữ liệu không hợp lệ',
                $validator,
                'VALIDATION_ERROR',
                422
            );
        }

        $this->decodeHashId($request, 'student_id', Student::class);
        $student = Student::find($request->student_id);
        if (! $student) {
            return $this->errorResponse('Không tìm thấy học sinh', null, 'NOT_FOUND', 404);
        }

        // Access check handled by canManageResource

        // (no plan-based limits in single-tenant mode)
        if ($limitError = $this->checkSubscriptionLimits('student')) {
            return $limitError;
        }

        // Use EnrollmentService to handle enrollment (will check max per class)
        try {
            EnrollmentService::enrollStudent(
                $student,
                $class,
                $request->notes ?? null
            );

            // Update status if provided
            if ($request->has('status')) {
                $student->classes()->updateExistingPivot($class->id, [
                    'status' => $request->status,
                ]);
            }

            // Clear cache
            $this->clearEnrollmentCaches($class->id, $student->id);

            return $this->successResponse(
                $this->buildEnrollmentPayload($student->fresh(), $class->fresh()),
                'Đăng ký học sinh thành công',
                201
            );
        } catch (\Exception $e) {
            return $this->errorResponse(
                $e->getMessage(),
                null,
                'ENROLLMENT_FAILED',
                422
            );
        }
    }

    /**
     * Unenroll student from class.
     */
    public function unenrollStudent(ClassRoom $classRoom, Student $student): JsonResponse
    {
        $class = $classRoom;
        $studentId = $student->id;

        if (! $class) {
            return $this->errorResponse('Không tìm thấy lớp học', null, 'NOT_FOUND', 404);
        }

        if (! $this->canManageResource($class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Check capability for students management
        if ($capabilityError = $this->requirePlanCapability('students.manage')) {
            return $capabilityError;
        }

        // Student already loaded via binding
        // $student = \App\Models\Student::find($studentId);

        // Check if student is enrolled
        if (! $class->students()->where('student_id', $studentId)->exists()) {
            return $this->errorResponse(
                'Học sinh chưa được đăng ký vào lớp học này',
                null,
                'NOT_ENROLLED',
                422
            );
        }

        // Use EnrollmentService to unenroll
        try {
            EnrollmentService::unenrollStudent($student, $class);

            // Clear cache
            $this->clearEnrollmentCaches($class->id, $student->id);

            return $this->successResponse([
                'student_id' => Student::encodeId($student->id),
                'student_name' => $student->name,
                'class_id' => ClassRoom::encodeId($class->id),
                'class_name' => $class->name,
                'class' => [
                    'current_students' => $class->getActiveStudentCount(),
                    'max_students' => $class->max_students,
                    'available_slots' => $class->getAvailableSlots(),
                ],
            ], 'Hủy đăng ký học sinh thành công');
        } catch (\Exception $e) {
            return $this->errorResponse(
                $e->getMessage(),
                null,
                'UNENROLLMENT_FAILED',
                500
            );
        }
    }

    /**
     * Pause a student's enrollment in a class.
     */
    public function pauseStudent(Request $request, ClassRoom $classRoom, Student $student): JsonResponse
    {
        if ($error = $this->requirePlanCapability('student_pause.use')) {
            return $error;
        }

        $class = $classRoom;

        if (! $this->canManageResource($class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        $enrollment = $student->classes()->where('classes.id', $class->id)->first();
        if (! $enrollment) {
            return $this->errorResponse('Học sinh chưa được đăng ký vào lớp học này', null, 'NOT_ENROLLED', 422);
        }

        if ($enrollment->pivot->is_paused) {
            return $this->errorResponse('Học sinh đã ở trạng thái tạm dừng', null, 'ALREADY_PAUSED', 422);
        }

        $validator = Validator::make($request->all(), [
            'reason' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        $student->classes()->updateExistingPivot($class->id, [
            'is_paused' => true,
            'paused_at' => now(),
            'resumed_at' => null,
            'pause_reason' => $request->get('reason'),
        ]);

        $this->clearEnrollmentCaches($class->id, $student->id);

        return $this->successResponse(
            $this->buildEnrollmentPayload($student->fresh(), $class->fresh()),
            'Đã tạm dừng học sinh trong lớp'
        );
    }

    /**
     * Resume a paused student's enrollment.
     */
    public function resumeStudent(ClassRoom $classRoom, Student $student): JsonResponse
    {
        if ($error = $this->requirePlanCapability('student_pause.use')) {
            return $error;
        }

        $class = $classRoom;

        if (! $class) {
            return $this->errorResponse('Không tìm thấy lớp học', null, 'NOT_FOUND', 404);
        }

        if (! $this->canManageResource($class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        $enrollment = $student->classes()->where('classes.id', $class->id)->first();
        if (! $enrollment) {
            return $this->errorResponse('Học sinh chưa được đăng ký vào lớp học này', null, 'NOT_ENROLLED', 422);
        }

        if (! $enrollment->pivot->is_paused) {
            return $this->errorResponse('Học sinh đang ở trạng thái hoạt động', null, 'NOT_PAUSED', 422);
        }

        $student->classes()->updateExistingPivot($class->id, [
            'is_paused' => false,
            'paused_at' => null,
            'resumed_at' => now(),
            'pause_reason' => null,
        ]);

        $this->clearEnrollmentCaches($class->id, $student->id);

        return $this->successResponse(
            $this->buildEnrollmentPayload($student->fresh(), $class->fresh()),
            'Đã kích hoạt lại học sinh'
        );
    }

    /**
     * Clear caches for class/student enrollment changes.
     */
    private function clearEnrollmentCaches(int $classId, int $studentId): void
    {
        // Roster + nested lists are versioned keys — bump versions via CacheHelper.
        // (Cache::forget on a versioned/filter-hashed key is a no-op, which left rosters stale.)
        CacheHelper::forgetStudents($classId, $studentId);
        CacheHelper::forgetAssignments($classId, $studentId);
        CacheHelper::forgetAttendance($classId, $studentId);
        CacheHelper::forgetGrades($classId, $studentId);

        // classDetail is a plain (un-versioned) key, so an explicit forget is correct here.
        Cache::forget(CacheKeys::classDetail($classId));
    }

    /**
     * Build class list payload for the index endpoint.
     */
    private function buildClassListResponse(Request $request): array
    {
        $query = ClassRoom::query()
            ->with(['tutor', 'subject'])
            ->withCount([
                'students as active_students_count' => function ($query) {
                    $query->where('class_student.status', 'active');
                },
            ]);

        $query = $this->applyDataIsolation($query, 'classes');
        $query = $this->applyFilters($query, $request);

        $perPage = min((int) $request->get('per_page', 15), 100);
        $page = (int) $request->get('page', 1);
        $classes = $query->paginate($perPage, ['*'], 'page', $page);

        // Calculate statistics (on all data, not filtered/paginated)
        $statsQuery = ClassRoom::query();
        $statsQuery = $this->applyDataIsolation($statsQuery, 'classes');

        $statistics = [
            'total' => $statsQuery->count(),
            'active' => (clone $statsQuery)->where('status', 'active')->count(),
            'inactive' => (clone $statsQuery)->where('status', 'inactive')->count(),
            'paused' => (clone $statsQuery)->where('status', 'paused')->count(),
            'total_students' => Enrollment::whereIn('class_id', (clone $statsQuery)->pluck('id'))
                ->where('status', 'active')
                ->count(),
        ];

        return [
            'data' => ClassRoomResource::collection($classes),
            'meta' => [
                'current_page' => $classes->currentPage(),
                'per_page' => $classes->perPage(),
                'total' => $classes->total(),
                'last_page' => $classes->lastPage(),
                'statistics' => $statistics,
            ],
        ];
    }

    /**
     * Build payload for the class students endpoint.
     */
    private function buildClassStudentsResponse(ClassRoom $class, Request $request, array $filters): array
    {
        $query = $class->students()->with([
            'classes',
            'user.activeLocks' => function ($query) {
                $query->orderBy('created_at', 'desc');
            },
        ]);

        if ($request->has('enrollment_status')) {
            $query->wherePivot('status', $request->enrollment_status);
        }

        if ($request->has('status')) {
            $query->where('students.status', $request->status);
        }

        if ($request->filled('is_paused')) {
            $query->wherePivot('is_paused', filter_var($request->get('is_paused'), FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->has('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('students.name', 'like', "%{$request->search}%")
                    ->orWhere('students.email', 'like', "%{$request->search}%")
                    ->orWhere('students.phone', 'like', "%{$request->search}%");
            });
        }

        $pivotSortable = ['class_student.enrolled_at', 'class_student.status', 'class_student.is_paused', 'class_student.paused_at'];
        $studentSortable = ['name', 'email', 'phone', 'status', 'birth_date', 'created_at', 'updated_at'];
        $sortBy = $request->get('sort', 'class_student.enrolled_at');
        $sortOrder = strtolower($request->get('order', 'desc')) === 'asc' ? 'asc' : 'desc';

        if (str_starts_with($sortBy, 'pivot.') || str_starts_with($sortBy, 'class_student.')) {
            $sortColumn = str_replace('pivot.', 'class_student.', $sortBy);
            if (! in_array($sortColumn, $pivotSortable, true)) {
                $sortColumn = 'class_student.enrolled_at';
            }
            $query->orderBy($sortColumn, $sortOrder);
        } else {
            if (! in_array($sortBy, $studentSortable, true)) {
                $sortBy = 'name';
            }
            $query->orderBy('students.'.$sortBy, $sortOrder);
        }

        $perPage = (int) min($filters['per_page'] ?? 15, 100);
        $page = (int) ($filters['page'] ?? 1);
        $students = $query->paginate($perPage, ['*'], 'page', $page);

        $totalCount = $class->students()->count();
        $activeCount = $class->getActiveStudentCount();
        $pausedCount = $class->students()->wherePivot('is_paused', true)->count();
        $maxStudents = $class->max_students ?? null;
        $availableSlots = $maxStudents !== null ? max(0, $maxStudents - $activeCount) : null;

        return [
            'students' => StudentResource::collection($students),
            'class_id' => ClassRoom::encodeId($class->id),
            'class_name' => $class->name,
            'statistics' => [
                'total_count' => $totalCount,
                'active_count' => $activeCount,
                'paused_count' => $pausedCount,
                'max_students' => $maxStudents,
                'available_slots' => $availableSlots,
            ],
            'meta' => [
                'current_page' => $students->currentPage(),
                'per_page' => $students->perPage(),
                'total' => $students->total(),
                'last_page' => $students->lastPage(),
            ],
        ];
    }

    /**
     * Build enrollment payload for responses.
     */
    private function buildEnrollmentPayload(Student $student, ClassRoom $class): array
    {
        $enrollment = $student->classes()->where('classes.id', $class->id)->first();
        $enrolledAt = $enrollment?->pivot?->enrolled_at;

        if ($enrolledAt && method_exists($enrolledAt, 'toDateString')) {
            $enrolledAt = $enrolledAt->toDateString();
        }

        return [
            'enrollment' => [
                'student_id' => Student::encodeId($student->id),
                'student_name' => $student->name,
                'class_id' => ClassRoom::encodeId($class->id),
                'class_name' => $class->name,
                'enrolled_at' => $enrolledAt,
                'status' => $enrollment?->pivot?->status,
                'notes' => $enrollment?->pivot?->notes,
                'is_paused' => (bool) ($enrollment?->pivot?->is_paused ?? false),
                'paused_at' => $enrollment?->pivot?->paused_at,
                'pause_reason' => $enrollment?->pivot?->pause_reason,
            ],
            'class' => [
                'current_students' => $class->getActiveStudentCount(),
                'max_students' => $class->max_students,
                'available_slots' => $class->getAvailableSlots(),
                'is_full' => $class->isFull(),
            ],
        ];
    }
}
