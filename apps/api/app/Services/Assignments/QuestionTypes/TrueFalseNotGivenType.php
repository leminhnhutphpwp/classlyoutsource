<?php

namespace App\Services\Assignments\QuestionTypes;

use App\Models\AssignmentQuestion;
use App\Services\Assignments\QuestionTypes\Concerns\GradesAnswers;

/**
 * TRUE / FALSE / NOT GIVEN — the classic IELTS Reading item. Options are auto-managed: exactly
 * the three fixed choices, and the tutor marks one as correct. Grading reuses single-choice
 * mechanics (one picked option) but additionally accepts a raw `text` of "TRUE"/"FALSE"/"NOT
 * GIVEN" for plain payloads (e.g. AI-generated imports).
 */
class TrueFalseNotGivenType implements QuestionType
{
    use GradesAnswers;

    /** The three fixed choices, keyed by the option label this type seeds on sync. */
    public const CHOICES = ['TRUE', 'FALSE', 'NOT GIVEN'];

    public function type(): string
    {
        return 'true_false_not_given';
    }

    public function answerRules(string $prefix): array
    {
        return [
            $prefix.'selected_option_id' => ['nullable', 'string', 'max:64'],
            $prefix.'text' => ['nullable', 'string', 'max:32'],
        ];
    }

    public function grade(AssignmentQuestion $question, array $answer): array
    {
        $identifier = $answer['selected_option_id'] ?? $answer['option_id'] ?? null;

        $picked = null;
        if ($identifier !== null && $identifier !== '') {
            $picked = $this->resolveOption($question, $identifier);
        }

        // Raw text path: match the fixed choice label case-insensitively.
        if ($picked === null) {
            $text = strtoupper(trim((string) ($answer['text'] ?? '')));
            if ($text !== '') {
                $picked = $question->options->first(fn ($o) => strtoupper((string) $o->content) === $text);
            }
        }

        $isCorrect = $picked !== null && (bool) $picked->is_correct;

        return [
            'earned_points' => $isCorrect ? $this->roundPoints((float) $question->points) : 0.0,
            'is_correct' => $isCorrect,
            'selected_option_id' => $identifier,
            'response' => [
                'selected_option_id' => $identifier,
                'text' => $picked?->content,
            ],
            'meta' => [],
        ];
    }

    public function transform(AssignmentQuestion $question, bool $exposeCorrect): array
    {
        $base = $this->baseTransform($question, $exposeCorrect);
        // The three choices are constants, not answers — students see them all.
        $base['options'] = $question->options->map(
            fn ($option) => $this->transformOption($option, $exposeCorrect)
        )->values()->all();
        $base['choices'] = self::CHOICES;

        return $base;
    }

    public function uiHints(): array
    {
        return ['needs_options' => true, 'multiple_correct' => false, 'fixed_choices' => self::CHOICES];
    }
}
