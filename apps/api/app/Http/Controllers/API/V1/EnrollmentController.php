<?php

namespace App\Http\Controllers\API\V1;

use App\Actions\ImportEnrollmentAction;
use App\Http\Requests\ImportEnrollmentsRequest;
use App\Services\DataJobService;
use App\Services\ImportService;
use Illuminate\Http\JsonResponse;

class EnrollmentController extends BaseController
{
    /**
     * Import enrollments from CSV/XLSX file.
     *
     * POST /api/v1/enrollments/import
     *
     * Body:
     * - file: CSV/XLSX file (required)
     * - skip_duplicates: boolean (optional, default: true)
     */
    public function import(ImportEnrollmentsRequest $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Student cannot import
        if ($user->isStudent()) {
            return $this->errorResponse('Không có quyền import ghi danh', null, 'UNAUTHORIZED', 403);
        }

        // Check capability for data import
        if ($capabilityError = $this->requirePlanCapability('data.import')) {
            return $capabilityError;
        }

        // Also check students.manage to ensure user can manage enrollments
        if ($capabilityError = $this->requirePlanCapability('students.manage')) {
            return $capabilityError;
        }

        $file = $request->file('file');
        $skipDuplicates = $request->boolean('skip_duplicates', true);

        $job = DataJobService::start('import', 'enrollments', $user, [
            'file_name' => $file?->getClientOriginalName(),
            'format' => $file?->getClientOriginalExtension(),
            'meta' => [
                'path' => $request->path(),
                'skip_duplicates' => $skipDuplicates,
            ],
        ]);

        $file = $request->file('file');
        $skipDuplicates = $request->boolean('skip_duplicates', true);

        // Read file
        $fileData = ImportService::readFile($file);

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

        // Import enrollments
        $result = ImportEnrollmentAction::execute(
            $fileData['rows'],
            $user->id,
            $skipDuplicates
        );

        // Build response
        $response = [
            'success' => true,
            'message' => 'Import hoàn tất',
            'data' => [
                'total_rows' => count($fileData['rows']),
                'success' => $result['success'],
                'failed' => $result['failed'],
                'skipped' => $result['skipped'],
                'errors' => $result['errors'],
            ],
        ];

        $metrics = [
            'total_rows' => count($fileData['rows']),
            'success_count' => $result['success'],
            'failed_count' => $result['failed'],
            'skipped_count' => $result['skipped'],
        ];

        if ($result['failed'] > 0 || $result['skipped'] > 0) {
            DataJobService::finishPartial($job, $metrics, ['errors' => $result['errors']]);

            return response()->json($response, 207); // 207 Multi-Status
        }

        DataJobService::finishSuccess($job, $metrics);

        return $this->successResponse($response['data'], 'Import thành công');
    }
}
