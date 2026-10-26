<?php

namespace App\Services;

use App\Models\ClassRoom;
use App\Models\Payment;
use App\Models\PaymentRequest;
use App\Models\Student;
use Illuminate\Support\Facades\DB;

class EnrollmentService
{
    /**
     * Enroll a student in a class.
     *
     * @throws \Exception
     */
    public static function enrollStudent(
        Student $student,
        ClassRoom $class,
        ?string $notes = null
    ): void {
        // Check if already enrolled
        if ($student->isEnrolledIn($class->id)) {
            throw new \Exception('Học viên đã đăng ký lớp này rồi.');
        }

        // Check if class is full (based on class's own max_students)
        if ($class->isFull()) {
            throw new \Exception("Lớp học đã đầy ({$class->max_students} học viên).");
        }

        // Enroll student
        $student->classes()->attach($class->id, [
            'enrolled_at' => now(),
            'status' => 'active',
            'notes' => $notes,
        ]);

        // Auto-generate payments for active payment requests in this class
        $activePaymentRequests = PaymentRequest::where('class_id', $class->id)
            ->where('status', 'active')
            ->get();

        foreach ($activePaymentRequests as $paymentRequest) {
            // Check if payment already exists for this student and payment request
            // (Just in case logic runs multiple times or re-enrollment logic changes)
            $exists = Payment::where('student_id', $student->id)
                ->where('payment_request_id', $paymentRequest->id)
                ->exists();

            if (! $exists) {
                Payment::create([
                    'student_id' => $student->id,
                    'class_id' => $class->id,
                    'payment_request_id' => $paymentRequest->id,
                    'amount' => $paymentRequest->amount_per_student,
                    'month' => $paymentRequest->period_month, // Assuming '2023-10' format or similar
                    'due_date' => $paymentRequest->due_date,
                    'status' => 'pending',
                    'note' => $paymentRequest->description,
                ]);
            }
        }
    }

    /**
     * Unenroll a student from a class.
     */
    public static function unenrollStudent(Student $student, ClassRoom $class): void
    {
        $student->classes()->detach($class->id);
    }

    /**
     * Update enrollment status.
     */
    public static function updateEnrollmentStatus(
        Student $student,
        ClassRoom $class,
        string $status
    ): void {
        $student->classes()->updateExistingPivot($class->id, [
            'status' => $status,
        ]);
    }

    /**
     * Get total active students for a tutor (across all classes).
     */
    public static function getTotalActiveStudentsForTutor(int $tutorId): int
    {
        return DB::table('class_student')
            ->join('classes', 'class_student.class_id', '=', 'classes.id')
            ->where('classes.tutor_id', $tutorId)
            ->where('class_student.status', 'active')
            ->where('class_student.is_paused', false)
            ->distinct('class_student.student_id')
            ->count('class_student.student_id');
    }

    /**
     * Get total active classes for a tutor.
     */
    public static function getTotalActiveClassesForTutor(int $tutorId): int
    {
        return ClassRoom::where('tutor_id', $tutorId)
            ->where('status', 'active')
            ->count();
    }
}
