<?php

namespace App\Services\Assignments\QuestionTypes;

use App\Models\AssignmentQuestion;
use App\Services\Assignments\QuestionTypes\Concerns\GradesAnswers;

/**
 * Multiple-choice. Default grading is all-or-nothing (the set of picks must equal the set of
 * correct options). When the question sets `settings.allow_partial`, a picked correct option
 * earns +1 unit and a picked wrong option costs 1 unit (floored at 0), scaled by
 * correctCount → useful for "select TWO answers" exam items where 1/2 right still counts.
 */
class MultipleChoiceType implements QuestionType
{
    use GradesAnswers;

    public function type(): string
    {
        return 'multiple_choice';
    }

    public function answerRules(string $prefix): array
    {
        return [
            $prefix.'selected_option_ids' => ['nullable', 'array', 'max:20'],
        ];
    }

    public function grade(AssignmentQuestion $question, array $answer): array
    {
        $identifiers = $answer['selected_option_ids'] ?? $answer['option_ids'] ?? [];
        if (! is_array($identifiers)) {
            $identifiers = array_filter([$identifiers]);
        }

        $selectedIds = collect($identifiers)
            ->map(fn ($id) => $this->resolveOption($question, $id)?->id)
            ->filter()
            ->unique()
            ->sort()
            ->values();

        $correctIds = $question->options->where('is_correct', true)->pluck('id')->unique()->sort()->values();

        $isCorrect = $selectedIds->isNotEmpty() && $selectedIds->all() === $correctIds->all();

        $points = (float) $question->points;
        $earned = 0.0;

        if ($isCorrect) {
            $earned = $points;
        } elseif (($question->settings['allow_partial'] ?? false) && $correctIds->isNotEmpty()) {
            $hits = $selectedIds->intersect($correctIds)->count();
            $misses = $selectedIds->diff($correctIds)->count();

            $earned = $points * max(0, $hits - $misses) / $correctIds->count();
        }

        return [
            'earned_points' => $this->roundPoints($earned),
            'is_correct' => $isCorrect,
            'selected_option_ids' => array_values($identifiers),
            'response' => ['selected_option_ids' => array_values($identifiers)],
            'meta' => [],
        ];
    }

    public function transform(AssignmentQuestion $question, bool $exposeCorrect): array
    {
        $base = $this->baseTransform($question, $exposeCorrect);
        $base['options'] = $question->options->map(
            fn ($option) => $this->transformOption($option, $exposeCorrect)
        )->values()->all();

        return $base;
    }

    public function uiHints(): array
    {
        return ['needs_options' => true, 'multiple_correct' => true];
    }
}
