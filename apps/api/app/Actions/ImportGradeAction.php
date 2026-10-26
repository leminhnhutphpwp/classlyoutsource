<?php

namespace App\Actions;

use App\Actions\Concerns\ResolvesImportEntities;
use App\Models\Assignment;
use App\Models\Grade;
use App\Models\GradeType;
use App\Models\User;
use App\Services\ImportService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ImportGradeAction
{
    use ResolvesImportEntities;

    /**
     * Import grades from file data.
     *
     * @param  array  $rows  Array of rows from ImportService::readFile()
     * @param  int  $userId  User ID creating the import
     * @param  bool  $overrideExisting  Override existing grade records
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

                // Find assignment or grade type
                $assignment = null;
                $gradeType = null;

                if (! empty($mappedData['assignment_code']) || ! empty($mappedData['assignment_title'])) {
                    $assignment = self::findAssignment($mappedData, $class->id);
                    if (! $assignment) {
                        $failed++;
                        $errors[] = [
                            'row' => $rowNumber,
                            'data' => $mappedData,
                            'errors' => ['Không tìm thấy bài tập (kiểm tra mã bài tập hoặc tiêu đề).'],
                        ];

                        continue;
                    }
                } elseif (! empty($mappedData['grade_type_code']) || ! empty($mappedData['grade_type_name'])) {
                    $gradeType = self::findGradeType($mappedData);
                    if (! $gradeType) {
                        $failed++;
                        $errors[] = [
                            'row' => $rowNumber,
                            'data' => $mappedData,
                            'errors' => ['Không tìm thấy loại điểm (kiểm tra mã loại điểm hoặc tên).'],
                        ];

                        continue;
                    }
                } else {
                    $failed++;
                    $errors[] = [
                        'row' => $rowNumber,
                        'data' => $mappedData,
                        'errors' => ['Thiếu thông tin bài tập hoặc loại điểm.'],
                    ];

                    continue;
                }

                // Check if grade already exists
                $existingGrade = null;
                if ($assignment) {
                    $existingGrade = Grade::where('student_id', $student->id)
                        ->where('assignment_id', $assignment->id)
                        ->first();
                } elseif ($gradeType) {
                    $existingGrade = Grade::where('student_id', $student->id)
                        ->where('class_id', $class->id)
                        ->where('grade_type_id', $gradeType->id)
                        ->whereDate('grade_date', $mappedData['grade_date'] ?? now())
                        ->first();
                }

                if ($existingGrade && ! $overrideExisting) {
                    $skipped++;
                    $errors[] = [
                        'row' => $rowNumber,
                        'data' => $mappedData,
                        'errors' => ['Điểm đã tồn tại. Sử dụng override_existing=true để ghi đè.'],
                    ];

                    continue;
                }

                // Create or update grade
                try {
                    $gradeData = [
                        'student_id' => $student->id,
                        'class_id' => $class->id,
                        'tutor_id' => $userId,
                        'score' => $mappedData['score'],
                        'max_score' => $mappedData['max_score'] ?? 100,
                        'comments' => $mappedData['comments'] ?? null,
                        'grade_date' => $mappedData['grade_date'] ?? now(),
                        'semester' => $mappedData['semester'] ?? null,
                    ];

                    if ($assignment) {
                        $gradeData['assignment_id'] = $assignment->id;
                        $gradeData['title'] = $mappedData['title'] ?? $assignment->title;
                    }

                    if ($gradeType) {
                        $gradeData['grade_type_id'] = $gradeType->id;
                        $gradeData['title'] = $mappedData['title'] ?? $gradeType->name;
                    }

                    if ($existingGrade && $overrideExisting) {
                        $existingGrade->update($gradeData);
                    } else {
                        Grade::create($gradeData);
                    }

                    $success++;
                } catch (\Exception $e) {
                    $failed++;
                    $errors[] = [
                        'row' => $rowNumber,
                        'data' => $mappedData,
                        'errors' => ['Lỗi khi tạo điểm: '.$e->getMessage()],
                    ];
                    Log::channel('media')->error('Import grade error', [
                        'row' => $rowNumber,
                        'data' => $mappedData,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            DB::commit();

            Log::channel('media')->info('Grades imported', [
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

            Log::channel('media')->error('Import grades transaction failed', [
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
            'student_email' => ['email học viên', 'student_email', 'email', 'email_student'],
            'student_phone' => ['số điện thoại học viên', 'student_phone', 'phone', 'phone_student'],
            'student_id' => ['mã học viên', 'student_id', 'id học viên', 'student_code'],
            'class_code' => ['mã lớp', 'class_code', 'code', 'mã lớp học'],
            'class_name' => ['tên lớp', 'class_name', 'name', 'tên lớp học'],
            'class_id' => ['id lớp', 'class_id', 'id lớp học'],
            'assignment_code' => ['mã bài tập', 'assignment_code', 'assignment_id', 'id bài tập'],
            'assignment_title' => ['tên bài tập', 'assignment_title', 'assignment_name', 'title'],
            'grade_type_code' => ['mã loại điểm', 'grade_type_code', 'grade_type_id', 'id loại điểm'],
            'grade_type_name' => ['tên loại điểm', 'grade_type_name', 'grade_type', 'loại điểm'],
            'title' => ['tiêu đề', 'title', 'tên điểm'],
            'score' => ['điểm', 'score', 'số điểm'],
            'max_score' => ['điểm tối đa', 'max_score', 'max', 'tổng điểm'],
            'comments' => ['nhận xét', 'comments', 'comment', 'ghi chú'],
            'grade_date' => ['ngày chấm', 'grade_date', 'date', 'ngày điểm'],
            'semester' => ['học kỳ', 'semester', 'kỳ học'],
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

        // At least assignment or grade type is required
        $hasAssignment = ! empty($data['assignment_code']) || ! empty($data['assignment_title']);
        $hasGradeType = ! empty($data['grade_type_code']) || ! empty($data['grade_type_name']);

        $errors = [];
        if (! $hasStudentId) {
            $errors[] = 'Thiếu thông tin học viên (cần email, số điện thoại hoặc mã học viên).';
        }
        if (! $hasClassId) {
            $errors[] = 'Thiếu thông tin lớp học (cần mã lớp, tên lớp hoặc ID lớp).';
        }
        if (! $hasAssignment && ! $hasGradeType) {
            $errors[] = 'Thiếu thông tin bài tập hoặc loại điểm.';
        }
        if (empty($data['score'])) {
            $errors[] = 'Thiếu điểm số.';
        }

        if (! empty($errors)) {
            return [
                'valid' => false,
                'errors' => $errors,
            ];
        }

        // Additional validation
        $rules = [
            'score' => 'required|numeric|min:0',
            'max_score' => 'nullable|numeric|min:0',
        ];

        if (! empty($data['grade_date'])) {
            $rules['grade_date'] = 'date';
        }
        if (! empty($data['student_email'])) {
            $rules['student_email'] = 'email|max:255';
        }
        if (! empty($data['comments'])) {
            $rules['comments'] = 'nullable|string';
        }

        return ImportService::validateRow($data, $rules);
    }

    /**
     * Find assignment by code or title.
     */
    private static function findAssignment(array $data, int $classId): ?Assignment
    {
        $query = Assignment::where('class_id', $classId);

        if (! empty($data['assignment_code'])) {
            // Try by ID first
            if (is_numeric($data['assignment_code'])) {
                $query->where('id', $data['assignment_code']);
            } else {
                // Try by title/code
                $query->where('title', 'like', '%'.$data['assignment_code'].'%');
            }
        } elseif (! empty($data['assignment_title'])) {
            $query->where('title', 'like', '%'.$data['assignment_title'].'%');
        } else {
            return null;
        }

        return $query->first();
    }

    /**
     * Find grade type by code or name.
     */
    private static function findGradeType(array $data): ?GradeType
    {
        $query = GradeType::query();

        if (! empty($data['grade_type_code'])) {
            if (is_numeric($data['grade_type_code'])) {
                $query->where('id', $data['grade_type_code']);
            } else {
                $query->where('code', $data['grade_type_code'])
                    ->orWhere('name', 'like', '%'.$data['grade_type_code'].'%');
            }
        } elseif (! empty($data['grade_type_name'])) {
            $query->where('name', 'like', '%'.$data['grade_type_name'].'%');
        } else {
            return null;
        }

        return $query->first();
    }
}
