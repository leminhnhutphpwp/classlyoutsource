<?php

use App\Services\Assignments\Modes\QuizAssignmentMode;
use App\Services\Assignments\Modes\StandardAssignmentMode;
use App\Services\Assignments\QuestionTypes\GapFillType;
use App\Services\Assignments\QuestionTypes\MatchingType;
use App\Services\Assignments\QuestionTypes\MultipleChoiceType;
use App\Services\Assignments\QuestionTypes\OrderingType;
use App\Services\Assignments\QuestionTypes\ShortAnswerType;
use App\Services\Assignments\QuestionTypes\SingleChoiceType;
use App\Services\Assignments\QuestionTypes\TrueFalseNotGivenType;

return [
    'default_mode' => 'standard',

    'modes' => [
        'standard' => StandardAssignmentMode::class,
        'quiz' => QuizAssignmentMode::class,
    ],

    /*
    |--------------------------------------------------------------------------
    | Question type registry
    |--------------------------------------------------------------------------
    | Maps assignment_questions.question_type → grader/transformer. A new exam
    | question type (per subject, per industry) registers here + one class in
    | App\Services\Assignments\QuestionTypes — the dispatcher, controllers and
    | resources stay untouched.
    */
    'question_types' => [
        'single_choice' => SingleChoiceType::class,
        'multiple_choice' => MultipleChoiceType::class,
        'short_answer' => ShortAnswerType::class,
        'true_false_not_given' => TrueFalseNotGivenType::class,
        'matching' => MatchingType::class,
        'ordering' => OrderingType::class,
        'gap_fill' => GapFillType::class,
    ],

    /*
    | Section types an exam assignment may use (IELTS Listening/Reading parts,
    | Writing/Speaking tasks...). Rendered by the FE exam engine, validated here.
    */
    'section_types' => ['general', 'listening', 'reading', 'writing', 'speaking'],
];
