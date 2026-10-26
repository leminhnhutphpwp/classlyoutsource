<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class UserController extends BaseController
{
    /**
     * Get validation rules for user.
     */
    private function getValidationRules(bool $isUpdate = false, ?int $userId = null): array
    {
        $rules = [
            'name' => ($isUpdate ? 'sometimes|' : '').'required|string|max:255',
            'email' => ($isUpdate ? 'sometimes|' : '').'required|email'.($userId ? '|unique:users,email,'.$userId : '|unique:users,email,NULL,id,deleted_at,NULL'),
            'phone' => 'nullable|string|max:20',
            'status' => ($isUpdate ? 'sometimes|' : 'nullable|').'in:active,inactive',
        ];

        if (! $isUpdate) {
            // For creating new users, password is required
            $rules['password'] = 'required|string|min:8';
            // Role is required for creating new users (only super_admin can create users)
            $rules['role'] = 'required|in:tutor,student,parent,admin';
        }

        return $rules;
    }

    /**
     * Apply data isolation for users query.
     * Returns [query, error] - error is null if access is allowed.
     */
    private function applyIsolation($query, $user)
    {
        if ($user->hasRole('super_admin')) {
            // Super Admin: see all
            return [$query, null];
        }

        // No access
        return [null, $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403)];
    }

    /**
     * Check if user can access a specific user.
     */
    private function checkAccess($targetUser, $user): ?JsonResponse
    {
        // Super Admin can access all
        if ($user->hasRole('super_admin')) {
            return null;
        }

        // Users can access themselves
        if ($targetUser->id === $user->id) {
            return null;
        }

        return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
    }

    /**
     * Check if user can edit a specific user.
     */
    private function checkEditAccess($targetUser, $user): ?JsonResponse
    {
        // Only super admin can update users
        if (! $user->hasRole('super_admin')) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        return null;
    }

    /**
     * Check if user can delete a specific user.
     */
    private function checkDeleteAccess($targetUser, $user): ?JsonResponse
    {
        // Only super admin can delete users
        if (! $user->hasRole('super_admin')) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        return null;
    }

    /**
     * Apply filters (role, status) to query.
     */
    private function applyFilters($query, Request $request)
    {
        if ($request->has('role')) {
            $query->where('role', $request->role);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $searchTerm = $request->get('search');
            $query->where(function ($q) use ($searchTerm) {
                $q->where('name', 'like', "%{$searchTerm}%")
                    ->orWhere('email', 'like', "%{$searchTerm}%")
                    ->orWhere('phone', 'like', "%{$searchTerm}%");
            });
        }

        return $query;
    }

    /**
     * List all users (with data isolation).
     */
    public function index(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $query = User::query();

        [$query, $error] = $this->applyIsolation($query, $user);
        if ($error) {
            return $error;
        }

        $query = $this->applyFilters($query, $request);

        // Pagination
        $perPage = min($request->get('per_page', 15), 100);
        $users = $query->paginate($perPage);

        // Calculate statistics (on all data, not filtered/paginated)
        $statsQuery = User::query();
        [$statsQuery, $error] = $this->applyIsolation($statsQuery, $user);
        if ($error) {
            // If isolation fails, return empty statistics
            $statistics = [
                'total' => 0,
                'admin' => 0,
                'tutor' => 0,
                'active' => 0,
            ];
        } else {
            $statistics = [
                'total' => $statsQuery->count(),
                'admin' => (clone $statsQuery)->whereHas('roles', function ($q) {
                    $q->whereIn('name', ['super_admin', 'admin']);
                })->count(),
                'tutor' => (clone $statsQuery)->whereHas('roles', function ($q) {
                    $q->where('name', 'tutor');
                })->count(),
                'active' => (clone $statsQuery)->where('status', 'active')->count(),
            ];
        }

        return response()->json([
            'success' => true,
            'data' => UserResource::collection($users),
            'meta' => [
                'current_page' => $users->currentPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
                'last_page' => $users->lastPage(),
                'statistics' => $statistics,
            ],
        ]);
    }

    /**
     * Create a new user - Super Admin only.
     */
    public function store(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Only super admin can create users
        if (! $user->hasRole('super_admin')) {
            return $this->errorResponse('Chỉ super admin mới có thể tạo người dùng', null, 'UNAUTHORIZED', 403);
        }

        //

        $validator = Validator::make($request->all(), $this->getValidationRules());

        if ($validator->fails()) {
            return $this->errorResponse('Dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        // Only super_admin can create users
        if (! $user->hasRole('super_admin')) {
            return $this->errorResponse('Chỉ Super Admin mới có thể tạo user mới', null, 'FORBIDDEN', 403);
        }

        // Check if there is a trashed user with same email
        $trashedUser = User::onlyTrashed()->where('email', $request->email)->first();

        if ($trashedUser) {
            $trashedUser->restore();
            $trashedUser->update([
                'name' => $request->name,
                'password' => \Hash::make($request->password),
                'phone' => $request->phone,
                'role' => $request->role ?? 'student',
                'status' => $request->status ?? 'active',
            ]);
            $newUser = $trashedUser;
        } else {
            $newUser = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => \Hash::make($request->password),
                'phone' => $request->phone,
                'role' => $request->role ?? 'student',
                'status' => $request->status ?? 'active',
            ]);
        }

        // Assign role based on request (Spatie Permissions)
        $roleToAssign = $request->role ?? 'student';
        if (! $newUser->hasRole($roleToAssign)) {
            $newUser->assignRole($roleToAssign);
        }

        return $this->successResponse(
            new UserResource($newUser),
            'Tạo user thành công',
            201
        );
    }

    /**
     * Get user details.
     */
    public function show(User $user): JsonResponse
    {
        // Defensive check: ensure user was properly resolved
        if (! $user || ! $user->exists || ! $user->id) {
            return $this->errorResponse('Không tìm thấy người dùng', null, 'NOT_FOUND', 404);
        }
        // Route Model Binding automatically resolves hash id using the Trait

        [$currentUser, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $accessError = $this->checkAccess($user, $currentUser);
        if ($accessError) {
            return $accessError;
        }

        return $this->successResponse(new UserResource($user));
    }

    /**
     * Update user.
     */
    public function update(Request $request, User $user): JsonResponse
    {
        // Defensive check: ensure user was properly resolved
        if (! $user || ! $user->exists || ! $user->id) {
            return $this->errorResponse('Không tìm thấy người dùng', null, 'NOT_FOUND', 404);
        }
        // Route Model Binding automatically resolves hash id

        [$currentUser, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $accessError = $this->checkEditAccess($user, $currentUser);
        if ($accessError) {
            return $accessError;
        }

        // Pass real ID to validation rules
        $validator = Validator::make($request->all(), $this->getValidationRules(true, $user->id));

        if ($validator->fails()) {
            return $this->errorResponse('Dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        $user->update($request->only(['name', 'email', 'phone', 'status']));

        return $this->successResponse(
            new UserResource($user->fresh()),
            'Cập nhật người dùng thành công'
        );
    }

    /**
     * Delete user.
     */
    public function destroy(User $user): JsonResponse
    {
        // Defensive check: ensure user was properly resolved
        if (! $user || ! $user->exists || ! $user->id) {
            return $this->errorResponse('Không tìm thấy người dùng', null, 'NOT_FOUND', 404);
        }
        // Route Model Binding automatically resolves hash id

        [$currentUser, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $accessError = $this->checkDeleteAccess($user, $currentUser);
        if ($accessError) {
            return $accessError;
        }

        $user->delete();

        return $this->successResponse(null, 'Xóa người dùng thành công');
    }

    /**
     * Reset password for a user - Super Admin only.
     */
    public function resetPassword(Request $request, User $user): JsonResponse
    {
        // Defensive check: ensure user was properly resolved
        if (! $user || ! $user->exists || ! $user->id) {
            return $this->errorResponse('Không tìm thấy người dùng', null, 'NOT_FOUND', 404);
        }
        // Route Model Binding automatically resolves hash id

        [$currentUser, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Only Super Admin can reset password
        $accessError = $this->checkEditAccess($user, $currentUser);
        if ($accessError) {
            return $accessError;
        }

        $validator = Validator::make($request->all(), [
            'password' => 'required|string|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        $user->update([
            'password' => \Hash::make($request->password),
        ]);

        return $this->successResponse(
            new UserResource($user->fresh()),
            'Đặt lại mật khẩu thành công'
        );
    }

    /**
     * Activate user - Super Admin only.
     */
    public function activate(User $user): JsonResponse
    {
        // Defensive check: ensure user was properly resolved
        if (! $user || ! $user->exists || ! $user->id) {
            return $this->errorResponse('Không tìm thấy người dùng', null, 'NOT_FOUND', 404);
        }
        // Route Model Binding automatically resolves hash id

        [$currentUser, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Only Super Admin can activate users
        $accessError = $this->checkEditAccess($user, $currentUser);
        if ($accessError) {
            return $accessError;
        }

        $user->update(['status' => 'active']);

        return $this->successResponse(
            new UserResource($user->fresh()),
            'Kích hoạt tài khoản thành công'
        );
    }

    /**
     * Deactivate user - Super Admin only.
     */
    public function deactivate(User $user): JsonResponse
    {
        // Defensive check: ensure user was properly resolved
        if (! $user || ! $user->exists || ! $user->id) {
            return $this->errorResponse('Không tìm thấy người dùng', null, 'NOT_FOUND', 404);
        }
        // Route Model Binding automatically resolves hash id

        [$currentUser, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Only Super Admin can deactivate users
        $accessError = $this->checkEditAccess($user, $currentUser);
        if ($accessError) {
            return $accessError;
        }

        // Prevent deactivating own account
        if ($user->id === $currentUser->id) {
            return $this->errorResponse('Không thể vô hiệu hóa tài khoản của chính mình', null, 'BAD_REQUEST', 400);
        }

        $user->update(['status' => 'inactive']);

        return $this->successResponse(
            new UserResource($user->fresh()),
            'Vô hiệu hóa tài khoản thành công'
        );
    }
}
