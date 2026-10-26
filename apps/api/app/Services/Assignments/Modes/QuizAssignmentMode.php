<?php

namespace App\Services\Assignments\Modes;

use App\Models\Assignment;
use App\Services\AssignmentQuizService;
use App\Services\Assignments\Contracts\AssignmentMode;
use App\Services\Assignments\DTO\SubmissionContext;
use App\Services\Assignments\DTO\SubmissionResult;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class QuizAssignmentMode implements AssignmentMode
{
    public function mode(): string
    {
        return 'quiz';
    }

    public function rules(bool $isUpdate = false): array
    {
        $questionRule = $isUpdate ? 'nullable|array|min:1' : 'required|array|min:1';
        $questionTypes = implode(',', app(\App\Services\Assignments\QuestionTypes\QuestionTypeRegistry::class)->types());

        return [
            'quiz_settings' => 'nullable|array',
            'quiz_settings.auto_grade' => 'sometimes|boolean',
            'quiz_settings.shuffle_questions' => 'sometimes|boolean',
            'quiz_settings.show_correct_answers' => 'sometimes|boolean',
            'quiz_settings.show_score_to_student' => 'sometimes|boolean',
            'quiz_settings.time_limit_minutes' => 'sometimes|nullable|integer|min:1|max:600',
            // Exam sections (IELTS Listening Part, Reading Passage...). Optional: a flat
            // payload without sections still builds a legacy-style quiz.
            'sections' => 'nullable|array|max:20',
            'sections.*.title' => 'required_with:sections|string|max:255',
            'sections.*.section_type' => 'nullable|in:'.implode(',', config('assignments.section_types', ['general'])),
            'sections.*.instruction' => 'nullable|string|max:5000',
            'sections.*.media_id' => 'nullable|integer|exists:media,id',
            'sections.*.order' => 'nullable|integer|min:1',
            'sections.*._key' => 'nullable|string|max:64',
            'sections.*.settings' => 'nullable|array',
            'questions' => $questionRule,
            'questions.*.title' => 'required_with:questions|string|max:10000',
            'questions.*.description' => 'nullable|string',
            'questions.*.explanation' => 'nullable|string',
            'questions.*.points' => 'nullable|numeric|min:0.5|max:100',
            'questions.*.question_type' => 'nullable|in:'.$questionTypes,
            // Section membership: a client-side temp key resolved against sections.*._key.
            'questions.*.section_key' => 'nullable|string|max:64',
            // Optional media prompt on the question: audio (listening) or an image/diagram.
            'questions.*.media_id' => 'nullable|integer|exists:media,id',
            'questions.*.options' => 'nullable|array|max:30',
            'questions.*.options.*.label' => 'nullable|string|max:10',
            'questions.*.options.*.content' => 'required|string|max:2000',
            'questions.*.options.*.is_correct' => 'required|boolean',
            'questions.*.options.*.feedback' => 'nullable|string|max:1000',
            // Optional image attached to an answer choice.
            'questions.*.options.*.media_id' => 'nullable|integer|exists:media,id',
        ];
    }

    public function prepareData(
        array $data,
        Request $request,
        bool $isUpdate = false,
        ?Assignment $assignment = null
    ): array {
        $data['mode'] = 'quiz';
        $data['allowed_submission_types'] = ['quiz'];
        $data['quiz_settings'] = AssignmentQuizService::normalizeSettings($request->input('quiz_settings'));

        if (! $isUpdate && empty($request->input('questions'))) {
            throw ValidationException::withMessages([
                'questions' => ['Bài trắc nghiệm cần ít nhất 1 câu hỏi.'],
            ]);
        }

        return $data;
    }

    public function afterSave(Assignment $assignment, Request $request, bool $isUpdate = false): void
    {
        $questions = $request->input('questions');

        if ($isUpdate && ! $assignment->wasChanged('mode') && empty($questions)) {
            return;
        }

        if ($isUpdate && $assignment->submissions()->exists() && ! empty($questions)) {
            throw ValidationException::withMessages([
                'questions' => ['Không thể chỉnh câu hỏi vì đã có học viên nộp bài.'],
            ]);
        }

        if (! empty($questions)) {
            AssignmentQuizService::syncQuestions($assignment, $questions, (array) $request->input('sections', []));
        }
    }

    public function handleSubmission(
        Request $request,
        Assignment $assignment,
        SubmissionContext $context
    ): SubmissionResult {
        $answers = $request->input('answers', []);

        // An exam may legitimately be submitted with some items left blank (auto-graded 0);
        // the grader treats a missing answer as earned 0. Only a fully empty payload fails.
        if (! is_array($answers) || count(array_filter($answers, 'is_array')) === 0) {
            throw ValidationException::withMessages([
                'answers' => ['Vui lòng trả lời ít nhất một câu hỏi.'],
            ]);
        }

        $autoGrade = $assignment->quiz_settings['auto_grade'] ?? true;
        $grading = AssignmentQuizService::grade($assignment, $answers, $autoGrade);

        // Tính thời gian làm bài
        $startedAt = $request->input('started_at') ? Carbon::parse($request->input('started_at')) : null;
        $submittedAt = now();
        $timeSpentMinutes = null;

        if ($startedAt) {
            $timeSpentMinutes = max(0, (int) $startedAt->diffInMinutes($submittedAt));
        }

        $submission = $assignment->submissions()->create([
            'student_id' => $context->student->id,
            'submitted_at' => $submittedAt,
            'started_at' => $startedAt,
            'time_spent_minutes' => $timeSpentMinutes,
            'is_late' => $context->isLate,
            'status' => $grading['status'],
            'score' => $autoGrade ? $grading['score'] : null,
            'graded_at' => $grading['status'] === 'graded' ? now() : null,
            'attempt_number' => $context->attemptNumber,
            'submission_type' => 'quiz',
        ]);

        AssignmentQuizService::storeResponses($submission, $grading['responses']);

        return new SubmissionResult(
            $submission,
            $this->buildSuccessMessage($context),
            201
        );
    }

    public function transformResource(Assignment $assignment, Request $request): ?array
    {
        $user = $request->user();
        $exposeCorrectAnswers = $user && ! $user->isStudent();

        $questionCount = $assignment->questions_count
            ?? $assignment->questions()->count();

        $questions = null;
        $sections = null;
        if ($assignment->relationLoaded('questions')) {
            $questions = AssignmentQuizService::transformQuestions(
                $assignment,
                $exposeCorrectAnswers
            );
            if ($assignment->relationLoaded('sections') || $assignment->sections()->exists()) {
                $sections = AssignmentQuizService::transformSections($assignment);
            }
        }

        return [
            'quiz' => [
                'settings' => $assignment->quiz_settings,
                'question_count' => $questionCount,
                'questions' => $questions,
                'sections' => $sections,
            ],
        ];
    }

    public function validateSubmissionUpdate(array $payload, Assignment $assignment): void
    {
        if (! empty(array_filter($payload))) {
            throw ValidationException::withMessages([
                'submission' => ['Không thể chỉnh sửa bài nộp trắc nghiệm thủ công.'],
            ]);
        }
    }

    private function buildSuccessMessage(SubmissionContext $context): string
    {
        $message = $context->attemptNumber === 1
            ? 'Nộp bài trắc nghiệm thành công'
            : 'Nộp lại bài trắc nghiệm thành công';

        if ($context->maxAttempts !== null) {
            $remainingAttempts = max(0, $context->maxAttempts - $context->attemptNumber);
            if ($remainingAttempts > 0) {
                $message .= " (Lần {$context->attemptNumber}/{$context->maxAttempts}, còn {$remainingAttempts} lần)";
            } else {
                $message .= " (Lần {$context->attemptNumber}/{$context->maxAttempts}, đã đạt giới hạn)";
            }
        }

        return $message;
    }
}
