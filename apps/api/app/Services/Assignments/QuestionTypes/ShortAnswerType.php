<?php

namespace App\Services\Assignments\QuestionTypes;

use App\Models\AssignmentQuestion;
use App\Services\Assignments\QuestionTypes\Concerns\GradesAnswers;

/**
 * Short answer: correct iff the normalized text matches any accepted answer. Accepted answers are
 * the question's `is_correct` option contents (reuses the options table — same convention as the
 * legacy grader). Normalization lowercases, trims, collapses whitespace, and strips surrounding
 * punctuation; matching allows a small typo tolerance (multibyte-aware Levenshtein) that scales
 * with answer length — short answers still require an exact match, so we never over-accept.
 * A per-question override lives in `settings.short_answer_tolerance`.
 */
class ShortAnswerType implements QuestionType
{
    use GradesAnswers;

    public function type(): string
    {
        return 'short_answer';
    }

    public function answerRules(string $prefix): array
    {
        return [
            $prefix.'text' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function grade(AssignmentQuestion $question, array $answer): array
    {
        $text = trim((string) ($answer['text'] ?? $answer['text_answer'] ?? ''));
        $normalized = self::normalizeText($text);

        $accepted = $question->options
            ->where('is_correct', true)
            ->map(fn ($o) => self::normalizeText((string) $o->content))
            ->filter()
            ->values();

        $override = $question->settings['short_answer_tolerance'] ?? null;
        $isCorrect = $normalized !== '' && $accepted->contains(
            fn (string $expected) => $this->shortAnswerMatches($normalized, $expected, is_numeric($override) ? (int) $override : null)
        );

        return [
            'earned_points' => $isCorrect ? $this->roundPoints((float) $question->points) : 0.0,
            'is_correct' => $isCorrect,
            'text_answer' => $text,
            'response' => ['text' => $text],
            'meta' => [],
        ];
    }

    public function transform(AssignmentQuestion $question, bool $exposeCorrect): array
    {
        $base = $this->baseTransform($question, $exposeCorrect);
        // Accepted answers are stored as is_correct options; contents are the answer itself,
        // so students only ever get the count.
        $base['options'] = $question->options->map(
            fn ($option) => $this->transformOption($option, $exposeCorrect, hideContent: true)
        )->values()->all();

        return $base;
    }

    public function uiHints(): array
    {
        return ['needs_options' => true, 'multiple_correct' => true, 'accepted_answers_as_options' => true];
    }
}
