<?php

namespace App\Services\Assignments\QuestionTypes;

use App\Models\AssignmentQuestion;
use App\Services\Assignments\QuestionTypes\Concerns\GradesAnswers;
use Illuminate\Validation\ValidationException;

/**
 * Ordering / sequencing ("Put the events in chronological order"). Options are the items in
 * CORRECT order (option.order = the right position). The student answers with
 * `response` = the option ids (or item indexes) in THEIR order.
 *
 * Default is all-or-nothing; `settings.partial_ordering` grants a share per position kept
 * in the right slot.
 */
class OrderingType implements QuestionType
{
    use GradesAnswers;

    public function type(): string
    {
        return 'ordering';
    }

    public function answerRules(string $prefix): array
    {
        return [
            $prefix.'response' => ['nullable', 'array', 'max:30'],
        ];
    }

    public function grade(AssignmentQuestion $question, array $answer): array
    {
        $sequence = $answer['response'] ?? [];
        if (! is_array($sequence)) {
            $sequence = [];
        }

        $correct = $question->options->sortBy('order')->values();
        $total = max(1, $correct->count());

        // Resolve every picked id; an unknown id is a hard validation error (fail closed).
        $pickedIds = collect($sequence)
            ->map(function ($identifier) use ($question) {
                $option = $question->options->first(
                    fn ($opt) => $opt->hash_id === $identifier || $opt->id == $identifier
                );

                if (! $option) {
                    throw ValidationException::withMessages([
                        'answers' => ["Đáp án không hợp lệ cho câu hỏi #{$question->hash_id}."],
                    ]);
                }

                return $option->id;
            })
            ->values();

        $positionResults = [];
        $matched = 0;
        foreach ($correct as $index => $option) {
            $atPosition = $pickedIds->get($index);
            $isRight = $atPosition === $option->id;
            $positionResults[] = $isRight;
            if ($isRight) {
                $matched++;
            }
        }

        $points = (float) $question->points;
        $partial = (bool) ($question->settings['partial_ordering'] ?? true);
        $earned = ($partial ? $points * $matched / $total : ($matched === $correct->count() ? $points : 0.0));

        return [
            'earned_points' => $this->roundPoints($earned),
            'is_correct' => $matched === $correct->count() && $correct->isNotEmpty(),
            'response' => ['sequence' => array_values($sequence)],
            'meta' => ['position_results' => $positionResults, 'matched' => $matched, 'total_items' => $total],
        ];
    }

    public function transform(AssignmentQuestion $question, bool $exposeCorrect): array
    {
        $base = $this->baseTransform($question, $exposeCorrect);

        $correct = $question->options->sortBy('order')->values();

        // Items in a STABLE scrambled order for students (deterministic per option id so a
        // page reload doesn't reshuffle under the learner's hands).
        $items = $correct->map(fn ($option) => [
            '_id' => $option->hash_id,
            'content' => $option->content,
            'media' => $option->relationLoaded('media') && $option->media
                ? \App\Support\MediaShape::shape($option->media)
                : null,
        ])->values();

        $base['items'] = $exposeCorrect
            ? $items->all()
            : $items->sortBy(fn ($item, $key) => crc32((string) $item['_id']))->values()->all();

        $base['options'] = [];

        return $base;
    }

    public function uiHints(): array
    {
        return ['needs_options' => true, 'order_is_answer' => true];
    }
}
