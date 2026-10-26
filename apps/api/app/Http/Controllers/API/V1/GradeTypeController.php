<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Resources\GradeTypeResource;
use App\Models\GradeType;
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

class GradeTypeController extends BaseController
{
    /**
     * Get validation rules for grade type.
     */
    private function getValidationRules(bool $isUpdate = false, ?int $ownerId = null, ?int $excludeId = null): array
    {
        return [
            'name' => [
                $isUpdate ? 'sometimes' : 'required',
                'string',
                'max:255',
                Rule::unique('grade_types', 'name')
                    ->where(fn ($q) => $q->where('created_by', $ownerId)->whereNull('deleted_at'))
                    ->ignore($excludeId),
            ],
            'code' => 'sometimes|nullable|string|max:50',
            'description' => 'sometimes|nullable|string',
            'is_active' => 'sometimes|boolean',
            // Weight drives Grade::weightedAveragePercentage. Decimals allowed (e.g. 1.5); 0..100.
            'weight' => 'sometimes|nullable|numeric|min:0|max:100',
            'order' => 'sometimes|integer|min:0',
        ];
    }

    /**
     * Apply data isolation for grade types based on user role.
     * Returns [query, error] - error is null if access is allowed.
     */
    private function applyIsolation($query)
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return [null, $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403)];
        }

        // Super Admin: See all
        if ($user->hasRole('super_admin')) {
            return [$query, null];
        }

        // Tutor: chỉ xem loại điểm do họ tạo
        if ($user->isTutor()) {
            return [$query->where('created_by', $user->id), null];
        }

        // No access
        return [null, $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403)];
    }

    /**
     * Check if user can access a specific grade type.
     */
    private function checkAccess($type, $user): ?JsonResponse
    {
        $query = GradeType::query()->where('id', $type->id);
        [$query, $error] = $this->applyIsolation($query);

        if ($error || ! $query->exists()) {
            return $error ?? $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        return null;
    }

    /**
     * Check if user can edit a specific grade type.
     */
    private function checkEditAccess($type, $user): ?JsonResponse
    {
        // Check basic access first
        $accessError = $this->checkAccess($type, $user);
        if ($accessError) {
            return $accessError;
        }

        // Super Admin: can edit all
        if ($user->hasRole('super_admin')) {
            return null;
        }

        // Tutor: chỉ sửa loại điểm do họ tạo (created_by = user->id), không thể sửa global (created_by = null)
        if ($user->isTutor()) {
            if ($type->created_by !== $user->id) {
                return $this->errorResponse('Bạn chỉ có thể sửa loại điểm do bạn tạo', null, 'UNAUTHORIZED', 403);
            }

            return null;
        }

        return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
    }

    /**
     * Check if user can delete a specific grade type.
     */
    private function checkDeleteAccess($type, $user): ?JsonResponse
    {
        // Check basic access first
        $accessError = $this->checkAccess($type, $user);
        if ($accessError) {
            return $accessError;
        }

        // Super Admin: can delete all
        if ($user->hasRole('super_admin')) {
            return null;
        }

        // Tutor: chỉ xóa loại điểm do họ tạo (không thể xóa global types)
        if ($user->isTutor()) {
            if ($type->created_by !== $user->id) {
                return $this->errorResponse('Bạn chỉ có thể xóa loại điểm do bạn tạo', null, 'UNAUTHORIZED', 403);
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
            if ($request->is_active === '1' || $request->is_active === 'true') {
                $query->active();
            } elseif ($request->is_active === '0' || $request->is_active === 'false') {
                $query->where('is_active', false);
            }
        } else {
            // Default: only active types
            $query->active();
        }

        // Search by name or code
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%");
            });
        }

        // Sort by order then name
        $query->ordered();

        return $query;
    }

    /**
     * Get list of grade types with data isolation.
     */
    public function index(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Giáo viên cần capability grade_types.manage để xem loại điểm
        if ($capabilityError = $this->requirePlanCapability('grade_types.manage')) {
            return $capabilityError;
        }

        $cacheKey = CacheKeys::gradeTypesList($user->id, false); // Cache all (both active and inactive)

        // Get all types from cache (cache stores full list without filters)
        $allTypes = Cache::remember($cacheKey, CacheTtl::REFERENCE_DATA, function () {
            $query = GradeType::query()
                ->with(['creator']);

            [$query, $error] = $this->applyIsolation($query);
            if ($error) {
                throw new \Exception('Access denied');
            }

            // Return all (cache full list, apply filters after)
            return $query->get();
        });

        // Apply is_active filter after cache retrieval
        if ($request->has('is_active')) {
            $isActive = $request->boolean('is_active');
            $allTypes = $allTypes->filter(function ($type) use ($isActive) {
                return (bool) $type->is_active === $isActive;
            })->values();
        } else {
            // Default: only active
            $allTypes = $allTypes->filter(function ($type) {
                return (bool) $type->is_active === true;
            })->values();
        }

        // Apply search filter after cache retrieval
        if ($request->filled('search')) {
            $search = $request->get('search');
            $allTypes = $allTypes->filter(function ($type) use ($search) {
                return stripos($type->name, $search) !== false
                    || stripos($type->code ?? '', $search) !== false;
            })->values();
        }

        // Pagination (always paginated for GradeType, default 50)
        $perPage = min($request->get('per_page', 50), 100);
        $currentPage = $request->get('page', 1);

        // Manual pagination for cached collection
        $total = $allTypes->count();
        $offset = ($currentPage - 1) * $perPage;
        $items = $allTypes->slice($offset, $perPage)->values();
        $lastPage = (int) ceil($total / $perPage);

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('grade_types.manage');

        return response()->json([
            'success' => true,
            'data' => GradeTypeResource::collection($items),
            'meta' => [
                'current_page' => (int) $currentPage,
                'per_page' => $perPage,
                'total' => $total,
                'last_page' => $lastPage,
            ],
            'permissions' => $permissions,
        ]);
    }

    /**
     * Get single grade type by ID.
     */
    public function show(GradeType $gradeType): JsonResponse
    {
        // Defensive check: ensure grade type was properly resolved
        if (! $gradeType || ! $gradeType->exists || ! $gradeType->id) {
            return $this->errorResponse('Không tìm thấy loại điểm', null, 'NOT_FOUND', 404);
        }
        $cacheKey = CacheKeys::gradeTypeDetail($gradeType->id);

        $type = Cache::remember($cacheKey, CacheTtl::REFERENCE_DATA, function () use ($gradeType) {
            return $gradeType->load(['creator']);
        });

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $accessError = $this->checkAccess($type, $user);
        if ($accessError) {
            return $accessError;
        }

        // Giáo viên cần capability grade_types.manage để xem loại điểm
        if ($capabilityError = $this->requirePlanCapability('grade_types.manage')) {
            return $capabilityError;
        }

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('grade_types.manage');

        $response = $this->successResponse(
            new GradeTypeResource($type),
            'Lấy thông tin loại điểm thành công'
        );
        $responseData = $response->getData(true);
        $responseData['permissions'] = $permissions;

        return response()->json($responseData, $response->getStatusCode());
    }

    /**
     * Import grade types from CSV/XLSX.
     *
     * POST /api/v1/grade-types/import
     */
    public function import(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        if ($user->isStudent()) {
            return $this->errorResponse('Không có quyền import loại điểm', null, 'UNAUTHORIZED', 403);
        }

        if ($capabilityError = $this->requirePlanCapability('data.import')) {
            return $capabilityError;
        }

        $file = $request->file('file');
        if (! $file) {
            return $this->errorResponse('Thiếu file upload', null, 'VALIDATION_ERROR', 422);
        }

        $job = DataJobService::start('import', 'grade-types', $user, [
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
                'name' => ['name', 'tên', 'tên loại điểm', 'loại điểm'],
            ]);

            return $mapped['name'] ?? null;
        })->filter()->toArray();

        $existingQuery = GradeType::query()->whereIn('name', $names);
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
                        'name' => ['name', 'tên', 'tên loại điểm', 'loại điểm'],
                        'code' => ['code', 'mã', 'mã loại điểm'],
                        'description' => ['description', 'mô tả', 'ghi chú'],
                        'is_active' => ['is_active', 'active', 'kích hoạt', 'trạng thái'],
                        'weight' => ['weight', 'trọng số', 'hệ số'],
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
                        'weight' => isset($mapped['weight']) && is_numeric($mapped['weight']) ? (float) $mapped['weight'] : 1,
                        'order' => isset($mapped['order']) ? (int) $mapped['order'] : 0,
                    ];

                    if ($existing) {
                        $existing->update($payload);
                        $updated++;
                    } else {
                        $payload['created_by'] = $user->id;
                        GradeType::create($payload);
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
        ], 'Import loại điểm hoàn tất');
    }

    /**
     * Export grade types to CSV/Excel.
     *
     * GET /api/v1/grade-types/export
     */
    public function export(Request $request)
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        if ($user->isStudent()) {
            return $this->errorResponse('Không có quyền export loại điểm', null, 'UNAUTHORIZED', 403);
        }

        if ($capabilityError = $this->requirePlanCapability('data.export')) {
            return $capabilityError;
        }

        $query = GradeType::query();
        [$query, $isolationError] = $this->applyIsolation($query);
        if ($isolationError) {
            return $isolationError;
        }

        $types = $query->orderBy('order')->orderBy('name')->get();

        $data = $types->map(function (GradeType $type) {
            return [
                '_id' => $type->hash_id,
                'name' => $type->name,
                'code' => $type->code,
                'description' => $type->description,
                'is_active' => $type->is_active ? 1 : 0,
                'weight' => (float) $type->weight,
                'order' => $type->order,
            ];
        })->toArray();

        $reportsController = app(ReportsController::class);

        return $reportsController->handleExport($request, 'grade-types-data', function () use ($data) {
            return $data;
        });
    }

    /**
     * Create a new grade type.
     */
    public function store(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Check capability for grade types management
        if ($capabilityError = $this->requirePlanCapability('grade_types.manage')) {
            return $capabilityError;
        }

        $validator = Validator::make($request->all(), $this->getValidationRules(false, $user->id));

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        //

        $data = $request->only(['name', 'code', 'description', 'is_active', 'weight', 'order']);
        $data['created_by'] = $user->id;

        // Auto-generate code if missing
        if (empty($data['code'])) {
            $baseCode = strtoupper(Str::slug($data['name'], '_'));
            if (empty($baseCode)) {
                $baseCode = 'GRADE_TYPE_'.Str::upper(Str::random(4));
            }

            $code = $baseCode;
            while (GradeType::where('created_by', $user->id)->where('code', $code)->exists()) {
                $code = $baseCode.'_'.Str::upper(Str::random(4));
            }
            $data['code'] = $code;
        }

        // Default values
        $data['is_active'] = $data['is_active'] ?? true;
        $data['weight'] = $data['weight'] ?? 1;
        $data['order'] = $data['order'] ?? 0;

        // Check if there is a trashed grade type with the same name for this user
        $trashedGradeType = GradeType::onlyTrashed()
            ->where('created_by', $user->id)
            ->where('name', $data['name'])
            ->first();

        if ($trashedGradeType) {
            $trashedGradeType->restore();
            $trashedGradeType->update($data);
            $gradeType = $trashedGradeType;
        } else {
            $gradeType = GradeType::create($data);
        }

        // Cache clearing handled by GradeTypeObserver

        return $this->successResponse(
            new GradeTypeResource($gradeType->load(['creator'])),
            'Tạo loại điểm thành công',
            201
        );
    }

    /**
     * Update grade type.
     */
    public function update(Request $request, GradeType $gradeType): JsonResponse
    {
        // Defensive check: ensure grade type was properly resolved
        if (! $gradeType || ! $gradeType->exists || ! $gradeType->id) {
            return $this->errorResponse('Không tìm thấy loại điểm', null, 'NOT_FOUND', 404);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $accessError = $this->checkEditAccess($gradeType, $user);
        if ($accessError) {
            return $accessError;
        }

        // Check capability for grade types management
        if ($capabilityError = $this->requirePlanCapability('grade_types.manage')) {
            return $capabilityError;
        }

        $validator = Validator::make($request->all(), $this->getValidationRules(true, $gradeType->created_by, $gradeType->id));

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        $updateData = $request->only(['name', 'code', 'description', 'weight', 'order']);

        if ($request->has('is_active')) {
            $updateData['is_active'] = $request->boolean('is_active');
        }

        $gradeType->fill($updateData)->save();

        // Cache clearing handled by GradeTypeObserver

        return $this->successResponse(
            new GradeTypeResource($gradeType->fresh(['creator'])),
            'Cập nhật loại điểm thành công'
        );
    }

    /**
     * Delete grade type.
     */
    public function destroy(GradeType $gradeType): JsonResponse
    {
        // Defensive check: ensure grade type was properly resolved
        if (! $gradeType || ! $gradeType->exists || ! $gradeType->id) {
            return $this->errorResponse('Không tìm thấy loại điểm', null, 'NOT_FOUND', 404);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $accessError = $this->checkDeleteAccess($gradeType, $user);
        if ($accessError) {
            return $accessError;
        }

        // Check capability for grade types management
        if ($capabilityError = $this->requirePlanCapability('grade_types.manage')) {
            return $capabilityError;
        }

        // Check if grade type is in use
        $inUse = $gradeType->grades()->exists();
        if ($inUse) {
            return $this->errorResponse(
                'Không thể xóa loại điểm đang được sử dụng',
                ['grade_count' => $gradeType->grades()->count()],
                'IN_USE',
                422
            );
        }

        $gradeType->delete();

        // Cache clearing handled by GradeTypeObserver

        return $this->successResponse(null, 'Xóa loại điểm thành công');
    }
}
