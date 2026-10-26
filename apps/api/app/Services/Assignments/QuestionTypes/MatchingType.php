<?php

namespace App\Services\Assignments\QuestionTypes;

use App\Models\AssignmentQuestion;
use App\Services\Assignments\QuestionTypes\Concerns\GradesAnswers;
use Illuminate\Support\Collection;

/**
 * Matching ("Match each statement with the correct person A–E"). Data lives in the options
 * table: each option = one item, `label` = the item text (left column), `content` = that item's
 * CORRECT match (right column). The choice pool the student picks from is the unique set of
 * contents, optionally extended with distractors in `settings.distractors`.
 *
 * Student answer: `response` = map of item identifier → pick (option id or pool text/index).
 * Each correctly matched item earns an equal share of the question's points → partial credit
 * falls out naturally.
 */
class MatchingType implements QuestionType
{
    use GradesAnswers;

    public function type(): string
    {
        return 'matching';
    }

    public function answerRules(string $prefix): array
    {
        return [
            $prefix.'response' => ['nullable', 'array', 'max:30'],
        ];
    }

    public function grade(AssignmentQuestion $question, array $answer): array
    {
        $picks = $answer['response'] ?? [];
        if (! is_array($picks)) {
            $picks = [];
        }

        $items = $question->options;
        $total = max(1, $items->count());

        $itemResults = [];
        $correctCount = 0;

        foreach ($items as $item) {
            $pick = $picks[$item->hash_id]
                ?? $picks[$item->label ?? '']
                ?? $picks[(string) ($item->order - 1)]
                ?? null;

            $pickContent = $pick !== null && $pick !== '' ? $this->resolvePickToContent($question, $pick) : null;
            $isItemCorrect = $pickContent !== null
                && self::normalizeText($pickContent) === self::normalizeText((string) $item->content);

            $itemResults[$item->hash_id] = $isItemCorrect;
            if ($isItemCorrect) {
                $correctCount++;
            }
        }

        $points = (float) $question->points;
        $earned = $points * $correctCount / $total;

        return [
            'earned_points' => $this->roundPoints($earned),
            'is_correct' => $correctCount === $items->count() && $items->isNotEmpty(),
            'response' => ['pairs' => $picks],
            'meta' => ['item_results' => $itemResults, 'correct_count' => $correctCount, 'total_items' => $total],
        ];
    }

    public function transform(AssignmentQuestion $question, bool $exposeCorrect): array
    {
        $base = $this->baseTransform($question, $exposeCorrect);

        // Items (left column): label + the option id used as the answer key. The correct match
        // (content) is the answer itself → hidden from students.
        $base['items'] = $question->options->map(fn ($option) => [
            '_id' => $option->hash_id,
            'label' => $option->label,
            'content' => $exposeCorrect ? $option->content : null,
            'media' => $option->relationLoaded('media') && $option->media
                ? \App\Support\MediaShape::shape($option->media)
                : null,
        ])->values()->all();

        // Choice pool (right column): unique contents + distractors. Never hidden — it IS the
        // choice list every matching item shows.
        $base['pool'] = $question->options
            ->map(fn ($option) => (string) $option->content)
            ->filter()
            ->unique()
            ->values()
            ->merge(collect((array) ($question->settings['distractors'] ?? [])))
            ->unique()
            ->values()
            ->all();

        $base['options'] = [];
        $base['settings'] = $this->publicSettings($question->settings ?? []);

        return $base;
    }

    /** Strip authoring-only keys from settings before exposing to any client. */
    private function publicSettings(array $settings): array
    {
        unset($settings['distractors']);

        return $settings;
    }

    public function uiHints(): array
    {
        return ['needs_options' => true, 'label_is_item' => true, 'content_is_correct_match' => true];
    }
}
