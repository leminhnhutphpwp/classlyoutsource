<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Resources\GradeLevelResource;
use App\Models\GradeLevel;
use App\Models\LearningResource;
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

class GradeLevelController extends BaseController
{
    /**
     * Get validation rules for grade level.
     */
    private function getValidationRules(bool $isUpdate = false, ?int $ownerId = null, ?int $excludeId = null): array
    {
        return [
            'name' => [
                $isUpdate ? 'sometimes' : 'required',
                'string',
                'max:255',
                Rule::unique('grade_levels', 'name')
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
     * Apply data isolation for grade levels query.
     * Returns [query, error] - error is null if access is allowed.
     */
    private function applyIsolation($query, $user)
    {
        if ($user->hasRole('super_admin')) {
            // Super Admin: see all
            return [$query, null];
        }

        if ($user->isTutor()) {
            return [$query->where('created_by', $user->id), null];
        }

        // No access
        return [null, $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403)];
    }

    /**
     * Check if user can access a specific grade level.
     */
    private function checkAccess($gradeLevel, $user): ?JsonResponse
    {
        if ($user->hasRole('super_admin')) {
            return null; // Super Admin can access all
        }

        if ($user->isTutor()) {
            if ($gradeLevel->created_by !== $user->id) {
                return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }

            return null;
        }

        return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
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
     * Get list of grade levels with data isolation.
     */
    public function index(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Giáo viên cần capability grade_levels.manage để xem cấp độ/khối
        if ($capabilityError = $this->requirePlanCapability('grade_levels.manage')) {
            return $capabilityError;
        }

        $cacheKey = CacheKeys::gradeLevelsList($user->id, false); // Cache all (both active and inactive)

        // Get all grade levels from cache (cache stores full list without filters)
        try {
            $allGradeLevels = Cache::remember($cacheKey, CacheTtl::REFERENCE_DATA, function () use ($user) {
                $query = GradeLevel::query()
                    ->with(['creator']);

                [$query, $error] = $this->applyIsolation($query, $user);
                if ($error) {
                    throw new \Exception('Access denied');
                }

                // Return all (cache full list, apply filters after)
                return $query->get();
            });
        } catch (\Exception $e) {
            // Handle access denied from cache
            $query = GradeLevel::query()->with(['creator']);
            [$query, $error] = $this->applyIsolation($query, $user);
            if ($error) {
                return $error;
            }
            $allGradeLevels = $query->get();
        }

        // Apply is_active filter after cache retrieval
        if ($request->has('is_active')) {
            $isActive = $request->boolean('is_active');
            $allGradeLevels = $allGradeLevels->filter(function ($level) use ($isActive) {
                return (bool) $level->is_active === $isActive;
            })->values();
        } else {
            // Default: only active
            $allGradeLevels = $allGradeLevels->filter(function ($level) {
                return (bool) $level->is_active === true;
            })->values();
        }

        // Apply search filter after cache retrieval
        if ($request->filled('search')) {
            $search = $request->get('search');
            $allGradeLevels = $allGradeLevels->filter(function ($level) use ($search) {
                return stripos($level->name, $search) !== false
                    || stripos($level->code ?? '', $search) !== false
                    || stripos($level->description ?? '', $search) !== false;
            })->values();
        }

        // Pagination (optional - if not provided, return all)
        if ($request->has('per_page')) {
            $perPage = min($request->get('per_page', 15), 100);
            $currentPage = $request->get('page', 1);

            // Manual pagination for cached collection
            $total = $allGradeLevels->count();
            $offset = ($currentPage - 1) * $perPage;
            $items = $allGradeLevels->slice($offset, $perPage)->values();
            $lastPage = (int) ceil($total / $perPage);

            // Build permissions: học viên có can_view, tutor có can_manage
            $permissions = $this->buildViewManagePermissions('grade_levels.manage');

            return response()->json([
                'success' => true,
                'data' => GradeLevelResource::collection($items),
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
        $permissions = $this->buildViewManagePermissions('grade_levels.manage');

        // Return all (for dropdowns)
        $response = $this->successResponse(
            GradeLevelResource::collection($allGradeLevels),
            'Lấy danh sách cấp độ/Khối thành công'
        );
        $responseData = $response->getData(true);
        $responseData['permissions'] = $permissions;

        return response()->json($responseData, $response->getStatusCode());
    }

    /**
     * Import grade levels from CSV/XLSX.
     *
     * POST /api/v1/grade-levels/import
     */
    public function import(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        if ($user->isStudent()) {
            return $this->errorResponse('Không có quyền import cấp độ/khối', null, 'UNAUTHORIZED', 403);
        }

        if ($capabilityError = $this->requirePlanCapability('data.import')) {
            return $capabilityError;
        }

        $file = $request->file('file');
        if (! $file) {
            return $this->errorResponse('Thiếu file upload', null, 'VALIDATION_ERROR', 422);
        }

        $job = DataJobService::start('import', 'grade-levels', $user, [
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
                'name' => ['name', 'tên', 'tên khối lớp', 'khối lớp'],
            ]);

            return $mapped['name'] ?? null;
        })->filter()->toArray();

        $existingQuery = GradeLevel::query()->whereIn('name', $names);
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
                        'name' => ['name', 'tên', 'tên khối lớp', 'khối lớp'],
                        'code' => ['code', 'mã', 'mã khối lớp'],
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
                        $existing->update($payload);
                        $updated++;
                    } else {
                        $payload['created_by'] = $user->id;
                        GradeLevel::create($payload);
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
        ], 'Import cấp độ/khối hoàn tất');
    }

    /**
     * Export grade levels to CSV/Excel.
     *
     * GET /api/v1/grade-levels/export
     */
    public function export(Request $request)
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        if ($user->isStudent()) {
            return $this->errorResponse('Không có quyền export cấp độ/khối', null, 'UNAUTHORIZED', 403);
        }

        if ($capabilityError = $this->requirePlanCapability('data.export')) {
            return $capabilityError;
        }

        [$query, $isolationError] = $this->applyIsolation(GradeLevel::query(), $user);
        if ($isolationError) {
            return $isolationError;
        }

        $levels = $query->orderBy('order')->orderBy('name')->get();

        $data = $levels->map(function (GradeLevel $level) {
            return [
                '_id' => $level->hash_id,
                'name' => $level->name,
                'code' => $level->code,
                'description' => $level->description,
                'is_active' => $level->is_active ? 1 : 0,
                'order' => $level->order,
            ];
        })->toArray();

        $reportsController = app(ReportsController::class);

        return $reportsController->handleExport($request, 'grade-levels-data', function () use ($data) {
            return $data;
        });
    }

    /**
     * Get single grade level by ID.
     */
    public function show(GradeLevel $gradeLevel): JsonResponse
    {
        // Defensive check: ensure grade level was properly resolved
        if (! $gradeLevel || ! $gradeLevel->exists || ! $gradeLevel->id) {
            return $this->errorResponse('Không tìm thấy cấp độ/Khối', null, 'NOT_FOUND', 404);
        }
        $cacheKey = CacheKeys::gradeLevelDetail($gradeLevel->id);

        $gradeLevel = Cache::remember($cacheKey, CacheTtl::REFERENCE_DATA, function () use ($gradeLevel) {
            return $gradeLevel->load(['creator']);
        });

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $accessError = $this->checkAccess($gradeLevel, $user);
        if ($accessError) {
            return $accessError;
        }

        // Giáo viên cần capability grade_levels.manage để xem cấp độ/khối
        if ($capabilityError = $this->requirePlanCapability('grade_levels.manage')) {
            return $capabilityError;
        }

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('grade_levels.manage');

        $response = $this->successResponse(
            new GradeLevelResource($gradeLevel),
            'Lấy thông tin cấp độ/Khối thành công'
        );
        $responseData = $response->getData(true);
        $responseData['permissions'] = $permissions;

        return response()->json($responseData, $response->getStatusCode());
    }

    /**
     * Create a new grade level.
     */
    public function store(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Check capability for grade levels management
        if ($capabilityError = $this->requirePlanCapability('grade_levels.manage')) {
            return $capabilityError;
        }

        $validator = Validator::make($request->all(), $this->getValidationRules(false, $user->id));

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        $data = $request->only(['name', 'code', 'description', 'is_active', 'order']);
        $data['created_by'] = $user->id;

        // Auto-generate code if missing
        if (empty($data['code'])) {
            $baseCode = strtoupper(Str::slug($data['name'], '_'));
            if (empty($baseCode)) {
                $baseCode = 'GRADE_'.Str::upper(Str::random(4));
            }

            $code = $baseCode;
            while (GradeLevel::where('created_by', $user->id)->where('code', $code)->exists()) {
                $code = $baseCode.'_'.Str::upper(Str::random(4));
            }
            $data['code'] = $code;
        }

        // Default values
        $data['is_active'] = $data['is_active'] ?? true;
        $data['order'] = $data['order'] ?? 0;

        // Check if there is a trashed grade level with the same name for this user
        $trashedLevel = GradeLevel::onlyTrashed()
            ->where('created_by', $user->id)
            ->where('name', $data['name'])
            ->first();

        if ($trashedLevel) {
            $trashedLevel->restore();
            $trashedLevel->update($data);
            $gradeLevel = $trashedLevel;
        } else {
            $gradeLevel = GradeLevel::create($data);
        }

        // Cache clearing handled by GradeLevelObserver

        return $this->successResponse(
            new GradeLevelResource($gradeLevel->load(['creator'])),
            'Tạo cấp độ/Khối thành công',
            201
        );
    }

    /**
     * Update grade level.
     */
    public function update(Request $request, GradeLevel $gradeLevel): JsonResponse
    {
        // Defensive check: ensure grade level was properly resolved
        if (! $gradeLevel || ! $gradeLevel->exists || ! $gradeLevel->id) {
            return $this->errorResponse('Không tìm thấy cấp độ/Khối', null, 'NOT_FOUND', 404);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $accessError = $this->checkAccess($gradeLevel, $user);
        if ($accessError) {
            return $accessError;
        }

        // Check capability for grade levels management
        if ($capabilityError = $this->requirePlanCapability('grade_levels.manage')) {
            return $capabilityError;
        }

        $validator = Validator::make($request->all(), $this->getValidationRules(true, $gradeLevel->created_by, $gradeLevel->id));

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        $updateData = $request->only(['name', 'code', 'description', 'order']);

        if ($request->has('is_active')) {
            $updateData['is_active'] = $request->boolean('is_active');
        }

        $gradeLevel->fill($updateData)->save();

        // Cache clearing handled by GradeLevelObserver

        return $this->successResponse(
            new GradeLevelResource($gradeLevel->fresh(['creator'])),
            'Cập nhật cấp độ/Khối thành công'
        );
    }

    /**
     * Delete grade level.
     */
    public function destroy(GradeLevel $gradeLevel): JsonResponse
    {
        // Defensive check: ensure grade level was properly resolved
        if (! $gradeLevel || ! $gradeLevel->exists || ! $gradeLevel->id) {
            return $this->errorResponse('Không tìm thấy cấp độ/Khối', null, 'NOT_FOUND', 404);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $accessError = $this->checkAccess($gradeLevel, $user);
        if ($accessError) {
            return $accessError;
        }

        // Check capability for grade levels management
        if ($capabilityError = $this->requirePlanCapability('grade_levels.manage')) {
            return $capabilityError;
        }

        // Check if grade level is in use (check learning resources using this grade level)
        $inUse = LearningResource::where('grade_level_id', $gradeLevel->id)->exists();
        if ($inUse) {
            return $this->errorResponse(
                'Không thể xóa cấp độ/Khối đang được sử dụng',
                ['learning_resource_count' => LearningResource::where('grade_level_id', $gradeLevel->id)->count()],
                'IN_USE',
                422
            );
        }

        $gradeLevel->delete();

        // Clear cache
        // Cache clearing handled by GradeLevelObserver

        return $this->successResponse(null, 'Xóa cấp độ/Khối thành công');
    }
}
