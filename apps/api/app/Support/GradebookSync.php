<?php

namespace App\Support;

use App\Models\Grade;
use App\Models\GradeType;
use App\Models\Submission;
use Illuminate\Support\Facades\Log;

/**
 * Bridges submission grading into the gradebook so a tutor never enters the same score twice.
 * When a submission becomes 'graded', we upsert exactly one Grade keyed by submission_id
 * (idempotent — re-grading updates the same row, never duplicates).
 */
class GradebookSync
{
    /**
     * Create/update the gradebook entry for a graded submission. Returns the Grade, or null when
     * the submission isn't in a state that should produce a grade. Never throws into the caller:
     * a gradebook hiccup must not break the grading flow itself.
     */
    public static function syncFromSubmission(Submission $submission): ?Grade
    {
        try {
            $submission->loadMissing('assignment.class');
            $assignment = $submission->assignment;

            if (! $assignment || ! $assignment->class_id || ! $assignment->class) {
                return null;
            }

            // Only mirror an actual, scored grade.
            if ($submission->status !== 'graded' || is_null($submission->score)) {
                return null;
            }

            $class = $assignment->class;

            // Map the assignment to a stable, per-tutor "Bài tập" grade type. Idempotent by (owner, code).
            $gradeType = GradeType::firstOrCreate(
                ['created_by' => $class->tutor_id, 'code' => 'ASSIGNMENT'],
                ['name' => 'Bài tập', 'weight' => 1, 'is_active' => true]
            );

            $maxScore = $assignment->max_score ?: 100;

            return Grade::updateOrCreate(
                ['submission_id' => $submission->id],
                [
                    'student_id' => $submission->student_id,
                    'class_id' => $assignment->class_id,
                    'assignment_id' => $assignment->id,
                    'grade_type_id' => $gradeType->id,
                    'tutor_id' => $class->tutor_id,
                    'title' => $assignment->title,
                    'score' => $submission->score,
                    'max_score' => $maxScore,
                    'comments' => $submission->feedback,
                    'grade_date' => now()->toDateString(),
                ]
            );
        } catch (\Throwable $e) {
            Log::warning('GradebookSync failed for submission', [
                'submission_id' => $submission->id ?? null,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
