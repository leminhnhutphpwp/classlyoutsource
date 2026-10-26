<?php

namespace App\Services\Assignments\QuestionTypes;

use App\Models\AssignmentQuestion;
use App\Services\Assignments\QuestionTypes\Concerns\GradesAnswers;

/**
 * Gap fill / sentence-note-table completion. The question `title` (or `description`) carries the
 * text with numbered placeholders `{{1}}`, `{{2}}`, ... ; each gap's accepted answers are options
 * whose `label` is the gap number ("1", "2", ...) with `is_correct` = true (multiple variants
 * allowed per gap). Each correctly filled gap earns an equal share of the points → partial credit.
 *
 * Student answer: `response` = map of gap number → typed text.
 */
class GapFillType implements QuestionType
{
    use GradesAnswers;

    public function type(): string
    {
        return 'gap_fill';
    }

    public function answerRules(string $prefix): array
    {
        return [
            $prefix.'response' => ['nullable', 'array', 'max:60'],
        ];
    }

    public function grade(AssignmentQuestion $question, array $answer): array
    {
        $fills = $answer['response'] ?? [];
        if (! is_array($fills)) {
            $fills = [];
        }

        $gapNumbers = $this->gapNumbers($question);
        $total = max(1, $gapNumbers->count());

        $override = $question->settings['short_answer_tolerance'] ?? null;
        $tolerance = is_numeric($override) ? (int) $override : null;

        $gapResults = [];
        $correctGaps = 0;

        foreach ($gapNumbers as $gap) {
            $typed = trim((string) ($fills[$gap] ?? $fills[(string) $gap] ?? ''));
            $normalized = self::normalizeText($typed);

            $accepted = $question->options
                ->where('label', (string) $gap)
                ->where('is_correct', true)
                ->map(fn ($o) => self::normalizeText((string) $o->content))
                ->filter()
                ->values();

            $isGapCorrect = $normalized !== '' && $accepted->contains(
                fn (string $expected) => $this->shortAnswerMatches($normalized, $expected, $tolerance)
            );

            $gapResults[$gap] = $isGapCorrect;
            if ($isGapCorrect) {
                $correctGaps++;
            }
        }

        $points = (float) $question->points;
        $earned = $points * $correctGaps / $total;

        return [
            'earned_points' => $this->roundPoints($earned),
            'is_correct' => $correctGaps === $gapNumbers->count() && $gapNumbers->isNotEmpty(),
            'response' => ['fills' => $fills],
            'meta' => ['gap_results' => $gapResults, 'correct_gaps' => $correctGaps, 'total_gaps' => $total],
        ];
    }

    public function transform(AssignmentQuestion $question, bool $exposeCorrect): array
    {
        $base = $this->baseTransform($question, $exposeCorrect);
        $base['gap_numbers'] = $this->gapNumbers($question)->values()->all();
        $base['text_with_gaps'] = $question->title;
        // Title IS the exercise text; render it as-is without the "title" semantics.
        $base['title'] = null;
        $base['options'] = [];
        $base['settings'] = $question->settings;

        return $base;
    }

    /** Gap numbers found in the exercise text (`{{1}}` ... `{{9}}`), in order of appearance. */
    public static function gapNumbers(AssignmentQuestion $question): \Illuminate\Support\Collection
    {
        $text = (string) $question->title;

        preg_match_all('/\{\{(\d+)\}\}/', $text, $matches);

        return collect($matches[1] ?? [])->unique()->values();
    }

    public function uiHints(): array
    {
        return ['needs_options' => true, 'label_is_gap_number' => true, 'title_is_text' => true];
    }
}
