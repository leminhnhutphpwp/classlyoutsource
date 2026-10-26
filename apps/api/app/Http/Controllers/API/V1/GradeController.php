<?php

namespace App\Http\Controllers\API\V1;

use App\Actions\ImportGradeAction;
use App\Http\Requests\ImportGradesRequest;
use App\Http\Resources\ClassRoomResource;
use App\Http\Resources\GradeResource;
use App\Models\Assignment;
use App\Models\Attendance;
use App\Models\ClassRoom;
use App\Models\Grade;
use App\Models\GradeType;
use App\Models\Student;
use App\Rules\ExistsHashId;
use App\Services\DataJobService;
use App\Services\ImportService;
use App\Support\CacheKeys;
use App\Support\CacheTtl;
use App\Traits\DecodesHashIds;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class GradeController extends BaseController
{
    use DecodesHashIds;

    /**
     * Get validation rules for grade.
     */
    private function getValidationRules(bool $isUpdate = false): array
    {
        $rules = [
            'title' => ($isUpdate ? 'sometimes|' : '').'required|string|max:255',
            'grade_type_id' => ['nullable', new ExistsHashId(GradeType::class)],
            'assignment_id' => ['nullable', new ExistsHashId(Assignment::class)],
            'score' => ($isUpdate ? 'sometimes|' : '').'required|numeric|min:0',
            'max_score' => ($isUpdate ? 'sometimes|' : '').'required|numeric|min:0',
            'grade_date' => ($isUpdate ? 'sometimes|' : '').'required|date',
            'semester' => 'nullable|string|max:255',
            'comments' => 'nullable|string',
        ];

        if (! $isUpdate) {
            $rules['class_id'] = ['required', new ExistsHashId(ClassRoom::class)];
            $rules['student_id'] = ['required', new ExistsHashId(Student::class)];
        }

        return $rules;
    }

    /**
     * Apply filters (class_id, student_id, grade_type_id, assignment_id, semester, date, search, sort) to query.
     */
    private function applyFilters($query, Request $request)
    {
        if ($request->has('class_id')) {
            $this->decodeHashId($request, 'class_id', ClassRoom::class);
        }
        if ($request->has('class_id')) {
            $query->where('class_id', $request->class_id);
        }

        if ($request->has('student_id')) {
            $this->decodeHashId($request, 'student_id', Student::class);
        }
        if ($request->has('student_id')) {
            $query->where('student_id', $request->student_id);
        }

        if ($request->has('grade_type_id')) {
            $this->decodeHashId($request, 'grade_type_id', GradeType::class);
            $query->where('grade_type_id', $request->grade_type_id);
        }

        if ($request->has('assignment_id')) {
            $this->decodeHashId($request, 'assignment_id', Assignment::class);
        }
        if ($request->has('assignment_id')) {
            $query->where('assignment_id', $request->assignment_id);
        }

        if ($request->has('semester')) {
            $query->where('semester', $request->semester);
        }

        if ($request->has('grade_date_from')) {
            $query->whereDate('grade_date', '>=', $request->grade_date_from);
        }

        if ($request->has('grade_date_to')) {
            $query->whereDate('grade_date', '<=', $request->grade_date_to);
        }

        // Search by title, comments, student name, student code, class name
        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('comments', 'like', "%{$search}%")
                    ->orWhere('semester', 'like', "%{$search}%")
                    ->orWhereHas('student', function ($studentQuery) use ($search) {
                        $studentQuery->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%")
                            ->orWhere('student_code', 'like', "%{$search}%");
                    })
                    ->orWhereHas('class', function ($classQuery) use ($search) {
                        $classQuery->where('name', 'like', "%{$search}%")
                            ->orWhere('subject', 'like', "%{$search}%");
                    });
            });
        }

        // Sort
        $sortable = ['grade_date', 'score', 'max_score', 'title', 'semester', 'created_at', 'updated_at'];
        $sortBy = $request->get('sort', 'grade_date');
        if (! in_array($sortBy, $sortable, true)) {
            $sortBy = 'grade_date';
        }
        $sortOrder = strtolower($request->get('order', 'desc')) === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sortBy, $sortOrder);

        return $query;
    }

    public function index(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Học viên: có thể xem grades của chính họ (không cần capability)
        // Giáo viên: cần capability grades.manage để xem grades
        if (! $user->isStudent()) {
            if ($capabilityError = $this->requirePlanCapability('grades.manage')) {
                return $capabilityError;
            }
        }

        $filters = [
            'search' => $request->get('search'),
            'sort' => $request->get('sort', 'grade_date'),
            'order' => $request->get('order', 'desc'),
            'per_page' => $request->get('per_page', 15),
            'page' => $request->get('page', 1),
            'user_id' => $user->id,
        ];

        $cacheKey = CacheKeys::gradesList($user->id, $filters);
        $result = Cache::remember($cacheKey, CacheTtl::LIST, function () use ($request) {
            return $this->buildGradeListResponse($request);
        });

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('grades.manage');

        return response()->json([
            'success' => true,
            'data' => $result['data'],
            'meta' => $result['meta'],
            'permissions' => $permissions,
        ]);
    }

    public function show(Grade $grade): JsonResponse
    {
        // Defensive check: ensure grade was properly resolved
        if (! $grade || ! $grade->exists || ! $grade->id) {
            return $this->errorResponse('Không tìm thấy điểm số', null, 'NOT_FOUND', 404);
        }
        $cacheKey = CacheKeys::gradeDetail($grade->id);

        $grade = Cache::remember($cacheKey, CacheTtl::DETAIL, function () use ($grade) {
            return $grade->load(['class', 'student', 'tutor', 'gradeType', 'assignment']);
        });

        $user = $this->getAuthUser();

        // Học viên: có thể xem grades của chính họ (không cần capability)
        // Giáo viên: cần capability grades.manage để xem grades
        if ($user && ! $user->isStudent()) {
            if ($capabilityError = $this->requirePlanCapability('grades.manage')) {
                return $capabilityError;
            }
        }

        // Student: chỉ có thể xem điểm của chính họ
        if ($user && $user->isStudent()) {
            $student = $this->getCurrentStudent();
            if ($student && $grade->student_id === $student->id) {
                // Kiểm tra xem student có tham gia lớp học này không
                $isEnrolled = $this->isStudentEnrolledInClass($student, $grade->class_id);
                if ($isEnrolled) {
                    // Học viên có thể xem grade detail (không cần capability)
                    // Nhưng vẫn trả về permissions để frontend biết
                    $permissions = $this->buildViewManagePermissions('grades.manage');
                    $response = $this->successResponse(new GradeResource($grade));
                    $responseData = $response->getData(true);
                    $responseData['permissions'] = $permissions;

                    return response()->json($responseData, $response->getStatusCode());
                }
            }

            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Other roles: use canManageResource
        if (! $this->canManageResource($grade->class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('grades.manage');

        $response = $this->successResponse(new GradeResource($grade));
        $responseData = $response->getData(true);
        $responseData['permissions'] = $permissions;

        return response()->json($responseData, $response->getStatusCode());
    }

    public function store(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Check capability for grades management
        if ($capabilityError = $this->requirePlanCapability('grades.manage')) {
            return $capabilityError;
        }

        $validator = Validator::make($request->all(), $this->getValidationRules());

        if ($validator->fails()) {
            return $this->errorResponse('Dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        // Decode HashIDs to integer IDs before processing logic
        $idsToDecode = $request->only(['class_id', 'student_id', 'assignment_id', 'grade_type_id']);
        $this->decodeHashId($idsToDecode, 'class_id', ClassRoom::class);
        $this->decodeHashId($idsToDecode, 'student_id', Student::class);
        $this->decodeHashId($idsToDecode, 'assignment_id', Assignment::class);
        $this->decodeHashId($idsToDecode, 'grade_type_id', GradeType::class);
        $request->merge($idsToDecode);

        $class = ClassRoom::find($request->class_id);
        if (! $class || ! $this->canManageResource($class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Validate student belongs to class
        $student = Student::find($request->student_id);
        if (! $student || ! $student->classes()->where('class_id', $request->class_id)->exists()) {
            return $this->errorResponse('Học viên không thuộc lớp học này', null, 'VALIDATION_ERROR', 422);
        }

        // Validate assignment belongs to class if provided
        if ($request->has('assignment_id')) {
            $assignment = Assignment::find($request->assignment_id);
            if (! $assignment || $assignment->class_id !== $request->class_id) {
                return $this->errorResponse('Bài tập không thuộc lớp học này', null, 'VALIDATION_ERROR', 422);
            }
        }

        // Validate grade_type_id is accessible by user
        if ($request->has('grade_type_id')) {
            $gradeType = GradeType::find($request->grade_type_id);
            if (! $gradeType) {
                return $this->errorResponse('Không tìm thấy loại điểm', null, 'VALIDATION_ERROR', 422);
            }

            // Check access based on role
            $hasAccess = false;

            if ($user->hasRole('super_admin')) {
                $hasAccess = true;
            } elseif ($user->isTutor()) {
                // Tutor: global types (created_by = null) or types they created
                $hasAccess = $gradeType->created_by === null || $gradeType->created_by === $user->id;
            }

            if (! $hasAccess) {
                return $this->errorResponse('Không có quyền sử dụng loại điểm này', null, 'VALIDATION_ERROR', 422);
            }
        }

        $gradeData = $request->only([
            'class_id', 'student_id', 'grade_type_id', 'assignment_id',
            'title', 'score', 'max_score', 'grade_date', 'semester', 'comments',
        ]);

        $gradeData['tutor_id'] = $user->id;
        $gradeData['max_score'] = $gradeData['max_score'] ?? 100;

        $grade = Grade::create($gradeData);

        // Cache clearing handled by GradeObserver

        return $this->successResponse(
            new GradeResource($grade->load(['class', 'student', 'tutor'])),
            'Tạo điểm thành công',
            201
        );
    }

    public function update(Request $request, Grade $grade): JsonResponse
    {
        // Defensive check: ensure grade was properly resolved
        if (! $grade || ! $grade->exists || ! $grade->id) {
            return $this->errorResponse('Không tìm thấy điểm số', null, 'NOT_FOUND', 404);
        }

        if (! $this->canManageResource($grade->class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Check capability for grades management
        if ($capabilityError = $this->requirePlanCapability('grades.manage')) {
            return $capabilityError;
        }

        $validator = Validator::make($request->all(), $this->getValidationRules(true));

        if ($validator->fails()) {
            return $this->errorResponse('Dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        // Decode HashIDs to integer IDs before processing logic
        $idsToDecode = $request->only(['class_id', 'student_id', 'assignment_id', 'grade_type_id']);
        $this->decodeHashId($idsToDecode, 'class_id', ClassRoom::class);
        $this->decodeHashId($idsToDecode, 'student_id', Student::class);
        $this->decodeHashId($idsToDecode, 'assignment_id', Assignment::class);
        $this->decodeHashId($idsToDecode, 'grade_type_id', GradeType::class);
        $request->merge($idsToDecode);

        // Validate assignment belongs to class if provided
        if ($request->has('assignment_id')) {
            $assignment = Assignment::find($request->assignment_id);
            if (! $assignment || $assignment->class_id !== $grade->class_id) {
                return $this->errorResponse('Bài tập không thuộc lớp học này', null, 'VALIDATION_ERROR', 422);
            }
        }

        // Validate grade_type_id is accessible by user if provided
        if ($request->has('grade_type_id')) {
            $gradeType = GradeType::find($request->grade_type_id);
            if (! $gradeType) {
                return $this->errorResponse('Không tìm thấy loại điểm', null, 'VALIDATION_ERROR', 422);
            }
            $hasAccess = false;

            if ($user->hasRole('super_admin')) {
                $hasAccess = true;
            } elseif ($user->isTutor()) {
                // Tutor: global types (created_by = null) or types they created
                $hasAccess = $gradeType->created_by === null || $gradeType->created_by === $user->id;
            }

            if (! $hasAccess) {
                return $this->errorResponse('Không có quyền sử dụng loại điểm này', null, 'VALIDATION_ERROR', 422);
            }
        }

        $updateData = $request->only([
            'title', 'grade_type_id', 'assignment_id', 'score', 'max_score',
            'grade_date', 'semester', 'comments',
        ]);

        $grade->update($updateData);

        // Cache clearing handled by GradeObserver

        return $this->successResponse(
            new GradeResource($grade->fresh()),
            'Cập nhật điểm thành công'
        );
    }

    public function destroy(Grade $grade): JsonResponse
    {
        // Defensive check: ensure grade was properly resolved
        if (! $grade || ! $grade->exists || ! $grade->id) {
            return $this->errorResponse('Không tìm thấy điểm số', null, 'NOT_FOUND', 404);
        }

        $user = $this->getAuthUser();

        // Check capability for grades management
        if ($capabilityError = $this->requirePlanCapability('grades.manage')) {
            return $capabilityError;
        }

        $studentId = $grade->student_id;
        $classId = $grade->class_id;

        // Super Admin: can delete all
        if ($user->hasRole('super_admin')) {
            $grade->delete();
        }
        // Tutor: chỉ xóa được điểm do họ tạo (tutor_id = user->id)
        elseif ($user->isTutor()) {
            if ($grade->tutor_id !== $user->id) {
                return $this->errorResponse('Bạn chỉ có thể xóa điểm do chính bạn chấm', null, 'UNAUTHORIZED', 403);
            }
            if (! $this->canManageResource($grade->class)) {
                return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }
            $grade->delete();
        } else {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Cache clearing handled by GradeObserver

        return $this->successResponse(null, 'Xóa điểm thành công');
    }

    public function byClass(Request $request, ClassRoom $classRoom): JsonResponse
    {
        $class = $classRoom;
        $classId = $class->id;

        $user = $this->getAuthUser();

        // Student: chỉ có thể xem điểm của chính họ trong lớp họ tham gia
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

        // Build cache key with filters and pagination
        $filters = [
            'student_id' => $request->get('student_id'),
            'grade_type_id' => $request->get('grade_type_id'),
            'grade_date_from' => $request->get('grade_date_from'),
            'grade_date_to' => $request->get('grade_date_to'),
            'search' => $request->get('search'),
            'sort' => $request->get('sort', 'grade_date'),
            'order' => $request->get('order', 'desc'),
            'per_page' => $request->get('per_page', 15),
            'page' => $request->get('page', 1),
            'user_id' => $user ? $user->id : null,
        ];
        $cacheKey = CacheKeys::classGradesList($classId, $filters);
        $result = Cache::remember($cacheKey, CacheTtl::NESTED_DATA, function () use ($class, $request, $user, $classId, $filters) {
            return $this->buildClassGradesResponse($class, $request, $user, $classId, $filters);
        });

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('grades.manage');

        return response()->json([
            'success' => true,
            'data' => [
                'class' => $result['class'],
                'grades' => $result['grades'],
                'statistics' => $result['statistics'],
            ],
            'meta' => $result['meta'],
            'permissions' => $permissions,
        ]);
    }

    public function byStudent(Request $request, Student $student): JsonResponse
    {
        $studentId = $student->id;

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Student: chỉ có thể xem điểm của chính họ
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

            // Giáo viên cần capability students.manage để xem grades của học viên
            if ($capabilityError = $this->requirePlanCapability('students.manage')) {
                return $capabilityError;
            }
        } else {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Build cache key with filters and pagination
        $filters = [
            'class_id' => $request->get('class_id'),
            'grade_type_id' => $request->get('grade_type_id'),
            'grade_date_from' => $request->get('grade_date_from'),
            'grade_date_to' => $request->get('grade_date_to'),
            'search' => $request->get('search'),
            'sort' => $request->get('sort', 'grade_date'),
            'order' => $request->get('order', 'desc'),
            'per_page' => $request->get('per_page', 15),
            'page' => $request->get('page', 1),
        ];
        $cacheKey = CacheKeys::studentGradesList($studentId, $filters);
        $result = Cache::remember($cacheKey, CacheTtl::NESTED_DATA, function () use ($student, $request, $studentId, $filters) {
            return $this->buildStudentGradesResponse($student, $request, $studentId, $filters);
        });

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('grades.manage');

        return response()->json([
            'success' => true,
            'data' => [
                'grades' => $result['grades'],
                'student_id' => $result['student_id'],
                'student_name' => $result['student_name'],
                'statistics' => $result['statistics'],
            ],
            'meta' => $result['meta'],
            'permissions' => $permissions,
        ]);
    }

    /**
     * GET /classes/{class}/gradebook
     * The whole-class grid: rows = enrolled students, columns = grade types used in the class,
     * each cell = that student's grades of that type (+ their weighted per-type average), plus a
     * per-student weighted average across everything. Owning tutor / super admin only (fail closed 404).
     */
    public function gradebook(ClassRoom $classRoom): JsonResponse
    {
        if (! $classRoom || ! $classRoom->exists || ! $classRoom->id) {
            return $this->errorResponse('Không tìm thấy tài nguyên', null, 'NOT_FOUND', 404);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Whole-class view is tutor-OWNER/super-admin only (canManageResource would also let an
        // enrolled student through — they must use byClass, which shows only their own grades).
        $isOwner = $user->isSuperAdmin() || ($user->isTutor() && (int) $classRoom->tutor_id === (int) $user->id);
        if (! $isOwner) {
            return $this->errorResponse('Không tìm thấy tài nguyên', null, 'NOT_FOUND', 404);
        }

        if ($capabilityError = $this->requirePlanCapability('grades.manage')) {
            return $capabilityError;
        }

        $students = $classRoom->students()->orderBy('students.name')->get();

        $grades = Grade::where('class_id', $classRoom->id)
            ->with('gradeType')
            ->orderBy('grade_date')
            ->get();

        // Columns = grade types actually used in this class (stable order).
        $columns = $grades->pluck('gradeType')->filter()->unique('id')
            ->sortBy([['order', 'asc'], ['name', 'asc']])
            ->values()
            ->map(fn (GradeType $t) => [
                '_id' => $t->hash_id,
                'name' => $t->name,
                'code' => $t->code,
                'weight' => (float) $t->weight,
            ]);

        $gradesByStudent = $grades->groupBy('student_id');

        $rows = $students->map(function (Student $student) use ($gradesByStudent, $classRoom) {
            $studentGrades = $gradesByStudent->get($student->id, collect());

            $cells = [];
            foreach ($studentGrades->groupBy('grade_type_id') as $typeId => $typeGrades) {
                $key = $typeId ? GradeType::encodeId($typeId) : 'none';
                $cells[$key] = [
                    'average_percentage' => Grade::weightedAveragePercentage(
                        Grade::whereIn('grades.id', $typeGrades->pluck('id'))
                    ),
                    'grades' => $typeGrades->map(fn (Grade $g) => [
                        '_id' => $g->hash_id,
                        'title' => $g->title,
                        'score' => (float) $g->score,
                        'max_score' => (int) $g->max_score,
                        'percentage' => $g->getPercentage(),
                    ])->values(),
                ];
            }

            return [
                '_id' => $student->hash_id,
                'name' => $student->name,
                'student_code' => $student->student_code,
                'cells' => $cells,
                'weighted_average_percentage' => Grade::weightedAveragePercentage(
                    Grade::where('class_id', $classRoom->id)->where('student_id', $student->id)
                ),
            ];
        });

        return $this->successResponse([
            'class' => new ClassRoomResource($classRoom),
            'grade_types' => $columns,
            'students' => $rows,
        ], 'Lấy sổ điểm thành công');
    }

    /**
     * POST /grades/bulk
     * Upsert an array of grades in one shot (one grade per class+student+grade_type cell), replacing
     * the old one-at-a-time entry. Every item is validated up front (score <= max, student enrolled,
     * grade type accessible); a single bad item aborts the whole batch (no partial writes).
     */
    public function bulkStore(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        if ($capabilityError = $this->requirePlanCapability('grades.manage')) {
            return $capabilityError;
        }

        $validator = Validator::make($request->all(), [
            'class_id' => ['required', new ExistsHashId(ClassRoom::class)],
            'grades' => 'required|array|min:1',
            'grades.*.student_id' => ['required', new ExistsHashId(Student::class)],
            'grades.*.grade_type_id' => ['nullable', new ExistsHashId(GradeType::class)],
            'grades.*.score' => 'required|numeric|min:0',
            'grades.*.max_score' => 'nullable|numeric|min:1',
            'grades.*.title' => 'nullable|string|max:255',
            'grades.*.comment' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        // Resolve + authorize the class first (fail closed — never confirm existence to a non-owner).
        $classData = ['class_id' => $request->input('class_id')];
        $this->decodeHashId($classData, 'class_id', ClassRoom::class);
        $class = ClassRoom::find($classData['class_id']);
        // Owner tutor / super admin only. canManageResource would also pass an enrolled student.
        $isOwner = $class && ($user->isSuperAdmin() || ($user->isTutor() && (int) $class->tutor_id === (int) $user->id));
        if (! $isOwner) {
            return $this->errorResponse('Không tìm thấy tài nguyên', null, 'NOT_FOUND', 404);
        }

        $enrolledStudentIds = $class->students()->pluck('students.id')->all();

        // First pass: decode + validate every item. Any failure aborts the whole batch.
        $items = [];
        foreach ($request->input('grades') as $index => $raw) {
            $studentData = ['student_id' => $raw['student_id']];
            $this->decodeHashId($studentData, 'student_id', Student::class);
            $studentId = $studentData['student_id'];

            if (! $studentId || ! in_array($studentId, $enrolledStudentIds)) {
                return $this->errorResponse(
                    "Học viên ở dòng {$index} không thuộc lớp học này",
                    ['index' => $index],
                    'VALIDATION_ERROR',
                    422
                );
            }

            $gradeType = null;
            $gradeTypeId = null;
            if (! empty($raw['grade_type_id'])) {
                $gtData = ['grade_type_id' => $raw['grade_type_id']];
                $this->decodeHashId($gtData, 'grade_type_id', GradeType::class);
                $gradeTypeId = $gtData['grade_type_id'];
                $gradeType = GradeType::find($gradeTypeId);

                $hasAccess = $user->hasRole('super_admin')
                    || ($user->isTutor() && $gradeType
                        && ($gradeType->created_by === null || $gradeType->created_by === $user->id));

                if (! $gradeType || ! $hasAccess) {
                    return $this->errorResponse(
                        "Không có quyền dùng loại điểm ở dòng {$index}",
                        ['index' => $index],
                        'VALIDATION_ERROR',
                        422
                    );
                }
            }

            $maxScore = isset($raw['max_score']) ? (float) $raw['max_score'] : 100;
            $score = (float) $raw['score'];
            if ($score > $maxScore) {
                return $this->errorResponse(
                    "Điểm ở dòng {$index} vượt quá điểm tối đa ({$maxScore})",
                    ['index' => $index],
                    'VALIDATION_ERROR',
                    422
                );
            }

            $items[] = [
                'student_id' => $studentId,
                'grade_type_id' => $gradeTypeId,
                'score' => $score,
                'max_score' => $maxScore,
                'title' => $raw['title'] ?? ($gradeType?->name ?? 'Điểm'),
                'comment' => $raw['comment'] ?? null,
            ];
        }

        // Second pass: upsert atomically. Manual cells never clobber submission-linked grades.
        $created = 0;
        $updated = 0;
        $result = [];

        DB::transaction(function () use ($items, $class, &$created, &$updated, &$result) {
            foreach ($items as $item) {
                $grade = Grade::where('class_id', $class->id)
                    ->where('student_id', $item['student_id'])
                    ->where('grade_type_id', $item['grade_type_id'])
                    ->whereNull('submission_id')
                    ->first();

                $payload = [
                    'title' => $item['title'],
                    'score' => $item['score'],
                    'max_score' => $item['max_score'],
                    'comments' => $item['comment'],
                    'tutor_id' => $class->tutor_id,
                    'grade_date' => now()->toDateString(),
                ];

                if ($grade) {
                    $grade->update($payload);
                    $updated++;
                } else {
                    $grade = Grade::create(array_merge($payload, [
                        'class_id' => $class->id,
                        'student_id' => $item['student_id'],
                        'grade_type_id' => $item['grade_type_id'],
                    ]));
                    $created++;
                }

                $result[] = new GradeResource($grade);
            }
        });

        return $this->successResponse([
            'class_id' => $class->hash_id,
            'total' => count($items),
            'created' => $created,
            'updated' => $updated,
            'grades' => $result,
        ], 'Nhập điểm hàng loạt thành công');
    }

    /**
     * GET /classes/{class}/students/{student}/report-card
     * Per-student report card data (for printing): grades grouped by type (+ per-type weighted average),
     * the overall weighted average, and an attendance summary. Fails closed for anyone who can't view
     * both the class and the student.
     */
    public function reportCard(ClassRoom $classRoom, Student $student): JsonResponse
    {
        if (! $classRoom || ! $classRoom->exists || ! $student || ! $student->exists) {
            return $this->errorResponse('Không tìm thấy tài nguyên', null, 'NOT_FOUND', 404);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Must be allowed to view the class AND the student.
        if ($denied = $this->guardClassAccess($classRoom)) {
            return $denied;
        }
        if ($denied = $this->guardStudentAccess($student)) {
            return $denied;
        }

        // Student must actually be enrolled in this class.
        if (! $classRoom->students()->where('students.id', $student->id)->exists()) {
            return $this->errorResponse('Không tìm thấy tài nguyên', null, 'NOT_FOUND', 404);
        }

        $grades = Grade::where('class_id', $classRoom->id)
            ->where('student_id', $student->id)
            ->with('gradeType')
            ->orderBy('grade_date')
            ->get();

        $byType = $grades->groupBy('grade_type_id')->map(function ($typeGrades) {
            $type = $typeGrades->first()->gradeType;

            return [
                '_id' => $type ? $type->hash_id : null,
                'name' => $type->name ?? 'Khác',
                'weight' => $type ? (float) $type->weight : 1.0,
                'average_percentage' => Grade::weightedAveragePercentage(
                    Grade::whereIn('grades.id', $typeGrades->pluck('id'))
                ),
                'grades' => $typeGrades->map(fn (Grade $g) => [
                    '_id' => $g->hash_id,
                    'title' => $g->title,
                    'score' => (float) $g->score,
                    'max_score' => (int) $g->max_score,
                    'percentage' => $g->getPercentage(),
                    'comments' => $g->comments,
                    'grade_date' => $g->grade_date?->toDateString(),
                ])->values(),
            ];
        })->values();

        $weightedAverage = Grade::weightedAveragePercentage(
            Grade::where('class_id', $classRoom->id)->where('student_id', $student->id)
        );

        // Attendance summary for this student in this class.
        $attendance = Attendance::where('class_id', $classRoom->id)
            ->where('student_id', $student->id)
            ->get();
        $attTotal = $attendance->count();
        $presentish = $attendance->whereIn('status', ['present', 'late'])->count();
        $attendanceRate = $attTotal > 0 ? round($presentish / $attTotal * 100, 2) : 0.0;

        return $this->successResponse([
            'class' => new ClassRoomResource($classRoom),
            'student' => [
                '_id' => $student->hash_id,
                'name' => $student->name,
                'student_code' => $student->student_code,
            ],
            'grade_types' => $byType,
            'weighted_average_percentage' => $weightedAverage,
            'attendance' => [
                'total' => $attTotal,
                'present' => $attendance->where('status', 'present')->count(),
                'late' => $attendance->where('status', 'late')->count(),
                'absent' => $attendance->where('status', 'absent')->count(),
                'excused' => $attendance->where('status', 'excused')->count(),
                'attendance_rate' => $attendanceRate,
            ],
        ], 'Lấy học bạ thành công');
    }

    /**
     * Build response for grade index.
     */
    private function buildGradeListResponse(Request $request): array
    {
        $query = Grade::query()->with(['class', 'student', 'tutor', 'gradeType', 'assignment']);
        $query = $this->applyDataIsolation($query, 'grades');
        $query = $this->applyFilters($query, $request);

        $perPage = min((int) $request->get('per_page', 15), 100);
        $page = (int) $request->get('page', 1);
        $grades = $query->paginate($perPage, ['*'], 'page', $page);

        // Calculate statistics (on all data, not filtered/paginated)
        $statsQuery = Grade::query();
        $statsQuery = $this->applyDataIsolation($statsQuery, 'grades');

        $statistics = [
            'total' => $statsQuery->count(),
            // Weighted by GradeType.weight (defaults to 1). See Grade::weightedAveragePercentage().
            'average_percentage' => Grade::weightedAveragePercentage(clone $statsQuery),
            'unique_students' => (clone $statsQuery)->distinct('student_id')->count('student_id'),
            'unique_classes' => (clone $statsQuery)->distinct('class_id')->count('class_id'),
        ];

        return [
            'data' => GradeResource::collection($grades),
            'meta' => [
                'current_page' => $grades->currentPage(),
                'per_page' => $grades->perPage(),
                'total' => $grades->total(),
                'last_page' => $grades->lastPage(),
                'statistics' => $statistics,
            ],
        ];
    }

    /**
     * Build response for class grades endpoint.
     */
    private function buildClassGradesResponse(ClassRoom $class, Request $request, $user, int $classId, array $filters): array
    {
        $query = Grade::where('class_id', $classId)
            ->with(['student', 'tutor', 'gradeType', 'assignment']);

        if ($user && $user->isStudent()) {
            $student = $this->getCurrentStudent();
            if ($student) {
                $query->where('student_id', $student->id);
            }
        }

        if ($request->has('student_id')) {
            $query->where('student_id', $request->student_id);
        }

        if ($request->has('grade_type_id')) {
            $this->decodeHashId($request, 'grade_type_id', GradeType::class);
            $query->where('grade_type_id', $request->grade_type_id);
        }

        if ($request->has('grade_date_from')) {
            $query->whereDate('grade_date', '>=', $request->grade_date_from);
        }

        if ($request->has('grade_date_to')) {
            $query->whereDate('grade_date', '<=', $request->grade_date_to);
        }

        if ($request->has('search')) {
            $query->whereHas('student', function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                    ->orWhere('email', 'like', "%{$request->search}%")
                    ->orWhere('student_code', 'like', "%{$request->search}%");
            });
        }

        $sortable = ['grade_date', 'score', 'max_score', 'title', 'semester', 'created_at', 'updated_at'];
        $sortBy = $request->get('sort', 'grade_date');
        if (! in_array($sortBy, $sortable, true)) {
            $sortBy = 'grade_date';
        }
        $sortOrder = strtolower($request->get('order', 'desc')) === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sortBy, $sortOrder);

        $perPage = (int) min($filters['per_page'] ?? 15, 100);
        $page = (int) ($filters['page'] ?? 1);
        $grades = $query->paginate($perPage, ['*'], 'page', $page);

        $totalCount = Grade::where('class_id', $classId)->count();
        $averageScore = Grade::where('class_id', $classId)->avg('score');
        $maxScore = Grade::where('class_id', $classId)->max('score');
        $minScore = Grade::where('class_id', $classId)->min('score');
        // Weighted (by GradeType.weight) percentage — the performance-meaningful average.
        $weightedAveragePercentage = Grade::weightedAveragePercentage(Grade::where('class_id', $classId));

        return [
            'class' => new ClassRoomResource($class),
            'grades' => GradeResource::collection($grades),
            'statistics' => [
                'total_count' => $totalCount,
                'average_score' => $averageScore,
                'average_score_formatted' => $this->formatDecimal($averageScore),
                'weighted_average_percentage' => $weightedAveragePercentage,
                'max_score' => $maxScore,
                'max_score_formatted' => $this->formatDecimal($maxScore),
                'min_score' => $minScore,
                'min_score_formatted' => $this->formatDecimal($minScore),
            ],
            'meta' => [
                'current_page' => $grades->currentPage(),
                'per_page' => $grades->perPage(),
                'total' => $grades->total(),
                'last_page' => $grades->lastPage(),
            ],
        ];
    }

    /**
     * Build response for student grades endpoint.
     */
    private function buildStudentGradesResponse(Student $student, Request $request, int $studentId, array $filters): array
    {
        $query = Grade::where('student_id', $studentId)
            ->with(['class', 'tutor', 'gradeType', 'assignment']);

        // Shared-student safety: a tutor may only see grades from classes they own.
        // Org owner/manager instead see every grade of the student within their org (design §4.3).
        $currentUser = $this->getAuthUser();
        if ($currentUser && $currentUser->isOrgViewerAll()) {
            $orgId = $currentUser->currentOrganization()?->id;
            $query->whereHas('class', fn ($q) => $q->where('organization_id', $orgId));
        } elseif ($currentUser && $currentUser->isTutor()) {
            $query->whereHas('class', fn ($q) => $q->where('tutor_id', $currentUser->id));
        }

        if ($request->has('class_id')) {
            $query->where('class_id', $request->class_id);
        }

        if ($request->has('grade_type_id')) {
            $this->decodeHashId($request, 'grade_type_id', GradeType::class);
            $query->where('grade_type_id', $request->grade_type_id);
        }

        if ($request->has('grade_date_from')) {
            $query->whereDate('grade_date', '>=', $request->grade_date_from);
        }

        if ($request->has('grade_date_to')) {
            $query->whereDate('grade_date', '<=', $request->grade_date_to);
        }

        if ($request->has('search')) {
            $query->whereHas('class', function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                    ->orWhere('subject', 'like', "%{$request->search}%");
            });
        }

        $sortable = ['grade_date', 'score', 'max_score', 'title', 'semester', 'created_at', 'updated_at'];
        $sortBy = $request->get('sort', 'grade_date');
        if (! in_array($sortBy, $sortable, true)) {
            $sortBy = 'grade_date';
        }
        $sortOrder = strtolower($request->get('order', 'desc')) === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sortBy, $sortOrder);

        $perPage = (int) min($filters['per_page'] ?? 15, 100);
        $page = (int) ($filters['page'] ?? 1);
        $grades = $query->paginate($perPage, ['*'], 'page', $page);

        // Stats must use the same scope as the list, or they leak cross-tutor counts/averages.
        $statsBase = fn () => Grade::where('student_id', $studentId)
            ->when($currentUser && $currentUser->isOrgViewerAll(), fn ($q) => $q->whereHas('class', fn ($c) => $c->where('organization_id', $currentUser->currentOrganization()?->id)))
            ->when($currentUser && ! $currentUser->isOrgViewerAll() && $currentUser->isTutor(), fn ($q) => $q->whereHas('class', fn ($c) => $c->where('tutor_id', $currentUser->id)));
        $totalCount = $statsBase()->count();
        $averageScore = $statsBase()->avg('score');
        $maxScore = $statsBase()->max('score');
        $minScore = $statsBase()->min('score');

        return [
            'grades' => GradeResource::collection($grades),
            'student_id' => Student::encodeId($student->id),
            'student_name' => $student->name,
            'statistics' => [
                'total_count' => $totalCount,
                'average_score' => $averageScore,
                'average_score_formatted' => $this->formatDecimal($averageScore),
                'max_score' => $maxScore,
                'max_score_formatted' => $this->formatDecimal($maxScore),
                'min_score' => $minScore,
                'min_score_formatted' => $this->formatDecimal($minScore),
            ],
            'meta' => [
                'current_page' => $grades->currentPage(),
                'per_page' => $grades->perPage(),
                'total' => $grades->total(),
                'last_page' => $grades->lastPage(),
            ],
        ];
    }

    /**
     * Import grades from CSV/XLSX file.
     *
     * POST /api/v1/grades/import
     *
     * Body:
     * - file: CSV/XLSX file (required)
     * - override_existing: boolean (optional, default: false)
     */
    public function import(ImportGradesRequest $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Student cannot import
        if ($user->isStudent()) {
            return $this->errorResponse('Không có quyền import điểm', null, 'UNAUTHORIZED', 403);
        }

        // Check capability for data import
        if ($capabilityError = $this->requirePlanCapability('data.import')) {
            return $capabilityError;
        }

        // Also check grades.manage to ensure user can manage grades
        if ($capabilityError = $this->requirePlanCapability('grades.manage')) {
            return $capabilityError;
        }

        $file = $request->file('file');
        $overrideExisting = $request->boolean('override_existing', false);

        $job = DataJobService::start('import', 'grades', $user, [
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

        // Import grades
        $result = ImportGradeAction::execute(
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
