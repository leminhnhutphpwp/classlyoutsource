<?php

namespace App\Services\AI;

use App\Exceptions\AiException;
use App\Models\Submission;
use App\Models\User;

/**
 * AI grading of free-text / short-answer submissions. This SUPPLEMENTS the deterministic
 * AssignmentQuizService::gradeShortAnswer (exact-match) — it does not replace it. The result is a
 * SUGGESTION for the tutor to review; the controller stores it on ai_suggested_score / ai_feedback,
 * never on the final score.
 */
class AiGradingService
{
    public function __construct(private AiClient $client) {}

    /**
     * The JSON schema the model must satisfy. No min/max/length constraints allowed; the numeric
     * range is described in prose and clamped in PHP afterwards.
     */
    public static function schema(): array
    {
        return [
            'type' => 'object',
            'additionalProperties' => false,
            'required' => ['score', 'is_correct', 'feedback', 'confidence', 'criteria'],
            'properties' => [
                'score' => [
                    'type' => 'integer',
                    'description' => 'Điểm số nguyên chấm cho bài làm, trong khoảng từ 0 đến điểm tối đa được nêu.',
                ],
                'is_correct' => [
                    'type' => 'boolean',
                    'description' => 'true nếu bài làm về cơ bản là đúng/đạt yêu cầu.',
                ],
                'feedback' => [
                    'type' => 'string',
                    'description' => 'Nhận xét ngắn gọn bằng tiếng Việt, mang tính xây dựng, nêu điểm đúng và điểm cần cải thiện.',
                ],
                'confidence' => [
                    'type' => 'number',
                    'description' => 'Độ tự tin về điểm bạn chấm, từ 0 (rất không chắc, gia sư nên xem kỹ) đến 1 (rất chắc).',
                ],
                'criteria' => [
                    'type' => 'array',
                    'description' => 'Chấm tách theo từng tiêu chí (rubric). Nếu bài không tách được tiêu chí thì trả mảng rỗng [].',
                    'items' => [
                        'type' => 'object',
                        'additionalProperties' => false,
                        'required' => ['name', 'score', 'comment'],
                        'properties' => [
                            'name' => ['type' => 'string', 'description' => 'Tên tiêu chí, ví dụ: Nội dung, Lập luận, Ngữ pháp, Trình bày.'],
                            'score' => ['type' => 'number', 'description' => 'Điểm cho riêng tiêu chí này.'],
                            'comment' => ['type' => 'string', 'description' => 'Nhận xét ngắn cho tiêu chí này bằng tiếng Việt.'],
                        ],
                    ],
                ],
            ],
        ];
    }

    /**
     * Grade a submission's free-text / short-answer content and return a normalized suggestion:
     * { score:int (0..maxPoints), is_correct:bool, feedback:string }.
     *
     * @throws AiException
     */
    public function gradeSubmission(Submission $submission, ?User $user = null): array
    {
        $submission->loadMissing(['assignment', 'questionResponses.question.options']);
        $assignment = $submission->assignment;

        $maxPoints = (int) ($assignment->max_score ?? 100);
        if ($maxPoints <= 0) {
            $maxPoints = 100;
        }

        $context = $this->buildContext($submission, $maxPoints);

        $system = 'Bạn là một trợ giảng AI công tâm, chấm bài tự luận và câu trả lời ngắn cho gia sư người Việt. '
            .'Hãy chấm điểm dựa trên đáp án tham chiếu (nếu có) và mức độ đúng đắn, đầy đủ của bài làm. '
            .'Luôn trả về điểm là số nguyên trong khoảng cho phép và nhận xét ngắn gọn, mang tính xây dựng bằng tiếng Việt.';

        $result = $this->client->generate(
            system: $system,
            userPrompt: $context,
            jsonSchema: self::schema(),
            opts: [
                // Provider (endpoint/type/model/key) is resolved by AiClient from the
                // `grade` feature config — cheap high-volume model by default.
                'feature' => 'grade',
                'user' => $user,
                // Org pool metering (Ops-fix B): the org that owns this call, if the tutor is in one.
                'organization' => $user?->currentOrganization(),
                'subject' => $submission,
                'max_tokens' => 2048,
                // Medium effort: a rubric breakdown + calibrated confidence needs more reasoning
                // than a single number.
                'effort' => 'medium',
            ],
        );

        $score = (int) round((float) ($result['score'] ?? 0));
        $score = max(0, min($maxPoints, $score));

        // Normalize the rubric: keep only well-formed criteria rows, clamp each score to 0..maxPoints.
        $criteria = [];
        foreach ((array) ($result['criteria'] ?? []) as $row) {
            if (! is_array($row) || ! filled($row['name'] ?? null)) {
                continue;
            }
            $criteria[] = [
                'name' => trim((string) $row['name']),
                'score' => max(0, min($maxPoints, (int) round((float) ($row['score'] ?? 0)))),
                'comment' => trim((string) ($row['comment'] ?? '')),
            ];
        }

        return [
            'score' => $score,
            'is_correct' => (bool) ($result['is_correct'] ?? false),
            'feedback' => trim((string) ($result['feedback'] ?? '')),
            'confidence' => max(0.0, min(1.0, (float) ($result['confidence'] ?? 0))),
            'criteria' => $criteria,
            'max_points' => $maxPoints,
        ];
    }

    /**
     * Assemble the grading prompt from the assignment + any short-answer questions + the student's answers.
     */
    private function buildContext(Submission $submission, int $maxPoints): string
    {
        $assignment = $submission->assignment;
        $lines = [];

        $lines[] = 'BÀI TẬP: '.($assignment->title ?? '(không có tiêu đề)');
        if (! empty($assignment->description)) {
            $lines[] = 'Mô tả: '.strip_tags((string) $assignment->description);
        }
        if (! empty($assignment->instructions)) {
            $lines[] = 'Hướng dẫn: '.strip_tags((string) $assignment->instructions);
        }
        $lines[] = 'ĐIỂM TỐI ĐA: '.$maxPoints.' (điểm bạn chấm phải là số nguyên từ 0 đến '.$maxPoints.').';
        $lines[] = '';

        // Per-question short-answer material (accepted answers = is_correct option contents).
        $responses = $submission->relationLoaded('questionResponses') ? $submission->questionResponses : collect();
        $freeTextResponses = $responses->filter(fn ($r) => filled($r->text_answer));

        if ($freeTextResponses->isNotEmpty()) {
            $i = 1;
            foreach ($freeTextResponses as $r) {
                $q = $r->question;
                $lines[] = 'CÂU HỎI '.$i.': '.($q->title ?? '');
                if ($q && filled($q->description)) {
                    $lines[] = '  Nội dung: '.strip_tags((string) $q->description);
                }
                if ($q) {
                    $accepted = $q->options->where('is_correct', true)->pluck('content')->filter()->values();
                    if ($accepted->isNotEmpty()) {
                        $lines[] = '  Đáp án tham chiếu: '.$accepted->implode(' | ');
                    }
                    if (filled($q->explanation)) {
                        $lines[] = '  Giải thích: '.strip_tags((string) $q->explanation);
                    }
                    $lines[] = '  (Câu này tối đa '.((int) $q->points).' điểm)';
                }
                $lines[] = '  BÀI LÀM CỦA HỌC SINH: '.$r->text_answer;
                $lines[] = '';
                $i++;
            }
        }

        // Essay / plain free-text submission content.
        if (filled($submission->content)) {
            $lines[] = 'BÀI LÀM TỰ LUẬN CỦA HỌC SINH:';
            $lines[] = strip_tags((string) $submission->content);
            $lines[] = '';
        }

        $lines[] = 'Hãy chấm điểm tổng thể cho bài nộp này (0..'.$maxPoints.'), '
            .'xác định bài làm có đạt yêu cầu hay không, và viết nhận xét ngắn gọn bằng tiếng Việt. '
            .'Ngoài ra, hãy chấm tách theo từng tiêu chí (rubric) nếu có thể (mỗi tiêu chí gồm tên, điểm, nhận xét), '
            .'và cho biết độ tự tin của bạn về điểm đã chấm (confidence 0..1) để gia sư biết chỗ nào cần xem lại kỹ.';

        return implode("\n", $lines);
    }
}
