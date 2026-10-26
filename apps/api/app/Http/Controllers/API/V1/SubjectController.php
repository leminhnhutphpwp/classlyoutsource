<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Resources\SubjectResource;
use App\Models\ClassRoom;
use App\Models\Subject;
use App\Services\DataJobService;
use App\Services\ImportService;
use App\Support\CacheKeys;
use App\Support\CacheTtl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SubjectController extends BaseController
{
    /**
     * Get validation rules for subject.
     */
    private function getValidationRules(bool $isUpdate = false, ?int $ownerId = null, ?int $excludeId = null): array
    {
        return [
            'name' => [
                $isUpdate ? 'sometimes' : 'required',
                'string',
                'max:255',
                Rule::unique('subjects', 'name')
                    ->where(fn ($q) => $q->where('created_by', $ownerId)->whereNull('deleted_at'))
                    ->ignore($excludeId),
            ],
            'code' => 'sometimes|nullable|string|max:50',
            'description' => 'sometimes|nullable|string',
            'is_active' => 'sometimes|boolean',
            'order' => 'sometimes|integer|min:0',
        ];
    }

    /**
     * Apply data isolation for subjects query.
     * Returns [query, error] - error is null if access is allowed.
     */
    private function applyIsolation($query, $user)
    {
        if ($user->hasRole('super_admin')) {
            return [$query, null];
        }

        if ($user->isTutor()) {
            // Tutor: chỉ xem subjects của chính họ
            return [$query->where('created_by', $user->id), null];
        }

        if ($user->isStudent()) {
            // Học viên: xem subjects của các lớp họ đang học
            $student = $this->getCurrentStudent();
            if (! $student) {
                return [null, $this->errorResponse('Không tìm thấy thông tin học viên', null, 'NOT_FOUND', 404)];
            }

            // Lấy subject_ids từ các lớp học viên đang học
            $classIds = $this->getStudentClassIds();
            if (empty($classIds)) {
                // Học viên chưa có lớp nào, trả về empty
                return [$query->whereRaw('1 = 0'), null];
            }

            // Lấy subjects từ các lớp học viên đang học
            $subjectIds = ClassRoom::whereIn('id', $classIds)
                ->whereNotNull('subject_id')
                ->distinct()
                ->pluck('subject_id')
                ->toArray();

            if (empty($subjectIds)) {
                return [$query->whereRaw('1 = 0'), null];
            }

            return [$query->whereIn('id', $subjectIds), null];
        }

        // No access
        return [null, $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403)];
    }

    /**
     * Check if user can access a specific subject.
     */
    private function checkAccess($subject, $user): ?JsonResponse
    {
        if ($user->hasRole('super_admin')) {
            return null;
        }

        if ($user->isTutor()) {
            // Tutor: chỉ xem subjects của chính họ
            if ($subject->created_by !== $user->id) {
                return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }

            return null;
        }

        if ($user->isStudent()) {
            // Học viên: xem subjects của các lớp họ đang học
            $student = $this->getCurrentStudent();
            if (! $student) {
                return $this->errorResponse('Không tìm thấy thông tin học viên', null, 'NOT_FOUND', 404);
            }

            $classIds = $this->getStudentClassIds();
            if (empty($classIds)) {
                return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }

            // Kiểm tra xem subject này có trong các lớp học viên đang học không
            $hasAccess = ClassRoom::whereIn('id', $classIds)
                ->where('subject_id', $subject->id)
                ->exists();

            if (! $hasAccess) {
                return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }

            return null;
        }

        return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
    }

    /**
     * Build permissions for subjects.
     * Học viên: can_view = true, can_manage = false (read-only)
     * Tutor: can_view = true, can_manage = based on capability
     */
    private function buildSubjectPermissions(): array
    {
        return $this->buildViewAndManagePermissions('subjects.manage', true);
    }

    /**
     * Apply filters (search, sort, active status) to query.
     */
    private function applyFilters($query, Request $request)
    {
        // Filter by active status (default: only active)
        if ($request->has('is_active')) {
            $query->where('is_active', $request->is_active === '1' || $request->is_active === 'true');
        } else {
            $query->active(); // Default: only active
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Sort
        $sortBy = $request->get('sort', 'order');
        $sortOrder = $request->get('order', 'asc');
        $query->ordered()->orderBy($sortBy, $sortOrder);

        return $query;
    }

    /**
     * Get list of subjects with data isolation.
     */
    public function index(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Chỉ giáo viên cần capability subjects.manage để xem môn học
        // Học viên có thể xem subjects của các lớp họ đang học (read-only)
        if (! $user->isStudent()) {
            if ($capabilityError = $this->requirePlanCapability('subjects.manage')) {
                return $capabilityError;
            }
        }

        // Check access before caching
        $testQuery = Subject::query()->with(['creator']);
        [$testQuery, $accessError] = $this->applyIsolation($testQuery, $user);
        if ($accessError) {
            return $accessError;
        }

        $cacheKey = CacheKeys::subjectsList($user->id, false); // Cache all (both active and inactive)

        // Get all subjects from cache (cache stores full list without filters)
        $allSubjects = Cache::remember($cacheKey, CacheTtl::REFERENCE_DATA, function () use ($user) {
            // Recreate query in closure to avoid reuse issues
            $query = Subject::query()->with(['creator']);
            [$query, $error] = $this->applyIsolation($query, $user);
            if ($error) {
                // This should not happen since we checked before, but handle it anyway
                return collect([]);
            }

            // Return all (cache full list, apply filters after)
            return $query->get();
        });

        // Apply is_active filter after cache retrieval
        if ($request->has('is_active')) {
            $isActive = $request->boolean('is_active');
            $allSubjects = $allSubjects->filter(function ($subject) use ($isActive) {
                return (bool) $subject->is_active === $isActive;
            })->values();
        } else {
            // Default: only active
            $allSubjects = $allSubjects->filter(function ($subject) {
                return (bool) $subject->is_active === true;
            })->values();
        }

        // Apply search filter after cache retrieval
        if ($request->filled('search')) {
            $search = $request->get('search');
            $allSubjects = $allSubjects->filter(function ($subject) use ($search) {
                return stripos($subject->name, $search) !== false
                    || stripos($subject->code ?? '', $search) !== false
                    || stripos($subject->description ?? '', $search) !== false;
            })->values();
        }

        // Pagination (optional - if not provided, return all)
        if ($request->has('per_page')) {
            $perPage = min($request->get('per_page', 15), 100);
            $currentPage = $request->get('page', 1);

            // Manual pagination for cached collection
            $total = $allSubjects->count();
            $offset = ($currentPage - 1) * $perPage;
            $items = $allSubjects->slice($offset, $perPage)->values();
            $lastPage = (int) ceil($total / $perPage);

            // Build permissions: học viên có can_view, tutor có can_manage
            $permissions = $this->buildSubjectPermissions();

            return response()->json([
                'success' => true,
                'data' => SubjectResource::collection($items),
                'meta' => [
                    'current_page' => (int) $currentPage,
                    'per_page' => $perPage,
                    'total' => $total,
                    'last_page' => $lastPage,
                ],
                'permissions' => $permissions,
            ]);
        }

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildSubjectPermissions();

        // Return all (for dropdowns)
        $response = $this->successResponse(
            SubjectResource::collection($allSubjects),
            'Lấy danh sách môn học thành công'
        );
        $responseData = $response->getData(true);
        $responseData['permissions'] = $permissions;

        return response()->json($responseData, $response->getStatusCode());
    }

    /**
     * Import subjects from CSV/XLSX.
     *
     * POST /api/v1/subjects/import
     */
    public function import(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        if ($user->isStudent()) {
            return $this->errorResponse('Không có quyền import môn học', null, 'UNAUTHORIZED', 403);
        }

        if ($capabilityError = $this->requirePlanCapability('data.import')) {
            return $capabilityError;
        }

        $file = $request->file('file');
        if (! $file) {
            return $this->errorResponse('Thiếu file upload', null, 'VALIDATION_ERROR', 422);
        }

        $job = DataJobService::start('import', 'subjects', $user, [
            'file_name' => $file?->getClientOriginalName(),
            'format' => $file?->getClientOriginalExtension(),
            'meta' => [
                'path' => $request->path(),
            ],
        ]);

        $requiredColumns = ['name'];
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

        $created = 0;
        $updated = 0;
        $failed = 0;
        $skipped = 0;
        $errors = [];

        // Optimize: Pre-fetch existing records
        $names = collect($fileData['rows'])->map(function ($row) {
            $mapped = $this->mapImportRow($row['data'], [
                'name' => ['name', 'tên', 'tên môn học', 'môn học'],
            ]);

            return $mapped['name'] ?? null;
        })->filter()->toArray();

        $existingQuery = Subject::withTrashed()->whereIn('name', $names);
        if ($user->isTutor() && ! $user->hasRole('super_admin')) {
            $existingQuery->where('created_by', $user->id);
        }
        $existingRecords = $existingQuery->get()->keyBy('name');

        DB::beginTransaction();
        try {
            foreach ($fileData['rows'] as $index => $rowInfo) {
                try {
                    $rowNumber = $rowInfo['row_number'];
                    $mapped = $this->mapImportRow($rowInfo['data'], [
                        'name' => ['name', 'tên', 'tên môn học', 'môn học'],
                        'code' => ['code', 'mã', 'mã môn học'],
                        'description' => ['description', 'mô tả', 'ghi chú'],
                        'is_active' => ['is_active', 'active', 'kích hoạt', 'trạng thái'],
                        'order' => ['order', 'thứ tự', 'sắp xếp'],
                    ]);

                    $name = $mapped['name'] ?? null;
                    if (! $name) {
                        $failed++;
                        $errors[] = [
                            'index' => $index,
                            'row' => $rowNumber,
                            'error' => 'Thiếu cột tên (name)',
                        ];

                        continue;
                    }

                    // Use pre-fetched record
                    $existing = $existingRecords->get($name);

                    $payload = [
                        'name' => $name,
                        'code' => $mapped['code'] ?? null,
                        'description' => $mapped['description'] ?? null,
                        'is_active' => isset($mapped['is_active']) ? (bool) $mapped['is_active'] : true,
                        'order' => isset($mapped['order']) ? (int) $mapped['order'] : 0,
                    ];

                    if ($existing) {
                        if ($existing->trashed()) {
                            $existing->restore();
                        }
                        $existing->update($payload);
                        $updated++;
                    } else {
                        $payload['created_by'] = $user->id;
                        Subject::create($payload);
                        $created++;
                    }
                } catch (\Throwable $e) {
                    $failed++;
                    $errors[] = [
                        'index' => $index,
                        'row' => $rowNumber ?? $index + 1,
                        'error' => $e->getMessage(),
                    ];
                }
            }
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            return $this->errorResponse('Lỗi hệ thống khi import: '.$e->getMessage(), null, 'SYSTEM_ERROR', 500);
        }

        $metrics = [
            'total_rows' => count($fileData['rows']),
            'success_count' => $created + $updated,
            'failed_count' => $failed,
            'skipped_count' => $skipped,
        ];

        if ($failed > 0) {
            DataJobService::finishPartial($job, $metrics, ['errors' => $errors]);
        } else {
            DataJobService::finishSuccess($job, $metrics);
        }

        return $this->successResponse([
            'total' => $metrics['total_rows'],
            'created' => $created,
            'updated' => $updated,
            'failed' => $failed,
            'skipped' => $skipped,
            'errors' => $errors,
        ], 'Import môn học hoàn tất');
    }

    /**
     * Export subjects to CSV/Excel.
     *
     * GET /api/v1/subjects/export
     */
    public function export(Request $request)
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        if ($user->isStudent()) {
            return $this->errorResponse('Không có quyền export môn học', null, 'UNAUTHORIZED', 403);
        }

        if ($capabilityError = $this->requirePlanCapability('data.export')) {
            return $capabilityError;
        }

        [$query, $isolationError] = $this->applyIsolation(Subject::query(), $user);
        if ($isolationError) {
            return $isolationError;
        }

        $subjects = $query->orderBy('order')->orderBy('name')->get();

        $data = $subjects->map(function (Subject $subject) {
            return [
                '_id' => $subject->hash_id,
                'name' => $subject->name,
                'code' => $subject->code,
                'description' => $subject->description,
                'is_active' => $subject->is_active ? 1 : 0,
                'order' => $subject->order,
            ];
        })->toArray();

        $reportsController = app(ReportsController::class);

        return $reportsController->handleExport($request, 'subjects-data', function () use ($data) {
            return $data;
        });
    }

    /**
     * Get single subject by ID.
     */
    public function show(Subject $subject): JsonResponse
    {
        // Defensive check: ensure subject was properly resolved
        if (! $subject || ! $subject->exists || ! $subject->id) {
            return $this->errorResponse('Không tìm thấy môn học', null, 'NOT_FOUND', 404);
        }

        // Generate cache key using the injected subject's ID
        $cacheKey = CacheKeys::subjectDetail($subject->id);

        // Cache the subject with relationships
        $cachedSubject = Cache::remember($cacheKey, CacheTtl::REFERENCE_DATA, function () use ($subject) {
            return $subject->load(['creator']);
        });

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $accessError = $this->checkAccess($cachedSubject, $user);
        if ($accessError) {
            return $accessError;
        }

        // Chỉ giáo viên cần capability subjects.manage để xem môn học
        // Học viên có thể xem subjects của các lớp họ đang học (read-only)
        if (! $user->isStudent()) {
            if ($capabilityError = $this->requirePlanCapability('subjects.manage')) {
                return $capabilityError;
            }
        }

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildSubjectPermissions();

        $response = $this->successResponse(
            new SubjectResource($cachedSubject),
            'Lấy thông tin môn học thành công'
        );
        $responseData = $response->getData(true);
        $responseData['permissions'] = $permissions;

        return response()->json($responseData, $response->getStatusCode());
    }

    /**
     * Create a new subject.
     */
    public function store(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Check capability for subjects management
        if ($capabilityError = $this->requirePlanCapability('subjects.manage')) {
            return $capabilityError;
        }

        $validator = Validator::make($request->all(), $this->getValidationRules(false, $user->id));

        if ($validator->fails()) {
            return $this->errorResponse('Dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        $data = $request->only(['name', 'code', 'description', 'is_active', 'order']);
        $data['created_by'] = $user->id;

        // Auto-generate code if missing
        if (empty($data['code'])) {
            $baseCode = strtoupper(Str::slug($data['name'], '_'));
            if (empty($baseCode)) {
                $baseCode = 'SUBJECT_'.Str::upper(Str::random(4));
            }

            $code = $baseCode;
            while (Subject::where('created_by', $user->id)->where('code', $code)->exists()) {
                $code = $baseCode.'_'.Str::upper(Str::random(4));
            }
            $data['code'] = $code;
        }

        // Default values
        $data['is_active'] = $data['is_active'] ?? true;
        $data['order'] = $data['order'] ?? 0;

        // Check if there is a trashed subject with the same name for this user
        $trashedSubject = Subject::onlyTrashed()
            ->where('created_by', $user->id)
            ->where('name', $data['name'])
            ->first();

        if ($trashedSubject) {
            $trashedSubject->restore();
            $trashedSubject->update($data);
            $subject = $trashedSubject;
        } else {
            $subject = Subject::create($data);
        }

        // Cache clearing handled by SubjectObserver

        return $this->successResponse(
            new SubjectResource($subject->load(['creator'])),
            'Tạo môn học thành công',
            201
        );
    }

    /**
     * Update subject.
     */
    public function update(Request $request, Subject $subject): JsonResponse
    {

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $accessError = $this->checkAccess($subject, $user);
        if ($accessError) {
            return $accessError;
        }

        // Check capability for subjects management
        if ($capabilityError = $this->requirePlanCapability('subjects.manage')) {
            return $capabilityError;
        }

        $validator = Validator::make($request->all(), $this->getValidationRules(true, $subject->created_by, $subject->id));

        if ($validator->fails()) {
            return $this->errorResponse('Dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        $updateData = $request->only(['name', 'code', 'description', 'order']);

        if ($request->has('is_active')) {
            $updateData['is_active'] = $request->boolean('is_active');
        }

        $subject->fill($updateData)->save();

        // Cache clearing handled by SubjectObserver

        return $this->successResponse(
            new SubjectResource($subject->fresh(['creator'])),
            'Cập nhật môn học thành công'
        );
    }

    /**
     * Delete subject.
     */
    public function destroy(Subject $subject): JsonResponse
    {

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $accessError = $this->checkAccess($subject, $user);
        if ($accessError) {
            return $accessError;
        }

        // Check capability for subjects management
        if ($capabilityError = $this->requirePlanCapability('subjects.manage')) {
            return $capabilityError;
        }

        // Check if subject is in use (check classes using this subject)
        $inUse = ClassRoom::where('subject_id', $subject->id)->exists();
        if ($inUse) {
            return $this->errorResponse(
                'Không thể xóa môn học đang được sử dụng',
                ['class_count' => ClassRoom::where('subject_id', $subject->id)->count()],
                'IN_USE',
                422
            );
        }

        $subject->delete();

        // Cache clearing handled by SubjectObserver

        return $this->successResponse(null, 'Xóa môn học thành công');
    }
}
