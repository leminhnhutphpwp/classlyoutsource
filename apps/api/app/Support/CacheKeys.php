<?php

namespace App\Support;

class CacheKeys
{
    /**
     * Normalize filters array to ensure consistent cache keys.
     * Removes null/empty values and sorts keys for consistent hashing.
     */
    private static function normalizeFilters(array $filters): array
    {
        $normalized = [];

        foreach ($filters as $key => $value) {
            // Skip null, empty string, and empty array values
            if ($value === null || $value === '' || (is_array($value) && empty($value))) {
                continue;
            }

            // Normalize value types
            if (is_bool($value)) {
                $normalized[$key] = $value ? 1 : 0;
            } elseif (is_numeric($value) && $value !== '') {
                // Convert to int if it's a whole number, otherwise keep as float
                // Note: string "0" is numeric and will be converted to int 0
                $normalized[$key] = is_float($value) ? (float) $value : (int) $value;
            } else {
                // Keep as string for non-numeric values
                $normalized[$key] = (string) $value;
            }
        }

        // Sort keys to ensure consistent order
        ksort($normalized);

        return $normalized;
    }

    /**
     * Generate consistent hash from filters array.
     */
    private static function hashFilters(array $filters): string
    {
        $normalized = self::normalizeFilters($filters);

        return md5(json_encode($normalized, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    public static function currentUser(string $userId): string
    {
        return "user:me:{$userId}";
    }

    // Class cache keys
    public static function classList(string $userId, array $filters = []): string
    {
        $version = CacheVersion::get('classes');
        $filterHash = self::hashFilters($filters);

        return "classes:list:u:{$userId}:v:{$version}:{$filterHash}";
    }

    public static function classDetail(string $classId): string
    {
        return "classes:detail:{$classId}";
    }

    public static function classStudents(string $classId): string
    {
        $version = CacheVersion::get('students_class', $classId);

        return "classes:{$classId}:students:v:{$version}";
    }

    public static function classStudentsList(string $classId, array $filters = []): string
    {
        $version = CacheVersion::get('students_class', $classId);
        $filterHash = self::hashFilters($filters);

        return "classes:{$classId}:students:v:{$version}:{$filterHash}";
    }

    public static function classAssignments(string $classId): string
    {
        $version = CacheVersion::get('assignments_class', $classId);

        return "classes:{$classId}:assignments:v:{$version}";
    }

    public static function classSchedules(string $classId): string
    {
        $version = CacheVersion::get('schedules_class', $classId);

        return "classes:{$classId}:schedules:v:{$version}";
    }

    // Student cache keys
    public static function studentList(string $userId, array $filters = []): string
    {
        $version = CacheVersion::get('students');
        $filterHash = self::hashFilters($filters);

        return "students:list:u:{$userId}:v:{$version}:{$filterHash}";
    }

    public static function studentDetail(string $studentId): string
    {
        return "students:detail:{$studentId}";
    }

    public static function studentClasses(string $studentId): string
    {
        $version = CacheVersion::get('classes_student', $studentId);

        return "students:{$studentId}:classes:v:{$version}";
    }

    public static function studentClassesList(string $studentId, array $filters = []): string
    {
        $version = CacheVersion::get('classes_student', $studentId);
        $filterHash = self::hashFilters($filters);

        return "students:{$studentId}:classes:v:{$version}:{$filterHash}";
    }

    public static function studentAssignments(string $studentId): string
    {
        $version = CacheVersion::get('assignments_student', $studentId);

        return "students:{$studentId}:assignments:v:{$version}";
    }

    public static function studentAssignmentsList(string $studentId, array $filters = []): string
    {
        $version = CacheVersion::get('assignments_student', $studentId);
        $filterHash = self::hashFilters($filters);

        return "students:{$studentId}:assignments:v:{$version}:{$filterHash}";
    }

    public static function studentAttendance(string $studentId, array $filters = []): string
    {
        $version = CacheVersion::get('attendance_student', $studentId);
        $filterHash = self::hashFilters($filters);

        return "attendance:student:{$studentId}:v:{$version}:{$filterHash}";
    }

    public static function studentGrades(string $studentId): string
    {
        $version = CacheVersion::get('grades_student', $studentId);

        return "students:{$studentId}:grades:v:{$version}";
    }

    // Assignment cache keys
    public static function assignmentList(string $userId, array $filters = []): string
    {
        $version = CacheVersion::get('assignments');
        $filterHash = self::hashFilters($filters);

        return "assignments:list:u:{$userId}:v:{$version}:{$filterHash}";
    }

    public static function assignmentDetail(string $assignmentId): string
    {
        return "assignments:detail:{$assignmentId}";
    }

    public static function assignmentSubmissions(string $assignmentId): string
    {
        $version = CacheVersion::get('submissions_assignment', $assignmentId);

        return "assignments:{$assignmentId}:submissions:v:{$version}";
    }

    // Schedule cache keys
    public static function scheduleDetail(string $scheduleId): string
    {
        return "schedules:detail:{$scheduleId}";
    }

    public static function schedulesList(string $userId, array $filters = []): string
    {
        $version = CacheVersion::get('schedules');
        $filterHash = self::hashFilters($filters);

        return "schedules:list:u:{$userId}:v:{$version}:{$filterHash}";
    }

    public static function classSchedulesList(string $classId, array $filters = []): string
    {
        $version = CacheVersion::get('schedules_class', $classId);
        $filterHash = self::hashFilters($filters);

        return "classes:{$classId}:schedules:v:{$version}:{$filterHash}";
    }

    // Reference data cache keys
    public static function subjectsList(string $userId, bool $activeOnly = false): string
    {
        $version = CacheVersion::get('subjects');
        $flag = $activeOnly ? 'active' : 'all';

        return "subjects:list:u:{$userId}:v:{$version}:{$flag}";
    }

    public static function gradeLevelsList(string $userId, bool $activeOnly = false): string
    {
        $version = CacheVersion::get('grade_levels');
        $flag = $activeOnly ? 'active' : 'all';

        return "grade_levels:list:u:{$userId}:v:{$version}:{$flag}";
    }

    public static function assignmentTypesList(string $userId, bool $activeOnly = false): string
    {
        $version = CacheVersion::get('assignment_types');
        $flag = $activeOnly ? 'active' : 'all';

        return "assignment_types:list:u:{$userId}:v:{$version}:{$flag}";
    }

    public static function gradeTypesList(string $userId, bool $activeOnly = false): string
    {
        $version = CacheVersion::get('grade_types');
        $flag = $activeOnly ? 'active' : 'all';

        return "grade_types:list:u:{$userId}:v:{$version}:{$flag}";
    }

    // Reference data detail cache keys
    public static function subjectDetail(string $subjectId): string
    {
        return "subjects:detail:{$subjectId}";
    }

    public static function gradeLevelDetail(string $gradeLevelId): string
    {
        return "grade_levels:detail:{$gradeLevelId}";
    }

    public static function assignmentTypeDetail(string $assignmentTypeId): string
    {
        return "assignment_types:detail:{$assignmentTypeId}";
    }

    public static function gradeTypeDetail(string $gradeTypeId): string
    {
        return "grade_types:detail:{$gradeTypeId}";
    }

    // Attendance cache keys
    public static function attendanceDetail(string $attendanceId): string
    {
        return "attendance:detail:{$attendanceId}";
    }

    public static function classAttendance(string $classId, array $filters = []): string
    {
        $version = CacheVersion::get('attendance_class', $classId);
        $filterHash = self::hashFilters($filters);

        return "attendance:class:{$classId}:v:{$version}:{$filterHash}";
    }

    public static function attendanceList(string $userId, array $filters = []): string
    {
        $version = CacheVersion::get('attendance');
        $filterHash = self::hashFilters($filters);

        return "attendance:list:u:{$userId}:v:{$version}:{$filterHash}";
    }

    public static function studentPayments(string $studentId, string $userId, array $filters = []): string
    {
        $version = CacheVersion::get('payments_student', $studentId);
        $filterHash = self::hashFilters($filters);

        return "payments:s:{$studentId}:u:{$userId}:v:{$version}:{$filterHash}";
    }

    public static function paymentsList(string $userId, array $filters = []): string
    {
        $version = CacheVersion::get('payments');
        $filterHash = self::hashFilters($filters);

        return "payments:list:u:{$userId}:v:{$version}:{$filterHash}";
    }

    // Grade cache keys
    public static function gradeDetail(string $gradeId): string
    {
        return "grades:detail:{$gradeId}";
    }

    public static function gradesList(string $userId, array $filters = []): string
    {
        $version = CacheVersion::get('grades');
        $filterHash = self::hashFilters($filters);

        return "grades:list:u:{$userId}:v:{$version}:{$filterHash}";
    }

    public static function classGrades(string $classId): string
    {
        return "classes:{$classId}:grades";
    }

    public static function classGradesList(string $classId, array $filters = []): string
    {
        $version = CacheVersion::get('grades_class', $classId);
        $filterHash = self::hashFilters($filters);

        return "classes:{$classId}:grades:v:{$version}:{$filterHash}";
    }

    public static function studentGradesList(string $studentId, array $filters = []): string
    {
        $version = CacheVersion::get('grades_student', $studentId);
        $filterHash = self::hashFilters($filters);

        return "students:{$studentId}:grades:v:{$version}:{$filterHash}";
    }

    // Submission cache keys
    public static function submissionDetail(string $submissionId): string
    {
        return "submissions:detail:{$submissionId}";
    }

    public static function submissionsList(string $userId, array $filters = []): string
    {
        $version = CacheVersion::get('submissions');
        $filterHash = self::hashFilters($filters);

        return "submissions:list:u:{$userId}:v:{$version}:{$filterHash}";
    }
}
