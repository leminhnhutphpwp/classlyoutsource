<?php

namespace App\Services\Assignments\QuestionTypes;

use App\Models\AssignmentQuestion;
use InvalidArgumentException;

/**
 * Resolves a question_type string to its grader/transformer instance. The map lives in
 * `config/assignments.php` under `question_types` — registering a new exam question type is a
 * config line + one class, nothing else changes.
 */
class QuestionTypeRegistry
{
    /** @var array<string, QuestionType> */
    private array $resolved = [];

    /** @var array<string, class-string>|null */
    private ?array $map = null;

    public function __construct(?array $config = null)
    {
        $this->map = $config ?? config('assignments.question_types');
    }

    public function resolve(string $type): QuestionType
    {
        $type = $type !== '' ? $type : 'single_choice';

        if (isset($this->resolved[$type])) {
            return $this->resolved[$type];
        }

        $class = $this->map()[$type] ?? null;

        if (! $class) {
            throw new InvalidArgumentException("Question type [{$type}] chưa được hỗ trợ.");
        }

        /** @var QuestionType $instance */
        $instance = app($class);
        $this->resolved[$type] = $instance;

        return $instance;
    }

    /** Resolve defensively — unknown types fall back to single_choice so legacy data never 500s. */
    public function resolveOrFallback(?string $type): QuestionType
    {
        try {
            return $this->resolve($type ?? '');
        } catch (InvalidArgumentException) {
            return $this->resolve('single_choice');
        }
    }

    /** All registered type identifiers (for validation `in:` rules). */
    public function types(): array
    {
        return array_keys($this->map() ?? []);
    }

    /** Base validation rules for an answer row, keyed by the given prefix. */
    public function answerRulesFor(string $type, string $prefix): array
    {
        return $this->resolveOrFallback($type)->answerRules($prefix);
    }

    public function grade(AssignmentQuestion $question, array $answer): array
    {
        return $this->resolveOrFallback($question->question_type)->grade($question, $answer);
    }

    public function transform(AssignmentQuestion $question, bool $exposeCorrect): array
    {
        return $this->resolveOrFallback($question->question_type)->transform($question, $exposeCorrect);
    }

    private function map(): array
    {
        if ($this->map === null) {
            $this->map = config('assignments.question_types', []);
        }

        return $this->map ?? [];
    }
}
