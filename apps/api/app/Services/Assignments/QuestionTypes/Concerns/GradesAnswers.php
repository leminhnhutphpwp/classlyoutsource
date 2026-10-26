<?php

namespace App\Services\Assignments\QuestionTypes\Concerns;

use App\Models\AssignmentQuestion;
use App\Models\AssignmentQuestionOption;
use Illuminate\Validation\ValidationException;

/**
 * Shared plumbing for question type graders: option resolution, text normalization and the
 * typo-tolerant short-answer matcher. Moved here from AssignmentQuizService so every question
 * type grades text the same way (single source of truth — no copied Levenshtein code).
 */
trait GradesAnswers
{
    /**
     * Find an option of this question by hash id or integer id; fail closed with a
     * ValidationException so an invalid answer id never silently scores 0 as "answered wrong".
     */
    protected function resolveOption(AssignmentQuestion $question, mixed $identifier): AssignmentQuestionOption
    {
        $option = $question->options->first(
            fn ($opt) => $opt->hash_id === $identifier || $opt->id == $identifier
        );

        if (! $option) {
            throw ValidationException::withMessages([
                'answers' => ["Đáp án không hợp lệ cho câu hỏi #{$question->hash_id}."],
            ]);
        }

        return $option;
    }

    /**
     * Resolve a "pick" value (matching / ordering answers may send a hash id, an integer id,
     * or — for matching pools — the candidate text itself) into the option's content string.
     */
    protected function resolvePickToContent(AssignmentQuestion $question, mixed $pick): ?string
    {
        if ($pick === null || $pick === '') {
            return null;
        }

        $option = $question->options->first(
            fn ($opt) => $opt->hash_id === $pick || $opt->id == $pick
        );

        if ($option) {
            return (string) $option->content;
        }

        // A pool pick may arrive as the candidate text itself, or as a numeric pool index.
        $pool = $question->options->map(fn ($o) => (string) $o->content)->unique()->values();

        if (is_numeric($pick) && (int) $pick == $pick) {
            $index = (int) $pick;

            return $pool->get($index);
        }

        return $pool->first(fn (string $content) => self::normalizeText($content) === self::normalizeText((string) $pick));
    }

    /** Normalize free text: collapse whitespace, strip surrounding punctuation, lowercase. */
    protected static function normalizeText(string $value): string
    {
        $collapsed = trim(preg_replace('/\s+/', ' ', $value));
        // Strip surrounding punctuation so "Hà Nội." matches "Hà Nội" (keeps inner punctuation intact).
        $trimmed = preg_replace('/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/u', '', $collapsed);

        return mb_strtolower($trimmed);
    }

    /** Tolerant short-answer matcher (same policy the legacy grader used). */
    protected function shortAnswerMatches(string $actual, string $expected, ?int $override = null): bool
    {
        if ($actual === $expected) {
            return true;
        }

        $tolerance = $override !== null && $override >= 0
            ? $override
            : min(2, intdiv(mb_strlen($expected), 8));

        return $tolerance > 0 && $this->mbLevenshtein($actual, $expected) <= $tolerance;
    }

    /** Multibyte-safe Levenshtein distance (PHP's levenshtein() counts bytes, which breaks on UTF-8). */
    protected function mbLevenshtein(string $a, string $b): int
    {
        $aChars = mb_str_split($a);
        $bChars = mb_str_split($b);
        $la = count($aChars);
        $lb = count($bChars);

        if ($la === 0) {
            return $lb;
        }
        if ($lb === 0) {
            return $la;
        }

        $prev = range(0, $lb);
        for ($i = 1; $i <= $la; $i++) {
            $curr = [$i];
            for ($j = 1; $j <= $lb; $j++) {
                $cost = $aChars[$i - 1] === $bChars[$j - 1] ? 0 : 1;
                $curr[$j] = min($prev[$j] + 1, $curr[$j - 1] + 1, $prev[$j - 1] + $cost);
            }
            $prev = $curr;
        }

        return $prev[$lb];
    }

    /** Round an earned score to 2 decimals (partial credit is fractional); whole numbers stay int. */
    protected function roundPoints(float $points): float|int
    {
        $rounded = round($points, 2);

        return abs($rounded - round($rounded)) < 0.005 ? (int) round($rounded) : $rounded;
    }

    /** The common question payload every type returns from transform(); type-specific extras
     * are merged on top by each grader. */
    protected function baseTransform(AssignmentQuestion $question, bool $exposeCorrect): array
    {
        return [
            '_id' => $question->hash_id,
            'title' => $question->title,
            'description' => $question->description,
            'question_type' => $question->question_type,
            'points' => (float) $question->points,
            'order' => $question->order,
            'explanation' => $question->explanation,
            'section_id' => $question->section_id,
            'settings' => $question->settings,
            'media_id' => $question->media_id,
            'media' => \App\Support\MediaShape::shape($question->media),
        ];
    }

    /** Shape one option row; `content`/`is_correct` are stripped from student payloads when the content IS the answer. */
    protected function transformOption(AssignmentQuestionOption $option, bool $exposeCorrect, bool $hideContent = false): array
    {
        return [
            '_id' => $option->hash_id,
            'label' => $option->label,
            'content' => $hideContent && ! $exposeCorrect ? null : $option->content,
            'is_correct' => $exposeCorrect ? (bool) $option->is_correct : null,
            'feedback' => $option->feedback,
            'media_id' => $option->media_id,
            'media' => $option->relationLoaded('media') && $option->media
                ? \App\Support\MediaShape::shape($option->media)
                : null,
        ];
    }
}
