<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Resources\AssignmentTypeResource;
use App\Models\AssignmentType;
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

class AssignmentTypeController extends BaseController
{
    /**
     * Get validation rules for assignment type.
     */
    private function getValidationRules(bool $isUpdate = false, ?int $ownerId = null, ?int $excludeId = null): array
    {
        return [
            'name' => [
                $isUpdate ? 'sometimes' : 'required',
                'string',
                'max:255',
                Rule::unique('assignment_types', 'name')
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
     * Apply data isolation for assignment types query.
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

        // No access for other roles
        return [null, $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403)];
    }

    /**
     * Check if user can access a specific assignment type.
     */
    private function checkAccess($type, $user): ?JsonResponse
    {
        if ($user->hasRole('super_admin')) {
            return null; // Super Admin can access all
        }

        if ($user->isTutor()) {
            if ($type->created_by !== $user->id) {
                return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }

            return null;
        }

        return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
    }

    /**
     * Check if user can edit a specific assignment type.
     */
    private function checkEditAccess($type, $user): ?JsonResponse
    {
        if ($user->hasRole('super_admin')) {
            return null; // Super Admin can edit all
        }

        if ($user->isTutor()) {
            // Tutor: can only edit types they created (not global types)
            if ($type->created_by !== $user->id) {
                return $this->errorResponse('Bạn chỉ có thể sửa loại bài tập do bạn tạo', null, 'UNAUTHORIZED', 403);
            }

            return null;
        }

        return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
    }

    /**
     * Check if user can delete a specific assignment type.
     */
    private function checkDeleteAccess($type, $user): ?JsonResponse
    {
        if ($user->hasRole('super_admin')) {
            return null; // Super Admin can delete all
        }

        if ($user->isTutor()) {
            // Tutor: can only delete types they created (not global types)
            if ($type->created_by !== $user->id) {
                return $this->errorResponse('Bạn chỉ có thể xóa loại bài tập do bạn tạo', null, 'UNAUTHORIZED', 403);
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
     * Get list of assignment types with data isolation.
     */
    public function index(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Giáo viên cần capability assignment_types.manage để xem loại bài tập
        if ($capabilityError = $this->requirePlanCapability('assignment_types.manage')) {
            return $capabilityError;
        }

        // Check access first (before cache)
        $query = AssignmentType::query();
        [$query, $error] = $this->applyIsolation($query, $user);
        if ($error) {
            return $error;
        }

        $cacheKey = CacheKeys::assignmentTypesList($user->id, false); // Cache all (both active and inactive)

        // Get all types from cache (cache stores full list without filters)
        $allTypes = Cache::remember($cacheKey, CacheTtl::REFERENCE_DATA, function () use ($user) {
            $query = AssignmentType::query()
                ->with(['creator']);

            // Access already checked, just apply isolation filter
            if ($user->hasRole('super_admin')) {
                // Super Admin: see all
            } elseif ($user->isTutor()) {
                $query->where('created_by', $user->id);
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
                    || stripos($type->code ?? '', $search) !== false
                    || stripos($type->description ?? '', $search) !== false;
            })->values();
        }

        // Pagination (optional - if not provided, return all)
        if ($request->has('per_page')) {
            $perPage = min($request->get('per_page', 15), 100);
            $currentPage = $request->get('page', 1);

            // Manual pagination for cached collection
            $total = $allTypes->count();
            $offset = ($currentPage - 1) * $perPage;
            $items = $allTypes->slice($offset, $perPage)->values();
            $lastPage = (int) ceil($total / $perPage);

            // Build permissions: học viên có can_view, tutor có can_manage
            $permissions = $this->buildViewManagePermissions('assignment_types.manage');

            return response()->json([
                'success' => true,
                'data' => AssignmentTypeResource::collection($items),
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
        $permissions = $this->buildViewManagePermissions('assignment_types.manage');

        // Return all (for dropdowns)
        $response = $this->successResponse(
            AssignmentTypeResource::collection($allTypes),
            'Lấy danh sách loại bài tập thành công'
        );
        $responseData = $response->getData(true);
        $responseData['permissions'] = $permissions;

        return response()->json($responseData, $response->getStatusCode());
    }

    /**
     * Import assignment types from CSV/XLSX.
     *
     * POST /api/v1/assignment-types/import
     */
    public function import(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Student cannot import
        if ($user->isStudent()) {
            return $this->errorResponse('Không có quyền import loại bài tập', null, 'UNAUTHORIZED', 403);
        }

        // Check capability for data import
        if ($capabilityError = $this->requirePlanCapability('data.import')) {
            return $capabilityError;
        }

        $file = $request->file('file');
        if (! $file) {
            return $this->errorResponse('Thiếu file upload', null, 'VALIDATION_ERROR', 422);
        }

        $job = DataJobService::start('import', 'assignment-types', $user, [
            'file_name' => $file?->getClientOriginalName(),
            'format' => $file?->getClientOriginalExtension(),
            'meta' => [
                'path' => $request->path(),
            ],
        ]);

        // Read file (require column name)
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

        // Optimize: Pre-fetch existing records to avoid N+1 queries
        $names = collect($fileData['rows'])->map(function ($row) {
            $mapped = $this->mapImportRow($row['data'], [
                'name' => ['name', 'tên', 'tên loại bài tập', 'loại bài tập'],
            ]);

            return $mapped['name'] ?? null;
        })->filter()->toArray();

        $existingQuery = AssignmentType::query()->whereIn('name', $names);
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
                        'name' => ['name', 'tên', 'tên loại bài tập', 'loại bài tập'],
                        'code' => ['code', 'mã', 'mã loại bài tập'],
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

                    // Use pre-fetched record from memory
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
                        AssignmentType::create($payload);
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

            // Log catastrophic failure
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
        ], 'Import loại bài tập hoàn tất');
    }

    /**
     * Export assignment types to CSV/Excel.
     *
     * GET /api/v1/assignment-types/export
     */
    public function export(Request $request)
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Student cannot export
        if ($user->isStudent()) {
            return $this->errorResponse('Không có quyền export loại bài tập', null, 'UNAUTHORIZED', 403);
        }

        // Check capability for data export (handled here, giống các reports)
        if ($capabilityError = $this->requirePlanCapability('data.export')) {
            return $capabilityError;
        }

        // Data isolation
        [$query, $isolationError] = $this->applyIsolation(AssignmentType::query(), $user);
        if ($isolationError) {
            return $isolationError;
        }

        $types = $query->orderBy('order')->orderBy('name')->get();

        $data = $types->map(function (AssignmentType $type) {
            return [
                '_id' => $type->hash_id,
                'name' => $type->name,
                'code' => $type->code,
                'description' => $type->description,
                'is_active' => $type->is_active ? 1 : 0,
                'order' => $type->order,
            ];
        })->toArray();

        $reportsController = app(ReportsController::class);

        return $reportsController->handleExport($request, 'assignment-types-data', function () use ($data) {
            return $data;
        });
    }

    /**
     * Get single assignment type by ID.
     */
    public function show(AssignmentType $assignmentType): JsonResponse
    {
        // Defensive check: ensure assignment type was properly resolved
        if (! $assignmentType || ! $assignmentType->exists || ! $assignmentType->id) {
            return $this->errorResponse('Không tìm thấy loại bài tập', null, 'NOT_FOUND', 404);
        }
        $cacheKey = CacheKeys::assignmentTypeDetail($assignmentType->id);

        $type = Cache::remember($cacheKey, CacheTtl::REFERENCE_DATA, function () use ($assignmentType) {
            return $assignmentType->load(['creator']);
        });

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $accessError = $this->checkAccess($type, $user);
        if ($accessError) {
            return $accessError;
        }

        // Giáo viên cần capability assignment_types.manage để xem loại bài tập
        if ($capabilityError = $this->requirePlanCapability('assignment_types.manage')) {
            return $capabilityError;
        }

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('assignment_types.manage');

        $response = $this->successResponse(
            new AssignmentTypeResource($type),
            'Lấy thông tin loại bài tập thành công'
        );
        $responseData = $response->getData(true);
        $responseData['permissions'] = $permissions;

        return response()->json($responseData, $response->getStatusCode());
    }

    /**
     * Create a new assignment type.
     */
    public function store(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Check capability for assignment types management
        if ($capabilityError = $this->requirePlanCapability('assignment_types.manage')) {
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
                $baseCode = 'ASSIGNMENT_'.Str::upper(Str::random(4));
            }

            $code = $baseCode;
            while (AssignmentType::where('created_by', $user->id)->where('code', $code)->exists()) {
                $code = $baseCode.'_'.Str::upper(Str::random(4));
            }
            $data['code'] = $code;
        }

        // Default values
        $data['is_active'] = $data['is_active'] ?? true;
        $data['order'] = $data['order'] ?? 0;

        // Check if there is a trashed assignment type with the same name for this user
        $trashedType = AssignmentType::onlyTrashed()
            ->where('created_by', $user->id)
            ->where('name', $data['name'])
            ->first();

        if ($trashedType) {
            $trashedType->restore();
            $trashedType->update($data);
            $type = $trashedType;
        } else {
            $type = AssignmentType::create($data);
        }

        // Cache clearing handled by AssignmentTypeObserver

        return $this->successResponse(
            new AssignmentTypeResource($type->load(['creator'])),
            'Tạo loại bài tập thành công',
            201
        );
    }

    /**
     * Update assignment type.
     */
    public function update(Request $request, AssignmentType $assignmentType): JsonResponse
    {
        // Defensive check: ensure assignment type was properly resolved
        if (! $assignmentType || ! $assignmentType->exists || ! $assignmentType->id) {
            return $this->errorResponse('Không tìm thấy loại bài tập', null, 'NOT_FOUND', 404);
        }
        $type = $assignmentType;

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $accessError = $this->checkEditAccess($type, $user);
        if ($accessError) {
            return $accessError;
        }

        // Check capability for assignment types management
        if ($capabilityError = $this->requirePlanCapability('assignment_types.manage')) {
            return $capabilityError;
        }

        $validator = Validator::make($request->all(), $this->getValidationRules(true, $type->created_by, $type->id));

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        $updateData = $request->only(['name', 'code', 'description', 'order']);

        if ($request->has('is_active')) {
            $updateData['is_active'] = $request->boolean('is_active');
        }

        $type->fill($updateData)->save();

        // Cache clearing handled by AssignmentTypeObserver

        return $this->successResponse(
            new AssignmentTypeResource($type->fresh(['creator'])),
            'Cập nhật loại bài tập thành công'
        );
    }

    /**
     * Delete assignment type.
     */
    public function destroy(AssignmentType $assignmentType): JsonResponse
    {
        // Defensive check: ensure assignment type was properly resolved
        if (! $assignmentType || ! $assignmentType->exists || ! $assignmentType->id) {
            return $this->errorResponse('Không tìm thấy loại bài tập', null, 'NOT_FOUND', 404);
        }
        $type = $assignmentType;

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $accessError = $this->checkDeleteAccess($type, $user);
        if ($accessError) {
            return $accessError;
        }

        // Check capability for assignment types management
        if ($capabilityError = $this->requirePlanCapability('assignment_types.manage')) {
            return $capabilityError;
        }

        // Check if assignment type is in use
        $inUse = $type->assignments()->exists();
        if ($inUse) {
            return $this->errorResponse(
                'Không thể xóa loại bài tập đang được sử dụng',
                ['assignment_count' => $type->assignments()->count()],
                'IN_USE',
                422
            );
        }

        $type->delete();

        // Cache clearing handled by AssignmentTypeObserver

        return $this->successResponse(null, 'Xóa loại bài tập thành công');
    }
}
