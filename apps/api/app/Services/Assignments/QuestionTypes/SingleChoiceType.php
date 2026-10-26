<?php

namespace App\Services\Assignments\QuestionTypes;

use App\Models\AssignmentQuestion;
use App\Services\Assignments\QuestionTypes\Concerns\GradesAnswers;

/**
 * Single-choice: exactly one option; correct iff that option is flagged correct.
 * (Legacy default — same behavior the original QuizAssignmentService::gradeSingleChoice had.)
 */
class SingleChoiceType implements QuestionType
{
    use GradesAnswers;

    public function type(): string
    {
        return 'single_choice';
    }

    public function answerRules(string $prefix): array
    {
        return [
            $prefix.'selected_option_id' => ['nullable', 'string', 'max:64'],
        ];
    }

    public function grade(AssignmentQuestion $question, array $answer): array
    {
        $identifier = $answer['selected_option_id'] ?? $answer['option_id'] ?? null;

        $option = null;
        if ($identifier !== null && $identifier !== '') {
            $option = $this->resolveOption($question, $identifier);
        }

        $isCorrect = $option !== null && (bool) $option->is_correct;

        return [
            'earned_points' => $isCorrect ? $this->roundPoints((float) $question->points) : 0.0,
            'is_correct' => $isCorrect,
            // Top-level keys are the storage contract (AssignmentQuizService::storeResponses);
            // `response` mirrors them for the FE review payload.
            'selected_option_id' => $identifier,
            'response' => ['selected_option_id' => $identifier],
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
        return ['needs_options' => true, 'multiple_correct' => false];
    }
}
