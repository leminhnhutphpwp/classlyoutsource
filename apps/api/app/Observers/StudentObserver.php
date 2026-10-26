<?php

namespace App\Observers;

use App\Models\Student;
use App\Support\CacheHelper;
use App\Support\CacheKeys;
use Illuminate\Support\Facades\Cache;

class StudentObserver
{
    /**
     * Handle the Student "created" event.
     */
    public function created(Student $student): void
    {
        $this->clearCache($student);
    }

    /**
     * Handle the Student "updated" event.
     */
    public function updated(Student $student): void
    {
        $this->clearCache($student);
    }

    /**
     * Handle the Student "deleted" event.
     */
    public function deleted(Student $student): void
    {
        $this->clearCache($student);
    }

    /**
     * Handle the Student "restored" event.
     */
    public function restored(Student $student): void
    {
        $this->clearCache($student);
    }

    /**
     * Handle the Student "force deleted" event.
     */
    public function forceDeleted(Student $student): void
    {
        $this->clearCache($student);
    }

    /**
     * Clear relevant caches.
     */
    protected function clearCache(Student $student): void
    {
        // 1. Clear Detail Cache
        Cache::forget(CacheKeys::studentDetail($student->id));

        // 2. Clear Students Lists (Global & Student's Classes List)
        CacheHelper::forgetStudents(null, $student->id);

        // 3. Clear Cache of Classes this student belongs to
        // Because student name/avatar might be shown in class student list
        // Note: This might be expensive if student is in many classes, but usually < 10
        try {
            $classIds = $student->classes()->pluck('classes.id')->toArray();
            foreach ($classIds as $classId) {
                // Bump the per-class roster version (students_class) so the class student list
                // refreshes. The previous Cache::forget(classStudents(...)) was a no-op — the read
                // key is versioned/filter-hashed, so the roster stayed stale after a student edit.
                CacheHelper::forgetStudents($classId);
            }
        } catch (\Exception $e) {
            // Ignore if relation fails (e.g. during force delete)
        }

        // 4. Clear related modules caches where student data might be embedded
        // (Attendance, Grades, Submissions lists usually include student name/avatar)
        try {
            CacheHelper::forgetAttendance(null, $student->id);
            CacheHelper::forgetGrades(null, $student->id);
            CacheHelper::forgetSubmissions(null, $student->id);
            // Assignments per se don't usually embed student data, but student's assignment list does
            CacheHelper::forgetAssignments(null, $student->id);
        } catch (\Exception $e) {
            // Ignore errors
        }

        // 5. Other related caches
        CacheHelper::forgetPayments($student->id);
    }
}
