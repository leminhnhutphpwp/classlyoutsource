<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Resources\LearningResourceResource;
use App\Models\Enrollment;
use App\Models\GradeLevel;
use App\Models\LearningResource;
use App\Models\Media;
use App\Models\Student;
use App\Models\Subject;
use App\Models\User;
use App\Rules\ExistsHashId;
use App\Services\MediaTokenService;
use App\Services\MediaUploadService;
use App\Traits\DecodesHashIds;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class LearningResourceController extends BaseController
{
    use DecodesHashIds;

    /**
     * Get validation rules for learning resource.
     */
    private function getValidationRules(bool $isUpdate = false): array
    {
        $rules = [
            'title' => ($isUpdate ? 'sometimes|' : '').'required|string|max:255',
            'description' => 'nullable|string',
            'type' => ($isUpdate ? 'sometimes|' : '').'required|in:document,pdf,video,image,audio,link,other',
            'status' => 'nullable|in:active,archived',
            'subject_id' => ['nullable', new ExistsHashId(Subject::class)],
            'subject' => 'nullable|string|max:255',
            'grade_level_id' => ['nullable', new ExistsHashId(GradeLevel::class)],
            'grade_level' => 'nullable|string|max:255',
            'topic' => 'nullable|string|max:255',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
            'external_url' => 'nullable|url'.($isUpdate ? '' : '|required_if:type,link'),
            'is_public' => 'nullable|boolean',
            // File upload rules
            'file' => $this->buildFileValidationRule($this->getAuthUser(), true), // Single file for non-image types
            'files' => 'nullable|array|max:10', // Multiple files for image type
            'files.*' => 'file|mimes:jpeg,png,jpg,gif,webp|max:5120', // Max 5MB per image
            'media_id' => ['nullable', new ExistsHashId(Media::class)], // Single media ID
            'media_ids' => 'nullable|array|max:10', // Multiple media IDs for image type
            'media_ids.*' => ['integer', new ExistsHashId(Media::class)],
        ];

        return $rules;
    }

    /**
     * Build file validation rule (size theo cấu hình mặc định).
     */
    private function buildFileValidationRule(?User $user, bool $nullable = true): string
    {
        $rule = $nullable ? 'nullable|file' : 'file';

        // Single-tenant: use the default upload limit from config.
        $defaultMb = (int) (config('fraud.upload.max_file_mb') ?? 10);
        $rule .= '|max:'.($defaultMb * 1024);

        return $rule;
    }

    /**
     * Build custom messages for file validation (dựa trên rule max).
     */
    private function buildFileValidationMessages(string $fileRule): array
    {
        $messages = [];

        if (is_string($fileRule) && preg_match('/max:(\d+)/', $fileRule, $matches)) {
            $maxKb = (int) ($matches[1] ?? 0);
            if ($maxKb > 0) {
                $maxMb = max(1, (int) floor($maxKb / 1024));
                $messages['file.max'] = "Dung lượng file tối đa là {$maxMb}MB. Vui lòng chọn file nhỏ hơn.";
            }
        }

        return $messages;
    }

    /**
     * Apply data isolation for learning resources query.
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

        // Tutor: See their own resources
        if ($user->isTutor()) {
            // Org owner/manager see every member's resources (design R3); a plain tutor sees own.
            if ($user->isOrgViewerAll()) {
                return [$query->whereIn('tutor_id', $this->orgTutorIds()), null];
            }

            return [$query->where('tutor_id', $user->id), null];
        }

        // Student: See learning resources from their enrolled classes
        if ($user->isStudent()) {
            $student = $this->getCurrentStudent();

            if (! $student) {
                return [null, $this->errorResponse('Không tìm thấy thông tin học sinh', null, 'NOT_FOUND', 404)];
            }

            // Lấy các lớp học mà student tham gia
            $classIds = Enrollment::where('student_id', $student->id)
                ->pluck('class_id')
                ->toArray();

            if (empty($classIds)) {
                return [$query->whereRaw('1 = 0'), null]; // No classes = no resources
            }

            // Student có thể xem learning resources:
            // - Từ các assignments trong lớp họ tham gia
            return [$query->whereHas('assignments', function ($q2) use ($classIds) {
                $q2->whereIn('class_id', $classIds);
            }), null];
        }

        // Default: no access
        return [null, $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403)];
    }

    /**
     * Check if user can access a specific learning resource.
     */
    private function checkAccess($resource, $user): ?JsonResponse
    {
        $query = LearningResource::query()->where('id', $resource->id);
        [$query, $error] = $this->applyIsolation($query);

        if ($error || ! $query->exists()) {
            return $error ?? $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        return null;
    }

    /**
     * Check if user can edit a specific learning resource.
     */
    private function checkEditAccess($resource, $user): ?JsonResponse
    {
        // Student cannot edit learning resources
        if ($user->isStudent()) {
            return $this->errorResponse('Không có quyền chỉnh sửa tài liệu học tập', null, 'UNAUTHORIZED', 403);
        }

        // Check basic access first
        $accessError = $this->checkAccess($resource, $user);
        if ($accessError) {
            return $accessError;
        }

        // Super Admin: can edit all
        if ($user->hasRole('super_admin')) {
            return null;
        }

        // Tutor: can only edit their own resources
        if ($user->isTutor()) {
            if ($resource->tutor_id !== $user->id) {
                return $this->errorResponse('Bạn chỉ có thể chỉnh sửa tài liệu của mình', null, 'UNAUTHORIZED', 403);
            }

            return null;
        }

        return $this->errorResponse('Không có quyền chỉnh sửa tài liệu này', null, 'UNAUTHORIZED', 403);
    }

    /**
     * Check if user can delete a specific learning resource.
     */
    private function checkDeleteAccess($resource, $user): ?JsonResponse
    {
        // Student cannot delete learning resources
        if ($user->isStudent()) {
            return $this->errorResponse('Không có quyền xóa tài liệu học tập', null, 'UNAUTHORIZED', 403);
        }

        // Check basic access first
        $accessError = $this->checkAccess($resource, $user);
        if ($accessError) {
            return $accessError;
        }

        // Super Admin: can delete all resources
        if ($user->hasRole('super_admin')) {
            return null;
        }

        // Tutor: can only delete their own resources
        if ($resource->tutor_id !== $user->id) {
            return $this->errorResponse('Bạn chỉ có thể xóa tài liệu của mình', null, 'UNAUTHORIZED', 403);
        }

        return null;
    }

    /**
     * Apply filters (search, sort, status, etc.) to query.
     */
    private function applyFilters($query, Request $request)
    {
        // Filter by type
        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        // Filter by status (default: active)
        if ($request->has('status')) {
            $query->where('status', $request->status);
        } else {
            $query->active(); // Default: only active
        }

        // Filter by subject
        if ($request->has('subject_id')) {
            $this->decodeHashId($request, 'subject_id', Subject::class);
        }
        if ($request->has('subject_id')) {
            $query->where('subject_id', $request->subject_id);
        }

        // Filter by grade level
        if ($request->has('grade_level_id')) {
            $this->decodeHashId($request, 'grade_level_id', GradeLevel::class);
        }
        if ($request->has('grade_level_id')) {
            $query->where('grade_level_id', $request->grade_level_id);
        }

        // Filter by is_public
        if ($request->has('is_public')) {
            $query->where('is_public', $request->is_public === '1' || $request->is_public === 'true');
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('topic', 'like', "%{$search}%");
            });
        }

        // Tags search
        if ($request->has('tags')) {
            $tags = is_array($request->tags) ? $request->tags : explode(',', $request->tags);
            $query->whereJsonContains('tags', $tags);
        }

        // Filter by created_at range
        if ($request->has('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }
        if ($request->has('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        // Sort
        $sortable = ['created_at', 'updated_at', 'title', 'type', 'topic', 'subject', 'downloads', 'views'];
        $sortBy = $request->get('sort', 'created_at');
        if (! in_array($sortBy, $sortable, true)) {
            $sortBy = 'created_at';
        }
        $sortOrder = strtolower($request->get('order', 'desc')) === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sortBy, $sortOrder);

        return $query;
    }

    /**
     * Handle file upload and return media_id.
     */
    private function handleFileUpload(Request $request, User $owner, ?int $oldMediaId = null): array
    {
        // For image type, handle multiple files
        if ($request->input('type') === 'image') {
            return $this->handleMultipleImageUpload($request, $owner, $oldMediaId);
        }

        // Original single file logic for other types
        return $this->handleSingleFileUpload($request, $owner, $oldMediaId);
    }

    /**
     * Handle multiple image upload for image type.
     */
    private function handleMultipleImageUpload(Request $request, User $owner, ?int $oldMediaId = null): array
    {
        $files = $request->file('files') ?? [];
        $mediaIds = $request->input('media_ids', []);

        // If no files and no media_ids, check if we can keep old media
        if (empty($files) && empty($mediaIds) && $oldMediaId) {
            return ['media_id' => $oldMediaId, 'media_ids' => [], 'error' => null];
        }

        $uploadedMediaIds = [];

        // Upload new files
        foreach ($files as $file) {
            // Upload file
            $uploadedMedia = MediaUploadService::uploadAndCreateMedia(
                $file,
                'learning-resources',
                ['allowed_mimes' => ['image/jpeg', 'image/png', 'image/gif', 'image/webp']]
            );

            if (! $uploadedMedia['success']) {
                // Cleanup already uploaded files
                foreach ($uploadedMediaIds as $mediaId) {
                    MediaUploadService::deleteMedia($mediaId);
                }

                return ['media_id' => null, 'media_ids' => [], 'error' => $this->errorResponse($uploadedMedia['message'], null, 'UPLOAD_ERROR', 422)];
            }

            $uploadedMediaIds[] = $uploadedMedia['media_id'];
        }

        // Combine uploaded media_ids with provided media_ids
        $allMediaIds = array_merge($uploadedMediaIds, array_map('intval', $mediaIds));

        // Use first media as primary media_id for backward compatibility
        $primaryMediaId = ! empty($allMediaIds) ? $allMediaIds[0] : $oldMediaId;

        return ['media_id' => $primaryMediaId, 'media_ids' => $allMediaIds, 'error' => null];
    }

    /**
     * Handle single file upload (original logic).
     */
    private function handleSingleFileUpload(Request $request, User $owner, ?int $oldMediaId = null): array
    {
        // Get file from request (Laravel handles multipart/form-data parsing)
        $file = $request->file('file');

        // Fallback: try to get file from allFiles() if not found by name
        if (! $file) {
            $allFiles = $request->allFiles();
            $file = $allFiles['file'] ?? (! empty($allFiles) ? reset($allFiles) : null);
        }

        // Delete old media if exists and new file is being uploaded
        if ($oldMediaId && $file) {
            MediaUploadService::deleteMedia($oldMediaId);
        }

        // If media_id is provided, use it
        if ($request->has('media_id') && $request->media_id) {
            return ['media_id' => $request->media_id, 'media_ids' => [], 'error' => null];
        }

        // If file is provided, upload it
        if ($file) {
            // Upload file
            $uploadedMedia = MediaUploadService::uploadAndCreateMedia(
                $file,
                'learning-resources',
                ['allowed_mimes' => MediaUploadService::getLearningResourceAllowedMimes()]
            );

            if (! $uploadedMedia['success']) {
                return ['media_id' => null, 'error' => $this->errorResponse($uploadedMedia['message'], null, 'UPLOAD_ERROR', 422)];
            }

            return ['media_id' => $uploadedMedia['media_id'], 'media_ids' => [], 'error' => null];
        }

        // If type is not 'link' and no file/media_id provided, check if we can keep old file
        $type = $request->input('type');

        // Only require file if:
        // 1. Type is not 'link'
        // 2. No media_id provided
        // 3. No existing file (oldMediaId is null)
        // 4. This is an update operation (oldMediaId parameter was passed, even if null)
        if ($type && $type !== 'link' && ! $request->has('media_id') && ! $oldMediaId) {
            // Check if this is an update (oldMediaId parameter exists) or create (oldMediaId is null and not passed)
            // For update: if no file, no media_id, and no old file, we need file
            // But we should allow keeping old file, so only error if oldMediaId is explicitly null (no old file)
            return [
                'media_id' => null,
                'media_ids' => [],
                'error' => $this->errorResponse(
                    'Vui lòng upload file hoặc chọn media',
                    ['file' => ['File hoặc media_id là bắt buộc khi type không phải là link']],
                    'VALIDATION_ERROR',
                    422
                ),
            ];
        }

        // Keep old media_id if exists (for update without new file)
        return ['media_id' => $oldMediaId, 'media_ids' => [], 'error' => null];
    }

    /**
     * Handle is_public setting based on user role.
     */
    private function handleIsPublic($user, Request $request, ?bool $currentValue = null): bool
    {
        // Tutor can set is_public (no restrictions in tutor-only system)
        if ($request->has('is_public')) {
            return $request->is_public === '1' || $request->is_public === true;
        }

        // If updating and no is_public in request, keep current value
        if ($currentValue !== null) {
            return $currentValue;
        }

        // Default: false
        return false;
    }

    /**
     * Attach multiple media files to learning resource.
     */
    private function attachMediaFiles(LearningResource $resource, array $mediaIds): void
    {
        if (empty($mediaIds)) {
            return;
        }

        // Get current max order
        $maxOrder = $resource->mediaFiles()->max('order') ?? -1;

        // Attach new media files with incremental order
        $attachData = [];
        foreach ($mediaIds as $index => $mediaId) {
            $attachData[$mediaId] = ['order' => $maxOrder + 1 + $index];
        }

        $resource->mediaFiles()->attach($attachData);
    }

    /**
     * Get list of learning resources with data isolation.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        // Học viên: có thể xem learning resources của chính họ (không cần capability)
        // Giáo viên: cần capability learning_resources.manage để xem learning resources
        if ($user && ! $user->isStudent()) {
            if ($capabilityError = $this->requirePlanCapability('learning_resources.manage')) {
                return $capabilityError;
            }
        }

        $query = LearningResource::query()
            ->with(['tutor', 'subject', 'gradeLevel', 'media']);

        [$query, $error] = $this->applyIsolation($query);
        if ($error) {
            return $error;
        }

        $query = $this->applyFilters($query, $request);

        // Pagination
        $perPage = min($request->get('per_page', 15), 100);
        $resources = $query->paginate($perPage);

        // Calculate statistics (on all data, not filtered/paginated)
        $statsQuery = LearningResource::query();
        [$statsQuery, $error] = $this->applyIsolation($statsQuery);
        if ($error) {
            // If isolation fails, return empty statistics
            $statistics = [
                'total' => 0,
                'document' => 0,
                'pdf' => 0,
                'video' => 0,
                'image' => 0,
                'audio' => 0,
                'link' => 0,
                'other' => 0,
            ];
        } else {
            $statistics = [
                'total' => $statsQuery->count(),
                'document' => (clone $statsQuery)->where('type', 'document')->count(),
                'pdf' => (clone $statsQuery)->where('type', 'pdf')->count(),
                'video' => (clone $statsQuery)->where('type', 'video')->count(),
                'image' => (clone $statsQuery)->where('type', 'image')->count(),
                'audio' => (clone $statsQuery)->where('type', 'audio')->count(),
                'link' => (clone $statsQuery)->where('type', 'link')->count(),
                'other' => (clone $statsQuery)->where('type', 'other')->count(),
            ];
        }

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('learning_resources.manage');

        return response()->json([
            'success' => true,
            'data' => LearningResourceResource::collection($resources),
            'meta' => [
                'current_page' => $resources->currentPage(),
                'per_page' => $resources->perPage(),
                'total' => $resources->total(),
                'last_page' => $resources->lastPage(),
                'statistics' => $statistics,
            ],
            'permissions' => $permissions,
        ]);
    }

    /**
     * Get single learning resource by ID.
     */
    public function show(LearningResource $learningResource): JsonResponse
    {
        // Defensive check: ensure learning resource was properly resolved
        if (! $learningResource || ! $learningResource->exists || ! $learningResource->id) {
            return $this->errorResponse('Không tìm thấy tài liệu học tập', null, 'NOT_FOUND', 404);
        }
        $resource = $learningResource->load(['tutor', 'subject', 'gradeLevel', 'media', 'mediaFiles']);

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Học viên: có thể xem learning resources của chính họ (không cần capability)
        // Giáo viên: cần capability learning_resources.manage để xem learning resources
        if (! $user->isStudent()) {
            if ($capabilityError = $this->requirePlanCapability('learning_resources.manage')) {
                return $capabilityError;
            }
        }

        $accessError = $this->checkAccess($resource, $user);
        if ($accessError) {
            return $accessError;
        }

        // Increment view count
        $resource->incrementViews();

        // Build permissions: học viên có can_view, tutor có can_manage
        $permissions = $this->buildViewManagePermissions('learning_resources.manage');

        $response = $this->successResponse(
            new LearningResourceResource($resource),
            'Lấy thông tin tài liệu thành công'
        );
        $responseData = $response->getData(true);
        $responseData['permissions'] = $permissions;

        return response()->json($responseData, $response->getStatusCode());
    }

    /**
     * Create new learning resource.
     */
    public function store(Request $request): JsonResponse
    {
        $rules = $this->getValidationRules();

        // Tuỳ biến thông báo lỗi dung lượng file cho thân thiện
        $messages = $this->buildFileValidationMessages($rules['file'] ?? '');

        $validator = Validator::make($request->all(), $rules, $messages);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        // Decode HashIDs to integer IDs
        $idsToDecode = $request->only(['subject_id', 'grade_level_id', 'media_id']);
        $this->decodeHashId($idsToDecode, 'subject_id', Subject::class);
        $this->decodeHashId($idsToDecode, 'grade_level_id', GradeLevel::class);
        $this->decodeHashId($idsToDecode, 'media_id', Media::class);
        $request->merge($idsToDecode);

        // Validate: if type is not 'link', must have file/files or media_id/media_ids
        if ($request->type !== 'link') {
            $hasFile = $request->hasFile('file') || $request->hasFile('files');
            $hasMedia = $request->media_id || ! empty($request->media_ids);

            if (! $hasFile && ! $hasMedia) {
                return $this->errorResponse(
                    'Vui lòng upload file hoặc chọn media',
                    ['file' => ['File hoặc media_id là bắt buộc khi type không phải là link']],
                    'VALIDATION_ERROR',
                    422
                );
            }
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Check capability for learning resources management
        if ($capabilityError = $this->requirePlanCapability('learning_resources.manage')) {
            return $capabilityError;
        }

        // Student cannot create learning resources
        if ($user->isStudent()) {
            return $this->errorResponse('Không có quyền tạo tài liệu học tập', null, 'UNAUTHORIZED', 403);
        }

        // Handle file upload
        $uploadResult = $this->handleFileUpload($request, $user);
        if ($uploadResult['error']) {
            return $uploadResult['error'];
        }

        $resourceData = $request->only([
            'title', 'description', 'type', 'status', 'subject_id', 'subject',
            'grade_level_id', 'grade_level', 'topic', 'tags', 'external_url',
        ]);

        $resourceData['tutor_id'] = $user->id;
        $resourceData['media_id'] = $uploadResult['media_id'];
        $resourceData['status'] = $resourceData['status'] ?? 'active';
        $resourceData['is_public'] = $this->handleIsPublic($user, $request);

        $resource = LearningResource::create($resourceData);

        // Attach multiple media files for image type
        if ($request->type === 'image' && ! empty($uploadResult['media_ids'])) {
            $this->attachMediaFiles($resource, $uploadResult['media_ids']);
        }

        return $this->successResponse(
            new LearningResourceResource($resource->load(['tutor', 'subject', 'gradeLevel', 'media', 'mediaFiles'])),
            'Tạo tài liệu thành công',
            201
        );
    }

    /**
     * Update learning resource.
     */
    public function update(Request $request, LearningResource $learningResource): JsonResponse
    {
        // Defensive check: ensure learning resource was properly resolved
        if (! $learningResource || ! $learningResource->exists || ! $learningResource->id) {
            return $this->errorResponse('Không tìm thấy tài liệu học tập', null, 'NOT_FOUND', 404);
        }
        $resource = $learningResource;

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Check capability for learning resources management
        if ($capabilityError = $this->requirePlanCapability('learning_resources.manage')) {
            return $capabilityError;
        }

        $accessError = $this->checkEditAccess($resource, $user);
        if ($accessError) {
            return $accessError;
        }

        // Get validation rules and adjust for update
        // For update: file is ALWAYS optional (can keep existing file)
        // The handleFileUpload() method will check if file is needed
        $rules = $this->getValidationRules(true);

        // Tuỳ biến thông báo lỗi dung lượng file cho thân thiện
        $messages = $this->buildFileValidationMessages($rules['file'] ?? '');

        $validator = Validator::make($request->all(), $rules, $messages);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        // Decode HashIDs to integer IDs
        $idsToDecode = $request->only(['subject_id', 'grade_level_id', 'media_id']);
        $this->decodeHashId($idsToDecode, 'subject_id', Subject::class);
        $this->decodeHashId($idsToDecode, 'grade_level_id', GradeLevel::class);
        $this->decodeHashId($idsToDecode, 'media_id', Media::class);
        $request->merge($idsToDecode);

        // Tutor can set is_public (no restrictions in tutor-only system)

        $resource->loadMissing('tutor');
        $owner = $resource->tutor instanceof User ? $resource->tutor : $user;

        // Handle file upload
        $uploadResult = $this->handleFileUpload($request, $owner, $resource->media_id);
        if ($uploadResult['error']) {
            return $uploadResult['error'];
        }

        $updateData = $request->only([
            'title', 'description', 'type', 'status', 'subject_id', 'subject',
            'grade_level_id', 'grade_level', 'topic', 'tags', 'external_url',
        ]);

        $updateData['media_id'] = $uploadResult['media_id'];
        $updateData['is_public'] = $this->handleIsPublic($user, $request, $resource->is_public);

        $resource->update($updateData);

        // Update multiple media files for image type
        if ($request->input('type') === 'image') {
            // Handle deleted media files first
            if ($request->has('deleted_media_ids') && ! empty($request->deleted_media_ids)) {
                $deletedMediaIds = collect($request->deleted_media_ids)->map(function ($id) {
                    // Media model doesn't have decodeId, use LearningResource instead
                    return is_numeric($id) ? (int) $id : LearningResource::decodeId($id);
                })->filter()->toArray();

                if (! empty($deletedMediaIds)) {
                    // Detach from learning resource
                    $resource->mediaFiles()->detach($deletedMediaIds);

                    // Delete media files
                    Media::whereIn('id', $deletedMediaIds)->delete();
                }
            }

            // Attach new media files if any
            if (isset($uploadResult['media_ids'])) {
                $this->attachMediaFiles($resource, $uploadResult['media_ids']);
            }
        }

        // Reload relationships to ensure media is loaded
        $resource->load(['tutor', 'subject', 'gradeLevel', 'media', 'mediaFiles']);

        return $this->successResponse(
            new LearningResourceResource($resource),
            'Cập nhật tài liệu thành công'
        );
    }

    /**
     * Delete learning resource.
     */
    public function destroy(LearningResource $learningResource): JsonResponse
    {
        // Defensive check: ensure learning resource was properly resolved
        if (! $learningResource || ! $learningResource->exists || ! $learningResource->id) {
            return $this->errorResponse('Không tìm thấy tài liệu học tập', null, 'NOT_FOUND', 404);
        }
        $resource = $learningResource;

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Check capability for learning resources management
        if ($capabilityError = $this->requirePlanCapability('learning_resources.manage')) {
            return $capabilityError;
        }

        $accessError = $this->checkDeleteAccess($resource, $user);
        if ($accessError) {
            return $accessError;
        }

        $resource->loadMissing(['tutor']);
        $owner = $resource->tutor instanceof User ? $resource->tutor : $user;

        // Observer will handle media cleanup automatically
        $resource->delete();

        return $this->successResponse(null, 'Xóa tài liệu thành công');
    }

    /**
     * Upload file endpoint (standalone) - Creates Media record.
     */
    public function upload(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|max:10240', // Max 10MB
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Check capability for learning resources management
        if ($capabilityError = $this->requirePlanCapability('learning_resources.manage')) {
            return $capabilityError;
        }

        $file = $request->file('file');

        // Upload file
        $uploadedMedia = MediaUploadService::uploadAndCreateMedia(
            $file,
            'learning-resources',
            ['allowed_mimes' => MediaUploadService::getLearningResourceAllowedMimes()]
        );

        if (! $uploadedMedia['success']) {
            return $this->errorResponse($uploadedMedia['message'], null, 'UPLOAD_ERROR', 422);
        }

        return $this->successResponse([
            'media_id' => $uploadedMedia['media_id'],
            'file_path' => $uploadedMedia['path'],
            'file_url' => $uploadedMedia['url'],
            'file_name' => $uploadedMedia['name'],
            'file_size' => $uploadedMedia['size'],
            'mime_type' => $uploadedMedia['mime_type'],
        ], 'Upload file thành công');
    }

    /**
     * Upload multiple images endpoint for image type learning resources.
     */
    public function uploadImages(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'files' => 'required|array|max:10',
            'files.*' => 'file|mimes:jpeg,png,jpg,gif,webp|max:5120', // Max 5MB per image
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Check capability for learning resources management
        if ($capabilityError = $this->requirePlanCapability('learning_resources.manage')) {
            return $capabilityError;
        }

        $files = $request->file('files');
        $uploadedMedia = [];
        $totalSize = 0;

        foreach ($files as $file) {
            $totalSize += (int) $file->getSize();

            // Upload file
            $result = MediaUploadService::uploadAndCreateMedia(
                $file,
                'learning-resources',
                ['allowed_mimes' => ['image/jpeg', 'image/png', 'image/gif', 'image/webp']]
            );

            if (! $result['success']) {
                // Cleanup already uploaded files
                foreach ($uploadedMedia as $media) {
                    MediaUploadService::deleteMedia($media['media_id']);
                }

                return $this->errorResponse($result['message'], null, 'UPLOAD_ERROR', 422);
            }

            $uploadedMedia[] = $result;
        }

        return $this->successResponse([
            'uploaded_files' => array_map(function ($media) {
                return [
                    'media_id' => $media['media_id'],
                    'file_name' => $media['name'],
                    'file_size' => $media['size'],
                    'mime_type' => $media['mime_type'],
                ];
            }, $uploadedMedia),
            'total_files' => count($uploadedMedia),
            'total_size' => $totalSize,
        ], 'Upload hình ảnh thành công');
    }

    /**
     * Validate token and check access to resource.
     *
     * @return array{0: LearningResource|null, 1: User|null, 2: JsonResponse|null}
     */
    private function validateTokenAndAccess(int $resourceId, ?string $token, string $action = 'download'): array
    {
        $user = null;
        $useMediaToken = false;

        // Validate token if provided
        if ($token) {
            // Laravel automatically URL decodes query parameters, but handle double-encoding
            // Try to decode if it looks encoded (contains %)
            if (str_contains($token, '%')) {
                $token = urldecode($token);
            }

            $payload = MediaTokenService::validateToken($token);
            if (! $payload) {
                \Log::channel('media')->warning('MediaTokenService: Token validation failed in controller', [
                    'resource_id' => $resourceId,
                    'action' => $action,
                ]);

                return [null, null, $this->errorResponse('Token không hợp lệ hoặc đã hết hạn', null, 'UNAUTHORIZED', 401)];
            }

            // Verify resource ID matches
            if ($payload['resource_id'] != $resourceId) {
                \Log::channel('media')->warning('MediaTokenService: Resource ID mismatch', [
                    'token_resource_id' => $payload['resource_id'],
                    'request_resource_id' => $resourceId,
                ]);

                return [null, null, $this->errorResponse('Token không khớp với resource', null, 'UNAUTHORIZED', 401)];
            }

            // Get user from token
            $user = User::find($payload['user_id']);
            if (! $user) {
                return [null, null, $this->errorResponse('User không tồn tại', null, 'UNAUTHORIZED', 401)];
            }

            $useMediaToken = true;
        } else {
            // Fallback to JWT auth if no token
            [$user, $error] = $this->requireAuth();
            if ($error) {
                return [null, null, $error];
            }
        }

        // Get resource with media files relationship for image galleries
        $resource = LearningResource::with(['media', 'mediaFiles'])->find($resourceId);
        if (! $resource) {
            return [null, null, $this->errorResponse('Không tìm thấy tài liệu', null, 'NOT_FOUND', 404)];
        }

        // Check access (pass user explicitly)
        $accessError = $this->checkAccessForUser($resource, $user);
        if ($accessError) {
            return [null, null, $accessError];
        }

        return [$resource, $user, null];
    }

    /**
     * Check capability for a specific user (not from auth context).
     */
    private function requirePlanCapabilityForUser(string $capabilityKey, User $user): ?JsonResponse
    {
        if ($user->isSuperAdmin()) {
            return null;
        }

        // Single-tenant: tutor-side roles have access; students are read-only.
        if (! $this->userHasPermissionFromCapabilityForUser($capabilityKey, $user)) {
            $message = $user->isStudent()
                ? 'Tính năng này hiện không khả dụng cho học viên.'
                : 'Tính năng này không khả dụng cho vai trò của bạn.';

            return $this->errorResponse(
                $message,
                null,
                'FEATURE_NOT_AVAILABLE',
                403
            );
        }

        return null;
    }

    /**
     * Check if user has permission from capability (for specific user, not from auth context).
     */
    private function userHasPermissionFromCapabilityForUser(string $capabilityKey, User $user): bool
    {
        // Single-tenant: tutor-side roles have capability access; students do not.
        return ! $user->isStudent();
    }

    /**
     * Check access for a specific user (not from auth context).
     *
     * @param  LearningResource  $resource
     * @param  User  $user
     */
    private function checkAccessForUser($resource, $user): ?JsonResponse
    {
        $query = LearningResource::query()->where('id', $resource->id);
        [$query, $error] = $this->applyIsolationForUser($query, $user);

        if ($error || ! $query->exists()) {
            return $error ?? $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        return null;
    }

    /**
     * Apply data isolation for a specific user (not from auth context).
     *
     * @param  Builder  $query
     * @param  User  $user
     * @return array{0: Builder|null, 1: JsonResponse|null}
     */
    private function applyIsolationForUser($query, $user)
    {
        if (! $user) {
            return [null, $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403)];
        }

        // Super Admin: See all
        if ($user->hasRole('super_admin')) {
            return [$query, null];
        }

        // Tutor: See their own resources
        if ($user->isTutor()) {
            // Org owner/manager see every member's resources (design R3); a plain tutor sees own.
            if ($user->isOrgViewerAll()) {
                return [$query->whereIn('tutor_id', $this->orgTutorIds()), null];
            }

            return [$query->where('tutor_id', $user->id), null];
        }

        // Student: See learning resources from their enrolled classes
        if ($user->isStudent()) {
            $student = Student::where('user_id', $user->id)->first();

            if (! $student) {
                return [null, $this->errorResponse('Không tìm thấy thông tin học sinh', null, 'NOT_FOUND', 404)];
            }

            // Lấy các lớp học mà student tham gia
            $classIds = Enrollment::where('student_id', $student->id)
                ->pluck('class_id')
                ->toArray();

            if (empty($classIds)) {
                return [$query->whereRaw('1 = 0'), null]; // No classes = no resources
            }

            // Student có thể xem learning resources từ các assignments trong các lớp họ tham gia
            return [$query->whereHas('assignments', function ($q2) use ($classIds) {
                $q2->whereIn('class_id', $classIds);
            }), null];
        }

        // Default: no access
        return [null, $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403)];
    }

    /**
     * Get target media for request (handles HashID decoding for media_id parameter).
     */
    private function getTargetMedia($resource, ?string $requestedMediaId): array
    {
        $targetMedia = null;

        if ($requestedMediaId && $resource->type === 'image' && $resource->relationLoaded('mediaFiles')) {
            // Decode HashID to real media ID (using LearningResource's HashID system for media IDs)
            $realMediaId = LearningResource::decodeId($requestedMediaId);
            if (! $realMediaId) {
                return [null, $this->errorResponse('Media ID không hợp lệ', null, 'INVALID_ID', 400)];
            }

            // Find the specific media file in the gallery
            $targetMedia = $resource->mediaFiles->firstWhere('id', $realMediaId);
            if (! $targetMedia) {
                return [null, $this->errorResponse('Không tìm thấy file trong gallery', null, 'NOT_FOUND', 404)];
            }
        } else {
            // Use primary media
            $targetMedia = $resource->media;
        }

        return [$targetMedia, null];
    }

    /**
     * Download learning resource file.
     */
    public function download($learningResource): StreamedResponse|JsonResponse
    {
        try {
            $resourceId = LearningResource::decodeId($learningResource);
            if (! $resourceId) {
                return $this->errorResponse('ID không hợp lệ', null, 'INVALID_ID', 400);
            }

            [$resource, $user, $error] = $this->validateTokenAndAccess($resourceId, $this->getTokenFromRequest(), 'download');
            if ($error) {
                return $error;
            }

            // Check if specific media_id is requested (for image galleries)
            $requestedMediaId = request()->query('media_id');
            [$targetMedia, $error] = $this->getTargetMedia($resource, $requestedMediaId);
            if ($error) {
                return $error;
            }

            // If using Media
            if ($targetMedia) {
                $fileInfo = $this->getFileInfo($targetMedia, $resourceId);
                if ($fileInfo['error']) {
                    return $fileInfo['error'];
                }

                // Increment downloads after validation
                $resource->incrementDownloads();

                return $this->streamFileResponse(
                    $fileInfo['disk'],
                    $fileInfo['filePath'],
                    $fileInfo['fileName'],
                    $fileInfo['mimeType'],
                    'attachment',
                    ['Cache-Control' => 'no-cache, no-store, must-revalidate', 'Pragma' => 'no-cache', 'Expires' => '0']
                );
            }

            // External URL
            if ($resource->external_url) {
                $resource->incrementDownloads();

                return response()->json([
                    'success' => true,
                    'url' => $resource->external_url,
                    'message' => 'Vui lòng truy cập link bên ngoài',
                ]);
            }

            return $this->errorResponse('Không tìm thấy file', null, 'NOT_FOUND', 404);
        } catch (\Exception $e) {
            \Log::channel('media')->error('LearningResource download: Exception', [
                'id' => $learningResource,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return $this->errorResponse('Lỗi khi tải file: '.$e->getMessage(), null, 'SERVER_ERROR', 500);
        }
    }

    /**
     * Preview learning resource (for images, PDFs, etc.).
     * Auto-selects optimized version if available, otherwise uses original.
     */
    public function preview($learningResource): StreamedResponse|JsonResponse
    {
        try {
            $resourceId = LearningResource::decodeId($learningResource);
            if (! $resourceId) {
                return $this->errorResponse('ID không hợp lệ', null, 'INVALID_ID', 400);
            }

            [$resource, $user, $error] = $this->validateTokenAndAccess($resourceId, $this->getTokenFromRequest(), 'preview');
            if ($error) {
                return $error;
            }

            // Check if specific media_id is requested (for image galleries)
            $requestedMediaId = request()->query('media_id');
            [$targetMedia, $error] = $this->getTargetMedia($resource, $requestedMediaId);
            if ($error) {
                return $error;
            }

            if (! $targetMedia) {
                return $this->errorResponse('Tài liệu không có file để xem', null, 'NOT_FOUND', 404);
            }

            // Auto-select optimized version if available and ready
            $useOptimized = $targetMedia->optimized_path &&
                           $targetMedia->optimize_status === 'done' &&
                           Storage::disk($targetMedia->disk ?? 'public')->exists($targetMedia->optimized_path);

            if ($useOptimized) {
                $fileInfo = $this->getOptimizedFileInfo($targetMedia, $resourceId);
            } else {
                $fileInfo = $this->getFileInfo($targetMedia, $resourceId);
            }

            if ($fileInfo['error']) {
                return $fileInfo['error'];
            }

            // Check if file type can be previewed
            if (! $this->canPreviewFile($fileInfo['mimeType'], $targetMedia->ext ?? '')) {
                // File cannot be previewed, redirect to download
                $downloadUrl = MediaTokenService::generateSignedUrl($resource->id, $user->id, 'download', 60);
                if ($requestedMediaId) {
                    $downloadUrl .= '&media_id='.$requestedMediaId;
                }

                return response()->json([
                    'success' => false,
                    'message' => 'Loại file này không thể xem trước. Vui lòng tải xuống để xem.',
                    'download_url' => $downloadUrl,
                    'code' => 'PREVIEW_NOT_SUPPORTED',
                ], 400);
            }

            // Increment views
            $resource->incrementViews();

            return $this->streamFileResponse(
                $fileInfo['disk'],
                $fileInfo['filePath'],
                $fileInfo['fileName'],
                $fileInfo['mimeType'],
                'inline',
                ['Cache-Control' => 'public, max-age=3600', 'X-Content-Type-Options' => 'nosniff']
            );
        } catch (\Exception $e) {
            \Log::channel('media')->error('LearningResource preview: Exception', [
                'id' => $learningResource,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse('Lỗi khi xem file: '.$e->getMessage(), null, 'SERVER_ERROR', 500);
        }
    }

    /**
     * Stream learning resource (for video/audio with range support).
     * Auto-selects optimized version if available, otherwise uses original.
     */
    public function stream($learningResource): StreamedResponse|JsonResponse
    {
        try {
            $resourceId = LearningResource::decodeId($learningResource);
            if (! $resourceId) {
                return $this->errorResponse('ID không hợp lệ', null, 'INVALID_ID', 400);
            }

            [$resource, $user, $error] = $this->validateTokenAndAccess($resourceId, $this->getTokenFromRequest(), 'stream');
            if ($error) {
                return $error;
            }

            if (! $resource->media_id || ! $resource->media) {
                return $this->errorResponse('Tài liệu không có file để phát', null, 'NOT_FOUND', 404);
            }

            $targetMedia = $resource->media;

            // Auto-select optimized version if available and ready
            $useOptimized = $targetMedia->optimized_path &&
                           $targetMedia->optimize_status === 'done' &&
                           Storage::disk($targetMedia->disk ?? 'public')->exists($targetMedia->optimized_path);

            if ($useOptimized) {
                $fileInfo = $this->getOptimizedFileInfo($targetMedia, $resourceId);
            } else {
                $fileInfo = $this->getFileInfo($targetMedia, $resourceId);
            }

            if ($fileInfo['error']) {
                return $fileInfo['error'];
            }

            $mimeType = $fileInfo['mimeType'];
            $asciiFallback = Str::ascii($fileInfo['fileName']) ?: 'preview';
            $dispositionHeader = 'inline; filename="'.$asciiFallback.'"; filename*=UTF-8\'\''.rawurlencode($fileInfo['fileName']);

            // Allow streaming for video, audio, and PDF (range-friendly for PDF viewers)
            $isVideo = str_starts_with($mimeType, 'video/');
            $isAudio = str_starts_with($mimeType, 'audio/');
            $isPdf = $mimeType === 'application/pdf';

            if (! $isVideo && ! $isAudio && ! $isPdf) {
                return $this->errorResponse('Chỉ video, audio, hoặc PDF mới hỗ trợ streaming', null, 'BAD_REQUEST', 400);
            }

            // Increment views
            $resource->incrementViews();

            // Support HTTP Range requests for video/audio streaming
            $fileSize = Storage::disk($fileInfo['disk'])->size($fileInfo['filePath']);
            $range = request()->header('Range');

            if ($range) {
                // Parse range header
                preg_match('/bytes=(\d+)-(\d*)/', $range, $matches);
                $start = (int) ($matches[1] ?? 0);
                $end = isset($matches[2]) && $matches[2] !== '' ? (int) $matches[2] : $fileSize - 1;
                $length = $end - $start + 1;

                // Validate range
                if ($start >= $fileSize || $end >= $fileSize || $start > $end) {
                    return response('', 416, [
                        'Content-Range' => "bytes */{$fileSize}",
                    ]);
                }

                return response()->stream(function () use ($fileInfo, $start, $length) {
                    $stream = Storage::disk($fileInfo['disk'])->readStream($fileInfo['filePath']);
                    fseek($stream, $start);
                    echo fread($stream, $length);
                    fclose($stream);
                }, 206, [
                    'Content-Type' => $mimeType,
                    'Content-Length' => $length,
                    'Content-Range' => "bytes {$start}-{$end}/{$fileSize}",
                    'Accept-Ranges' => 'bytes',
                    'Content-Disposition' => $dispositionHeader,
                    'Cache-Control' => 'public, max-age=3600',
                ]);
            }

            // No range request, return full file
            return $this->streamFileResponse(
                $fileInfo['disk'],
                $fileInfo['filePath'],
                $fileInfo['fileName'],
                $mimeType,
                'inline',
                [
                    'Content-Length' => $fileSize,
                    'Accept-Ranges' => 'bytes',
                    'Content-Disposition' => $dispositionHeader,
                    'Cache-Control' => 'public, max-age=3600',
                ]
            );
        } catch (\Exception $e) {
            \Log::channel('media')->error('LearningResource stream: Exception', [
                'id' => $learningResource,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse('Lỗi khi phát file: '.$e->getMessage(), null, 'SERVER_ERROR', 500);
        }
    }

    /**
     * Get thumbnail for learning resource (for videos, images).
     */
    public function thumbnail($learningResource): StreamedResponse|JsonResponse
    {
        try {
            $resourceId = LearningResource::decodeId($learningResource);
            if (! $resourceId) {
                return $this->errorResponse('ID không hợp lệ', null, 'INVALID_ID', 400);
            }

            [$resource, $user, $error] = $this->validateTokenAndAccess($resourceId, $this->getTokenFromRequest(), 'thumbnail');
            if ($error) {
                return $error;
            }

            // Check if specific media_id is requested (for image galleries)
            $requestedMediaId = request()->query('media_id');
            [$targetMedia, $error] = $this->getTargetMedia($resource, $requestedMediaId);
            if ($error) {
                return $error;
            }

            if (! $targetMedia) {
                return $this->errorResponse('Tài liệu không có file', null, 'NOT_FOUND', 404);
            }

            $fileInfo = $this->getFileInfo($targetMedia, $resourceId);
            if ($fileInfo['error']) {
                return $fileInfo['error'];
            }

            // For images, return resized version
            if (str_starts_with($fileInfo['mimeType'], 'image/')) {
                // TODO: Implement image resizing with Intervention Image or similar
                // For now, return original image
                return Storage::disk($fileInfo['disk'])->response($fileInfo['filePath'], null, [
                    'Content-Type' => $fileInfo['mimeType'],
                    'Cache-Control' => 'public, max-age=86400',
                ]);
            }

            // For videos, return a lightweight transparent placeholder (avoid breaking clients)
            if (str_starts_with($fileInfo['mimeType'], 'video/')) {
                // Stream a 1x1 transparent PNG to satisfy response type constraints
                $png = $this->transparentPng();

                return response()->stream(function () use ($png) {
                    echo $png;
                }, 200, [
                    'Content-Type' => 'image/png',
                    'Cache-Control' => 'public, max-age=86400',
                ]);
            }

            return $this->errorResponse('Thumbnail chưa được hỗ trợ cho loại file này', null, 'NOT_IMPLEMENTED', 501);
        } catch (\Exception $e) {
            \Log::channel('media')->error('LearningResource thumbnail: Exception', [
                // $resourceId may not have been decoded yet when the exception occurs;
                // the route parameter is always available and avoids masking the root error.
                'id' => $learningResource,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse('Lỗi khi tạo thumbnail: '.$e->getMessage(), null, 'SERVER_ERROR', 500);
        }
    }

    /**
     * Return a 1x1 transparent PNG binary for placeholder thumbnails.
     */
    private function transparentPng(): string
    {
        // Base64 for a 1x1 transparent PNG
        return base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HwAE/wJ/lUxsGwAAAABJRU5ErkJggg==');
    }

    /**
     * Get optimized file info for media.
     */
    private function getOptimizedFileInfo($media, int $resourceId): array
    {
        if (! $media->optimized_path) {
            return ['error' => $this->errorResponse('File tối ưu không tồn tại', null, 'NOT_FOUND', 404)];
        }

        $disk = $media->disk ?? 'public';
        $filePath = $media->optimized_path;

        if (! Storage::disk($disk)->exists($filePath)) {
            return ['error' => $this->errorResponse('File tối ưu không tồn tại trên storage', null, 'NOT_FOUND', 404)];
        }

        // Determine MIME type based on file extension
        $extension = pathinfo($filePath, PATHINFO_EXTENSION);
        $mimeType = match (strtolower($extension)) {
            'webp' => 'image/webp',
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'mp4' => 'video/mp4',
            'webm' => 'video/webm',
            default => Storage::disk($disk)->mimeType($filePath) ?? 'application/octet-stream'
        };

        $fileName = basename($filePath);

        return [
            'error' => null,
            'disk' => $disk,
            'filePath' => $filePath,
            'fileName' => $fileName,
            'mimeType' => $mimeType,
        ];
    }

    /**
     * Check if a file type can be previewed in browser.
     */
    private function canPreviewFile(string $mimeType, string $extension = ''): bool
    {
        // Images - can always preview
        if (str_starts_with($mimeType, 'image/')) {
            return true;
        }

        // PDF - can preview
        if ($mimeType === 'application/pdf') {
            return true;
        }

        // Text files - can preview
        if (in_array($mimeType, ['text/plain', 'text/html', 'text/css', 'text/javascript', 'text/csv'])) {
            return true;
        }

        // Check by extension for common text-based formats
        $textExtensions = ['txt', 'md', 'json', 'xml', 'csv', 'log'];
        if (in_array(strtolower($extension), $textExtensions)) {
            return true;
        }

        // Video and audio should use stream endpoint, not preview
        if (str_starts_with($mimeType, 'video/') || str_starts_with($mimeType, 'audio/')) {
            return false;
        }

        // Office documents, archives, and other binary files cannot be previewed
        $nonPreviewableMimes = [
            // Office documents
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
            // Archives
            'application/zip',
            'application/x-rar-compressed',
            'application/x-7z-compressed',
            'application/x-tar',
            'application/gzip',
            // Other
            'application/octet-stream',
        ];

        if (in_array($mimeType, $nonPreviewableMimes)) {
            return false;
        }

        // Check by extension for common non-previewable formats
        $nonPreviewableExtensions = [
            'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
            'zip', 'rar', '7z', 'tar', 'gz',
            'exe', 'dmg', 'deb', 'rpm',
        ];

        if (in_array(strtolower($extension), $nonPreviewableExtensions)) {
            return false;
        }

        // Default: allow preview for unknown types (let browser decide)

        return true;
    }

    /**
     * Get token from request query string (with URL decoding).
     */
    private function getTokenFromRequest(): ?string
    {
        $token = request()->query('token');
        if ($token && str_contains($token, '%')) {
            // Decode in case it's double-encoded
            $token = urldecode($token);
        }

        return $token;
    }

    /**
     * Get file information from media object.
     *
     * @param  Media  $media
     * @param  int  $resourceId  For logging purposes
     * @return array{disk: string, filePath: string, fileName: string, mimeType: string, error: JsonResponse|null}
     */
    private function getFileInfo($media, int $resourceId): array
    {
        $filePath = $media->path;
        $disk = $media->disk ?? 'public';

        if (! Storage::disk($disk)->exists($filePath)) {
            \Log::channel('media')->error('LearningResource: File not found', [
                'resource_id' => $resourceId,
                'file_path' => $filePath,
                'disk' => $disk,
            ]);

            return [
                'disk' => $disk,
                'filePath' => $filePath,
                'fileName' => '',
                'mimeType' => 'application/octet-stream',
                'error' => $this->errorResponse('File không tồn tại trong storage', null, 'NOT_FOUND', 404),
            ];
        }

        // Get file name from media or use original filename
        $fileName = $media->name ?? basename($filePath);

        // Ensure proper file extension
        if (! pathinfo($fileName, PATHINFO_EXTENSION) && $media->ext) {
            $fileName .= '.'.$media->ext;
        }

        $mimeType = Storage::disk($disk)->mimeType($filePath) ?? 'application/octet-stream';

        return [
            'disk' => $disk,
            'filePath' => $filePath,
            'fileName' => $fileName,
            'mimeType' => $mimeType,
            'error' => null,
        ];
    }

    /**
     * Stream file response with proper headers.
     *
     * @param  string  $disposition  inline|attachment
     */
    private function streamFileResponse(
        string $disk,
        string $filePath,
        string $fileName,
        string $mimeType,
        string $disposition = 'inline',
        array $additionalHeaders = []
    ): StreamedResponse {
        $asciiFallback = Str::ascii($fileName) ?: ($disposition === 'inline' ? 'preview' : 'download');
        $utf8Name = rawurlencode($fileName);

        $headers = array_merge([
            'Content-Type' => $mimeType,
            'Content-Disposition' => "{$disposition}; filename=\"{$asciiFallback}\"; filename*=UTF-8''{$utf8Name}",
        ], $additionalHeaders);

        return Storage::disk($disk)->response($filePath, $asciiFallback, $headers);
    }
}
