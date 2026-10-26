<?php

namespace App\Http\Controllers\API\V1;

use App\Models\DataJob;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DataJobController extends BaseController
{
    /**
     * Danh sách lịch sử import/export (data_jobs).
     *
     * GET /api/v1/data-jobs
     *
     * Query:
     * - module: string (optional)
     * - type: import|export (optional)
     * - status: processing|success|partial|failed (optional)
     * - date_from, date_to: Y-m-d (lọc theo created_at)
     */
    public function index(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $query = DataJob::query();

        // Super admin xem được tất cả, user khác chỉ xem được job của mình
        if (! $user->isSuperAdmin()) {
            $query->where('user_id', $user->id);
        }

        if ($request->filled('module')) {
            $query->where('module', $request->get('module'));
        }

        if ($request->filled('type')) {
            $query->where('type', $request->get('type'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->get('status'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->get('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->get('date_to'));
        }

        $perPage = (int) $request->get('per_page', 20);
        $perPage = $perPage > 100 ? 100 : $perPage;

        $jobs = $query->orderByDesc('id')->paginate($perPage);

        $data = $jobs->getCollection()->map(function (DataJob $job) {
            return $this->transformJob($job);
        });

        return $this->successResponse([
            'items' => $data,
            'meta' => [
                'current_page' => $jobs->currentPage(),
                'per_page' => $jobs->perPage(),
                'total' => $jobs->total(),
                'last_page' => $jobs->lastPage(),
            ],
        ]);
    }

    /**
     * Chi tiết 1 job.
     *
     * GET /api/v1/data-jobs/{id}
     */
    public function show(DataJob $dataJob): JsonResponse
    {
        // Defensive check: ensure data job was properly resolved
        if (! $dataJob || ! $dataJob->exists || ! $dataJob->id) {
            return $this->errorResponse('Không tìm thấy lịch sử xử lý dữ liệu', null, 'NOT_FOUND', 404);
        }
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        if (! $user->isSuperAdmin() && $dataJob->user_id !== $user->id) {
            return $this->errorResponse('Không có quyền xem lịch sử này', null, 'UNAUTHORIZED', 403);
        }

        return $this->successResponse($this->transformJob($dataJob));
    }

    private function transformJob(DataJob $job): array
    {
        return [
            '_id' => $job->hash_id,
            'type' => $job->type,
            'module' => $job->module,
            'user_id' => User::encodeId($job->user_id),
            'user_name' => $job->user?->name,
            'status' => $job->status,
            'file_name' => $job->file_name,
            'format' => $job->format,
            'total_rows' => $job->total_rows,
            'success_count' => $job->success_count,
            'failed_count' => $job->failed_count,
            'skipped_count' => $job->skipped_count,
            'download_path' => $job->download_path,
            'message' => $job->message,
            'meta' => $job->meta,
            'ip' => $job->ip,
            'user_agent' => $job->user_agent,
            'started_at' => optional($job->started_at)->toDateTimeString(),
            'finished_at' => optional($job->finished_at)->toDateTimeString(),
            'duration_ms' => $job->duration_ms,
            'created_at' => $job->created_at->toDateTimeString(),
            'updated_at' => $job->updated_at->toDateTimeString(),
        ];
    }
}
