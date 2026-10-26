<?php

namespace App\Services\Assignments\QuestionTypes;

use App\Models\AssignmentQuestion;

/**
 * Contract for a quiz/exam question type. One class per type; registered in
 * `config/assignments.php` under `question_types`. Adding a new exam question type means
 * adding a class here + one config line — no edits to the grading dispatcher or controllers.
 */
interface QuestionType
{
    /** Stable machine identifier stored in assignment_questions.question_type. */
    public function type(): string;

    /**
     * Extra validation rules for the answer a student submits for this question type.
     * $prefix is the answer's validation path, e.g. `answers.*.` — prepend it to every key.
     * Note: these rules run against the *answer row* the student sends, keyed by the fields
     * this type reads in grade().
     */
    public function answerRules(string $prefix): array;

    /**
     * Grade one student answer against this question. Must not throw on missing/blank answers —
     * an unanswered question simply earns 0.
     *
     * @param  array  $answer  raw answer row (question_id + whatever the type reads)
     * @return array{earned_points: float, is_correct: bool, response: array, meta: array}
     */
    public function grade(AssignmentQuestion $question, array $answer): array;

    /**
     * Shape the question (and its options) for the FE. $exposeCorrect mirrors the existing
     * convention: false for student-facing payloads (answers hidden), true for staff.
     */
    public function transform(AssignmentQuestion $question, bool $exposeCorrect): array;

    /**
     * Identifier label for FE hints (e.g. "TRUE/FALSE/NOT GIVEN" chip row). Optional metadata.
     */
    public function uiHints(): array;
}
