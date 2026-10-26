<?php

namespace App\Actions;

use App\Actions\Concerns\ResolvesImportEntities;
use App\Services\EnrollmentService;
use App\Services\ImportService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ImportEnrollmentAction
{
    use ResolvesImportEntities;

    /**
     * Import enrollments from file data.
     *
     * @param  array  $rows  Array of rows from ImportService::readFile()
     * @param  int  $userId  User ID creating the import
     * @param  bool  $skipDuplicates  Skip rows with duplicate enrollments
     * @return array ['success' => int, 'failed' => int, 'skipped' => int, 'errors' => []]
     */
    public static function execute(array $rows, int $userId, bool $skipDuplicates = true): array
    {
        $success = 0;
        $failed = 0;
        $skipped = 0;
        $errors = [];

        DB::beginTransaction();

        try {
            foreach ($rows as $rowInfo) {
                $rowNumber = $rowInfo['row_number'];
                $rowData = $rowInfo['data'];

                // Map column names
                $mappedData = self::mapRowData($rowData);

                // Validate row
                $validation = self::validateRow($mappedData);
                if (! $validation['valid']) {
                    $failed++;
                    $errors[] = [
                        'row' => $rowNumber,
                        'data' => $mappedData,
                        'errors' => $validation['errors'],
                    ];

                    continue;
                }

                // Find student
                $student = self::findStudent($mappedData);
                if (! $student) {
                    $failed++;
                    $errors[] = [
                        'row' => $rowNumber,
                        'data' => $mappedData,
                        'errors' => ['Không tìm thấy học viên (kiểm tra email hoặc số điện thoại).'],
                    ];

                    continue;
                }

                // Find class
                $class = self::findClass($mappedData, $userId);
                if (! $class) {
                    $failed++;
                    $errors[] = [
                        'row' => $rowNumber,
                        'data' => $mappedData,
                        'errors' => ['Không tìm thấy lớp học (kiểm tra mã lớp hoặc tên lớp).'],
                    ];

                    continue;
                }

                // Check if already enrolled
                if ($skipDuplicates && $student->isEnrolledIn($class->id)) {
                    $skipped++;
                    $errors[] = [
                        'row' => $rowNumber,
                        'data' => $mappedData,
                        'errors' => ['Học viên đã được ghi danh vào lớp này.'],
                    ];

                    continue;
                }

                // Enroll student
                try {
                    EnrollmentService::enrollStudent(
                        $student,
                        $class,
                        $mappedData['notes'] ?? null
                    );

                    $success++;
                } catch (\Exception $e) {
                    $failed++;
                    $errors[] = [
                        'row' => $rowNumber,
                        'data' => $mappedData,
                        'errors' => [$e->getMessage()],
                    ];
                    Log::channel('media')->error('Import enrollment error', [
                        'row' => $rowNumber,
                        'data' => $mappedData,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            DB::commit();

            Log::channel('media')->info('Enrollments imported', [
                'user_id' => $userId,
                'success' => $success,
                'failed' => $failed,
                'skipped' => $skipped,
            ]);

            return [
                'success' => $success,
                'failed' => $failed,
                'skipped' => $skipped,
                'errors' => $errors,
            ];
        } catch (\Exception $e) {
            DB::rollBack();

            Log::channel('media')->error('Import enrollments transaction failed', [
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => 0,
                'failed' => count($rows),
                'skipped' => 0,
                'errors' => [['row' => 0, 'errors' => ['Lỗi hệ thống: '.$e->getMessage()]]],
            ];
        }
    }

    /**
     * Map row data to standard keys.
     */
    private static function mapRowData(array $rowData): array
    {
        $mapped = [];

        // Column mapping
        $mappings = [
            'student_email' => ['email học viên', 'student_email', 'email', 'email_student', 'học viên email'],
            'student_phone' => ['số điện thoại học viên', 'student_phone', 'phone', 'phone_student', 'sdt học viên'],
            'student_id' => ['mã học viên', 'student_id', 'id học viên', 'student_code'],
            'class_code' => ['mã lớp', 'class_code', 'code', 'mã lớp học'],
            'class_name' => ['tên lớp', 'class_name', 'name', 'tên lớp học'],
            'class_id' => ['id lớp', 'class_id', 'id lớp học'],
            'notes' => ['ghi chú', 'notes', 'note', 'mô tả'],
        ];

        foreach ($mappings as $key => $possibleNames) {
            foreach ($possibleNames as $possibleName) {
                foreach ($rowData as $rowKey => $value) {
                    if (strcasecmp(trim($rowKey), trim($possibleName)) === 0) {
                        $mapped[$key] = $value;
                        break 2;
                    }
                }
            }
        }

        return $mapped;
    }

    /**
     * Validate row data.
     */
    private static function validateRow(array $data): array
    {
        // At least one student identifier is required
        $hasStudentId = ! empty($data['student_email']) ||
                       ! empty($data['student_phone']) ||
                       ! empty($data['student_id']);

        // At least one class identifier is required
        $hasClassId = ! empty($data['class_code']) ||
                     ! empty($data['class_name']) ||
                     ! empty($data['class_id']);

        $errors = [];
        if (! $hasStudentId) {
            $errors[] = 'Thiếu thông tin học viên (cần email, số điện thoại hoặc mã học viên).';
        }
        if (! $hasClassId) {
            $errors[] = 'Thiếu thông tin lớp học (cần mã lớp, tên lớp hoặc ID lớp).';
        }

        if (! empty($errors)) {
            return [
                'valid' => false,
                'errors' => $errors,
            ];
        }

        // Additional validation
        $rules = [];
        if (! empty($data['student_email'])) {
            $rules['student_email'] = 'email|max:255';
        }
        if (! empty($data['notes'])) {
            $rules['notes'] = 'nullable|string';
        }

        if (empty($rules)) {
            return ['valid' => true, 'errors' => []];
        }

        return ImportService::validateRow($data, $rules);
    }
}
