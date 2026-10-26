<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Resources\AssignmentResource;
use App\Http\Resources\SubmissionResource;
use App\Models\Assignment;
use App\Models\AssignmentQuestion;
use App\Models\AssignmentQuestionOption;
use App\Models\AssignmentQuestionSubmission;
use App\Models\Media;
use App\Models\Student;
use App\Models\Submission;
use App\Models\UserNotificationPreference;
use App\Notifications\NewSubmissionNotification;
use App\Rules\ExistsHashId;
use App\Services\Assignments\AssignmentWorkflowService;
use App\Services\Assignments\DTO\SubmissionContext;
use App\Services\AssignmentQuizService;
use App\Services\BotShield;
use App\Services\Reports\SkillReportBuilder;
use App\Support\CacheKeys;
use App\Support\CacheTtl;
use App\Support\GradebookSync;
use App\Traits\DecodesHashIds;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class SubmissionController extends BaseController
{
    use DecodesHashIds;

    /**
     * Get validation rules for submission.
     */
    private function getValidationRules(): array
    {
        return [
            'assignment_id' => ['required', new ExistsHashId(Assignment::class)],
            'content' => 'nullable|string',
            'file_path' => 'nullable|string|max:500',
            'media_id' => ['nullable', new ExistsHashId(Media::class)],
            'external_url' => 'nullable|url|max:500',
            'answers' => 'nullable|array|min:1',
            'answers.*.question_id' => ['required_with:answers', new ExistsHashId(AssignmentQuestion::class)],
            // Answer shape depends on the question type: single_choice sends option_id,
            // multiple_choice sends selected_option_ids[], short_answer sends text, and the
            // exam types (matching/ordering/gap_fill/tfn) send a structured `response` map.
            // None of them is required on every answer row — a blank answer simply scores 0.
            'answers.*.option_id' => ['nullable', new ExistsHashId(AssignmentQuestionOption::class)],
            'answers.*.selected_option_id' => ['nullable', 'string', 'max:64'],
            'answers.*.selected_option_ids' => ['nullable', 'array', 'max:30'],
            'answers.*.selected_option_ids.*' => ['nullable', 'string', 'max:64'],
            'answers.*.text' => ['nullable', 'string', 'max:2000'],
            'answers.*.response' => ['nullable', 'array', 'max:60'],
            'started_at' => 'nullable|date', // Thời gian bắt đầu làm bài (cho quiz)
        ];
    }

    /**
     * Get validation rules for grading. `question_scores` (map of question hashid/int → points)
     * is the per-question manual grading path for quiz submissions; `score` is required only when
     * no per-question scores are sent.
     */
    private function getGradingValidationRules(): array
    {
        return [
            'score' => 'required_without:question_scores|nullable|numeric|min:0',
            'feedback' => 'nullable|string',
            'question_scores' => 'nullable|array',
            'question_scores.*' => 'numeric|min:0',
        ];
    }

    /**
     * Apply filters (assignment_id, status, sort) to query.
     */
    private function applyFilters($query, Request $request)
    {
        if ($request->has('assignment_id')) {
            $query->where('assignment_id', $request->assignment_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('search')) {
            $query->where(function ($q) use ($request) {
                $q->whereHas('assignment', function ($assignmentQuery) use ($request) {
                    $assignmentQuery->where('title', 'like', "%{$request->search}%");
                })
                    ->orWhereHas('student', function ($studentQuery) use ($request) {
                        $studentQuery->where('name', 'like', "%{$request->search}%")
                            ->orWhere('email', 'like', "%{$request->search}%");
                    });
            });
        }

        // Sort
        $sortBy = $request->get('sort', 'submitted_at');
        $sortOrder = $request->get('order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        return $query;
    }

    public function store(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Only students can submit assignments
        if (! $user->isStudent()) {
            return $this->errorResponse('Chỉ học sinh mới có thể nộp bài', null, 'UNAUTHORIZED', 403);
        }

        $student = $user->studentProfile->first();
        if (! $student) {
            return $this->errorResponse('Không tìm thấy thông tin học sinh', null, 'NOT_FOUND', 404);
        }

        $validator = Validator::make($request->all(), $this->getValidationRules());

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        // Decode HashIDs
        $idsToDecode = $request->only(['media_id']);
        $this->decodeHashId($idsToDecode, 'media_id', Media::class);
        $request->merge($idsToDecode);

        $this->decodeHashId($request, 'assignment_id', Assignment::class);

        // Decode HashIDs in answers array
        if ($request->has('answers') && is_array($request->answers)) {
            $decodedAnswers = [];
            foreach ($request->answers as $answer) {
                $decodedAnswer = $answer;

                // Decode question_id
                if (isset($answer['question_id'])) {
                    $questionData = ['question_id' => $answer['question_id']];
                    $this->decodeHashId($questionData, 'question_id', AssignmentQuestion::class);
                    $decodedAnswer['question_id'] = $questionData['question_id'];
                }

                // Decode option_id
                if (isset($answer['option_id'])) {
                    $optionData = ['option_id' => $answer['option_id']];
                    $this->decodeHashId($optionData, 'option_id', AssignmentQuestionOption::class);
                    $decodedAnswer['option_id'] = $optionData['option_id'];
                }

                $decodedAnswers[] = $decodedAnswer;
            }
            $request->merge(['answers' => $decodedAnswers]);
        }

        $assignment = Assignment::find($request->assignment_id);
        if ($assignment) {
            $assignment->load('class');
        }

        if (! $assignment) {
            return $this->errorResponse('Không tìm thấy bài tập', null, 'NOT_FOUND', 404);
        }

        // Check if student is enrolled in the class
        if (! $student->isEnrolledIn($assignment->class_id)) {
            return $this->errorResponse('Bạn không thuộc lớp học này', null, 'UNAUTHORIZED', 403);
        }

        if ($student->isPausedInClass($assignment->class_id)) {
            return $this->errorResponse(
                'Bạn đang tạm dừng trong lớp học này nên không thể nộp bài',
                null,
                'STUDENT_PAUSED',
                422
            );
        }

        // Check assignment status (closed must be checked first — it's the more specific error).
        if ($assignment->status === 'closed') {
            return $this->errorResponse('Bài tập đã đóng', null, 'BAD_REQUEST', 400);
        }
        if ($assignment->status !== 'published') {
            return $this->errorResponse('Bài tập chưa được công bố', null, 'BAD_REQUEST', 400);
        }

        // Check if overdue and not allowing late submission
        $isLate = $assignment->due_date && now()->isAfter($assignment->due_date);
        if ($isLate && ! $assignment->allow_late_submission) {
            return $this->errorResponse('Bài tập đã quá hạn và không cho phép nộp muộn', null, 'BAD_REQUEST', 400);
        }

        // Check max attempts limit - Count existing submissions (chỉ đếm các bài đã thực sự nộp, không tính not_submitted)
        $maxAttempts = $assignment->max_attempts;
        if ($maxAttempts !== null) {
            $existingSubmissionsCount = Submission::where('assignment_id', $assignment->id)
                ->where('student_id', $student->id)
                ->where('status', '!=', 'not_submitted') // Chỉ đếm các bài đã nộp (submitted, graded, returned)
                ->count();

            if ($existingSubmissionsCount >= $maxAttempts) {
                return $this->errorResponse(
                    "Bạn đã đạt giới hạn số lần nộp ({$maxAttempts} lần). Không thể nộp lại.",
                    [
                        'max_attempts' => $maxAttempts,
                        'current_attempts' => $existingSubmissionsCount,
                        'remaining_attempts' => 0,
                        'limit_reached' => true,
                    ],
                    'MAX_ATTEMPTS_EXCEEDED',
                    400
                );
            }
        } else {
            // Nếu không có giới hạn, vẫn cần đếm để tính attempt_number
            $existingSubmissionsCount = Submission::where('assignment_id', $assignment->id)
                ->where('student_id', $student->id)
                ->where('status', '!=', 'not_submitted')
                ->count();
        }

        if ($botBlock = BotShield::check($user, 'submissions', ['action' => 'create'])) {
            return $this->errorResponse(
                $botBlock['message'],
                $botBlock['details'],
                $botBlock['code'],
                $botBlock['status']
            );
        }

        $newAttemptNumber = $existingSubmissionsCount + 1;
        $workflow = app(AssignmentWorkflowService::class);
        $context = new SubmissionContext(
            student: $student,
            user: $user,
            isLate: $isLate,
            attemptNumber: $newAttemptNumber,
            maxAttempts: $maxAttempts,
            existingAttempts: $existingSubmissionsCount
        );

        try {
            $result = $workflow->handleSubmission($request, $assignment, $context);
        } catch (ValidationException $e) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $e, 'VALIDATION_ERROR', 422);
        }

        $submission = $result->submission;
        $message = $result->message;
        $statusCode = $result->status;

        // Gửi notification cho giáo viên khi có bài nộp mới
        try {
            $class = $assignment->class;
            if ($class && $class->tutor) {
                $tutor = $class->tutor;

                // Check notification preferences before sending
                if (UserNotificationPreference::shouldSendNotification($tutor->id, 'new_submission', 'email')) {
                    // Queue notification để không block response
                    $tutor->notify((new NewSubmissionNotification($submission))->delay(now()->addSeconds(2)));
                }
            }
        } catch (\Exception $e) {
            // Log error nhưng không fail request
            Log::channel('notifications')->warning('Failed to send new submission notification', [
                'submission_id' => $submission->id,
                'error' => $e->getMessage(),
            ]);
        }

        // Cache clearing handled by SubmissionObserver

        return $this->successResponse(
            new SubmissionResource($submission->load(['assignment', 'student', 'grader', 'questionResponses'])),
            $message,
            $statusCode
        );
    }

    public function index(Request $request): JsonResponse
    {
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Build cache key with filters
        $filters = [
            'assignment_id' => $request->get('assignment_id'),
            'status' => $request->get('status'),
            'latest' => $request->get('latest'),
            'sort' => $request->get('sort', 'submitted_at'),
            'order' => $request->get('order', 'desc'),
            'per_page' => $request->get('per_page', 15),
            'page' => $request->get('page', 1),
        ];
        $cacheKey = CacheKeys::submissionsList($user->id, $filters);

        $result = Cache::remember($cacheKey, CacheTtl::LIST, function () use ($request, $user) {
            $query = Submission::query()->with(['assignment', 'student', 'grader', 'questionResponses']);

            // Students only see their own submissions
            if ($user->isStudent()) {
                $student = $this->getCurrentStudent();
                if ($student) {
                    $query->where('student_id', $student->id);
                } else {
                    $query->whereRaw('1 = 0'); // No student profile = no submissions
                }
            } else {
                // Tutors see submissions from their classes
                $query->whereHas('assignment.class', function ($q) use ($user) {
                    if ($user->isTutor()) {
                        // Tutor: classes do họ dạy
                        $q->where('tutor_id', $user->id);
                    }
                });
            }

            // Filter: latest only (get only the latest submission for each assignment-student pair)
            if ($request->has('latest') && $request->boolean('latest')) {
                // Get latest submission for each assignment-student combination
                $query->whereIn('id', function ($subQuery) {
                    $subQuery->selectRaw('MAX(id)')
                        ->from('submissions')
                        ->groupBy('assignment_id', 'student_id');
                });
            }

            // Apply filters
            $query = $this->applyFilters($query, $request);

            $perPage = min($request->get('per_page', 15), 100);
            $submissions = $query->orderBy('submitted_at', 'desc')->paginate($perPage);

            // Calculate statistics (on all data, not filtered/paginated)
            $statsQuery = Submission::query()->with('assignment');

            // Students only see their own submissions
            if ($user->isStudent()) {
                $student = $this->getCurrentStudent();
                if ($student) {
                    $statsQuery->where('student_id', $student->id);
                } else {
                    $statsQuery->whereRaw('1 = 0');
                }
            } else {
                // Tutors see submissions from their classes
                $statsQuery->whereHas('assignment.class', function ($q) use ($user) {
                    if ($user->isTutor()) {
                        $q->where('tutor_id', $user->id);
                    }
                });
            }

            $statistics = [
                'total' => $statsQuery->count(),
                'graded' => (clone $statsQuery)->where('status', 'graded')->count(),
                'submitted' => (clone $statsQuery)->where('status', 'submitted')->count(),
                'returned' => (clone $statsQuery)->where('status', 'returned')->count(),
                'late' => (clone $statsQuery)->whereHas('assignment', function ($q) {
                    $q->whereColumn('submissions.submitted_at', '>', 'assignments.due_date');
                })->where('status', '!=', 'cancelled')->count(),
            ];

            return [
                'data' => SubmissionResource::collection($submissions),
                'meta' => [
                    'current_page' => $submissions->currentPage(),
                    'per_page' => $submissions->perPage(),
                    'total' => $submissions->total(),
                    'last_page' => $submissions->lastPage(),
                    'statistics' => $statistics,
                ],
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $result['data'],
            'meta' => $result['meta'],
        ]);
    }

    public function show(Submission $submission): JsonResponse
    {
        // Defensive check: ensure submission was properly resolved
        if (! $submission || ! $submission->exists || ! $submission->id) {
            return $this->errorResponse('Không tìm thấy bài nộp', null, 'NOT_FOUND', 404);
        }
        $cacheKey = CacheKeys::submissionDetail($submission->id);

        $submission = Cache::remember($cacheKey, CacheTtl::DETAIL, function () use ($submission) {
            return $submission->load(['assignment', 'student', 'grader', 'questionResponses']);
        });

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Check access
        if ($user->isStudent()) {
            $student = $this->getCurrentStudent();
            if (! $student || $submission->student_id !== $student->id) {
                return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }
        } else {
            if (! $this->canManageResource($submission->assignment->class)) {
                return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
            }
        }

        // Load assignment to get max_attempts info
        if (! $submission->relationLoaded('assignment')) {
            $submission->load('assignment');
        }

        return $this->successResponse(new SubmissionResource($submission));
    }

    public function update(Request $request, Submission $submission): JsonResponse
    {
        // Defensive check: ensure submission was properly resolved
        if (! $submission || ! $submission->exists || ! $submission->id) {
            return $this->errorResponse('Không tìm thấy bài nộp', null, 'NOT_FOUND', 404);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Students cannot update submissions - only tutors can
        if ($user->isStudent()) {
            return $this->errorResponse('Học sinh không thể sửa bài nộp', null, 'UNAUTHORIZED', 403);
        }

        // Only tutors can update submissions in their classes
        if (! $this->canManageResource($submission->assignment->class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        $validator = Validator::make($request->all(), [
            'content' => 'nullable|string',
            'file_path' => 'nullable|string|max:500',
            'media_id' => ['nullable', new ExistsHashId(Media::class)],
            'external_url' => 'nullable|url|max:500',
            'reset_status' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        $updateData = $request->only(['content', 'file_path', 'media_id', 'external_url']);
        $this->decodeHashId($updateData, 'media_id', Media::class);

        // Validate submission type if updating
        if (! empty(array_filter($updateData))) {
            try {
                app(AssignmentWorkflowService::class)
                    ->validateSubmissionUpdate($updateData, $submission->assignment);
            } catch (ValidationException $e) {
                return $this->errorResponse('Lỗi xác thực dữ liệu', $e, 'VALIDATION_ERROR', 422);
            }
        }

        // If updating, reset status to pending if it was graded (only tutors can do this)
        if (! $user->isStudent() && $request->has('reset_status') && $request->reset_status) {
            $updateData['status'] = 'pending';
            $updateData['graded_by'] = null;
            $updateData['graded_at'] = null;
        }

        $submission->update($updateData);

        // Cache clearing handled by SubmissionObserver

        return $this->successResponse(
            new SubmissionResource($submission->fresh(['assignment', 'student', 'grader'])),
            'Cập nhật bài nộp thành công'
        );
    }

    public function destroy(Submission $submission): JsonResponse
    {
        // Defensive check: ensure submission was properly resolved
        if (! $submission || ! $submission->exists || ! $submission->id) {
            return $this->errorResponse('Không tìm thấy bài nộp', null, 'NOT_FOUND', 404);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Students cannot delete submissions - only tutors can
        if ($user->isStudent()) {
            return $this->errorResponse('Học sinh không thể xóa bài nộp', null, 'UNAUTHORIZED', 403);
        }

        // Only tutors can delete submissions in their classes
        if (! $this->canManageResource($submission->assignment->class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        $assignmentId = $submission->assignment_id;
        $studentId = $submission->student_id;
        $submission->delete();

        // Cache clearing handled by SubmissionObserver

        return $this->successResponse(null, 'Xóa bài nộp thành công');
    }

    /**
     * Review a quiz/exam submission: the questions as the student saw them, the student's own
     * answers with per-question results, and — only when allowed — the correct answers and
     * explanations. Replaces the old student-facing gap where review required the tutor-only
     * quiz/schema endpoint (students got a bare "Câu hỏi #id").
     */
    public function review(Submission $submission): JsonResponse
    {
        if (! $submission || ! $submission->exists || ! $submission->id) {
            return $this->errorResponse('Không tìm thấy bài nộp', null, 'NOT_FOUND', 404);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $submission->load(['assignment.class', 'student', 'questionResponses']);
        $assignment = $submission->assignment;

        if (! $assignment || ! $assignment->isQuiz()) {
            return $this->errorResponse('Bài nộp này không có đề trắc nghiệm', null, 'NOT_FOUND', 404);
        }

        // Staff = tutor/admin side of the class. canManageResource(ClassRoom) also returns true
        // for enrolled students ("can view the class"), which is NOT staff for answer-key purposes
        // — so students must be excluded here and fall through to the ownership check below.
        $isStaff = ! $user->isStudent() && $this->canManageResource($assignment->class);
        $isOwner = false;
        if ($user->isStudent()) {
            $student = $this->getCurrentStudent();
            $isOwner = $student !== null && $submission->student_id === $student->id;
        }

        if (! $isStaff && ! $isOwner) {
            // Fail closed: another student's (or anyone else's) paper is invisible.
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Correct answers ride along only for staff, or for the owning student when the
        // assignment explicitly allows showing them.
        $exposeCorrect = $isStaff
            || (bool) ($assignment->quiz_settings['show_correct_answers'] ?? false);

        $assignment->load(['questions.options.media', 'questions.media', 'sections.media']);

        // Skill report (per-section breakdown) is an aggregate of the student's OWN attempt —
        // safe for both staff and the owning student, and never leaks answer keys. Only when
        // the attempt actually has scores; otherwise null so the FE shows the waiting state.
        $skillReport = $submission->isGraded()
            ? app(SkillReportBuilder::class)->build($submission)
            : null;

        return $this->successResponse([
            'submission' => new SubmissionResource($submission),
            'assignment' => new AssignmentResource($assignment->withoutRelations()),
            'sections' => AssignmentQuizService::transformSections($assignment),
            'questions' => AssignmentQuizService::transformQuestions($assignment, $exposeCorrect),
            'skill_report' => $skillReport,
            'responses' => $submission->questionResponses->map(function (AssignmentQuestionSubmission $row) use ($exposeCorrect) {
                return [
                    'question_id' => AssignmentQuestion::encodeId($row->question_id),
                    'selected_option_id' => $row->selected_option_id
                        ? AssignmentQuestionOption::encodeId($row->selected_option_id)
                        : null,
                    'selected_option_ids' => collect((array) $row->selected_option_ids)
                        ->map(fn ($id) => AssignmentQuestionOption::encodeId($id))
                        ->all(),
                    'text_answer' => $row->text_answer,
                    'response' => $row->response,
                    'is_correct' => $row->is_correct,
                    'score' => $row->score,
                    'max_points' => $row->meta['max_points'] ?? null,
                    'meta' => $exposeCorrect ? $row->meta : $this->metaWithoutAnswerKeys($row->meta),
                ];
            })->values()->all(),
            'expose_correct' => $exposeCorrect,
        ]);
    }

    /**
     * Strip the answer KEYS from stored grading meta (correct option ids / orders / pairs);
     * per-item correctness booleans stay — they are plain feedback about the student's own
     * attempt. The full answer key only ships when the caller is allowed to see it.
     */
    private function metaWithoutAnswerKeys(?array $meta): ?array
    {
        if ($meta === null) {
            return null;
        }

        unset(
            $meta['correct_option_ids'],
            $meta['correct_pairs'],
            $meta['correct_order'],
            $meta['correct_gaps'],
            $meta['correct_answer']
        );

        return $meta;
    }

    public function grade(Request $request, Submission $submission): JsonResponse
    {
        // Defensive check: ensure submission was properly resolved
        if (! $submission || ! $submission->exists || ! $submission->id) {
            return $this->errorResponse('Không tìm thấy bài nộp', null, 'NOT_FOUND', 404);
        }

        if (! $this->canManageResource($submission->assignment->class)) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        $validator = Validator::make($request->all(), $this->getGradingValidationRules());

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        // Validate score doesn't exceed max_score (when the client sends a single total).
        $maxScore = $submission->assignment->max_score;
        if ($maxScore && filled($request->input('score')) && $request->input('score') > $maxScore) {
            return $this->errorResponse(
                "Điểm không được vượt quá điểm tối đa ({$maxScore})",
                null,
                'VALIDATION_ERROR',
                422
            );
        }

        // Per-question manual grading (quiz submissions): apply each override, clamp it against
        // the question's max_points, then recompute the submission total from all rows. Auto-graded
        // rows keep their earned score; unlisted rows stay untouched.
        $questionScores = (array) $request->input('question_scores', []);
        if ($questionScores !== []) {
            $total = $this->applyQuestionScores($submission, $questionScores);
            if ($maxScore && $total > $maxScore) {
                return $this->errorResponse(
                    "Tổng điểm từng câu ({$total}) vượt quá điểm tối đa ({$maxScore})",
                    null,
                    'VALIDATION_ERROR',
                    422
                );
            }
            $submission->update([
                'score' => $total,
                'feedback' => $request->input('feedback', $submission->feedback),
                'graded_by' => auth('api')->id(),
                'graded_at' => now(),
                'status' => 'graded',
            ]);
        } else {
            $submission->update([
                'score' => $request->input('score'),
                'feedback' => $request->input('feedback'),
                'graded_by' => auth('api')->id(),
                'graded_at' => now(),
                'status' => 'graded',
            ]);
        }

        // Mirror the score into the gradebook (idempotent by submission_id) so tutors don't re-enter it.
        GradebookSync::syncFromSubmission($submission->fresh());

        // Cache clearing handled by SubmissionObserver

        return $this->successResponse(
            new SubmissionResource($submission->fresh()),
            'Chấm điểm bài nộp thành công'
        );
    }

    /**
     * Apply per-question manual scores to a quiz submission's answer rows and return the new
     * submission total. Keys may be question hashids or raw ids; unknown questions are skipped.
     *
     * @param  array<string|int, float|int|string>  $questionScores
     */
    private function applyQuestionScores(Submission $submission, array $questionScores): float
    {
        $questionIds = collect($questionScores)
            ->map(function ($score, $identifier) {
                $id = AssignmentQuestion::decodeId($identifier);
                $id = $id ?: (is_numeric($identifier) ? (int) $identifier : null);
                $score = max(0.0, (float) $score);

                return $id ? ['id' => $id, 'score' => $score] : null;
            })
            ->filter()
            ->values();

        if ($questionIds->isEmpty()) {
            return (float) $submission->score;
        }

        $rows = $submission->questionResponses()
            ->whereIn('question_id', $questionIds->pluck('id'))
            ->get()
            ->keyBy('question_id');

        foreach ($questionIds as $entry) {
            $row = $rows->get($entry['id']);
            if (! $row) {
                continue; // answer row missing — nothing to score
            }
            $maxPoints = (float) ($row->meta['max_points'] ?? 0);
            $score = $maxPoints > 0 ? min($maxPoints, $entry['score']) : $entry['score'];
            $row->update([
                'score' => abs($score - round($score)) < 0.005 ? (int) round($score) : $score,
                // Full points → correct; zero → incorrect; partial stays "correct" (credit given).
                'is_correct' => $maxPoints > 0 ? $score >= $maxPoints - 0.005 : $score > 0,
            ]);
        }

        return round((float) $submission->questionResponses()->sum('score'), 2);
    }

    /**
     * Get latest submission for a student's assignment.
     *
     * @param  int  $assignmentId
     */
    public function latest(Assignment $assignment): JsonResponse
    {
        // Defensive check: ensure assignment was properly resolved
        if (! $assignment || ! $assignment->exists || ! $assignment->id) {
            return $this->errorResponse('Không tìm thấy bài tập', null, 'NOT_FOUND', 404);
        }
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Only students can get their latest submission
        if (! $user->isStudent()) {
            return $this->errorResponse('Chỉ học sinh mới có thể xem bài nộp mới nhất', null, 'UNAUTHORIZED', 403);
        }

        $student = $this->getCurrentStudent();
        if (! $student) {
            return $this->errorResponse('Không tìm thấy thông tin học sinh', null, 'NOT_FOUND', 404);
        }

        // Assignment already loaded via binding
        $assignment->load('class');

        // Check if student is enrolled in the class
        if (! $assignment->class || ! $student->isEnrolledIn($assignment->class_id)) {
            return $this->errorResponse('Bạn không thuộc lớp học này', null, 'UNAUTHORIZED', 403);
        }

        // Get latest submission
        $submission = Submission::where('assignment_id', $assignment->id)
            ->where('student_id', $student->id)
            ->with(['assignment', 'student', 'grader'])
            ->orderBy('submitted_at', 'desc')
            ->orderBy('id', 'desc')
            ->first();

        if (! $submission) {
            // Return 200 with null data + assignment info
            return response()->json([
                'success' => true,
                'message' => 'Chưa có bài nộp nào',
                'data' => null,
                'assignment' => new AssignmentResource($assignment),
            ], 200);
        }

        return $this->successResponse(new SubmissionResource($submission));
    }

    /**
     * Get submission history for a student's assignment.
     *
     * @param  int  $assignmentId
     */
    public function history(Request $request, Assignment $assignment): JsonResponse
    {
        // Defensive check: ensure assignment was properly resolved
        if (! $assignment || ! $assignment->exists || ! $assignment->id) {
            return $this->errorResponse('Không tìm thấy bài tập', null, 'NOT_FOUND', 404);
        }
        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Decode student_id if provided
        if ($request->has('student_id')) {
            $this->decodeHashId($request, 'student_id', Student::class);
        }

        // Students can see their own history, tutors can see student's history
        $studentId = null;

        if ($user->isStudent()) {
            $student = $this->getCurrentStudent();
            if (! $student) {
                return $this->errorResponse('Không tìm thấy thông tin học sinh', null, 'NOT_FOUND', 404);
            }
            $studentId = $student->id;
        } else {
            // Tutor must own the assignment's class before reading any student's history.
            // 404 (not 403) so a cross-tenant probe cannot confirm the assignment exists.
            $assignment->loadMissing('class');
            if (! $this->canManageResource($assignment->class)) {
                return $this->errorResponse('Không tìm thấy bài tập', null, 'NOT_FOUND', 404);
            }

            // Tutors need to specify student_id
            if (! $request->has('student_id')) {
                return $this->errorResponse('Vui lòng cung cấp student_id', null, 'VALIDATION_ERROR', 422);
            }
            $studentId = $request->student_id;
        }

        // Get all submissions for this assignment-student pair
        $submissions = Submission::where('assignment_id', $assignment->id)
            ->where('student_id', $studentId)
            ->with(['assignment', 'student', 'grader'])
            ->orderBy('attempt_number', 'asc')
            ->orderBy('submitted_at', 'asc')
            ->get();

        return $this->successResponse(SubmissionResource::collection($submissions));
    }
}
