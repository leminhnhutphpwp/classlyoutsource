<?php

namespace App\Http\Controllers\API\V1;

use App\Actions\ImportStudentAction;
use App\Http\Requests\ImportStudentsRequest;
use App\Http\Requests\StudentResetPasswordRequest;
use App\Http\Requests\StudentStoreRequest;
use App\Http\Resources\AssignmentResource;
use App\Http\Resources\ClassRoomResource;
use App\Http\Resources\StudentResource;
use App\Models\Assignment;
use App\Models\AssignmentType;
use App\Models\Attendance;
use App\Models\ClassRoom;
use App\Models\Enrollment;
use App\Models\Grade;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Submission;
use App\Models\User;
use App\Models\UserLock;
use App\Services\BotShield;
use App\Services\DataJobService;
use App\Services\ImportService;
use App\Support\CacheKeys;
use App\Support\CacheTtl;
use App\Traits\DecodesHashIds;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Spatie\Permission\PermissionRegistrar;

class StudentController extends BaseController
{
    use DecodesHashIds;

    /**
     * Get validation rules for student.
     */
    private function getValidationRules(bool $isUpdate = false, ?int $studentId = null): array
    {
        $rules = [
            'name' => ($isUpdate ? 'sometimes|' : '').'required|string|max:255',
            'student_code' => 'nullable|string|max:50'.($isUpdate && $studentId ? '|unique:students,student_code,'.$studentId.',id,deleted_at,NULL' : '|unique:students,student_code,NULL,id,deleted_at,NULL'),
            'parent_name' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:20'.($isUpdate && $studentId ? '|unique:students,phone,'.$studentId.',id,deleted_at,NULL' : '|unique:students,phone,NULL,id,deleted_at,NULL'),
            'email' => 'nullable|email|max:255'.($isUpdate && $studentId ? '|unique:students,email,'.$studentId.',id,deleted_at,NULL' : '|unique:students,email,NULL,id,deleted_at,NULL'),
            'birth_date' => 'nullable|date',
            'gender' => 'nullable|in:male,female,other',
            'address' => 'nullable|string',
            'notes' => 'nullable|string',
            'avatar' => 'nullable|url',
            'status' => 'nullable|in:active,inactive,graduated',
        ];

        return $rules;
    }

    /**
     * Check if user can access a specific student.
     */
    private function checkAccess($student, $user): ?JsonResponse
    {
        // Student: chỉ có thể xem thông tin của chính họ
        if ($user->isStudent()) {
            $studentProfile = $this->getCurrentStudent();
            if (! $studentProfile || $student->id !== $studentProfile->id) {
                return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }

            return null;
        }

        if ($user->isTutor()) {
            // Org owner/manager: allow any student in their org (design §4.3). Checked before the
            // own-tutor rules because owner/manager have role=tutor (R1).
            if ($user->isOrgViewerAll()) {
                return $this->orgOwnsStudent($student)
                    ? null
                    : $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }

            // Accountant (finance-only): may read a student of THEIR org for BILLING (name/contact/
            // enrollment/debt). Same org-membership scope as owner/manager, but the StudentResource is
            // trimmed of teaching-derived fields (attendance rate / class list) for this viewer, and the
            // teaching per-student endpoints (grades/attendance) stay fail-closed via guardStudentAccess.
            // Before the own-tutor rules (shared User.role=tutor).
            if ($user->isOrgAccountant()) {
                return $this->orgFinanceOwnsStudent($student)
                    ? null
                    : $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }

            // Allow if tutor created the student OR student is in tutor's classes
            if ($student->created_by === $user->id) {
                return null;
            }

            // Check if student is in tutor's classes
            $hasAccess = $student->classes()
                ->where('tutor_id', $user->id)
                ->exists();

            if (! $hasAccess) {
                return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }
        } elseif (false) {
            // Removed - no longer needed
        } else {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        return null;
    }

    /**
     * Apply filters (search, sort, status, class_id) to query.
     */
    private function applyFilters($query, Request $request)
    {
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                    ->orWhere('email', 'like', "%{$request->search}%")
                    ->orWhere('phone', 'like', "%{$request->search}%")
                    ->orWhere('student_code', 'like', "%{$request->search}%");
            });
        }

        if ($request->has('class_id')) {
            $this->decodeHashId($request, 'class_id', ClassRoom::class);
            $query->whereHas('classes', function ($q) use ($request) {
                $q->where('class_id', $request->class_id);
            });
        }

        // Sort
        $sortable = ['created_at', 'updated_at', 'name', 'email', 'phone', 'status', 'birth_date'];
        $sortBy = $request->get('sort', 'created_at');
        if (! in_array($sortBy, $sortable, true)) {
            $sortBy = 'created_at';
        }
        $sortOrder = strtolower($request->get('order', 'desc')) === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sortBy, $sortOrder);

        return $query;
    }

    /**
     * List all students (with data isolation).
     */
    public function index(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();
        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Học viên: có thể xem students của chính họ (không cần capability)
        // Gia sư: cần capability students.manage để xem students
        if (! $user->isStudent()) {
            if ($capabilityError = $this->requirePlanCapability('students.manage')) {
                return $capabilityError;
            }
        }

        // Decode filter IDs
        $this->decodeHashId($request, 'class_id', ClassRoom::class);

        $filters = [
            'status' => $request->get('status'),
            'class_id' => $request->get('class_id'),
            'search' => $request->get('search'),
            'sort' => $request->get('sort', 'created_at'),
            'order' => $request->get('order', 'desc'),
            'per_page' => $request->get('per_page', 15),
            'page' => $request->get('page', 1),
        ];

        $cacheKey = CacheKeys::studentList($user->id, $filters);

        $result = Cache::remember($cacheKey, CacheTtl::LIST, function () use ($request) {
            return $this->buildStudentListResponse($request);
        });

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('students.manage');

        return response()->json([
            'success' => true,
            'data' => $result['data'],
            'meta' => $result['meta'],
            'permissions' => $permissions,
        ]);
    }

    /**
     * Get student details.
     */
    public function show(Student $student): JsonResponse
    {
        // Defensive check: ensure student was properly resolved
        if (! $student || ! $student->exists || ! $student->id) {
            return $this->errorResponse('Không tìm thấy học sinh', null, 'NOT_FOUND', 404);
        }
        $cacheKey = CacheKeys::studentDetail($student->id);

        $student = Cache::remember($cacheKey, CacheTtl::DETAIL, function () use ($student) {
            return $student->load([
                'classes' => function ($query) {
                    $query->with(['tutor', 'subject']);
                },
                'user.activeLocks' => function ($query) {
                    $query->orderBy('created_at', 'desc');
                },
            ]);
        });

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $accessError = $this->checkAccess($student, $user);
        if ($accessError) {
            return $accessError;
        }

        // Học viên: có thể xem thông tin của chính họ (không cần capability)
        // Gia sư: cần capability students.manage để xem students
        if (! $user->isStudent()) {
            if ($capabilityError = $this->requirePlanCapability('students.manage')) {
                return $capabilityError;
            }
        }

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('students.manage');

        $response = $this->successResponse(new StudentResource($student));
        $responseData = $response->getData(true);
        $responseData['permissions'] = $permissions;

        return response()->json($responseData, $response->getStatusCode());
    }

    /**
     * Create a new student.
     */
    public function store(StudentStoreRequest $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Student cannot create other students
        if ($user->isStudent()) {
            return $this->errorResponse('Không có quyền tạo học sinh', null, 'UNAUTHORIZED', 403);
        }

        // Check capability for students management
        if ($capabilityError = $this->requirePlanCapability('students.manage')) {
            return $capabilityError;
        }

        // (no plan-based limits in single-tenant mode)
        if ($limitError = $this->checkSubscriptionLimits('student')) {
            return $limitError;
        }

        if ($botBlock = BotShield::check($user, 'students', ['action' => 'create'])) {
            return $this->errorResponse(
                $botBlock['message'],
                $botBlock['details'],
                $botBlock['code'],
                $botBlock['status']
            );
        }

        $validated = $request->validated();

        $student = \DB::transaction(function () use ($validated, $user) {
            $email = $validated['email'] ?? null;
            $phone = $validated['phone'] ?? null;

            // Check if there is a trashed user with same email or phone
            $studentUser = User::withTrashed()
                ->where(function ($q) use ($email, $phone) {
                    if ($email) {
                        $q->where('email', $email);
                    }
                    if ($phone) {
                        $q->orWhere('phone', $phone);
                    }
                })
                ->first();

            if ($studentUser) {
                if ($studentUser->trashed()) {
                    $studentUser->restore();
                }
                $studentUser->update([
                    'name' => $validated['name'],
                    'password' => Hash::make($validated['password']),
                    'role' => 'student',
                    'status' => 'active',
                ]);
            } else {
                // Tạo user mới cho học viên
                $studentUser = User::create([
                    'name' => $validated['name'],
                    'email' => $email,
                    'phone' => $phone,
                    'password' => Hash::make($validated['password']),
                    'role' => 'student',
                    'status' => 'active',
                ]);
            }

            // Ensure student role is assigned (Spatie Permissions)
            if (! $studentUser->hasRole('student')) {
                $studentUser->assignRole('student');
            }

            // Check if there is a trashed student profile
            $trashedStudent = Student::withTrashed()
                ->where('user_id', $studentUser->id)
                ->first();

            $studentData = collect($validated)->except(['password', 'password_confirmation'])->all();
            $studentData['status'] = $studentData['status'] ?? 'active';
            $studentData['user_id'] = $studentUser->id;
            $studentData['created_by'] = $user->id;

            if ($trashedStudent) {
                if ($trashedStudent->trashed()) {
                    $trashedStudent->restore();
                }
                $trashedStudent->update($studentData);

                return $trashedStudent;
            }

            return Student::create($studentData);
        });

        // Cache clearing handled by StudentObserver

        return $this->successResponse(
            new StudentResource($student->load(['user.activeLocks'])),
            'Tạo học sinh thành công',
            201
        );
    }

    /**
     * Reset password for a student (by tutor/admin).
     */
    public function resetPassword(StudentResetPasswordRequest $request, Student $student): JsonResponse
    {
        $student->load('user');

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Học viên không được tự reset mật khẩu học viên khác
        if ($user->isStudent()) {
            return $this->errorResponse('Không có quyền đặt lại mật khẩu', null, 'UNAUTHORIZED', 403);
        }

        // Kiểm tra quyền truy cập: tutor chỉ reset mật khẩu cho học viên của mình
        $accessError = $this->checkAccess($student, $user);
        if ($accessError) {
            return $accessError;
        }

        // Yêu cầu capability quản lý học viên
        if ($capabilityError = $this->requirePlanCapability('students.manage')) {
            return $capabilityError;
        }

        $validated = $request->validated();

        if (! $student->user) {
            return $this->errorResponse('Học sinh chưa có tài khoản', null, 'NO_USER_ACCOUNT', 422);
        }

        $student->user->update([
            'password' => Hash::make($validated['password']),
        ]);

        return $this->successResponse(null, 'Đặt lại mật khẩu thành công');
    }

    /**
     * Update student.
     */
    public function update(Request $request, Student $student): JsonResponse
    {
        // Defensive check: ensure student was properly resolved
        if (! $student || ! $student->exists || ! $student->id) {
            return $this->errorResponse('Không tìm thấy học sinh', null, 'NOT_FOUND', 404);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $accessError = $this->checkAccess($student, $user);
        if ($accessError) {
            return $accessError;
        }

        // Student can only update limited fields (not status, notes, etc.)
        if ($user->isStudent()) {
            $validator = Validator::make($request->all(), [
                'name' => 'sometimes|string|max:255',
                'phone' => 'sometimes|string|max:20|unique:students,phone,'.$student->id.',id,deleted_at,NULL',
                'email' => 'sometimes|email|max:255|unique:students,email,'.$student->id.',id,deleted_at,NULL',
                'birth_date' => 'sometimes|date',
                'gender' => 'sometimes|in:male,female,other',
                'address' => 'sometimes|string',
                'avatar' => 'sometimes|url',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse(
                    'Dữ liệu không hợp lệ',
                    $validator,
                    'VALIDATION_ERROR',
                    422
                );
            }

            // Student can only update these fields
            $student->update($request->only([
                'name', 'phone', 'email', 'birth_date', 'gender', 'address', 'avatar',
            ]));
        } else {
            // Check capability for students management (only for tutors/admins)
            if ($capabilityError = $this->requirePlanCapability('students.manage')) {
                return $capabilityError;
            }

            $validator = Validator::make($request->all(), $this->getValidationRules(true, $student->id));

            if ($validator->fails()) {
                return $this->errorResponse(
                    'Dữ liệu không hợp lệ',
                    $validator,
                    'VALIDATION_ERROR',
                    422
                );
            }

            $student->update($request->only([
                'name', 'student_code', 'parent_name', 'phone', 'email', 'birth_date',
                'gender', 'address', 'notes', 'avatar', 'status',
            ]));
        }

        // Cache clearing handled by StudentObserver

        return $this->successResponse(
            new StudentResource($student->fresh()),
            'Cập nhật học sinh thành công'
        );
    }

    /**
     * Delete student.
     */
    public function destroy(Student $student): JsonResponse
    {
        // Defensive check: ensure student was properly resolved
        if (! $student || ! $student->exists || ! $student->id) {
            return $this->errorResponse('Không tìm thấy học sinh', null, 'NOT_FOUND', 404);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Check access (only Tutor can delete)
        // Student cannot delete
        if ($user->isStudent() || ! $user->isTutor()) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Check capability for students management
        if ($capabilityError = $this->requirePlanCapability('students.manage')) {
            return $capabilityError;
        }

        $accessError = $this->checkAccess($student, $user);
        if ($accessError) {
            return $accessError;
        }

        $userId = auth('api')->id();
        $student->delete();

        // Cache clearing handled by StudentObserver

        return $this->successResponse(null, 'Xóa học sinh thành công');
    }

    /**
     * Lock a student's account.
     *
     * Gia sư có thể khóa tài khoản học viên của mình (yêu cầu capability user_lock.use).
     */
    public function lockStudent(Request $request, Student $student): JsonResponse
    {
        // Yêu cầu capability
        if ($error = $this->requirePlanCapability('user_lock.use')) {
            return $error;
        }

        $student->load('user');

        if (! $student->user) {
            return $this->errorResponse('Học sinh chưa có tài khoản', null, 'NO_USER_ACCOUNT', 422);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Kiểm tra quyền truy cập: tutor chỉ có thể lock học viên của mình
        $accessError = $this->checkAccess($student, $user);
        if ($accessError) {
            return $accessError;
        }

        // Validation
        $validator = Validator::make($request->all(), [
            'type' => 'required|in:login,actions,all',
            'reason' => 'nullable|string|max:1000',
            'start_at' => 'nullable|date',
            'end_at' => 'nullable|date|after:start_at',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator->errors(), 'VALIDATION_ERROR', 422);
        }

        // Kiểm tra xem học viên đã bị khóa chưa
        $activeLock = $student->user->activeLocks()->first();
        if ($activeLock) {
            return $this->errorResponse(
                'Học viên này đã bị khóa. Vui lòng mở khóa trước khi khóa lại.',
                [
                    'lock_id' => UserLock::encodeId($activeLock->id),
                    'lock_type' => $activeLock->type,
                    'locked_from' => $activeLock->start_at?->toISOString(),
                    'locked_until' => $activeLock->end_at?->toISOString(),
                ],
                'ALREADY_LOCKED',
                422
            );
        }

        // Xác định start_at và status
        $startAt = $request->get('start_at') ? Carbon::parse($request->get('start_at')) : now();
        $status = $startAt->isFuture()
            ? UserLock::STATUS_SCHEDULED
            : UserLock::STATUS_ACTIVE;

        // Tạo lock mới (bắt đầu vòng đời lock mới)
        $lock = UserLock::create([
            'user_id' => $student->user->id,
            'type' => $request->get('type', 'all'),
            'status' => $status,
            'reason' => $request->get('reason'),
            'start_at' => $startAt,
            'end_at' => $request->get('end_at') ? Carbon::parse($request->get('end_at')) : null,
            'created_by' => $user->id,
            'internal_note' => "Khóa bởi gia sư: {$user->name} (ID: {$user->id})",
        ]);

        // Clear permission cache để đảm bảo lock được áp dụng ngay
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // Clear student detail cache để đảm bảo API trả về trạng thái mới nhất
        Cache::forget(CacheKeys::studentDetail($student->id));

        return $this->successResponse([
            'lock' => [
                '_id' => $lock->hash_id,
                'type' => $lock->type,
                'status' => $lock->status,
                'reason' => $lock->reason,
                'start_at' => $lock->start_at?->toISOString(),
                'end_at' => $lock->end_at?->toISOString(),
                'created_at' => $lock->created_at->toISOString(),
            ],
            'student' => [
                '_id' => $student->hash_id,
                'name' => $student->name,
                'user_id' => $student->user?->hash_id,
            ],
        ], 'Đã khóa tài khoản học viên thành công');
    }

    /**
     * Unlock a student's account.
     *
     * Gia sư có thể mở khóa tài khoản học viên của mình (yêu cầu capability user_lock.use).
     */
    public function unlockStudent(Request $request, Student $student): JsonResponse
    {
        // Yêu cầu capability
        if ($error = $this->requirePlanCapability('user_lock.use')) {
            return $error;
        }

        $student->load('user');

        if (! $student->user) {
            return $this->errorResponse('Học sinh chưa có tài khoản', null, 'NO_USER_ACCOUNT', 422);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Kiểm tra quyền truy cập: tutor chỉ có thể unlock học viên của mình
        $accessError = $this->checkAccess($student, $user);
        if ($accessError) {
            return $accessError;
        }

        // Tìm lock đang active
        $activeLock = $student->user->activeLocks()->first();
        if (! $activeLock) {
            // Idempotent: nếu không còn lock (đã xóa trong admin hoặc đã hết hạn) coi như đã mở khóa
            return $this->successResponse(null, 'Học viên này không bị khóa');
        }

        // Kiểm tra xem lock có phải do tutor này tạo không (hoặc tutor có quyền unlock)
        // Cho phép tutor unlock học viên của mình, không cần check created_by
        // (vì có thể admin lock, nhưng tutor vẫn có thể unlock học viên của mình)

        // Mở khóa
        $activeLock->update([
            'status' => UserLock::STATUS_DONE,
            'unlocked_by' => $user->id,
            'unlocked_at' => now(),
        ]);

        // Clear permission cache để đảm bảo unlock được áp dụng ngay
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // Clear student detail cache để đảm bảo API trả về trạng thái mới nhất
        Cache::forget(CacheKeys::studentDetail($student->id));

        return $this->successResponse([
            'lock' => [
                '_id' => $activeLock->hash_id,
                'type' => $activeLock->type,
                'status' => $activeLock->status,
                'unlocked_at' => $activeLock->unlocked_at->toISOString(),
            ],
            'student' => [
                '_id' => $student->hash_id,
                'name' => $student->name,
                'user_id' => $student->user?->hash_id,
            ],
        ], 'Đã mở khóa tài khoản học viên thành công');
    }

    /**
     * Get student's enrolled classes with filters, pagination, and search.
     */
    public function classes(Request $request, Student $student): JsonResponse
    {

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $accessError = $this->checkAccess($student, $user);
        if ($accessError) {
            return $accessError;
        }

        // Học viên: có thể xem classes của chính họ (không cần capability)
        // Gia sư: cần capability students.manage để xem classes của học viên
        if (! $user->isStudent()) {
            if ($capabilityError = $this->requirePlanCapability('students.manage')) {
                return $capabilityError;
            }
        }

        // Decode HashIDs
        $this->decodeHashId($request, 'tutor_id', User::class);
        $this->decodeHashId($request, 'subject_id', Subject::class);

        // Build cache key with filters and pagination
        $filters = [
            'enrollment_status' => $request->get('enrollment_status'),
            'status' => $request->get('status'),
            'tutor_id' => $request->get('tutor_id'),
            'subject_id' => $request->get('subject_id'),
            'start_date_from' => $request->get('start_date_from'),
            'start_date_to' => $request->get('start_date_to'),
            'search' => $request->get('search'),
            'is_paused' => $request->get('is_paused'),
            'sort' => $request->get('sort', 'class_student.enrolled_at'),
            'order' => $request->get('order', 'desc'),
            'per_page' => $request->get('per_page', 15),
            'page' => $request->get('page', 1),
        ];
        $cacheKey = CacheKeys::studentClassesList($student->id, $filters);

        $result = Cache::remember($cacheKey, CacheTtl::LIST, function () use ($student, $request, $filters) {
            return $this->buildStudentClassesResponse($student, $request, $filters);
        });

        // Check capability để frontend biết có nên hiển thị nút quản lý hay không
        $permissions = $this->buildMultiplePermissions([
            'can_manage_students' => 'students.manage',
            'can_manage_classes' => 'classes.manage',
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'classes' => $result['classes'],
                'student_id' => $result['student_id'],
                'student_name' => $result['student_name'],
                'statistics' => $result['statistics'],
            ],
            'meta' => $result['meta'],
            'permissions' => $permissions,
        ]);
    }

    /**
     * Get student's assignments from all enrolled classes with filters, pagination, and search.
     */
    public function assignments(Request $request, Student $student): JsonResponse
    {

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $accessError = $this->checkAccess($student, $user);
        if ($accessError) {
            return $accessError;
        }

        // Học viên: có thể xem assignments của chính họ (không cần capability)
        // Gia sư: cần capability students.manage để xem assignments của học viên
        if (! $user->isStudent()) {
            if ($capabilityError = $this->requirePlanCapability('students.manage')) {
                return $capabilityError;
            }
        }

        $classIds = $student->classes()
            ->wherePivot('is_paused', false)
            ->pluck('classes.id');

        if ($request->has('class_id') && $request->filled('class_id') && ! $classIds->contains($request->class_id)) {
            return $this->errorResponse('Học viên không thuộc lớp này', null, 'BAD_REQUEST', 400);
        }

        // Decode HashIDs
        $this->decodeHashId($request, 'class_id', ClassRoom::class);
        $this->decodeHashId($request, 'assignment_type_id', AssignmentType::class);

        // Build filters array for pagination (giống như method classes)
        $filters = [
            'status' => $request->get('status'),
            'assignment_type_id' => $request->get('assignment_type_id'),
            'class_id' => $request->get('class_id'),
            'due_date_from' => $request->get('due_date_from'),
            'due_date_to' => $request->get('due_date_to'),
            'search' => $request->get('search'),
            'sort' => $request->get('sort', 'due_date'),
            'order' => $request->get('order', 'asc'),
            'per_page' => $request->get('per_page', 15),
            'page' => $request->get('page', 1),
        ];

        $cacheKey = CacheKeys::studentAssignmentsList($student->id, $filters);

        $result = Cache::remember($cacheKey, CacheTtl::LIST, function () use ($student, $request, $classIds, $filters) {
            return $this->buildStudentAssignmentsResponse($student, $request, $classIds, $filters);
        });

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('assignments.manage');

        return response()->json([
            'success' => true,
            'data' => [
                'assignments' => $result['assignments'],
                'student_id' => $result['student_id'],
                'student_name' => $result['student_name'],
                'statistics' => $result['statistics'],
            ],
            'meta' => $result['meta'],
            'permissions' => $permissions,
        ]);
    }

    /**
     * Get recent activity for a student.
     *
     * CƠ CHẾ HOẠT ĐỘNG:
     * - KHÔNG có bảng riêng để lưu trữ activities
     * - Query REAL-TIME từ các bảng gốc: attendance, submissions, grades, class_student, assignments
     * - Mỗi lần gọi API sẽ query lại từ đầu
     * - Dữ liệu KHÔNG bị giới hạn lưu trữ, lấy từ dữ liệu gốc trong database
     *
     * PARAMETERS:
     * - limit: Số lượng activities muốn lấy (default: 20, max: 100)
     * - page: Trang số (default: 1) - Có phân trang
     * - per_page: Số items mỗi trang (default: 20, max: 100)
     */
    public function recentActivity(Request $request, Student $student): JsonResponse
    {

        [$user, $error] = $this->requireAuth();

        if ($error) {
            return $error;
        }

        // Check access
        $accessError = $this->checkAccess($student, $user);
        if ($accessError) {
            return $accessError;
        }

        // Check capabilities specifics
        if ($user->isTutor()) {
            // Gia sư cần capability students.manage để xem recent activity của học viên
            if ($capabilityError = $this->requirePlanCapability('students.manage')) {
                return $capabilityError;
            }
        }
        // Student logic automatically handled by checkAccess for access, no extra cap needed for viewing self recent activity

        try {
            // Pagination parameters
            $perPage = min($request->get('per_page', 20), 100);
            $page = max(1, (int) $request->get('page', 1));

            // Fetch more records than needed to ensure we have enough after merging and sorting
            // We'll fetch 3x per_page from each category to ensure coverage
            $fetchLimit = $perPage * 3;
            $classIds = $student->classes()->pluck('classes.id');

            $activities = collect();

            // Recent attendance records
            $recentAttendances = Attendance::where('student_id', $student->id)
                ->with(['class', 'tutor'])
                ->latest('date')
                ->take($fetchLimit)
                ->get()
                ->map(function ($attendance) {
                    return [
                        'type' => 'attendance',
                        '_id' => $attendance->hash_id,
                        'date' => $attendance->date?->toDateString(),
                        'datetime' => $attendance->date?->toISOString(),
                        'title' => "Điểm danh - {$attendance->class->name}",
                        'description' => 'Trạng thái: '.ucfirst($attendance->status),
                        'status' => $attendance->status,
                        'class' => [
                            '_id' => $attendance->class->hash_id,
                            'name' => $attendance->class->name,
                        ],
                        'tutor' => $attendance->tutor ? [
                            '_id' => $attendance->tutor->hash_id,
                            'name' => $attendance->tutor->name,
                        ] : null,
                        'check_in_time' => $attendance->check_in_time?->format('H:i'),
                        'check_out_time' => $attendance->check_out_time?->format('H:i'),
                        'note' => $attendance->note,
                    ];
                });

            $activities = $activities->concat($recentAttendances);

            // Recent submissions
            $recentSubmissions = Submission::where('student_id', $student->id)
                ->with(['assignment.class', 'assignment.tutor', 'grader'])
                ->latest('submitted_at')
                ->take($fetchLimit)
                ->get()
                ->map(function ($submission) {
                    return [
                        'type' => 'submission',
                        '_id' => $submission->hash_id,
                        'date' => $submission->submitted_at?->toDateString(),
                        'datetime' => $submission->submitted_at?->toISOString(),
                        'title' => "Nộp bài tập: {$submission->assignment->title}",
                        'description' => "Lớp: {$submission->assignment->class->name}",
                        'status' => $submission->status,
                        'score' => $submission->score,
                        'max_score' => $submission->assignment->max_score,
                        'is_late' => $submission->is_late,
                        'assignment' => [
                            '_id' => $submission->assignment->hash_id,
                            'title' => $submission->assignment->title,
                        ],
                        'class' => [
                            '_id' => $submission->assignment->class->hash_id,
                            'name' => $submission->assignment->class->name,
                        ],
                        'tutor' => $submission->assignment->tutor ? [
                            '_id' => $submission->assignment->tutor->hash_id,
                            'name' => $submission->assignment->tutor->name,
                        ] : null,
                        'grader' => $submission->grader ? [
                            '_id' => $submission->grader->hash_id,
                            'name' => $submission->grader->name,
                        ] : null,
                    ];
                });

            $activities = $activities->concat($recentSubmissions);

            // Recent grades
            $recentGrades = Grade::where('student_id', $student->id)
                ->with(['class', 'tutor', 'gradeType'])
                ->latest('grade_date')
                ->take($fetchLimit)
                ->get()
                ->map(function ($grade) {
                    return [
                        'type' => 'grade',
                        '_id' => $grade->hash_id,
                        'date' => $grade->grade_date?->toDateString(),
                        'datetime' => $grade->grade_date?->toISOString(),
                        'title' => "Điểm số: {$grade->score}/{$grade->max_score}",
                        'description' => "{$grade->class->name} - ".($grade->gradeType ? $grade->gradeType->name : 'Điểm tổng hợp'),
                        'score' => $grade->score,
                        'max_score' => $grade->max_score,
                        'class' => [
                            '_id' => $grade->class->hash_id,
                            'name' => $grade->class->name,
                        ],
                        'tutor' => $grade->tutor ? [
                            '_id' => $grade->tutor->hash_id,
                            'name' => $grade->tutor->name,
                        ] : null,
                        'grade_type' => $grade->gradeType ? [
                            '_id' => $grade->gradeType->hash_id,
                            'name' => $grade->gradeType->name,
                        ] : null,
                        'note' => $grade->note,
                    ];
                });

            $activities = $activities->concat($recentGrades);

            // Recent class enrollments
            if (! $classIds->isEmpty()) {
                $recentEnrollments = \DB::table('class_student')
                    ->where('student_id', $student->id)
                    ->whereIn('class_id', $classIds)
                    ->join('classes', 'class_student.class_id', '=', 'classes.id')
                    ->select('class_student.*', 'classes.name as class_name', 'classes.id as class_id')
                    ->orderByDesc('class_student.enrolled_at')
                    ->take($fetchLimit)
                    ->get()
                    ->map(function ($enrollment) {
                        return [
                            'type' => 'enrollment',
                            'date' => $enrollment->enrolled_at ? (new Carbon($enrollment->enrolled_at))->toDateString() : null,
                            'datetime' => $enrollment->enrolled_at ? (new Carbon($enrollment->enrolled_at))->toISOString() : null,
                            'title' => "Tham gia lớp: {$enrollment->class_name}",
                            'description' => 'Trạng thái: '.ucfirst($enrollment->status ?? 'active'),
                            'status' => $enrollment->status ?? 'active',
                            'class' => [
                                '_id' => ClassRoom::encodeId($enrollment->class_id),
                                'name' => $enrollment->class_name,
                            ],
                            'notes' => $enrollment->notes,
                        ];
                    });

                $activities = $activities->concat($recentEnrollments);
            }

            // Recent assignments (assigned to student's classes)
            if (! $classIds->isEmpty()) {
                $recentAssignments = Assignment::whereIn('class_id', $classIds)
                    ->with(['class', 'tutor', 'assignmentType'])
                    ->latest('created_at')
                    ->take($fetchLimit)
                    ->get()
                    ->map(function ($assignment) {
                        return [
                            'type' => 'assignment',
                            '_id' => $assignment->hash_id,
                            'date' => $assignment->created_at?->toDateString(),
                            'datetime' => $assignment->created_at?->toISOString(),
                            'title' => "Bài tập mới: {$assignment->title}",
                            'description' => "Lớp: {$assignment->class->name}".($assignment->due_date ? " - Hạn: {$assignment->due_date->format('d/m/Y')}" : ''),
                            'status' => $assignment->status,
                            'due_date' => $assignment->due_date?->toDateString(),
                            'deadline' => $assignment->deadline?->toISOString(),
                            'assignment_type' => $assignment->assignmentType ? [
                                '_id' => $assignment->assignmentType->hash_id,
                                'name' => $assignment->assignmentType->name,
                                'code' => $assignment->assignmentType->code,
                            ] : null,
                            'class' => [
                                '_id' => $assignment->class->hash_id,
                                'name' => $assignment->class->name,
                            ],
                            'tutor' => $assignment->tutor ? [
                                '_id' => $assignment->tutor->hash_id,
                                'name' => $assignment->tutor->name,
                            ] : null,
                        ];
                    });

                $activities = $activities->concat($recentAssignments);
            }

            // Sort all activities by datetime (most recent first)
            $allSortedActivities = $activities
                ->filter(function ($activity) {
                    return isset($activity['datetime']) && $activity['datetime'];
                })
                ->sortByDesc(function ($activity) {
                    return $activity['datetime'];
                })
                ->values();

            // Calculate pagination
            $totalActivities = $allSortedActivities->count();
            $totalPages = (int) ceil($totalActivities / $perPage);
            $offset = ($page - 1) * $perPage;

            // Get paginated activities
            $paginatedActivities = $allSortedActivities->slice($offset, $perPage)->values();

            // Group by date for easier frontend display (only for current page)
            $groupedByDate = $paginatedActivities->groupBy('date');

            return response()->json([
                'success' => true,
                'data' => [
                    'activities' => $paginatedActivities->toArray(),
                    'grouped_by_date' => $groupedByDate->map(function ($items) {
                        return $items->values()->toArray();
                    })->toArray(),
                    'student_id' => Student::encodeId($student->id),
                    'student_name' => $student->name,
                ],
                'meta' => [
                    'current_page' => $page,
                    'per_page' => $perPage,
                    'total' => $totalActivities,
                    'last_page' => $totalPages,
                    'from' => $totalActivities > 0 ? $offset + 1 : 0,
                    'to' => min($offset + $perPage, $totalActivities),
                ],
            ]);
        } catch (\Exception $e) {
            return $this->errorResponse(
                'Lỗi khi tải hoạt động gần đây: '.$e->getMessage(),
                null,
                'SERVER_ERROR',
                500
            );
        }
    }

    /**
     * Get student statistics.
     */
    public function statistics(Student $student): JsonResponse
    {
        $student->load(['classes', 'attendances', 'grades']);

        if (! $student->exists) {
            return $this->errorResponse('Không tìm thấy học sinh', null, 'NOT_FOUND', 404);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Student: chỉ có thể xem statistics của chính họ
        if ($user->isStudent()) {
            $studentProfile = $this->getCurrentStudent();
            if (! $studentProfile || $student->id !== $studentProfile->id) {
                return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }

            // Check capability for students
            if ($planError = $this->requirePlanCapability('reports.view_advanced')) {
                return $planError;
            }
        } else {
            // Other roles: check access
            $accessError = $this->checkAccess($student, $user);
            if ($accessError) {
                return $accessError;
            }

            // Gia sư cần capability students.manage để xem statistics của học viên
            if ($capabilityError = $this->requirePlanCapability('students.manage')) {
                return $capabilityError;
            }
        }

        $attendanceRate = $student->getAttendanceRate();
        $averageGrade = $student->grades->avg('score');

        // Điểm trung bình là số THÔ theo thang của học viên (band IELTS 0–9, TOEIC 0–990,
        // hay thang trường 0–10). Trả kèm thang + điểm tối đa để UI hiện "6.5 / 9" thay vì
        // một con số trần trụi kiểu "309.17" mà người xem không biết là thang gì.
        // Trả null khi sổ điểm trộn nhiều thang — lúc đó số trung bình vô nghĩa.
        $scales = $student->grades->pluck('max_score')->filter()->unique();
        $gradeMax = $scales->count() === 1 ? (int) $scales->first() : null;
        $gradeScale = match ($gradeMax) {
            9 => 'ielts',
            990 => 'toeic',
            null => 'mixed',
            default => 'standard',
        };

        return $this->successResponse([
            'average_grade_max' => $gradeMax,
            'average_grade_scale' => $gradeScale,
            'total_classes' => $student->classes->count(),
            'active_classes' => $student->getActiveClassCount(),
            'total_attendances' => $student->attendances->count(),
            'attendance_rate' => $attendanceRate,
            'attendance_rate_formatted' => $this->formatPercentage($attendanceRate),
            'total_grades' => $student->grades->count(),
            'average_grade' => $averageGrade,
            'average_grade_formatted' => $this->formatDecimal($averageGrade),
        ]);
    }

    /**
     * Build response for student listing.
     */
    private function buildStudentListResponse(Request $request): array
    {
        $query = Student::query()->with([
            'classes' => function ($query) {
                $query->with(['tutor', 'subject']);
            },
            'user.activeLocks' => function ($query) {
                $query->orderBy('created_at', 'desc');
            },
        ]);

        $query = $this->applyDataIsolation($query, 'students');
        $query = $this->applyFilters($query, $request);

        $perPage = min($request->get('per_page', 15), 100);
        $students = $query->paginate($perPage);

        // Calculate statistics (on all data, not filtered/paginated)
        $statsQuery = Student::query();
        $statsQuery = $this->applyDataIsolation($statsQuery, 'students');

        $statistics = [
            'total' => $statsQuery->count(),
            'active' => (clone $statsQuery)->where('status', 'active')->count(),
            'inactive' => (clone $statsQuery)->where('status', 'inactive')->count(),
            'unique_classes' => Enrollment::whereIn('student_id', (clone $statsQuery)->pluck('id'))
                ->distinct('class_id')
                ->count('class_id'),
        ];

        return [
            'data' => StudentResource::collection($students),
            'meta' => [
                'current_page' => $students->currentPage(),
                'per_page' => $students->perPage(),
                'total' => $students->total(),
                'last_page' => $students->lastPage(),
                'statistics' => $statistics,
            ],
        ];
    }

    /**
     * Build response for student classes endpoint.
     */
    private function buildStudentClassesResponse(Student $student, Request $request, array $filters): array
    {
        $query = $student->classes()->with(['tutor', 'subject']);

        if ($request->has('enrollment_status')) {
            $query->wherePivot('status', $request->enrollment_status);
        }

        if ($request->has('status')) {
            $query->where('classes.status', $request->status);
        }

        if ($request->has('tutor_id')) {
            $query->where('classes.tutor_id', $request->tutor_id);
        }

        if ($request->has('subject_id')) {
            $query->where('classes.subject_id', $request->subject_id);
        }

        if ($request->filled('is_paused')) {
            $query->wherePivot('is_paused', filter_var($request->get('is_paused'), FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->has('start_date_from')) {
            $query->whereDate('classes.start_date', '>=', $request->start_date_from);
        }

        if ($request->has('start_date_to')) {
            $query->whereDate('classes.start_date', '<=', $request->start_date_to);
        }

        if ($request->has('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('classes.name', 'like', "%{$request->search}%")
                    ->orWhere('classes.subject', 'like', "%{$request->search}%")
                    ->orWhereHas('tutor', function ($q) use ($request) {
                        $q->where('name', 'like', "%{$request->search}%")
                            ->orWhere('email', 'like', "%{$request->search}%");
                    });
            });
        }

        $pivotSortable = ['class_student.enrolled_at', 'class_student.status', 'class_student.is_paused', 'class_student.paused_at'];
        $classSortable = ['name', 'subject', 'start_date', 'end_date', 'status', 'tuition_fee', 'created_at', 'updated_at'];
        $sortBy = $request->get('sort', 'class_student.enrolled_at');
        $sortOrder = strtolower($request->get('order', 'desc')) === 'asc' ? 'asc' : 'desc';

        if (str_starts_with($sortBy, 'pivot.') || str_starts_with($sortBy, 'class_student.')) {
            $sortColumn = str_replace('pivot.', 'class_student.', $sortBy);
            if (! in_array($sortColumn, $pivotSortable, true)) {
                $sortColumn = 'class_student.enrolled_at';
            }
            $query->orderBy($sortColumn, $sortOrder);
        } else {
            if (! in_array($sortBy, $classSortable, true)) {
                $sortBy = 'name';
            }
            $query->orderBy('classes.'.$sortBy, $sortOrder);
        }

        $perPage = (int) min($filters['per_page'] ?? 15, 100);
        $page = (int) ($filters['page'] ?? 1);
        $classes = $query->paginate($perPage, ['*'], 'page', $page);

        $totalCount = $student->classes()->count();
        $activeCount = $student->getActiveClassCount();
        $pausedCount = $student->classes()->wherePivot('is_paused', true)->count();

        $enrollmentStatusCounts = \DB::table('class_student')
            ->where('student_id', $student->id)
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        $classesData = $classes->map(function ($class) use ($request, $student) {
            $classData = (new ClassRoomResource($class))->toArray($request);

            // Build enrollment object với đầy đủ thông tin
            $enrollment = $this->buildEnrollmentData($student, $class);

            $classData['enrollment'] = $enrollment;

            return $classData;
        });

        return [
            'classes' => $classesData,
            'student_id' => Student::encodeId($student->id),
            'student_name' => $student->name,
            'statistics' => [
                'total_count' => $totalCount,
                'active_count' => $activeCount,
                'paused_count' => $pausedCount,
                'enrollment_status_counts' => $enrollmentStatusCounts,
            ],
            'meta' => [
                'current_page' => $classes->currentPage(),
                'per_page' => $classes->perPage(),
                'total' => $classes->total(),
                'last_page' => $classes->lastPage(),
            ],
        ];
    }

    /**
     * Build response for student assignments endpoint.
     */
    private function buildStudentAssignmentsResponse(Student $student, Request $request, $classIds, array $filters = []): array
    {
        if ($classIds->isEmpty()) {
            return [
                'assignments' => [],
                'student_id' => Student::encodeId($student->id),
                'student_name' => $student->name,
                'statistics' => [
                    'total_count' => 0,
                    'published_count' => 0,
                    'pending_submissions_count' => 0,
                    'graded_submissions_count' => 0,
                ],
                'meta' => [
                    'current_page' => 1,
                    'per_page' => 15,
                    'total' => 0,
                    'last_page' => 1,
                ],
            ];
        }

        $query = Assignment::query()
            ->whereIn('class_id', $classIds)
            ->with(['class', 'tutor', 'assignmentType'])
            ->withCount([
                'submissions',
                'submissions as graded_submissions_count' => function ($query) {
                    $query->where('status', 'graded');
                },
                'submissions as pending_submissions_count' => function ($query) {
                    $query->where('status', 'pending');
                },
            ])
            ->with(['submissions' => function ($q) use ($student) {
                $q->where('student_id', $student->id);
            }]);

        // Học viên: chỉ được filter status = 'published' hoặc 'closed', status 'draft' trả về empty
        $user = auth('api')->user();
        if ($user && $user->isStudent()) {
            // Nếu có filter status
            if ($request->has('status')) {
                if (in_array($request->status, ['published', 'closed'])) {
                    $query->where('status', $request->status);
                } else {
                    // Nếu học viên filter status = 'draft', trả về empty result
                    $query->whereRaw('1 = 0');
                }
            } else {
                // Không có filter → mặc định lấy published và closed (không lấy draft)
                $query->whereIn('status', ['published', 'closed']);
            }
        } else {
            // Gia sư/admin có thể filter theo bất kỳ status nào
            if ($request->has('status')) {
                $query->where('status', $request->status);
            }
        }

        if ($request->has('assignment_type_id')) {
            $query->where('assignment_type_id', $request->assignment_type_id);
        }

        if ($request->has('class_id')) {
            $query->where('class_id', $request->class_id);
        }

        if ($request->has('due_date_from')) {
            $query->whereDate('due_date', '>=', $request->due_date_from);
        }

        if ($request->has('due_date_to')) {
            $query->whereDate('due_date', '<=', $request->due_date_to);
        }

        if ($request->has('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('title', 'like', "%{$request->search}%")
                    ->orWhere('description', 'like', "%{$request->search}%")
                    ->orWhereHas('class', function ($q) use ($request) {
                        $q->where('name', 'like', "%{$request->search}%");
                    });
            });
        }

        $sortable = ['due_date', 'assigned_date', 'deadline', 'title', 'status', 'max_score', 'created_at', 'updated_at'];
        $sortBy = $request->get('sort', 'due_date');
        if (! in_array($sortBy, $sortable, true)) {
            $sortBy = 'due_date';
        }
        $sortOrder = strtolower($request->get('order', 'asc')) === 'desc' ? 'desc' : 'asc';
        $query->orderBy($sortBy, $sortOrder);

        // Pagination - explicitly pass page parameter
        // IMPORTANT: Use $filters['page'] not $request->get('page') to avoid reading from global request
        $perPage = (int) min($filters['per_page'] ?? 15, 100);
        $page = (int) ($filters['page'] ?? 1);
        $assignments = $query->paginate($perPage, ['*'], 'page', $page);

        $totalCount = Assignment::whereIn('class_id', $classIds)->count();
        $publishedCount = Assignment::whereIn('class_id', $classIds)
            ->where('status', 'published')
            ->count();

        $pendingSubmissionsCount = Submission::where('student_id', $student->id)
            ->whereHas('assignment', function ($q) use ($classIds) {
                $q->whereIn('class_id', $classIds);
            })
            ->where('status', 'pending')
            ->count();

        $gradedSubmissionsCount = Submission::where('student_id', $student->id)
            ->whereHas('assignment', function ($q) use ($classIds) {
                $q->whereIn('class_id', $classIds);
            })
            ->where('status', 'graded')
            ->count();

        $assignmentsData = $assignments->map(function ($assignment) use ($request) {
            $assignmentData = (new AssignmentResource($assignment))->toArray($request);
            $studentSubmission = $assignment->submissions->first();

            $assignmentData['my_submission'] = $studentSubmission
                ? [
                    '_id' => $studentSubmission->hash_id,
                    'status' => $studentSubmission->status,
                    'submitted_at' => $studentSubmission->submitted_at?->toISOString(),
                    'score' => $studentSubmission->score,
                    'is_late' => $studentSubmission->is_late,
                    'feedback' => $studentSubmission->feedback,
                ]
                : null;

            return $assignmentData;
        });

        return [
            'assignments' => $assignmentsData,
            'student_id' => $student->hash_id,
            'student_name' => $student->name,
            'statistics' => [
                'total_count' => $totalCount,
                'published_count' => $publishedCount,
                'pending_submissions_count' => $pendingSubmissionsCount,
                'graded_submissions_count' => $gradedSubmissionsCount,
            ],
            'meta' => [
                'current_page' => $assignments->currentPage(),
                'per_page' => $assignments->perPage(),
                'total' => $assignments->total(),
                'last_page' => $assignments->lastPage(),
            ],
        ];
    }

    /**
     * Build enrollment data với đầy đủ thông tin (is_paused, status_label, etc.)
     */
    private function buildEnrollmentData(Student $student, ClassRoom $class): array
    {
        $pivot = $class->pivot;
        $isPaused = (bool) ($pivot->is_paused ?? false);
        $status = $pivot->status ?? null;

        // Format enrolled_at
        $enrolledAt = $pivot->enrolled_at ?? null;
        if ($enrolledAt) {
            if (is_string($enrolledAt)) {
                // Already a string
            } elseif ($enrolledAt instanceof Carbon || method_exists($enrolledAt, 'toISOString')) {
                $enrolledAt = $enrolledAt->toISOString();
            } elseif (method_exists($enrolledAt, 'toDateString')) {
                $enrolledAt = $enrolledAt->toDateString();
            }
        }

        // Format paused_at
        $pausedAt = $pivot->paused_at ?? null;
        if ($pausedAt && ($pausedAt instanceof Carbon || method_exists($pausedAt, 'toISOString'))) {
            $pausedAt = $pausedAt->toISOString();
        }

        // Format resumed_at
        $resumedAt = $pivot->resumed_at ?? null;
        if ($resumedAt && ($resumedAt instanceof Carbon || method_exists($resumedAt, 'toISOString'))) {
            $resumedAt = $resumedAt->toISOString();
        }

        // Get enrollment ID from pivot
        $enrollmentId = $pivot->id ?? null;

        return [
            '_id' => Enrollment::encodeId($enrollmentId),
            'class_id' => $class->hash_id,
            'student_id' => $student->hash_id,
            'status' => $status,
            'status_label' => $this->getEnrollmentStatusLabel($status, $isPaused),
            'is_paused' => $isPaused,
            'pause_reason' => $pivot->pause_reason ?? null,
            'paused_at' => $pausedAt,
            'resumed_at' => $resumedAt,
            'enrolled_at' => $enrolledAt,
            'notes' => $pivot->notes ?? null,
        ];
    }

    /**
     * Get enrollment status label.
     */
    private function getEnrollmentStatusLabel(?string $status, bool $isPaused = false): ?string
    {
        if ($isPaused) {
            return 'Tạm dừng học';
        }

        if (! $status) {
            return null;
        }

        return match ($status) {
            'active' => 'Đang học',
            'inactive' => 'Tạm nghỉ',
            'completed' => 'Đã hoàn thành',
            'dropped' => 'Đã bỏ học',
            'paused' => 'Tạm dừng học',
            default => $status,
        };
    }

    /**
     * Import students from CSV/XLSX file.
     *
     * POST /api/v1/students/import
     *
     * Body:
     * - file: CSV/XLSX file (required)
     * - skip_duplicates: boolean (optional, default: true)
     */
    public function import(ImportStudentsRequest $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Student cannot import
        if ($user->isStudent()) {
            return $this->errorResponse('Không có quyền import học viên', null, 'UNAUTHORIZED', 403);
        }

        // Check capability for data import
        if ($capabilityError = $this->requirePlanCapability('data.import')) {
            return $capabilityError;
        }

        // Also check students.manage to ensure user can manage students
        if ($capabilityError = $this->requirePlanCapability('students.manage')) {
            return $capabilityError;
        }

        $file = $request->file('file');
        $skipDuplicates = $request->boolean('skip_duplicates', true);

        $job = DataJobService::start('import', 'students', $user, [
            'file_name' => $file?->getClientOriginalName(),
            'format' => $file?->getClientOriginalExtension(),
            'meta' => [
                'path' => $request->path(),
                'skip_duplicates' => $skipDuplicates,
            ],
        ]);

        // Read file
        $requiredColumns = ['name']; // At least name is required
        $fileData = ImportService::readFile($file, $requiredColumns);

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

        // Import students
        $result = ImportStudentAction::execute(
            $fileData['rows'],
            $user->id,
            $skipDuplicates
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

    /**
     * Export raw students list (data export, not report).
     *
     * GET /api/v1/students/export
     *
     * Query:
     * - format: csv|excel (required)
     * - Các filter giống index(): search, status, class_id, ...
     */
    public function export(Request $request)
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Student cannot export
        if ($user->isStudent()) {
            return $this->errorResponse('Không có quyền export học viên', null, 'UNAUTHORIZED', 403);
        }

        // Chỉ check students.manage; quyền data.export sẽ được kiểm tra trong ReportsController::handleExport
        if ($capabilityError = $this->requirePlanCapability('students.manage')) {
            return $capabilityError;
        }

        // Build query giống index(), nhưng không paginate
        $query = Student::query()->with('classes');
        $query = $this->applyDataIsolation($query, 'students');
        $query = $this->applyFilters($query, $request);

        $students = $query->get();

        // Map thành mảng đơn giản để export
        $data = $students->map(function (Student $student) {
            return [
                '_id' => $student->hash_id,
                'name' => $student->name,
                'parent_name' => $student->parent_name,
                'email' => $student->email,
                'phone' => $student->phone,
                'status' => $student->status,
                'birth_date' => $student->birth_date ? $student->birth_date->format('Y-m-d') : null,
                'gender' => $student->gender,
                'classes' => $student->classes->pluck('name')->implode(', '),
                'created_at' => $student->created_at?->format('Y-m-d H:i:s'),
                'updated_at' => $student->updated_at?->format('Y-m-d H:i:s'),
            ];
        })->toArray();

        // Dùng trực tiếp ReportsController::handleExport để sinh file (không dùng Reflection)
        $reportsController = app(ReportsController::class);

        return $reportsController->handleExport($request, 'students-data', function () use ($data) {
            return $data;
        });
    }
}
