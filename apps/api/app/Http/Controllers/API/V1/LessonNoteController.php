<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Resources\ClassRoomResource;
use App\Http\Resources\LessonNoteResource;
use App\Models\ClassRoom;
use App\Models\LearningResource;
use App\Models\LessonNote;
use App\Models\Media;
use App\Models\Student;
use App\Rules\ExistsHashId;
use App\Traits\DecodesHashIds;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class LessonNoteController extends BaseController
{
    use DecodesHashIds;

    /**
     * Get validation rules for lesson note.
     */
    private function getValidationRules(bool $isUpdate = false): array
    {
        $rules = [
            'lesson_date' => ($isUpdate ? 'sometimes|' : '').'required|date',
            'topic' => 'nullable|string|max:255',
            'content' => ($isUpdate ? 'sometimes|' : '').'required|string',
            'homework' => 'nullable|string',
            'observations' => 'nullable|string',
            'student_notes' => 'nullable|array',
            'student_notes.*.student_id' => ['required_with:student_notes', new ExistsHashId(Student::class)],
            'student_notes.*.behavior' => 'nullable|in:excellent,good,average,poor',
            'student_notes.*.note' => 'nullable|string',
            'rating' => 'nullable|integer|min:1|max:5',
            'attachments' => 'nullable|array',
            'attachments.*' => [new ExistsHashId(Media::class)],
            'learning_resources' => 'nullable|array',
            'learning_resources.*' => [new ExistsHashId(LearningResource::class)],
            // Legacy fields (backward compatibility)
            'title' => 'nullable|string|max:255',
            'objectives' => 'nullable|string',
            'materials' => 'nullable|string',
            'student_performance' => 'nullable|string',
            'notes' => 'nullable|string',
        ];

        if (! $isUpdate) {
            $rules['class_id'] = ['required', new ExistsHashId(ClassRoom::class)];
        }

        return $rules;
    }

    /**
     * Apply filters (class_id, lesson_date, search, sort) to query.
     */
    private function applyFilters($query, Request $request)
    {
        if ($request->has('class_id')) {
            $this->decodeHashId($request, 'class_id', ClassRoom::class);
        }
        if ($request->has('class_id')) {
            $query->where('class_id', $request->class_id);
        }

        if ($request->has('lesson_date')) {
            $query->whereDate('lesson_date', $request->lesson_date);
        }

        if ($request->has('lesson_date_from')) {
            $query->whereDate('lesson_date', '>=', $request->lesson_date_from);
        }

        if ($request->has('lesson_date_to')) {
            $query->whereDate('lesson_date', '<=', $request->lesson_date_to);
        }

        // Support generic date_from/date_to aliases for lesson_date
        if ($request->has('date_from') && ! $request->has('lesson_date_from')) {
            $query->whereDate('lesson_date', '>=', $request->date_from);
        }
        if ($request->has('date_to') && ! $request->has('lesson_date_to')) {
            $query->whereDate('lesson_date', '<=', $request->date_to);
        }

        if ($request->has('tutor_id')) {
            $query->where('tutor_id', $request->tutor_id);
        }

        // Search
        if ($request->has('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('topic', 'like', "%{$request->search}%")
                    ->orWhere('content', 'like', "%{$request->search}%")
                    ->orWhere('homework', 'like', "%{$request->search}%")
                    ->orWhere('observations', 'like', "%{$request->search}%");
            });
        }

        // Sort
        $sortable = ['lesson_date', 'topic', 'rating', 'created_at', 'updated_at'];
        $sortBy = $request->get('sort', 'lesson_date');
        if (! in_array($sortBy, $sortable, true)) {
            $sortBy = 'lesson_date';
        }
        $sortOrder = strtolower($request->get('order', 'desc')) === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sortBy, $sortOrder);

        return $query;
    }

    public function index(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        // Học viên: có thể xem lesson notes của chính họ (không cần capability)
        // Giáo viên: cần capability lesson_notes.manage để xem lesson notes
        if ($user && ! $user->isStudent()) {
            if ($capabilityError = $this->requirePlanCapability('lesson_notes.manage')) {
                return $capabilityError;
            }
        }

        $query = LessonNote::query()->with(['class', 'tutor', 'learningResources']);

        $query = $this->applyDataIsolation($query, 'lesson_notes');

        // Apply filters
        $query = $this->applyFilters($query, $request);

        $perPage = min($request->get('per_page', 15), 100);
        $lessonNotes = $query->paginate($perPage);

        // Calculate statistics (on all data, not filtered/paginated)
        $statsQuery = LessonNote::query();
        $statsQuery = $this->applyDataIsolation($statsQuery, 'lesson_notes');

        $now = now();
        $startOfMonth = $now->copy()->startOfMonth();
        $startOfWeek = $now->copy()->startOfWeek();

        $statistics = [
            'total' => $statsQuery->count(),
            'this_month' => (clone $statsQuery)->where('created_at', '>=', $startOfMonth)->count(),
            'this_week' => (clone $statsQuery)->where('created_at', '>=', $startOfWeek)->count(),
            'average_rating' => (clone $statsQuery)->whereNotNull('rating')->avg('rating') ?? 0,
            'unique_classes' => (clone $statsQuery)->distinct('class_id')->count('class_id'),
        ];

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('lesson_notes.manage');

        return response()->json([
            'success' => true,
            'data' => LessonNoteResource::collection($lessonNotes),
            'meta' => [
                'current_page' => $lessonNotes->currentPage(),
                'per_page' => $lessonNotes->perPage(),
                'total' => $lessonNotes->total(),
                'last_page' => $lessonNotes->lastPage(),
                'statistics' => $statistics,
            ],
            'permissions' => [
                'can_manage' => $permissions['can_manage'], // Có thể tạo/sửa/xóa ghi chú bài học
            ],
        ]);
    }

    public function show(LessonNote $lessonNote): JsonResponse
    {
        // Defensive check: ensure lesson note was properly resolved
        if (! $lessonNote || ! $lessonNote->exists || ! $lessonNote->id) {
            return $this->errorResponse('Không tìm thấy ghi chú bài học', null, 'NOT_FOUND', 404);
        }
        $lessonNote->load(['class', 'tutor', 'learningResources']);

        $user = $this->getAuthUser();

        // Student: chỉ cần kiểm tra xem họ có tham gia lớp học này không
        if ($user->isStudent()) {
            $student = $this->getCurrentStudent();
            if ($student) {
                $isEnrolled = $this->isStudentEnrolledInClass($student, $lessonNote->class_id);
                if ($isEnrolled) {
                    // Học viên có thể xem lesson note detail (không cần capability)
                    // Nhưng vẫn trả về permissions để frontend biết
                    $permissions = $this->buildViewManagePermissions('lesson_notes.manage');
                    $response = $this->successResponse(new LessonNoteResource($lessonNote));
                    $responseData = $response->getData(true);
                    $responseData['permissions'] = $permissions;

                    return response()->json($responseData, $response->getStatusCode());
                }
            }

            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Other roles: use canManageResource
        if (! $this->canManageResource($lessonNote->class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Giáo viên cần capability lesson_notes.manage để xem lesson notes
        if ($capabilityError = $this->requirePlanCapability('lesson_notes.manage')) {
            return $capabilityError;
        }

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('lesson_notes.manage');

        $response = $this->successResponse(new LessonNoteResource($lessonNote));
        $responseData = $response->getData(true);
        $responseData['permissions'] = $permissions;

        return response()->json($responseData, $response->getStatusCode());
    }

    public function store(Request $request): JsonResponse
    {
        if ($error = $this->requirePlanCapability('lesson_notes.manage')) {
            return $error;
        }

        $validator = Validator::make($request->all(), $this->getValidationRules());

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        // Decode HashIDs
        $idsToDecode = $request->only(['class_id', 'student_notes', 'attachments', 'learning_resources']);
        $this->decodeHashId($idsToDecode, 'class_id', ClassRoom::class);
        $this->decodeNestedHashIds($idsToDecode, 'student_notes', 'student_id', Student::class);
        $this->decodeHashIdArray($idsToDecode, 'attachments', Media::class);
        $this->decodeHashIdArray($idsToDecode, 'learning_resources', LearningResource::class);
        $request->merge($idsToDecode);

        $class = ClassRoom::find($request->class_id);
        if (! $class || ! $this->canManageResource($class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Validate student_notes: students must belong to the class
        if ($request->has('student_notes') && is_array($request->student_notes)) {
            $studentIds = array_column($request->student_notes, 'student_id');
            $classStudentIds = $class->students()->pluck('students.id')->toArray();
            $invalidStudentIds = array_diff($studentIds, $classStudentIds);

            if (! empty($invalidStudentIds)) {
                return $this->errorResponse(
                    'Một số học viên không thuộc lớp này.',
                    ['student_notes' => ['Tất cả học viên phải thuộc lớp đã chọn']],
                    'VALIDATION_ERROR',
                    422
                );
            }
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Validate learning_resources access
        if ($request->has('learning_resources') && ! empty($request->learning_resources)) {
            $accessibleResources = $this->getAccessibleLearningResources($user);
            $requestResourceIds = $request->learning_resources;
            $invalidResourceIds = array_diff($requestResourceIds, $accessibleResources->pluck('id')->toArray());

            if (! empty($invalidResourceIds)) {
                return $this->errorResponse(
                    'Một số tài liệu không có quyền truy cập.',
                    ['learning_resources' => ['Chỉ có thể chọn tài liệu bạn có quyền truy cập']],
                    'VALIDATION_ERROR',
                    422
                );
            }
        }

        $lessonNoteData = $request->only([
            'class_id', 'lesson_date', 'topic', 'content', 'homework', 'observations',
            'student_notes', 'rating', 'attachments',
        ]);

        $lessonNoteData['tutor_id'] = $user->id;

        $lessonNote = LessonNote::create($lessonNoteData);

        // Attach learning resources with order
        if ($request->has('learning_resources') && ! empty($request->learning_resources)) {
            $syncData = [];
            foreach ($request->learning_resources as $index => $resourceId) {
                $syncData[$resourceId] = ['order' => $index];
            }
            $lessonNote->learningResources()->sync($syncData);

            // Touch lesson note to trigger 'created' event and ensure cache consistency
            // This is necessary because sync() only modifies pivot table, not the lesson note itself
            $lessonNote->touch();
        }

        return $this->successResponse(
            new LessonNoteResource($lessonNote->load(['class', 'tutor', 'learningResources'])),
            'Tạo ghi chú bài học thành công',
            201
        );
    }

    public function update(Request $request, LessonNote $lessonNote): JsonResponse
    {
        // Defensive check: ensure lesson note was properly resolved
        if (! $lessonNote || ! $lessonNote->exists || ! $lessonNote->id) {
            return $this->errorResponse('Không tìm thấy ghi chú bài học', null, 'NOT_FOUND', 404);
        }
        if ($error = $this->requirePlanCapability('lesson_notes.manage')) {
            return $error;
        }

        if (! $this->canManageResource($lessonNote->class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        $validator = Validator::make($request->all(), $this->getValidationRules(true));

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        // Decode HashIDs
        $idsToDecode = $request->only(['class_id', 'student_notes', 'attachments', 'learning_resources']);
        $this->decodeHashId($idsToDecode, 'class_id', ClassRoom::class);
        $this->decodeNestedHashIds($idsToDecode, 'student_notes', 'student_id', Student::class);
        $this->decodeHashIdArray($idsToDecode, 'attachments', Media::class);
        $this->decodeHashIdArray($idsToDecode, 'learning_resources', LearningResource::class);
        $request->merge($idsToDecode);

        // Validate student_notes: students must belong to the class
        if ($request->has('student_notes') && is_array($request->student_notes)) {
            $studentIds = array_column($request->student_notes, 'student_id');
            $classStudentIds = $lessonNote->class->students()->pluck('students.id')->toArray();
            $invalidStudentIds = array_diff($studentIds, $classStudentIds);

            if (! empty($invalidStudentIds)) {
                return $this->errorResponse(
                    'Một số học viên không thuộc lớp này.',
                    ['student_notes' => ['Tất cả học viên phải thuộc lớp đã chọn']],
                    'VALIDATION_ERROR',
                    422
                );
            }
        }

        // Validate learning_resources access
        if ($request->has('learning_resources') && ! empty($request->learning_resources)) {
            $accessibleResources = $this->getAccessibleLearningResources($this->getAuthUser());
            $requestResourceIds = $request->learning_resources;
            $invalidResourceIds = array_diff($requestResourceIds, $accessibleResources->pluck('id')->toArray());

            if (! empty($invalidResourceIds)) {
                return $this->errorResponse(
                    'Một số tài liệu không có quyền truy cập.',
                    ['learning_resources' => ['Chỉ có thể chọn tài liệu bạn có quyền truy cập']],
                    'VALIDATION_ERROR',
                    422
                );
            }
        }

        $lessonNote->update($request->only([
            'lesson_date', 'topic', 'content', 'homework', 'observations',
            'student_notes', 'rating', 'attachments',
        ]));

        // Sync learning resources if provided
        if ($request->has('learning_resources')) {
            if (empty($request->learning_resources)) {
                // Remove all if empty array
                $lessonNote->learningResources()->detach();
            } else {
                // Sync with order
                $syncData = [];
                foreach ($request->learning_resources as $index => $resourceId) {
                    $syncData[$resourceId] = ['order' => $index];
                }
                $lessonNote->learningResources()->sync($syncData);
            }

            // Touch lesson note to trigger 'updated' event and clear cache
            // This is necessary because sync() only modifies pivot table, not the lesson note itself
            $lessonNote->touch();
        }

        return $this->successResponse(
            new LessonNoteResource($lessonNote->fresh(['class', 'tutor', 'learningResources'])),
            'Cập nhật ghi chú bài học thành công'
        );
    }

    public function destroy(LessonNote $lessonNote): JsonResponse
    {
        // Defensive check: ensure lesson note was properly resolved
        if (! $lessonNote || ! $lessonNote->exists || ! $lessonNote->id) {
            return $this->errorResponse('Không tìm thấy ghi chú bài học', null, 'NOT_FOUND', 404);
        }
        if ($error = $this->requirePlanCapability('lesson_notes.manage')) {
            return $error;
        }

        if (! $this->canManageResource($lessonNote->class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        $lessonNote->delete();

        return $this->successResponse(null, 'Xóa ghi chú bài học thành công');
    }

    public function byClass(Request $request, ClassRoom $classRoom): JsonResponse
    {
        $class = $classRoom;
        $classId = $class->id;

        $user = $this->getAuthUser();

        // Student: chỉ cần kiểm tra xem họ có tham gia lớp học này không
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

        try {
            $query = LessonNote::where('class_id', $classId)
                ->with(['tutor', 'learningResources']);

            // Apply filters
            $query = $this->applyFilters($query, $request);

            // Pagination
            $perPage = min($request->get('per_page', 15), 100);
            $lessonNotes = $query->paginate($perPage);

            // Statistics
            $totalCount = LessonNote::where('class_id', $classId)->count();

            // Build permissions: học viên có can_view, tutor có can_manage
            $permissions = $this->buildViewManagePermissions('lesson_notes.manage');

            return response()->json([
                'success' => true,
                'data' => [
                    'class' => new ClassRoomResource($class),
                    'lesson_notes' => LessonNoteResource::collection($lessonNotes),
                    'statistics' => [
                        'total_count' => $totalCount,
                    ],
                ],
                'meta' => [
                    'current_page' => $lessonNotes->currentPage(),
                    'per_page' => $lessonNotes->perPage(),
                    'total' => $lessonNotes->total(),
                    'last_page' => $lessonNotes->lastPage(),
                ],
                'permissions' => $permissions,
            ]);
        } catch (\Exception $e) {
            return $this->errorResponse(
                'Lỗi khi tải danh sách ghi chú bài học: '.$e->getMessage(),
                null,
                'SERVER_ERROR',
                500
            );
        }
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
            // Default: no access
            return collect([]);
        }

        return $query->get();
    }
}
