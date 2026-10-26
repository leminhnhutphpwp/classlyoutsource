<?php

namespace App\Support;

class CacheHelper
{
    public static function forgetClasses(): void
    {
        CacheVersion::increment('classes');
    }

    public static function forgetStudents(?int $classId = null, ?int $studentId = null): void
    {
        CacheVersion::increment('students');

        if ($classId) {
            CacheVersion::increment('students_class', $classId);
        }
        if ($studentId) {
            CacheVersion::increment('classes_student', $studentId);
        }
    }

    public static function forgetAssignments(?int $classId = null, ?int $studentId = null): void
    {
        CacheVersion::increment('assignments');

        if ($classId) {
            CacheVersion::increment('assignments_class', $classId);
        }
        if ($studentId) {
            CacheVersion::increment('assignments_student', $studentId);
        }
    }

    public static function forgetSchedules(?int $classId = null): void
    {
        CacheVersion::increment('schedules');

        if ($classId) {
            CacheVersion::increment('schedules_class', $classId);
        }
    }

    public static function forgetAttendance(?int $classId = null, ?int $studentId = null): void
    {
        CacheVersion::increment('attendance');

        if ($classId) {
            CacheVersion::increment('attendance_class', $classId);
        }
        if ($studentId) {
            CacheVersion::increment('attendance_student', $studentId);
        }
    }

    public static function forgetGrades(?int $classId = null, ?int $studentId = null): void
    {
        CacheVersion::increment('grades');

        if ($classId) {
            CacheVersion::increment('grades_class', $classId);
        }
        if ($studentId) {
            CacheVersion::increment('grades_student', $studentId);
        }
    }

    public static function forgetSubmissions(?int $assignmentId = null, ?int $studentId = null): void
    {
        CacheVersion::increment('submissions');

        if ($assignmentId) {
            CacheVersion::increment('submissions_assignment', $assignmentId);
        }
        if ($studentId) {
            CacheVersion::increment('submissions_student', $studentId);
        }
    }

    public static function forgetSubjects(): void
    {
        CacheVersion::increment('subjects');
    }

    public static function forgetGradeLevels(): void
    {
        CacheVersion::increment('grade_levels');
    }

    public static function forgetAssignmentTypes(): void
    {
        CacheVersion::increment('assignment_types');
    }

    public static function forgetGradeTypes(): void
    {
        CacheVersion::increment('grade_types');
    }

    public static function forgetPayments(?int $studentId = null): void
    {
        CacheVersion::increment('payments');

        if ($studentId) {
            CacheVersion::increment('payments_student', $studentId);
        }
    }
}
