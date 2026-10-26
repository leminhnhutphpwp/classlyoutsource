<?php

namespace App\Actions;

use App\Models\Student;
use App\Models\User;
use App\Services\ImportService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ImportStudentAction
{
    /**
     * Import students from file data.
     *
     * @param  array  $rows  Array of rows from ImportService::readFile()
     * @param  int  $userId  User ID creating the import
     * @param  bool  $skipDuplicates  Skip rows with duplicate email/phone
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

                // Map column names (support Vietnamese and English)
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

                // Check for duplicates
                if ($skipDuplicates) {
                    $duplicate = self::findDuplicate($mappedData);
                    if ($duplicate) {
                        $skipped++;
                        $errors[] = [
                            'row' => $rowNumber,
                            'data' => $mappedData,
                            'errors' => ['Học viên đã tồn tại (email hoặc số điện thoại trùng).'],
                        ];

                        continue;
                    }
                }

                // Create or Restore student
                try {
                    $studentData = [
                        'name' => $mappedData['name'],
                        'student_code' => $mappedData['student_code'] ?? null,
                        'parent_name' => $mappedData['parent_name'] ?? null,
                        'phone' => $mappedData['phone'] ?? null,
                        'email' => $mappedData['email'] ?? null,
                        'birth_date' => $mappedData['birth_date'] ?? null,
                        'gender' => $mappedData['gender'] ?? null,
                        'address' => $mappedData['address'] ?? null,
                        'notes' => $mappedData['notes'] ?? null,
                        'status' => $mappedData['status'] ?? 'active',
                        'created_by' => $userId,
                    ];

                    $existingStudent = self::findDuplicate($mappedData);

                    if ($existingStudent) {
                        if ($existingStudent->trashed()) {
                            $existingStudent->restore();
                        }
                        $existingStudent->update($studentData);
                        $student = $existingStudent;
                    } else {
                        $student = Student::create($studentData);
                    }

                    // Apply data isolation (set user_id if needed)
                    $user = User::find($userId);
                    if ($user && ! $user->isSuperAdmin()) {
                        // For tutors, students are isolated by classes they teach
                        // The student will be linked when enrolled in a class
                    }

                    $success++;
                } catch (\Exception $e) {
                    $failed++;
                    $errors[] = [
                        'row' => $rowNumber,
                        'data' => $mappedData,
                        'errors' => ['Lỗi khi tạo học viên: '.$e->getMessage()],
                    ];
                    Log::channel('media')->error('Import student error', [
                        'row' => $rowNumber,
                        'data' => $mappedData,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            DB::commit();

            Log::channel('media')->info('Students imported', [
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

            Log::channel('media')->error('Import students transaction failed', [
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

        // Column mapping (support both Vietnamese and English)
        $mappings = [
            'name' => ['tên', 'name', 'họ tên', 'full_name', 'student_name'],
            'student_code' => ['mã học viên', 'student_code', 'code', 'mã', 'student_id'],
            'parent_name' => ['phụ huynh', 'parent_name', 'parent', 'tên phụ huynh'],
            'phone' => ['số điện thoại', 'phone', 'sdt', 'tel', 'mobile'],
            'email' => ['email', 'e-mail', 'mail'],
            'birth_date' => ['ngày sinh', 'birth_date', 'birthdate', 'dob', 'date_of_birth'],
            'gender' => ['giới tính', 'gender', 'sex'],
            'address' => ['địa chỉ', 'address', 'addr'],
            'notes' => ['ghi chú', 'notes', 'note', 'mô tả', 'description'],
            'status' => ['trạng thái', 'status', 'state'],
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
        $rules = [
            'name' => 'required|string|max:255',
            'student_code' => 'nullable|string|max:50',
            'parent_name' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:255',
            'birth_date' => 'nullable|date',
            'gender' => 'nullable|in:male,female,other',
            'address' => 'nullable|string',
            'notes' => 'nullable|string',
            'status' => 'nullable|in:active,inactive,graduated',
        ];

        return ImportService::validateRow($data, $rules);
    }

    /**
     * Find duplicate student by email or phone.
     */
    private static function findDuplicate(array $data): ?Student
    {
        $query = Student::withTrashed(); // Check trashed too

        if (! empty($data['email'])) {
            $query->where('email', $data['email']);
        } elseif (! empty($data['phone'])) {
            $query->where('phone', $data['phone']);
        } else {
            return null;
        }

        return $query->first();
    }
}
