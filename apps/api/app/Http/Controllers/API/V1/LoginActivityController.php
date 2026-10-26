<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Resources\LoginActivityResource;
use App\Models\LoginActivity;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class LoginActivityController extends BaseController
{
    public function index(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        if ($validationError = $this->validateFilters($request)) {
            return $validationError;
        }

        $perPage = $this->resolvePerPage($request);

        // LUÔN trả về lịch sử đăng nhập của chính user (học viên hoặc giáo viên)
        // Học viên không nên thấy các log liên quan đến giáo viên bị inactive/lock
        $query = $this->buildQueryForUser($request, $user->id);

        // Nếu là học viên, loại bỏ các log nhạy cảm về trạng thái giáo viên
        if ($user->isStudent()) {
            $query->where('status', '!=', 'tutor_inactive');
        }

        $activities = $query->paginate($perPage);

        return $this->formatPaginatedResponse($activities);
    }

    /**
     * Lấy lịch sử đăng nhập của TẤT CẢ học viên mà giáo viên quản lý
     */
    public function allStudentsHistory(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Chỉ giáo viên mới được gọi API này
        if ($user->isStudent()) {
            return $this->errorResponse(
                'Bạn không có quyền truy cập',
                null,
                'FORBIDDEN',
                403
            );
        }

        if ($validationError = $this->validateFilters($request)) {
            return $validationError;
        }

        $perPage = $this->resolvePerPage($request);

        // Lấy lịch sử đăng nhập của TẤT CẢ học viên mà giáo viên quản lý
        $activities = $this->buildQueryForTutorStudents($request, $user->id)
            ->paginate($perPage);

        // Check capability để frontend biết có quyền xem (luôn true ở đây vì đã pass check ở trên)
        // Nhưng vẫn trả về để đồng bộ format với các endpoint khác
        $permissions = $this->buildMultiplePermissions([
            'can_view' => 'login_activity.view',
        ]);

        return $this->formatPaginatedResponse($activities, [], $permissions);
    }

    public function studentHistory(Request $request, Student $student): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Chỉ giáo viên mới được gọi API này
        if ($user->isStudent()) {
            return $this->errorResponse(
                'Bạn không có quyền truy cập',
                null,
                'FORBIDDEN',
                403
            );
        }

        if ($validationError = $this->validateFilters($request)) {
            return $validationError;
        }

        $student->load(['user:id,name,email']);

        if (! $this->canViewStudentHistory($user, $student)) {
            return $this->errorResponse('Bạn không có quyền xem học viên này', null, 'FORBIDDEN', 403);
        }

        $perPage = $this->resolvePerPage($request);

        if (! $student->user_id) {
            // Check capability để frontend biết có quyền xem
            $permissions = $this->buildMultiplePermissions([
                'can_view' => 'login_activity.view',
            ]);

            return $this->formatPaginatedResponse(
                $this->emptyPaginator($perPage),
                [
                    'student' => $this->studentSummary($student),
                ],
                $permissions
            );
        }

        $activities = $this->buildQueryForUser($request, $student->user_id)
            ->paginate($perPage);

        // Check capability để frontend biết có quyền xem
        $permissions = $this->buildMultiplePermissions([
            'can_view' => 'login_activity.view',
        ]);

        return $this->formatPaginatedResponse(
            $activities,
            [
                'student' => $this->studentSummary($student),
            ],
            $permissions
        );
    }

    private function validateFilters(Request $request): ?JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'status' => 'sometimes|string|max:50',
            'from_date' => 'sometimes|date',
            'to_date' => 'sometimes|date',
            'per_page' => 'sometimes|integer|min:1|max:100',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        return null;
    }

    private function resolvePerPage(Request $request): int
    {
        return (int) min(max((int) $request->get('per_page', 20), 1), 100);
    }

    /**
     * Apply common filters to login activity query
     *
     * @param  Builder  $query
     */
    private function applyFilters($query, Request $request): void
    {
        if ($request->filled('status')) {
            $query->where('status', $request->get('status'));
        }

        if ($request->filled('from_date')) {
            $query->where('logged_in_at', '>=', Carbon::parse($request->get('from_date'))->startOfDay());
        }

        if ($request->filled('to_date')) {
            $query->where('logged_in_at', '<=', Carbon::parse($request->get('to_date'))->endOfDay());
        }
    }

    private function buildQueryForUser(Request $request, int $userId)
    {
        $query = LoginActivity::with('user')
            ->where('user_id', $userId)
            ->orderByDesc('logged_in_at')
            ->orderByDesc('id');

        $this->applyFilters($query, $request);

        return $query;
    }

    /**
     * Build query để lấy lịch sử đăng nhập của TẤT CẢ học viên mà giáo viên quản lý
     *
     * @return Builder
     */
    private function buildQueryForTutorStudents(Request $request, int $tutorId)
    {
        // Lấy danh sách user_id của tất cả học viên trong các lớp mà giáo viên quản lý
        $studentUserIds = Student::whereHas('classes', function ($query) use ($tutorId) {
            $query->where('tutor_id', $tutorId);
        })
            ->whereNotNull('user_id')
            ->pluck('user_id')
            ->unique()
            ->toArray();

        // Nếu không có học viên nào, trả về query rỗng
        if (empty($studentUserIds)) {
            return LoginActivity::whereRaw('1 = 0'); // Empty result
        }

        // Query lịch sử đăng nhập của tất cả học viên
        $query = LoginActivity::with('user')
            ->whereIn('user_id', $studentUserIds)
            ->orderByDesc('logged_in_at')
            ->orderByDesc('id');

        $this->applyFilters($query, $request);

        return $query;
    }

    private function formatPaginatedResponse($paginator, array $extra = [], array $permissions = []): JsonResponse
    {
        $data = array_merge([
            'items' => LoginActivityResource::collection($paginator->getCollection()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ], $extra);

        $response = $this->successResponse($data);
        $responseData = $response->getData(true);

        // Thêm permissions nếu có
        if (! empty($permissions)) {
            $responseData['permissions'] = $permissions;
        }

        return response()->json($responseData, $response->getStatusCode());
    }

    private function canViewStudentHistory($user, Student $student): bool
    {
        if ($user->isSuperAdmin() || $user->isAdmin()) {
            return true;
        }

        if ($user->isTutor()) {
            return $student->classes()
                ->where('tutor_id', $user->id)
                ->exists();
        }

        return false;
    }

    private function studentSummary(Student $student): array
    {
        return [
            '_id' => $student->hash_id,
            'name' => $student->name,
            'email' => $student->email ?? $student->user?->email,
            'user_id' => User::encodeId($student->user_id),
        ];
    }

    private function emptyPaginator(int $perPage)
    {
        return new class($perPage)
        {
            private int $perPage;

            public function __construct(int $perPage)
            {
                $this->perPage = $perPage;
            }

            public function getCollection()
            {
                return collect([]);
            }

            public function currentPage(): int
            {
                return 1;
            }

            public function perPage(): int
            {
                return $this->perPage;
            }

            public function total(): int
            {
                return 0;
            }

            public function lastPage(): int
            {
                return 1;
            }
        };
    }

    /**
     * Export login activities.
     *
     * GET /api/v1/login-activities/export
     */
    public function export(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Check capability for data export
        if ($capabilityError = $this->requirePlanCapability('data.export')) {
            return $capabilityError;
        }

        // Also check login_activity.view to ensure user can view login activities
        if ($capabilityError = $this->requirePlanCapability('login_activity.view')) {
            return $capabilityError;
        }

        $format = $request->get('format', 'csv'); // csv or excel

        if (! in_array($format, ['csv', 'excel'])) {
            return $this->errorResponse('Format không hợp lệ. Chỉ hỗ trợ csv hoặc excel.', null, 'INVALID_FORMAT', 400);
        }

        try {
            // Build query similar to index method
            $query = $this->buildQueryForUser($request, $user->id);

            // If student, exclude sensitive logs
            if ($user->isStudent()) {
                $query->where('status', '!=', 'tutor_inactive');
            }

            // Apply filters
            if ($request->filled('date_from')) {
                $query->whereDate('logged_in_at', '>=', $request->date_from);
            }
            if ($request->filled('date_to')) {
                $query->whereDate('logged_in_at', '<=', $request->date_to);
            }
            if ($request->filled('status')) {
                $query->where('status', $request->status);
            }
            if ($request->filled('is_success')) {
                $query->where('is_success', $request->boolean('is_success'));
            }

            $activities = $query->with('user')->orderBy('logged_in_at', 'desc')->get();

            $data = $activities->map(function ($activity) {
                return [
                    '_id' => $activity->hash_id,
                    'user_id' => User::encodeId($activity->user_id),
                    'user_email' => $activity->email,
                    'user_name' => $activity->user->name ?? '',
                    'is_success' => $activity->is_success ? 'Yes' : 'No',
                    'status' => $activity->status,
                    'ip_address' => $activity->ip_address,
                    'device_name' => $activity->device_name ?? '',
                    'location' => $activity->location ?? '',
                    'user_agent' => $activity->user_agent ?? '',
                    'message' => $activity->message ?? '',
                    'logged_in_at' => $activity->logged_in_at?->format('Y-m-d H:i:s'),
                    'created_at' => $activity->created_at->format('Y-m-d H:i:s'),
                ];
            })->toArray();

            // Use ReportsController's handleExport method
            $reportsController = new ReportsController;
            $reflection = new \ReflectionClass($reportsController);
            $method = $reflection->getMethod('handleExport');
            $method->setAccessible(true);

            return $method->invoke($reportsController, $request, 'login-activities', function () use ($data) {
                return $data;
            });
        } catch (\Exception $e) {
            Log::channel('auth')->error('Export login activities error', [
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse('Lỗi khi export login activities: '.$e->getMessage(), null, 'EXPORT_ERROR', 500);
        }
    }
}
