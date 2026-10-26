<?php

namespace App\Http\Resources;

use App\Models\Assignment;
use App\Models\AssignmentQuestion;
use App\Models\AssignmentQuestionOption;
use App\Models\Student;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SubmissionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            '_id' => $this->hash_id,
            'assignment_id' => Assignment::encodeId($this->assignment_id),
            'student_id' => Student::encodeId($this->student_id),
            'submitted_at' => $this->submitted_at?->toISOString(),
            'started_at' => $this->started_at?->toISOString(),
            'time_spent_minutes' => $this->time_spent_minutes,
            'content' => $this->content,
            'media_id' => $this->media_id ? User::encodeId($this->media_id) : null,
            'external_url' => $this->external_url,
            'file_path' => $this->file_path, // Legacy
            'score' => $this->score,
            'max_score' => $this->whenLoaded('assignment', fn () => $this->assignment?->max_score),
            'feedback' => $this->feedback,
            // AI grading is advisory — a suggestion the tutor reviews, never the final score.
            'ai_suggested_score' => $this->ai_suggested_score,
            'ai_feedback' => $this->ai_feedback,
            'ai_graded_at' => $this->ai_graded_at?->toISOString(),
            // AI confidence is a tutor-side signal (review queue) — never shown to students.
            'ai_confidence' => $this->when(! $this->callerIsStudent(), $this->ai_confidence),
            // Rubric breakdown is internal grading detail — tutor only, students get the skill
            // report (aggregate) from the review endpoint instead.
            'ai_criteria' => $this->when(! $this->callerIsStudent(), $this->ai_criteria),
            'graded_by' => $this->graded_by ? User::encodeId($this->graded_by) : null,
            'graded_at' => $this->graded_at?->toISOString(),
            'status' => $this->status,
            'status_label' => $this->getStatusLabel(),
            'is_late' => $this->is_late,
            'attempt_number' => $this->attempt_number ?? 1,
            'submission_type' => $this->submission_type,

            // Attempts information (if assignment is loaded)
            'attempts_info' => $this->when($this->relationLoaded('assignment') && $this->assignment, function () {
                $assignment = $this->assignment;
                $currentAttempts = $this->attempt_number ?? 1;
                $maxAttempts = $assignment->max_attempts;

                return [
                    'current' => $currentAttempts,
                    'max' => $maxAttempts,
                    'remaining' => $maxAttempts !== null ? max(0, $maxAttempts - $currentAttempts) : null,
                    'unlimited' => $maxAttempts === null,
                    'can_resubmit' => $maxAttempts === null || $currentAttempts < $maxAttempts,
                    'limit_reached' => $maxAttempts !== null && $currentAttempts >= $maxAttempts,
                ];
            }),

            // Relationships
            'assignment' => new AssignmentResource($this->whenLoaded('assignment')),
            'student' => new StudentResource($this->whenLoaded('student')),
            'grader' => new UserResource($this->whenLoaded('grader')),
            'quiz_breakdown' => $this->when($this->relationLoaded('questionResponses') && $this->questionResponses->isNotEmpty(), function () {
                return [
                    'total_questions' => $this->questionResponses->count(),
                    'correct' => $this->questionResponses->where('is_correct', true)->count(),
                    'details' => $this->questionResponses->map(function ($item) {
                        return [
                            'question_id' => AssignmentQuestion::encodeId($item->question_id),
                            'selected_option_id' => $item->selected_option_id ? AssignmentQuestionOption::encodeId($item->selected_option_id) : null,
                            // Multi-select picks + short-answer text (single-choice keeps selected_option_id above).
                            'selected_option_ids' => collect($item->selected_option_ids ?? [])
                                ->map(fn ($id) => AssignmentQuestionOption::encodeId($id))
                                ->all(),
                            'text_answer' => $item->text_answer,
                            'response' => $item->response,
                            'is_correct' => $item->is_correct,
                            'score' => $item->score,
                            // meta can carry the correct answer keys (correct_option_ids...) —
                            // never ship those to students; the review endpoint serves them
                            // under its own permission gate.
                            'meta' => $this->metaForCaller($item->meta),
                        ];
                    }),
                ];
            }),

            // Timestamps
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }

    /**
     * meta carries grading internals (correct_option_ids / item_results / position_results...).
     * Per-item booleans are plain feedback for the owner; the correct answer KEYS are not —
     * students get those only via the review endpoint under its show_correct_answers gate.
     */
    private function metaForCaller(?array $meta): ?array
    {
        if ($meta === null) {
            return null;
        }

        $user = request()->user('api');
        if ($user && $user->isStudent()) {
            unset($meta['correct_option_ids'], $meta['correct_pairs'], $meta['correct_order'], $meta['correct_gaps'], $meta['correct_answer']);
        }

        return $meta;
    }

    /**
     * Whether the API caller is a student — the only role that must NOT see AI internals.
     */
    private function callerIsStudent(): bool
    {
        $user = request()->user('api');

        return $user !== null && $user->isStudent();
    }

    /**
     * Get status label in Vietnamese.
     */
    protected function getStatusLabel(): string
    {
        return match ($this->status) {
            'not_submitted' => 'Chưa nộp',
            'submitted' => 'Đã nộp',
            'graded' => 'Đã chấm',
            'returned' => 'Đã trả lại',
            default => $this->status ?? 'N/A',
        };
    }
}
