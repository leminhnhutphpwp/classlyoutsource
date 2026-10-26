<?php

namespace App\Services;

use App\Models\Assignment;
use App\Models\AssignmentQuestion;
use App\Models\AssignmentQuestionOption;
use App\Models\AssignmentQuestionSubmission;
use App\Models\AssignmentSection;
use App\Models\Submission;
use App\Services\Assignments\QuestionTypes\QuestionTypeRegistry;
use App\Support\MediaShape;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Quiz/exam engine entry point: question sync, transform and grading dispatch. The actual
 * per-type logic lives in App\Services\Assignments\QuestionTypes (registry in config/assignments.php);
 * this class orchestrates sections, sums scores and stores responses.
 */
class AssignmentQuizService
{
    public static function defaultSettings(): array
    {
        return [
            'auto_grade' => true,
            'shuffle_questions' => false,
            'show_correct_answers' => false,
            'show_score_to_student' => true,
            'time_limit_minutes' => null,
        ];
    }

    public static function normalizeSettings(?array $settings = null): array
    {
        return array_merge(self::defaultSettings(), $settings ?? []);
    }

    public static function registry(): QuestionTypeRegistry
    {
        return app(QuestionTypeRegistry::class);
    }

    /**
     * @throws \Throwable
     */
    public static function syncQuestions(Assignment $assignment, array $questions, array $sections = []): void
    {
        DB::transaction(function () use ($assignment, $questions, $sections) {
            // Detach + delete existing questions (options cascade through FK / explicit delete).
            $assignment->questions()->each(function (AssignmentQuestion $question) {
                $question->options()->delete();
                $question->delete();
            });

            // Replace the section set. Questions reference sections by a client-side temp key
            // (`_key`), which we map to real section ids as we create them.
            $assignment->sections()->delete();

            $sectionIdByKey = [];
            $sectionOrder = 1;

            foreach ($sections as $section) {
                if (! is_array($section) || empty($section['title'])) {
                    continue;
                }

                $created = $assignment->sections()->create([
                    'section_type' => $section['section_type'] ?? 'general',
                    'title' => $section['title'],
                    'instruction' => $section['instruction'] ?? null,
                    'media_id' => self::normalizeMediaId($section['media_id'] ?? null),
                    'order' => $section['order'] ?? $sectionOrder++,
                    'settings' => $section['settings'] ?? null,
                ]);

                $key = $section['_key'] ?? null;
                if (is_string($key) && $key !== '') {
                    $sectionIdByKey[$key] = $created->id;
                }
                $sectionIdByKey['#'.$created->order] = $created->id;
            }

            $order = 1;
            $totalPoints = 0.0;

            foreach ($questions as $questionData) {
                $sectionKey = $questionData['section_key'] ?? null;
                $sectionId = $sectionKey !== null ? ($sectionIdByKey[$sectionKey] ?? null) : null;

                // Legacy/flat payload (no sections at all): leave section_id null.
                if ($sectionId === null && ! empty($sections) && ! empty($questionData['_section_index'])) {
                    $sectionId = $sectionIdByKey['#'.$questionData['_section_index']] ?? null;
                }

                $question = $assignment->questions()->create([
                    'section_id' => $sectionId,
                    'question_type' => $questionData['question_type'] ?? 'single_choice',
                    'media_id' => self::normalizeMediaId($questionData['media_id'] ?? null),
                    'title' => $questionData['title'],
                    'description' => $questionData['description'] ?? null,
                    'explanation' => $questionData['explanation'] ?? null,
                    'points' => (float) ($questionData['points'] ?? 1),
                    'order' => $questionData['order'] ?? $order++,
                    'settings' => $questionData['settings'] ?? null,
                ]);

                $optionOrder = 1;
                foreach ($questionData['options'] ?? [] as $option) {
                    $question->options()->create([
                        'media_id' => self::normalizeMediaId($option['media_id'] ?? null),
                        'label' => $option['label'] ?? null,
                        'content' => $option['content'],
                        'is_correct' => (bool) ($option['is_correct'] ?? false),
                        'feedback' => $option['feedback'] ?? null,
                        'order' => $option['order'] ?? $optionOrder++,
                    ]);
                }

                // Auto-seed the fixed TFNG choices so the tutor doesn't author them.
                if ($question->question_type === 'true_false_not_given' && $question->options()->count() === 0) {
                    $tfng = \App\Services\Assignments\QuestionTypes\TrueFalseNotGivenType::CHOICES;
                    $correct = strtolower(trim((string) ($question->settings['correct_choice'] ?? '')));
                    foreach ($tfng as $choice) {
                        $question->options()->create([
                            'label' => mb_substr($choice, 0, 1),
                            'content' => $choice,
                            'is_correct' => $correct !== '' && strcasecmp($choice, $correct) === 0,
                            'order' => $optionOrder++,
                        ]);
                    }
                }

                $totalPoints += (float) $question->points;
            }

            $assignment->update([
                'max_score' => $totalPoints > 0 ? round($totalPoints, 2) : $assignment->max_score,
            ]);
        });
    }

    /**
     * Shape the section list for any client. Media (listening audio) rides along so the FE
     * can render the part header + player without a second request.
     */
    public static function transformSections(Assignment $assignment): array
    {
        $sections = $assignment->relationLoaded('sections')
            ? $assignment->sections->sortBy('order')->values()
            : $assignment->sections()->orderBy('order')->get();

        return $sections->map(fn (AssignmentSection $section) => [
            '_id' => $section->hash_id,
            'section_type' => $section->section_type,
            'title' => $section->title,
            'instruction' => $section->instruction,
            'media_id' => $section->media_id,
            'media' => MediaShape::shape($section->media),
            'order' => $section->order,
            'settings' => $section->settings,
        ])->values()->all();
    }

    public static function transformQuestions(Assignment $assignment, bool $exposeCorrect = false): array
    {
        $questions = $assignment->relationLoaded('questions')
            ? $assignment->questions->loadMissing('options', 'media', 'options.media')->sortBy('order')->values()
            : $assignment->questions()->with(['options.media', 'media'])->orderBy('order')->get();

        $registry = self::registry();

        return $questions
            ->map(fn (AssignmentQuestion $question) => $registry->transform($question, $exposeCorrect))
            ->values()
            ->all();
    }

    /**
     * Grade answers and return score + breakdown.
     *
     * @throws ValidationException
     */
    public static function grade(Assignment $assignment, array $answers, bool $autoGrade = true): array
    {
        $questions = $assignment->questions()->with('options')->get();

        if ($questions->isEmpty()) {
            throw ValidationException::withMessages([
                'answers' => ['Bài trắc nghiệm chưa có câu hỏi.'],
            ]);
        }

        // Support both HashID (string) and integer ID in answers
        // Create map with both hash_id and id as keys for flexibility
        $answerMap = collect($answers)->keyBy(function ($answer) {
            // Try to use question_id as-is (could be HashID or integer)
            return $answer['question_id'] ?? null;
        });

        $totalPoints = (float) $questions->sum('points');
        $earnedPoints = 0.0;
        $responses = [];
        $registry = self::registry();

        foreach ($questions as $question) {
            // Try to find answer by hash_id first, then by integer id
            $answer = $answerMap->get($question->hash_id) ?? $answerMap->get($question->id) ?? [];
            $type = $question->question_type ?: 'single_choice';

            $result = $registry->resolveOrFallback($type)->grade($question, $answer);

            $earnedPoints += $result['earned_points'];

            $responses[] = array_merge([
                'question_id' => $question->hash_id,
                'max_points' => (float) $question->points,
                'correct_option_ids' => $question->options->where('is_correct', true)->map->hash_id->values()->all(),
            ], $result);
        }

        $status = $autoGrade ? 'graded' : 'submitted';

        $score = round($earnedPoints, 2);
        $maxScore = round($totalPoints, 2);

        return [
            'score' => abs($score - round($score)) < 0.005 ? (int) round($score) : $score,
            'max_score' => abs($maxScore - round($maxScore)) < 0.005 ? (int) round($maxScore) : $maxScore,
            'status' => $status,
            'responses' => $responses,
        ];
    }

    /** Accept an int/numeric-string media id; treat empty/non-numeric as "no media". */
    private static function normalizeMediaId($mediaId): ?int
    {
        return is_numeric($mediaId) ? (int) $mediaId : null;
    }

    /**
     * Resolve an answer identifier to the integer option id. Identifiers arrive either as
     * hashids (client) or as decoded integer ids (controller pre-decodes answers.*.option_id).
     */
    private static function resolveOptionId(mixed $identifier): ?int
    {
        if ($identifier === null || $identifier === '') {
            return null;
        }

        return AssignmentQuestionOption::decodeId($identifier)
            ?? (is_numeric($identifier) ? (int) $identifier : null);
    }

    public static function storeResponses(Submission $submission, array $responses): void
    {
        foreach ($responses as $response) {
            $questionId = AssignmentQuestion::decodeId($response['question_id'])
                ?? (is_numeric($response['question_id'] ?? null) ? (int) $response['question_id'] : null);
            $optionId = self::resolveOptionId($response['selected_option_id'] ?? null);

            if (! $questionId) {
                continue;
            }

            // Multi-select: persist the resolved integer option ids (from either hash or int identifiers).
            $optionIds = null;
            if (! empty($response['selected_option_ids']) && is_array($response['selected_option_ids'])) {
                $optionIds = collect($response['selected_option_ids'])
                    ->map(fn ($id) => self::resolveOptionId($id))
                    ->filter()
                    ->values()
                    ->all();
            }

            AssignmentQuestionSubmission::create([
                'submission_id' => $submission->id,
                'question_id' => $questionId,
                'selected_option_id' => $optionId,
                'selected_option_ids' => $optionIds,
                'text_answer' => $response['text_answer'] ?? null,
                'score' => $response['earned_points'],
                'is_correct' => $response['is_correct'],
                'response' => $response['response'] ?? null,
                'meta' => array_merge([
                    'max_points' => $response['max_points'],
                    'correct_option_ids' => $response['correct_option_ids'],
                ], $response['meta'] ?? []),
            ]);
        }
    }
}
