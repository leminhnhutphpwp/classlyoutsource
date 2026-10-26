<?php

namespace App\Services\AI;

use App\Exceptions\AiException;
use App\Models\Assignment;
use App\Models\User;
use Illuminate\Support\Facades\Config;

/**
 * AI question generation. Produces quiz questions in the exact shape of assignment_questions +
 * assignment_question_options so the tutor can review then feed them into the existing quiz-save flow.
 * Nothing is persisted here — the tutor stays in control.
 *
 * Covers every registered question type (config/assignments.php → question_types), including the
 * exam shapes: TFNG (statement, choices auto-seeded server-side), matching (item → correct match
 * pairs + distractors), ordering (steps in the correct sequence) and gap_fill (text with {{n}}
 * placeholders + the accepted answer per gap).
 */
class AiQuestionService
{
    /** TFNG choices are constants; the model only picks which one is correct. */
    public const TFNG_CHOICES = ['TRUE', 'FALSE', 'NOT GIVEN'];

    public function __construct(private AiClient $client) {}

    /**
     * Question types we support generating — mirrored from the backend question-type registry so
     * a newly registered type is instantly AI-generatable once its prompt + normalizer exist.
     */
    public static function types(): array
    {
        $configured = array_keys((array) Config::get('assignments.question_types', []));

        return $configured ?: ['single_choice', 'multiple_choice', 'short_answer'];
    }

    /**
     * Structured-output schema: a root object with a `questions` array. All object properties are
     * `required` (structured outputs disallow optional keys); the model returns empty strings /
     * empty arrays where a value doesn't apply (e.g. `items` is empty for plain choices). No
     * min/max/length constraints anywhere.
     */
    public static function schema(): array
    {
        return [
            'type' => 'object',
            'additionalProperties' => false,
            'required' => ['questions'],
            'properties' => [
                'questions' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'additionalProperties' => false,
                        'required' => [
                            'question_type', 'title', 'points', 'explanation',
                            'options', 'items', 'distractors', 'text_with_gaps',
                        ],
                        'properties' => [
                            'question_type' => [
                                'type' => 'string',
                                'enum' => self::types(),
                            ],
                            'title' => [
                                'type' => 'string',
                                'description' => 'Nội dung câu hỏi. Với gap_fill: ĐOẠN VĂN có chỗ trống {{1}}, {{2}}.',
                            ],
                            'points' => ['type' => 'integer'],
                            'explanation' => [
                                'type' => 'string',
                                'description' => 'Giải thích đáp án đúng bằng tiếng Việt (có thể để rỗng).',
                            ],
                            'options' => [
                                'type' => 'array',
                                'description' => 'Lựa chọn cho single/multiple/short_answer. Rỗng với các dạng khác.',
                                'items' => [
                                    'type' => 'object',
                                    'additionalProperties' => false,
                                    'required' => ['content', 'is_correct', 'feedback'],
                                    'properties' => [
                                        'content' => ['type' => 'string'],
                                        'is_correct' => ['type' => 'boolean'],
                                        'feedback' => [
                                            'type' => 'string',
                                            'description' => 'Phản hồi cho lựa chọn này (có thể để rỗng).',
                                        ],
                                    ],
                                ],
                            ],
                            'items' => [
                                'type' => 'array',
                                'description' => 'matching: cặp nối. ordering: các bước ĐÚNG THỨ TỰ. gap_fill: đáp án từng chỗ trống.',
                                'items' => [
                                    'type' => 'object',
                                    'additionalProperties' => false,
                                    'required' => ['label', 'content'],
                                    'properties' => [
                                        'label' => [
                                            'type' => 'string',
                                            'description' => 'matching/gap_fill: mục hoặc số chỗ trống. ordering: bỏ trống.',
                                        ],
                                        'content' => ['type' => 'string'],
                                    ],
                                ],
                            ],
                            'distractors' => [
                                'type' => 'array',
                                'description' => 'matching: các lựa chọn gây nhiễu (chuỗi). Dạng khác: rỗng.',
                                'items' => ['type' => 'string'],
                            ],
                            'text_with_gaps' => [
                                'type' => 'string',
                                'description' => 'gap_fill: đoạn văn có chỗ trống {{1}}, {{2}}. Dạng khác: rỗng.',
                            ],
                        ],
                    ],
                ],
            ],
        ];
    }

    /**
     * Generate $count questions of $questionType about $topic. Returns an array of normalized
     * question arrays ready for the quiz-save flow. NOT persisted.
     *
     * @param  array  $opts  { user?, assignment?: Assignment, source?: string (seed content) }
     * @return array<int, array>
     *
     * @throws AiException
     */
    public function generate(string $topic, int $count, string $questionType, array $opts = []): array
    {
        $count = max(1, min(10, $count));
        $types = self::types();
        if (! in_array($questionType, $types, true)) {
            $questionType = 'single_choice';
        }

        $system = 'Bạn là một chuyên gia soạn đề kiểm tra cho gia sư người Việt. '
            .'Hãy tạo các câu hỏi chất lượng, rõ ràng, phù hợp trình độ, kèm đáp án chính xác. '
            .'Toàn bộ nội dung bằng tiếng Việt trừ khi chủ đề yêu cầu ngôn ngữ khác (đề tiếng Anh dùng tiếng Anh).';

        $prompt = $this->buildPrompt($topic, $count, $questionType, $opts['source'] ?? null);

        $result = $this->client->generate(
            system: $system,
            userPrompt: $prompt,
            jsonSchema: self::schema(),
            opts: [
                // Provider (endpoint/type/model/key) is resolved by AiClient from the
                // `generate` feature config — a mid-tier model by default.
                'feature' => 'generate',
                'user' => $opts['user'] ?? null,
                // Org pool metering (Ops-fix B): the org that owns this call, if the tutor is in one.
                'organization' => $opts['user'] instanceof User ? $opts['user']->currentOrganization() : null,
                'subject' => $opts['assignment'] instanceof Assignment ? $opts['assignment'] : null,
                // Exam shapes (matching/gap_fill) carry more text per question than plain choices.
                'max_tokens' => 10000,
                'effort' => 'medium',
                // NOTE: adaptive `thinking` removed — it inflated output tokens (the priciest part)
                // for little quality gain on structured quiz generation.
            ],
        );

        $questions = $result['questions'] ?? [];

        return collect($questions)
            ->take($count)
            ->map(fn ($q) => $this->normalizeQuestion($q, $questionType))
            ->filter(fn ($q) => $q !== null)
            ->values()
            ->all();
    }

    /**
     * Coerce a model-produced question into the assignment_questions shape (defensive normalization),
     * per question type. Returns null when the question is unusable for its type.
     */
    private function normalizeQuestion(array $q, string $requestedType): ?array
    {
        $types = self::types();
        $type = in_array($q['question_type'] ?? null, $types, true) ? $q['question_type'] : $requestedType;
        $points = (int) ($q['points'] ?? 1);
        $points = max(1, $points);

        $title = trim((string) ($q['title'] ?? ''));
        $explanation = trim((string) ($q['explanation'] ?? ''));

        $normalized = [
            'question_type' => $type,
            'title' => $title,
            'points' => $points,
            'options' => [],
        ];

        switch ($type) {
            case 'true_false_not_given':
                // Statement question — options are auto-seeded server-side; nothing to keep.
                if ($title === '') {
                    return null;
                }
                break;

            case 'matching':
                $pairs = collect($q['items'] ?? [])
                    ->map(fn ($item) => [
                        'label' => trim((string) ($item['label'] ?? '')),
                        'content' => trim((string) ($item['content'] ?? '')),
                        'is_correct' => true,
                    ])
                    ->filter(fn ($item) => $item['label'] !== '' && $item['content'] !== '')
                    ->values()
                    ->all();
                if (count($pairs) < 2) {
                    return null; // a matching question with fewer than 2 pairs is ungradable
                }
                $distractors = collect($q['distractors'] ?? [])
                    ->map(fn ($d) => trim((string) $d))
                    ->filter(fn ($d) => $d !== '')
                    ->values()
                    ->all();
                $normalized['options'] = $pairs;
                if ($distractors !== []) {
                    $normalized['settings'] = ['distractors' => $distractors];
                }
                break;

            case 'ordering':
                $steps = collect($q['items'] ?? [])
                    ->map(fn ($item) => trim((string) ($item['content'] ?? '')))
                    ->filter(fn ($step) => $step !== '')
                    ->values();
                if ($steps->count() < 2) {
                    return null; // ordering with fewer than 2 steps is ungradable
                }
                // Options arrive in the CORRECT sequence; the take view scrambles deterministically.
                $normalized['options'] = $steps->map(fn ($step, $i) => [
                    'label' => chr(65 + $i),
                    'content' => $step,
                    'is_correct' => true,
                ])->values()->all();
                $normalized['settings'] = ['partial_ordering' => true];
                break;

            case 'gap_fill':
                // The exercise text (with {{n}} placeholders) lives in the title.
                $gapText = trim((string) ($q['text_with_gaps'] ?? '')) ?: $title;
                if ($gapText === '') {
                    return null;
                }
                preg_match_all('/\{\{(\d+)\}\}/', $gapText, $matches);
                $gapNumbers = array_values(array_unique($matches[1] ?? []));
                if ($gapNumbers === []) {
                    return null; // no placeholders — nothing to fill
                }
                // Items: label = gap number, content = the accepted answer for that gap.
                $answersByGap = [];
                foreach ((array) ($q['items'] ?? []) as $item) {
                    $gap = (string) preg_replace('/\D/', '', (string) ($item['label'] ?? ''));
                    $answer = trim((string) ($item['content'] ?? ''));
                    if ($gap !== '' && $answer !== '') {
                        $answersByGap[$gap][] = $answer;
                    }
                }
                $options = [];
                foreach ($gapNumbers as $gap) {
                    foreach ($answersByGap[$gap] ?? [] as $answer) {
                        $options[] = [
                            'label' => (string) (int) $gap,
                            'content' => $answer,
                            'is_correct' => true,
                        ];
                    }
                }
                if ($options === []) {
                    return null; // placeholders without answers cannot be graded
                }
                $normalized['title'] = $gapText;
                $normalized['options'] = $options;
                break;

            default: // single_choice / multiple_choice / short_answer
                $options = collect($q['options'] ?? [])
                    ->map(function ($o) {
                        $option = [
                            'content' => trim((string) ($o['content'] ?? '')),
                            'is_correct' => (bool) ($o['is_correct'] ?? false),
                        ];
                        $feedback = trim((string) ($o['feedback'] ?? ''));
                        if ($feedback !== '') {
                            $option['feedback'] = $feedback;
                        }

                        return $option;
                    })
                    ->filter(fn ($o) => $o['content'] !== '')
                    ->values()
                    ->all();

                if ($type === 'short_answer') {
                    $options = collect($options)->map(fn ($o) => ['content' => $o['content'], 'is_correct' => true])->all();
                }
                if ($options === []) {
                    return null;
                }
                $normalized['options'] = $options;
                break;
        }

        if ($explanation !== '') {
            $normalized['explanation'] = $explanation;
        }

        return $normalized;
    }

    private function buildPrompt(string $topic, int $count, string $questionType, ?string $source): string
    {
        $lines = [];
        $lines[] = "Hãy tạo $count câu hỏi thuộc loại \"$questionType\" về chủ đề sau:";
        $lines[] = $topic;

        if (filled($source)) {
            $lines[] = '';
            $lines[] = 'Dựa trên tài liệu tham khảo sau (dùng làm nguồn kiến thức):';
            $lines[] = strip_tags($source);
        }

        $lines[] = '';
        $lines[] = match ($questionType) {
            'single_choice' => 'Mỗi câu có 4 lựa chọn trong mảng options, CHỈ một lựa chọn đúng (is_correct=true), ba lựa chọn còn lại sai.',
            'multiple_choice' => 'Mỗi câu có 4-5 lựa chọn trong mảng options, có từ hai lựa chọn đúng trở lên (is_correct=true).',
            'short_answer' => 'Mỗi câu là câu trả lời ngắn: đưa các đáp án được chấp nhận vào mảng options với is_correct=true (không cần đáp án sai).',
            'true_false_not_given' => 'Mỗi câu là MỘT KHẲNG ĐỊNH (statement) trong trường title. Mảng options để RỖNG — hệ thống tự sinh 3 lựa chọn TRUE/FALSE/NOT GIVEN. Đừng nhắc đáp án trong title.',
            'matching' => 'Mỗi câu là bài NỐI THÔNG TIN: mảng items chứa 3-5 cặp — label = mục ở cột trái, content = thông tin ĐÚNG nối với mục đó (cột phải). Thêm 2-3 lựa chọn gây nhiễu vào mảng distractors. Trường title mô tả yêu cầu nối (vd "Nối mỗi địa danh với quốc gia").',
            'ordering' => 'Mỗi câu là bài SẮP XẾP THỨ TỰ: mảng items chứa 3-6 bước theo ĐÚNG THỨ TỰ ĐÚNG (content = nội dung bước, label bỏ trống). Trường title yêu cầu sắp xếp (vd "Sắp xếp các bước pha cà phê theo đúng thứ tự").',
            'gap_fill' => 'Mỗi câu là bài ĐIỀN TỪ: trường title chứa đoạn văn có chỗ trống đánh số {{1}}, {{2}}... (2-5 chỗ trống). Mảng items chứa đáp án đúng cho từng chỗ trống — label = số chỗ trống (vd "1"), content = từ/cụm từ đúng. Chỉ dùng từ đơn giản, dễ điền.',
            default => 'Mỗi câu có các lựa chọn phù hợp.',
        };
        $lines[] = 'Với mỗi câu, đặt "points" là số điểm hợp lý (mặc định 1), và "explanation" giải thích đáp án đúng. Các trường không áp dụng cho dạng câu hỏi thì để mảng rỗng hoặc chuỗi rỗng.';

        return implode("\n", $lines);
    }
}
