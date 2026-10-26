<?php

namespace App\Actions\Concerns;

use App\Models\ClassRoom;
use App\Models\Student;
use App\Models\User;

/**
 * Shared entity resolution for the import actions.
 *
 * Previously each ImportXxxAction carried its own copy of findStudent()/findClass().
 * The copies drifted: only ImportEnrollmentAction could resolve a HashID, while the
 * attendance/grade/payment copies did a raw `where('id', ...)` that silently failed
 * for HashID identifiers. This trait centralises the HashID-aware version so every
 * import path resolves students and classes identically.
 */
trait ResolvesImportEntities
{
    /**
     * Find a student by (numeric or HashID) student_id, then email, then phone.
     */
    protected static function findStudent(array $data): ?Student
    {
        if (! empty($data['student_id'])) {
            // Numeric primary key first.
            if (is_numeric($data['student_id'])) {
                $student = Student::find($data['student_id']);
                if ($student) {
                    return $student;
                }
            }

            // Then try the public HashID.
            $student = Student::findByHashId($data['student_id']);
            if ($student) {
                return $student;
            }
        }

        if (! empty($data['student_email'])) {
            return Student::where('email', $data['student_email'])->first();
        }

        if (! empty($data['student_phone'])) {
            return Student::where('phone', $data['student_phone'])->first();
        }

        return null;
    }

    /**
     * Find a class by (numeric or HashID) class_id, then class_code, then class_name.
     * Applies tutor data isolation: a non-super-admin tutor only sees their own classes.
     */
    protected static function findClass(array $data, int $userId): ?ClassRoom
    {
        $user = User::find($userId);
        if (! $user) {
            return null;
        }

        $query = ClassRoom::query();

        // Apply data isolation for tutors.
        if ($user->isTutor() && ! $user->isSuperAdmin()) {
            $query->where('tutor_id', $userId);
        }

        if (! empty($data['class_id'])) {
            if (is_numeric($data['class_id'])) {
                $query->where('id', $data['class_id']);
            } else {
                $class = ClassRoom::findByHashId($data['class_id']);
                if ($class) {
                    $query->where('id', $class->id);
                } else {
                    // Invalid HashID provided.
                    return null;
                }
            }
        } elseif (! empty($data['class_code'])) {
            $query->where('name', 'like', '%'.$data['class_code'].'%');
        } elseif (! empty($data['class_name'])) {
            $query->where('name', 'like', '%'.$data['class_name'].'%');
        } else {
            return null;
        }

        return $query->first();
    }
}
