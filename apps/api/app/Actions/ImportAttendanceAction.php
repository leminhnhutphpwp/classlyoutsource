<?php

namespace App\Actions;

use App\Actions\Concerns\ResolvesImportEntities;
use App\Models\Attendance;
use App\Models\User;
use App\Services\ImportService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ImportAttendanceAction
{
    use ResolvesImportEntities;

    /**
     * Import attendance from file data.
     *
     * @param  array  $rows  Array of rows from ImportService::readFile()
     * @param  int  $userId  User ID creating the import
     * @param  bool  $overrideExisting  Override existing attendance records
     * @return array ['success' => int, 'failed' => int, 'skipped' => int, 'errors' => []]
     */
    public static function execute(array $rows, int $userId, bool $overrideExisting = false): array
    {
        $success = 0;
        $failed = 0;
        $skipped = 0;
        $errors = [];

        $user = User::find($userId);
        if (! $user) {
            return [
                'success' => 0,
                'failed' => count($rows),
                'skipped' => 0,
                'errors' => [['row' => 0, 'errors' => ['Người dùng không tồn tại.']]],
            ];
        }

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
                        'errors' => ['Không tìm thấy học viên (kiểm tra email, số điện thoại hoặc mã học viên).'],
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

                // Check if student is enrolled in class
                if (! $student->isEnrolledIn($class->id)) {
                    $skipped++;
                    $errors[] = [
                        'row' => $rowNumber,
                        'data' => $mappedData,
                        'errors' => ['Học viên chưa được ghi danh vào lớp này.'],
                    ];

                    continue;
                }

                // Check if attendance already exists
                $existingAttendance = Attendance::where('class_id', $class->id)
                    ->where('student_id', $student->id)
                    ->whereDate('date', $mappedData['date'])
                    ->first();

                if ($existingAttendance && ! $overrideExisting) {
                    $skipped++;
                    $errors[] = [
                        'row' => $rowNumber,
                        'data' => $mappedData,
                        'errors' => ['Điểm danh đã tồn tại cho ngày này. Sử dụng override_existing=true để ghi đè.'],
                    ];

                    continue;
                }

                // Create or update attendance
                try {
                    $attendanceData = [
                        'class_id' => $class->id,
                        'student_id' => $student->id,
                        'tutor_id' => $userId,
                        'date' => $mappedData['date'],
                        'status' => $mappedData['status'],
                        'check_in_time' => $mappedData['check_in_time'] ?? null,
                        'check_out_time' => $mappedData['check_out_time'] ?? null,
                        'note' => $mappedData['note'] ?? null,
                    ];

                    if ($existingAttendance && $overrideExisting) {
                        $existingAttendance->update($attendanceData);
                    } else {
                        Attendance::create($attendanceData);
                    }

                    $success++;
                } catch (\Exception $e) {
                    $failed++;
                    $errors[] = [
                        'row' => $rowNumber,
                        'data' => $mappedData,
                        'errors' => ['Lỗi khi tạo điểm danh: '.$e->getMessage()],
                    ];
                    Log::channel('media')->error('Import attendance error', [
                        'row' => $rowNumber,
                        'data' => $mappedData,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            DB::commit();

            Log::channel('media')->info('Attendance imported', [
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

            Log::channel('media')->error('Import attendance transaction failed', [
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
            'date' => ['ngày', 'date', 'ngày điểm danh', 'attendance_date'],
            'status' => ['trạng thái', 'status', 'attendance_status'],
            'check_in_time' => ['giờ vào', 'check_in_time', 'check_in', 'giờ vào lớp', 'time_in'],
            'check_out_time' => ['giờ ra', 'check_out_time', 'check_out', 'giờ ra lớp', 'time_out'],
            'note' => ['ghi chú', 'notes', 'note', 'mô tả'],
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
        if (empty($data['date'])) {
            $errors[] = 'Thiếu ngày điểm danh.';
        }
        if (empty($data['status'])) {
            $errors[] = 'Thiếu trạng thái điểm danh (present/absent/late/excused).';
        }

        if (! empty($errors)) {
            return [
                'valid' => false,
                'errors' => $errors,
            ];
        }

        // Additional validation
        $rules = [
            'date' => 'date',
            'status' => 'in:present,absent,late,excused',
        ];

        if (! empty($data['check_in_time'])) {
            $rules['check_in_time'] = 'date_format:H:i';
        }
        if (! empty($data['check_out_time'])) {
            $rules['check_out_time'] = 'date_format:H:i';
        }
        if (! empty($data['student_email'])) {
            $rules['student_email'] = 'email|max:255';
        }
        if (! empty($data['note'])) {
            $rules['note'] = 'nullable|string';
        }

        return ImportService::validateRow($data, $rules);
    }
}
