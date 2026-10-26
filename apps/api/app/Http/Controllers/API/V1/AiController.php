<?php

namespace App\Http\Controllers\API\V1;

use App\Exceptions\AiException;
use App\Http\Resources\SubmissionResource;
use App\Models\Assignment;
use App\Models\Submission;
use App\Services\AI\AiGradingService;
use App\Services\AI\AiQuestionService;
use App\Support\GradebookSync;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * AI features: advisory grading of free-text/short-answer submissions, and quiz question generation.
 * Both fail CLOSED — ownership is checked first (404), then the capability gate (403), then the AI
 * call (which itself fails safe when AI is disabled).
 */
class AiController extends BaseController
{
    /**
     * POST /submissions/{submission}/ai-grade
     * Tutor triggers AI grading. The result is stored as a SUGGESTION (ai_suggested_score /
     * ai_feedback) — it never overwrites the final score, feedback, or graded_by.
     */
    public function gradeSubmission(Request $request, Submission $submission): JsonResponse
    {
        if (! $submission || ! $submission->exists || ! $submission->id) {
            return $this->errorResponse('Không tìm thấy bài nộp', null, 'NOT_FOUND', 404);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Ownership first — fail closed with 404 (never confirm existence to a non-owner).
        $submission->loadMissing('assignment.class');
        if (! $submission->assignment || ! $this->canManageResource($submission->assignment->class)) {
            return $this->errorResponse('Không tìm thấy bài nộp', null, 'NOT_FOUND', 404);
        }

        // Capability gate.
        if ($gate = $this->requirePlanCapability('ai.grade')) {
            return $gate;
        }

        // Monthly AI-call quota. Fails BEFORE any billable AI call.
        if ($quota = $this->requireAiQuota($user, 'grade')) {
            return $quota;
        }

        // Only meaningful for free-text / short-answer content.
        $submission->loadMissing('questionResponses');
        $hasFreeText = filled($submission->content)
            || $submission->questionResponses->contains(fn ($r) => filled($r->text_answer));

        if (! $hasFreeText) {
            return $this->errorResponse(
                'Bài nộp không có nội dung tự luận hoặc câu trả lời ngắn để chấm bằng AI.',
                null,
                'NO_FREE_TEXT',
                422
            );
        }

        try {
            $result = app(AiGradingService::class)->gradeSubmission($submission, $user);
        } catch (AiException $e) {
            return $this->aiError($e);
        }

        $submission->update([
            'ai_suggested_score' => $result['score'],
            'ai_feedback' => $result['feedback'],
            'ai_graded_at' => now(),
            'ai_confidence' => $result['confidence'],
            'ai_criteria' => $result['criteria'],
        ]);

        return $this->successResponse(
            [
                'suggestion' => [
                    'score' => $result['score'],
                    'is_correct' => $result['is_correct'],
                    'feedback' => $result['feedback'],
                    'confidence' => $result['confidence'],
                    'criteria' => $result['criteria'],
                    'max_points' => $result['max_points'],
                ],
                'submission' => new SubmissionResource($submission->fresh(['assignment', 'student', 'grader'])),
            ],
            'AI đã chấm bài. Vui lòng xem lại trước khi lưu điểm chính thức.'
        );
    }

    /**
     * POST /assignments/{assignment}/ai-generate-questions
     * Body: { topic|prompt, count (1..10), question_type }. Returns generated questions (NOT saved).
     */
    public function generateQuestions(Request $request, Assignment $assignment): JsonResponse
    {
        if (! $assignment || ! $assignment->exists || ! $assignment->id) {
            return $this->errorResponse('Không tìm thấy bài tập', null, 'NOT_FOUND', 404);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        $assignment->loadMissing('class');
        if (! $this->canManageResource($assignment->class)) {
            return $this->errorResponse('Không tìm thấy bài tập', null, 'NOT_FOUND', 404);
        }

        if ($gate = $this->requirePlanCapability('ai.generate')) {
            return $gate;
        }

        // Monthly AI-call quota + the tighter generate sub-cap. Fails BEFORE any billable AI call.
        if ($quota = $this->requireAiQuota($user, 'generate')) {
            return $quota;
        }

        $validator = Validator::make($request->all(), [
            'topic' => ['required_without:prompt', 'nullable', 'string', 'max:2000'],
            'prompt' => ['required_without:topic', 'nullable', 'string', 'max:2000'],
            'count' => ['required', 'integer', 'min:1', 'max:10'],
            'question_type' => ['required', 'string', 'in:'.implode(',', AiQuestionService::types())],
            'source' => ['nullable', 'string', 'max:8000'],
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        $topic = (string) ($request->input('topic') ?: $request->input('prompt'));

        try {
            $questions = app(AiQuestionService::class)->generate(
                $topic,
                (int) $request->input('count'),
                (string) $request->input('question_type'),
                [
                    'user' => $user,
                    'assignment' => $assignment,
                    'source' => $request->input('source'),
                ],
            );
        } catch (AiException $e) {
            return $this->aiError($e);
        }

        return $this->successResponse(
            [
                'questions' => $questions,
                'count' => count($questions),
            ],
            'AI đã tạo câu hỏi. Vui lòng xem lại và chỉnh sửa trước khi lưu.'
        );
    }

    /**
     * POST /submissions/{submission}/ai-grade/accept
     * One-tap acceptance: the tutor promotes the stored AI suggestion to the OFFICIAL grade
     * (score / feedback / graded_by / graded_at / status). Optional body overrides let the tutor
     * tweak the score or feedback before saving. Fails CLOSED like gradeSubmission.
     */
    public function acceptGrade(Request $request, Submission $submission): JsonResponse
    {
        if (! $submission || ! $submission->exists || ! $submission->id) {
            return $this->errorResponse('Không tìm thấy bài nộp', null, 'NOT_FOUND', 404);
        }

        [$user, $error] = $this->requireAuth();
        if ($error) {
            return $error;
        }

        // Ownership first — fail closed with 404 (never confirm existence to a non-owner).
        $submission->loadMissing('assignment.class');
        if (! $submission->assignment || ! $this->canManageResource($submission->assignment->class)) {
            return $this->errorResponse('Không tìm thấy bài nộp', null, 'NOT_FOUND', 404);
        }

        // Capability gate.
        if ($gate = $this->requirePlanCapability('ai.grade')) {
            return $gate;
        }

        // Nothing to accept until AI has actually produced a suggestion.
        if (is_null($submission->ai_graded_at)) {
            return $this->errorResponse(
                'Chưa có gợi ý AI để chấp nhận. Hãy chạy AI chấm trước.',
                null,
                'AI_NO_SUGGESTION',
                422
            );
        }

        $validator = Validator::make($request->all(), [
            'score' => ['nullable', 'numeric', 'min:0'],
            'feedback' => ['nullable', 'string'],
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Lỗi xác thực dữ liệu', $validator, 'VALIDATION_ERROR', 422);
        }

        // Optional overrides; otherwise fall back to the stored suggestion.
        $finalScore = $request->filled('score') ? (float) $request->input('score') : $submission->ai_suggested_score;
        $finalFeedback = $request->has('feedback') ? $request->input('feedback') : $submission->ai_feedback;

        $maxScore = $submission->assignment->max_score;
        if ($maxScore && $finalScore > $maxScore) {
            return $this->errorResponse(
                "Điểm không được vượt quá điểm tối đa ({$maxScore})",
                null,
                'VALIDATION_ERROR',
                422
            );
        }

        $submission->update([
            'score' => $finalScore,
            'feedback' => $finalFeedback,
            'graded_by' => $user->id,
            'graded_at' => now(),
            'status' => 'graded',
        ]);

        // Mirror the accepted score into the gradebook (idempotent by submission_id).
        GradebookSync::syncFromSubmission($submission->fresh());

        return $this->successResponse(
            new SubmissionResource($submission->fresh(['assignment', 'student', 'grader'])),
            'Đã lưu điểm chính thức từ gợi ý AI.'
        );
    }

    /**
     * Map an AiException reason to a clean JSON envelope + HTTP status.
     */
    private function aiError(AiException $e): JsonResponse
    {
        $status = match ($e->reason) {
            'disabled' => 503,
            'rate_limited' => 429,
            'refusal' => 422,
            default => 502, // upstream / invalid_response
        };

        return $this->errorResponse($e->getMessage(), null, 'AI_'.strtoupper($e->reason), $status);
    }
}
