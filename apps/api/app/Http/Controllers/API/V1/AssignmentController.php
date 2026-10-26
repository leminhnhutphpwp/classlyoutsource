<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Resources\AssignmentResource;
use App\Http\Resources\ClassRoomResource;
use App\Http\Resources\SubmissionResource;
use App\Models\Assignment;
use App\Models\AssignmentType;
use App\Models\ClassRoom;
use App\Models\LearningResource;
use App\Rules\ExistsHashId;
use App\Services\AssignmentQuizService;
use App\Services\Assignments\AssignmentWorkflowService;
use App\Support\CacheKeys;
use App\Support\CacheTtl;
use App\Traits\DecodesHashIds;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Validator;

class AssignmentController extends BaseController
{
    use DecodesHashIds;

    /**
     * Get validation rules for assignment.
     */
    private function getValidationRules(Request $request, bool $isUpdate = false, ?Assignment $assignment = null): array
    {
        $rules = [
            'assignment_type_id' => array_merge(
                $isUpdate ? ['sometimes'] : [],
                ['required', new ExistsHashId(AssignmentType::class)]
            ),
            'title' => ($isUpdate ? 'sometimes|' : '').'required|string|max:255',
            'description' => 'nullable|string',
            'instructions' => 'nullable|string',
            'max_score' => ($isUpdate ? 'sometimes|' : '').'required|integer|min:0',
            'assigned_date' => ($isUpdate ? 'sometimes|' : '').'required|date',
            'due_date' => ($isUpdate ? 'sometimes|' : '').'required|date|after_or_equal:assigned_date',
            'deadline' => 'nullable|date',
            'allow_late_submission' => 'nullable|boolean',
            'allowed_submission_types' => 'nullable|array|min:1',
            'allowed_submission_types.*' => 'in:text,file,document,image,video,audio,link,quiz',
            'status' => ($isUpdate ? 'sometimes|' : '').'required|in:draft,published,closed',
            'learning_resources' => 'nullable|array',
            'learning_resources.*' => new ExistsHashId(LearningResource::class),
            'mode' => 'nullable|in:standard,quiz',
            'quiz_settings' => 'nullable|array',
        ];

        if (! $isUpdate) {
            $rules['class_id'] = ['required', new ExistsHashId(ClassRoom::class)];
        }

        $modeRules = $this->assignmentWorkflow()
            ->rulesForRequest($request, $isUpdate, $assignment);

        return array_merge($rules, $modeRules);
    }

    /**
     * Normalize data from request (handle array of objects for relations)
     */
    private function normalizeRequestData(Request $request): void
    {
        if ($request->has('learning_resources') && is_array($request->learning_resources)) {
            $resources = $request->learning_resources;
            // Check if it's an array of objects (arrays) with _id
            if (! empty($resources) && isset($resources[0]) && is_array($resources[0])) {
                $ids = array_map(function ($item) {
                    return $item['_id'] ?? null;
                }, $resources);

                // Filter out nulls and re-index
                $request->merge(['learning_resources' => array_values(array_filter($ids))]);
            }
        }
    }

    /**
     * Apply filters (class_id, status, search, sort) to query.
     */
    private function applyFilters($query, Request $request)
    {
        $user = $this->getAuthUser();

        if ($request->has('class_id')) {
            $query->where('class_id', $request->class_id);
        }

        // Học viên: chỉ được filter status = 'published' hoặc 'closed', status 'draft' trả về empty
        if ($request->has('status')) {
            if ($user && $user->isStudent()) {
                // Học viên chỉ được filter status = 'published' hoặc 'closed'
                if (in_array($request->status, ['published', 'closed'])) {
                    $query->where('status', $request->status);
                } else {
                    // Nếu học viên filter status = 'draft', trả về empty result
                    $query->whereRaw('1 = 0');
                }
            } else {
                // Gia sư/admin có thể filter theo bất kỳ status nào
                $query->where('status', $request->status);
            }
        }

        // Search by title, description, or class name
        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhereHas('class', function ($classQuery) use ($search) {
                        $classQuery->where('name', 'like', "%{$search}%");
                    });
            });
        }

        // Sort
        $sortBy = $request->get('sort', 'created_at');
        $sortOrder = $request->get('order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        return $query;
    }

    public function index(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Học viên: có thể xem assignments của chính họ (không cần capability)
        // Gia sư: cần capability assignments.manage để xem assignments
        if (! $user->isStudent()) {
            if ($capabilityError = $this->requirePlanCapability('assignments.manage')) {
                return $capabilityError;
            }
        }

        // Cache result
        $filters = $request->all();
        $cacheKey = CacheKeys::assignmentList($user->id, $filters);

        $result = Cache::remember($cacheKey, CacheTtl::LIST, function () use ($request) {
            return $this->buildAssignmentListResponse($request);
        });

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewAndManagePermissions('assignments.manage', true);

        return response()->json([
            'success' => true,
            'data' => $result['data'],
            'meta' => $result['meta'],
            'permissions' => $permissions,
        ]);
    }

    public function show(Assignment $assignment): JsonResponse
    {
        // Defensive check: ensure assignment was properly resolved
        if (! $assignment || ! $assignment->exists || ! $assignment->id) {
            return $this->errorResponse('Không tìm thấy bài tập', null, 'NOT_FOUND', 404);
        }
        $cacheKey = CacheKeys::assignmentDetail($assignment->id);

        $assignment = Cache::remember($cacheKey, CacheTtl::DETAIL, function () use ($assignment) {
            return $assignment->load(['class', 'tutor', 'assignmentType', 'learningResources', 'submissions', 'questions.options', 'sections'])
                ->loadCount([
                    'submissions',
                    'submissions as graded_submissions_count' => function ($query) {
                        $query->where('status', 'graded');
                    },
                    'submissions as pending_submissions_count' => function ($query) {
                        $query->where('status', 'pending');
                    },
                ]);
        });

        $user = $this->getAuthUser();

        // Student: chỉ cần kiểm tra xem họ có tham gia lớp học này không VÀ chỉ xem được published/closed assignments (không cho xem draft)
        if ($user && $user->isStudent()) {
            // Học viên chỉ được xem assignments đã published hoặc closed (không cho xem draft)
            if ($assignment->status === 'draft') {
                return $this->errorResponse('Bài tập chưa được công bố', null, 'UNAUTHORIZED', 403);
            }

            $student = $this->getCurrentStudent();
            if ($student) {
                $isEnrolled = $this->isStudentEnrolledInClass($student, $assignment->class_id);
                if ($isEnrolled) {
                    // Học viên có thể xem assignment detail (không cần capability)
                    // Nhưng vẫn trả về permissions để frontend biết
                    $permissions = $this->buildViewManagePermissions('assignments.manage');
                    $response = $this->successResponse(new AssignmentResource($assignment));
                    $responseData = $response->getData(true);
                    $responseData['permissions'] = $permissions;

                    return response()->json($responseData, $response->getStatusCode());
                }
            }

            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Other roles: use canManageResource
        if (! $this->canManageResource($assignment->class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Gia sư cần capability assignments.manage để xem assignments
        if ($capabilityError = $this->requirePlanCapability('assignments.manage')) {
            return $capabilityError;
        }

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewAndManagePermissions('assignments.manage', true);

        $response = $this->successResponse(new AssignmentResource($assignment));
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

        // Check capability for assignments management
        if ($capabilityError = $this->requirePlanCapability('assignments.manage')) {
            return $capabilityError;
        }

        $this->normalizeRequestData($request);
        $validator = Validator::make($request->all(), $this->getValidationRules($request));

        if ($validator->fails()) {
            return $this->errorResponse('Dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        // Decode HashIDs
        $this->decodeHashId($request, 'class_id', ClassRoom::class);
        $this->decodeHashId($request, 'assignment_type_id', AssignmentType::class);
        $this->decodeHashIdArray($request, 'learning_resources', LearningResource::class);

        $class = ClassRoom::find($request->class_id);
        if (! $class || ! $this->canManageResource($class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Validate learning resources belong to user's accessible resources
        if ($request->has('learning_resources') && ! empty($request->learning_resources)) {
            $accessibleResources = $this->getAccessibleLearningResources($user);
            $requestedResources = $request->learning_resources;

            $invalidResources = array_diff($requestedResources, $accessibleResources->pluck('id')->toArray());
            if (! empty($invalidResources)) {
                return $this->errorResponse(
                    'Một số tài liệu không hợp lệ hoặc bạn không có quyền truy cập',
                    ['learning_resources' => ['invalid_ids' => array_values($invalidResources)]],
                    'VALIDATION_ERROR',
                    422
                );
            }
        }

        $assignmentData = $request->only([
            'class_id', 'assignment_type_id', 'title', 'description', 'instructions',
            'max_score', 'assigned_date', 'due_date', 'deadline', 'allow_late_submission',
            'allowed_submission_types', 'status',
        ]);

        $assignmentData['tutor_id'] = $user->id;
        $assignmentData['max_score'] = $assignmentData['max_score'] ?? 100;
        $assignmentData['status'] = $assignmentData['status'] ?? 'draft';
        $assignmentData = $this->assignmentWorkflow()->prepareAssignmentData($request, $assignmentData);

        $assignment = Assignment::create($assignmentData);
        $this->assignmentWorkflow()->afterSave($assignment, $request);

        // Attach learning resources with order
        if ($request->has('learning_resources') && ! empty($request->learning_resources)) {
            $syncData = [];
            foreach ($request->learning_resources as $index => $id) {
                $resource = LearningResource::find($id);
                if ($resource) {
                    $syncData[$resource->id] = ['order' => $index];
                }
            }
            $assignment->learningResources()->sync($syncData);
        }

        $assignment->load(['class', 'tutor', 'assignmentType', 'learningResources', 'questions.options']);

        return $this->successResponse(
            new AssignmentResource($assignment),
            'Tạo bài tập thành công',
            201
        );
    }

    public function update(Request $request, Assignment $assignment): JsonResponse
    {
        // Defensive check: ensure assignment was properly resolved
        if (! $assignment || ! $assignment->exists || ! $assignment->id) {
            return $this->errorResponse('Không tìm thấy bài tập', null, 'NOT_FOUND', 404);
        }

        if (! $this->canManageResource($assignment->class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Check capability for assignments management
        if ($capabilityError = $this->requirePlanCapability('assignments.manage')) {
            return $capabilityError;
        }

        $this->normalizeRequestData($request);
        $validator = Validator::make($request->all(), $this->getValidationRules($request, true, $assignment));

        // Validate due_date if assigned_date is provided
        if ($request->has('assigned_date') || $request->has('due_date')) {
            $assignedDate = $request->has('assigned_date')
                ? $request->assigned_date
                : $assignment->assigned_date;
            $dueDate = $request->has('due_date')
                ? $request->due_date
                : $assignment->due_date;

            if ($dueDate && $assignedDate && $dueDate < $assignedDate) {
                return $this->errorResponse(
                    'Hạn nộp phải sau hoặc bằng ngày giao bài',
                    ['due_date' => ['Hạn nộp phải sau hoặc bằng ngày giao bài']],
                    'VALIDATION_ERROR',
                    422
                );
            }
        }

        if ($validator->fails()) {
            return $this->errorResponse('Dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        // Decode Input
        $this->decodeHashId($request, 'assignment_type_id', AssignmentType::class);
        $this->decodeHashIdArray($request, 'learning_resources', LearningResource::class);

        // Validate learning resources if provided
        if ($request->has('learning_resources')) {
            $accessibleResources = $this->getAccessibleLearningResources($user);

            if (! empty($request->learning_resources)) {
                $requestedResources = $request->learning_resources;
                $invalidResources = array_diff($requestedResources, $accessibleResources->pluck('id')->toArray());

                if (! empty($invalidResources)) {
                    return $this->errorResponse(
                        'Một số tài liệu không hợp lệ hoặc bạn không có quyền truy cập',
                        ['learning_resources' => ['invalid_ids' => array_values($invalidResources)]],
                        'VALIDATION_ERROR',
                        422
                    );
                }
            }
        }

        $payload = $request->only([
            'assignment_type_id', 'title', 'description', 'instructions',
            'max_score', 'assigned_date', 'due_date', 'deadline', 'allow_late_submission',
            'allowed_submission_types', 'status', 'mode', 'quiz_settings',
        ]);

        $payload = $this->assignmentWorkflow()
            ->prepareAssignmentData($request, $payload, true, $assignment);

        $assignment->update($payload);
        $this->assignmentWorkflow()->afterSave($assignment, $request, true);

        // Sync learning resources if provided
        if ($request->has('learning_resources')) {
            if (empty($request->learning_resources)) {
                // Remove all if empty array
                $assignment->learningResources()->detach();
            } else {
                // Sync with order
                $syncData = [];
                foreach ($request->learning_resources as $index => $id) {
                    $resource = LearningResource::find($id);
                    if ($resource) {
                        $syncData[$resource->id] = ['order' => $index];
                    }
                }
                $assignment->learningResources()->sync($syncData);
            }

            // Touch assignment to trigger 'updated' event and clear cache
            // This is necessary because sync() only modifies pivot table, not the assignment itself
            $assignment->touch();
        }

        // Cache clearing handled by AssignmentObserver

        $assignment->load(['class', 'tutor', 'assignmentType', 'learningResources', 'questions.options']);

        return $this->successResponse(
            new AssignmentResource($assignment),
            'Cập nhật bài tập thành công'
        );
    }

    public function destroy(Assignment $assignment): JsonResponse
    {
        // Defensive check: ensure assignment was properly resolved
        if (! $assignment || ! $assignment->exists || ! $assignment->id) {
            return $this->errorResponse('Không tìm thấy bài tập', null, 'NOT_FOUND', 404);
        }

        if (! $this->canManageResource($assignment->class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Check capability for assignments management
        if ($capabilityError = $this->requirePlanCapability('assignments.manage')) {
            return $capabilityError;
        }

        $classId = $assignment->class_id;
        $userId = auth('api')->id();
        $assignment->delete();

        // Cache clearing handled by AssignmentObserver

        return $this->successResponse(null, 'Xóa bài tập thành công');
    }

    public function submissions(Request $request, Assignment $assignment): JsonResponse
    {

        $user = $this->getAuthUser();

        // Student: chỉ có thể xem submissions của chính họ
        if ($user->isStudent()) {
            $student = $this->getCurrentStudent();
            if ($student) {
                $isEnrolled = $this->isStudentEnrolledInClass($student, $assignment->class_id);
                if (! $isEnrolled) {
                    return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
                }
            } else {
                return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }
        } else {
            // Other roles: use canManageResource
            if (! $this->canManageResource($assignment->class)) {
                return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }

            // Gia sư cần capability assignments.manage để xem submissions
            if ($capabilityError = $this->requirePlanCapability('assignments.manage')) {
                return $capabilityError;
            }
        }

        $result = $this->buildAssignmentSubmissionsResponse($assignment, $request, $user);

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewAndManagePermissions('assignments.manage', true);

        return response()->json([
            'success' => true,
            'data' => [
                'assignment' => $result['assignment'],
                'submissions' => $result['submissions'],
                'statistics' => $result['statistics'],
            ],
            'meta' => $result['meta'],
            'permissions' => $permissions,
        ]);
    }

    /**
     * Build response for assignment index.
     */
    private function buildAssignmentListResponse(Request $request): array
    {
        $user = $this->getAuthUser();

        $query = Assignment::query()
            ->with(['class', 'tutor', 'assignmentType', 'learningResources'])
            ->withCount('questions as questions_count')
            ->withCount([
                'submissions',
                'submissions as graded_submissions_count' => function ($query) {
                    $query->where('status', 'graded');
                },
                'submissions as pending_submissions_count' => function ($query) {
                    $query->where('status', 'pending');
                },
            ]);

        $query = $this->applyDataIsolation($query, 'assignments');

        // Học viên: tự động loại bỏ các bài tập draft (chỉ cho xem published và closed)
        if ($user && $user->isStudent()) {
            $query->whereIn('status', ['published', 'closed']);
        }

        $query = $this->applyFilters($query, $request);

        $perPage = min((int) $request->get('per_page', 15), 100);
        $page = (int) $request->get('page', 1);
        $assignments = $query->paginate($perPage, ['*'], 'page', $page);

        // Calculate statistics (on all data, not filtered/paginated)
        $statsQuery = Assignment::query();
        $statsQuery = $this->applyDataIsolation($statsQuery, 'assignments');

        // Học viên: chỉ tính statistics cho published và closed
        if ($user && $user->isStudent()) {
            $statsQuery->whereIn('status', ['published', 'closed']);
        }

        $statistics = [
            'total' => $statsQuery->count(),
            'published' => (clone $statsQuery)->where('status', 'published')->count(),
            'draft' => $user && ! $user->isStudent()
                ? (clone $statsQuery)->where('status', 'draft')->count()
                : 0, // Học viên không thấy draft
            'closed' => (clone $statsQuery)->where('status', 'closed')->count(),
        ];

        return [
            'data' => AssignmentResource::collection($assignments),
            'meta' => [
                'current_page' => $assignments->currentPage(),
                'per_page' => $assignments->perPage(),
                'total' => $assignments->total(),
                'last_page' => $assignments->lastPage(),
                'statistics' => $statistics,
            ],
        ];
    }

    /**
     * Build response for assignments filtered by class.
     */
    private function buildClassAssignmentsResponse(ClassRoom $class, Request $request, int $classId, $user = null): array
    {
        $query = Assignment::where('class_id', $classId)
            ->with(['tutor', 'assignmentType', 'learningResources'])
            ->withCount('questions as questions_count')
            ->withCount([
                'submissions',
                'submissions as graded_submissions_count' => function ($query) {
                    $query->where('status', 'graded');
                },
                'submissions as pending_submissions_count' => function ($query) {
                    $query->where('status', 'pending');
                },
            ]);

        // Học viên: chỉ được filter status = 'published' hoặc 'closed', status 'draft' trả về empty
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

        if ($request->has('due_date_from')) {
            $query->whereDate('due_date', '>=', $request->due_date_from);
        }

        if ($request->has('due_date_to')) {
            $query->whereDate('due_date', '<=', $request->due_date_to);
        }

        if ($request->has('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('title', 'like', "%{$request->search}%")
                    ->orWhere('description', 'like', "%{$request->search}%");
            });
        }

        $sortBy = $request->get('sort', 'due_date');
        $sortOrder = $request->get('order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        $perPage = min($request->get('per_page', 15), 100);
        $assignments = $query->paginate($perPage);

        $totalCount = Assignment::where('class_id', $classId)->count();
        $statusCounts = Assignment::where('class_id', $classId)
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        return [
            'class' => new ClassRoomResource($class),
            'assignments' => AssignmentResource::collection($assignments),
            'statistics' => [
                'total_count' => $totalCount,
                'status_counts' => $statusCounts,
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
     * Build response for assignment submissions listing.
     */
    private function buildAssignmentSubmissionsResponse(Assignment $assignment, Request $request, $user): array
    {
        $assignment->load(['learningResources']);

        $query = $assignment->submissions()->with(['student', 'grader', 'questionResponses']);

        if ($user && $user->isStudent()) {
            $student = $this->getCurrentStudent();
            if ($student) {
                $query->where('student_id', $student->id);
            }
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('student_id')) {
            $query->where('student_id', $request->student_id);
        }

        if ($request->has('search')) {
            $query->whereHas('student', function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                    ->orWhere('email', 'like', "%{$request->search}%");
            });
        }

        $sortBy = $request->get('sort', 'submitted_at');
        $sortOrder = $request->get('order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        $perPage = min($request->get('per_page', 15), 100);
        $submissions = $query->paginate($perPage);

        $totalCount = $assignment->submissions()->count();
        $gradedCount = $assignment->submissions()->where('status', 'graded')->count();
        $pendingCount = $assignment->submissions()->where('status', 'pending')->count();
        $lateCount = $assignment->submissions()
            ->where('status', '!=', 'cancelled')
            ->where('submitted_at', '>', $assignment->due_date)
            ->count();

        return [
            'assignment' => new AssignmentResource($assignment),
            'submissions' => SubmissionResource::collection($submissions),
            'statistics' => [
                'total_submissions' => $totalCount,
                'graded_submissions' => $gradedCount,
                'pending_submissions' => $pendingCount,
                'late_submissions' => $lateCount,
            ],
            'meta' => [
                'current_page' => $submissions->currentPage(),
                'per_page' => $submissions->perPage(),
                'total' => $submissions->total(),
                'last_page' => $submissions->lastPage(),
            ],
        ];
    }

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

            // Gia sư cần capability classes.manage để xem bài tập trong lớp
            if ($capabilityError = $this->requirePlanCapability('classes.manage')) {
                return $capabilityError;
            }
        }

        $result = $this->buildClassAssignmentsResponse($class, $request, (int) $id, $user);

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewAndManagePermissions('assignments.manage', true);

        return response()->json([
            'success' => true,
            'data' => [
                'class' => $result['class'],
                'assignments' => $result['assignments'],
                'statistics' => $result['statistics'],
            ],
            'meta' => $result['meta'],
            'permissions' => $permissions,
        ]);
    }

    /**
     * Get accessible learning resources for the user based on their role.
     */
    private function getAccessibleLearningResources($user)
    {
        $query = LearningResource::query()
            ->where('status', 'active');

        if ($user->isTutor()) {
            // Tutor: Own resources
            $query->where('tutor_id', $user->id);
        } else {
            // No access
            $query->whereRaw('1 = 0');
        }

        return $query->get();
    }

    private function assignmentWorkflow(): AssignmentWorkflowService
    {
        return app(AssignmentWorkflowService::class);
    }

    public function quizSchema(Assignment $assignment): JsonResponse
    {
        $assignment->load(['class', 'tutor', 'questions.options', 'questions.media', 'questions.options.media', 'sections']);

        if (! $assignment->isQuiz()) {
            return $this->errorResponse('Bài tập không tồn tại hoặc không phải dạng trắc nghiệm', null, 'NOT_FOUND', 404);
        }

        if (! $this->canManageResource($assignment->class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        return $this->successResponse([
            'assignment' => new AssignmentResource($assignment),
            'questions' => AssignmentQuizService::transformQuestions($assignment, true),
            'sections' => AssignmentQuizService::transformSections($assignment),
            'settings' => $assignment->quiz_settings,
        ]);
    }

    public function quizTake(Assignment $assignment): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        if (! $user->isStudent()) {
            return $this->errorResponse('Chỉ học viên mới có thể làm bài trắc nghiệm', null, 'UNAUTHORIZED', 403);
        }

        $assignment->load(['class', 'tutor', 'questions.options.media', 'questions.media', 'sections']);

        if (! $assignment->isQuiz()) {
            return $this->errorResponse('Bài trắc nghiệm không tồn tại', null, 'NOT_FOUND', 404);
        }

        $student = $this->getCurrentStudent();
        if (! $student || ! $student->isEnrolledIn($assignment->class_id)) {
            return $this->errorResponse('Bạn không thuộc lớp học này', null, 'UNAUTHORIZED', 403);
        }

        // Học viên chỉ được làm bài trắc nghiệm đã published hoặc closed (không cho làm draft)
        if ($assignment->status === 'draft') {
            return $this->errorResponse('Bài trắc nghiệm chưa được công bố', null, 'UNAUTHORIZED', 403);
        }

        $questions = AssignmentQuizService::transformQuestions($assignment, false);
        if ($assignment->quiz_settings['shuffle_questions'] ?? false) {
            $questions = collect($questions)->shuffle()->values()->all();
        }

        // Lưu thời gian bắt đầu làm bài (nếu chưa có submission nào)
        $existingSubmission = $assignment->submissions()
            ->where('student_id', $student->id)
            ->where('status', '!=', 'not_submitted')
            ->latest()
            ->first();

        $startedAt = $existingSubmission?->started_at ?? now();

        return $this->successResponse([
            'assignment' => new AssignmentResource($assignment->loadMissing(['class', 'tutor'])),
            'questions' => $questions,
            'sections' => AssignmentQuizService::transformSections($assignment),
            'settings' => $assignment->quiz_settings,
            'started_at' => $startedAt->toISOString(),
        ]);
    }
}
