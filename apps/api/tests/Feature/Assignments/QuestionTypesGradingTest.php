<?php

namespace Tests\Feature\Assignments;

use App\Models\Assignment;
use App\Models\AssignmentQuestion;
use App\Models\ClassRoom;
use App\Services\AssignmentQuizService;
use App\Services\Assignments\QuestionTypes\TrueFalseNotGivenType;
use Tests\TestCase;

/**
 * The exam-engine question type registry: grading semantics for every registered type,
 * including the new exam items (TFNG, matching, ordering, gap fill) and partial credit.
 */
class QuestionTypesGradingTest extends TestCase
{
    private Assignment $assignment;

    protected function setUp(): void
    {
        parent::setUp();

        $this->assignment = Assignment::factory()->create([
            'mode' => 'quiz',
            'status' => 'published',
        ]);
    }

    private function question(string $type, float $points, array $options, array $settings = []): AssignmentQuestion
    {
        $q = $this->assignment->questions()->create([
            'question_type' => $type,
            'title' => 'Q '.$type,
            'points' => $points,
            'order' => 1,
            'settings' => $settings ?: null,
        ]);

        $order = 1;
        foreach ($options as $opt) {
            $q->options()->create([
                'label' => $opt['label'] ?? null,
                'content' => $opt['content'],
                'is_correct' => $opt['is_correct'],
                'order' => $order++,
            ]);
        }

        return $q->load('options');
    }

    public function test_true_false_not_given_grades_by_choice_content(): void
    {
        $q = $this->question('true_false_not_given', 2, [
            ['content' => 'TRUE', 'is_correct' => true],
            ['content' => 'FALSE', 'is_correct' => false],
            ['content' => 'NOT GIVEN', 'is_correct' => false],
        ]);

        // By option id…
        $byId = AssignmentQuizService::grade($this->assignment, [
            ['question_id' => $q->hash_id, 'selected_option_id' => $q->options->firstWhere('content', 'TRUE')->hash_id],
        ]);
        $this->assertSame(2, $byId['score']);
        $this->assertTrue($byId['responses'][0]['is_correct']);

        // …and by raw text (AI-generated/plain payloads).
        $byText = AssignmentQuizService::grade($this->assignment, [
            ['question_id' => $q->hash_id, 'text' => 'true'],
        ]);
        $this->assertSame(2, $byText['score']);
    }

    public function test_tfng_auto_seeds_choices_on_sync(): void
    {
        AssignmentQuizService::syncQuestions($this->assignment, [
            [
                'title' => 'The passage says giants exist.',
                'question_type' => 'true_false_not_given',
                'points' => 1,
                'options' => [],
                'settings' => ['correct_choice' => 'false'],
            ],
        ]);

        $question = $this->assignment->questions()->first();
        $this->assertSame('true_false_not_given', $question->question_type);
        $this->assertSame(3, $question->options()->count());

        $choices = $question->options()->orderBy('order')->pluck('content')->all();
        $this->assertSame(TrueFalseNotGivenType::CHOICES, $choices);

        $correct = $question->options()->where('is_correct', true)->first();
        $this->assertNotNull($correct);
        $this->assertSame('FALSE', $correct->content);
    }

    public function test_matching_scores_partial_credit_per_pair(): void
    {
        $q = $this->question('matching', 4, [
            ['label' => 'Statements about Tom', 'content' => 'Tom', 'is_correct' => false],
            ['label' => 'Statements about Anna', 'content' => 'Anna', 'is_correct' => false],
        ], ['distractors' => ['Nobody']]);

        // 1 of 2 pairs right → half credit.
        $result = AssignmentQuizService::grade($this->assignment, [
            ['question_id' => $q->hash_id, 'response' => [
                $q->options[0]->hash_id => 'Tom',
                $q->options[1]->hash_id => 'Nobody',
            ]],
        ]);

        $this->assertSame(2, $result['score']);
        $this->assertFalse($result['responses'][0]['is_correct']);
        $this->assertSame(1, $result['responses'][0]['meta']['correct_count']);
    }

    public function test_matching_all_correct_earns_full_points(): void
    {
        $q = $this->question('matching', 4, [
            ['label' => 'Item A', 'content' => 'X', 'is_correct' => false],
            ['label' => 'Item B', 'content' => 'Y', 'is_correct' => false],
        ]);

        $result = AssignmentQuizService::grade($this->assignment, [
            ['question_id' => $q->hash_id, 'response' => [
                $q->options[0]->hash_id => 'X',
                $q->options[1]->hash_id => 'Y',
            ]],
        ]);

        $this->assertSame(4, $result['score']);
        $this->assertTrue($result['responses'][0]['is_correct']);
    }

    public function test_ordering_scores_partial_credit_per_position(): void
    {
        // Correct order: option order 1,2,3 = A, B, C.
        $q = $this->question('ordering', 3, [
            ['content' => 'A', 'is_correct' => false],
            ['content' => 'B', 'is_correct' => false],
            ['content' => 'C', 'is_correct' => false],
        ]);

        // Correct order is A,B,C. Student's sequence [B,A,C] keeps only position 3 right
        // (C) → 1/3 of 3 points = 1.
        $result = AssignmentQuizService::grade($this->assignment, [
            ['question_id' => $q->hash_id, 'response' => [
                $q->options[1]->hash_id,
                $q->options[0]->hash_id,
                $q->options[2]->hash_id,
            ]],
        ]);

        $this->assertSame(1, $result['score']);
        $this->assertFalse($result['responses'][0]['is_correct']);
    }

    public function test_ordering_wrong_sequence_earns_zero_when_partial_disabled(): void
    {
        $q = $this->question('ordering', 3, [
            ['content' => 'A', 'is_correct' => false],
            ['content' => 'B', 'is_correct' => false],
            ['content' => 'C', 'is_correct' => false],
        ], ['partial_ordering' => false]);

        $result = AssignmentQuizService::grade($this->assignment, [
            ['question_id' => $q->hash_id, 'response' => [
                $q->options[1]->hash_id,
                $q->options[0]->hash_id,
                $q->options[2]->hash_id,
            ]],
        ]);

        $this->assertSame(0, $result['score']);
    }

    public function test_gap_fill_scores_per_gap_with_normalization(): void
    {
        $q = $this->assignment->questions()->create([
            'question_type' => 'gap_fill',
            'title' => 'She {{1}} to school by bus every {{2}}.',
            'points' => 4,
            'order' => 1,
        ]);

        foreach ([1 => 'goes', 2 => 'day'] as $gap => $answer) {
            $q->options()->create([
                'label' => (string) $gap,
                'content' => $answer,
                'is_correct' => true,
                'order' => $gap,
            ]);
        }

        $result = AssignmentQuizService::grade($this->assignment, [
            ['question_id' => $q->hash_id, 'response' => ['1' => ' GOES. ', '2' => 'week']],
        ]);

        $this->assertSame(2, $result['score']);
        $this->assertSame(1, $result['responses'][0]['meta']['correct_gaps']);
        $this->assertSame(['1' => true, '2' => false], $result['responses'][0]['meta']['gap_results']);
    }

    public function test_multiple_choice_partial_mode_gives_half_for_half_correct(): void
    {
        $q = $this->question('multiple_choice', 2, [
            ['content' => 'A', 'is_correct' => true],
            ['content' => 'B', 'is_correct' => true],
            ['content' => 'C', 'is_correct' => false],
        ], ['allow_partial' => true]);

        $result = AssignmentQuizService::grade($this->assignment, [
            ['question_id' => $q->hash_id, 'selected_option_ids' => [
                $q->options[0]->hash_id, // one right, nothing wrong
            ]],
        ]);

        $this->assertSame(1, $result['score']);
    }

    public function test_unanswered_question_scores_zero_without_error(): void
    {
        $q = $this->question('single_choice', 5, [
            ['content' => 'A', 'is_correct' => true],
            ['content' => 'B', 'is_correct' => false],
        ]);

        $result = AssignmentQuizService::grade($this->assignment, [
            ['question_id' => $q->hash_id],
        ]);

        $this->assertSame(0, $result['score']);
        $this->assertFalse($result['responses'][0]['is_correct']);
    }

    public function test_fractional_points_sum_to_fractional_max(): void
    {
        $this->question('single_choice', 0.5, [
            ['content' => 'A', 'is_correct' => true],
            ['content' => 'B', 'is_correct' => false],
        ]);
        $this->question('single_choice', 1.5, [
            ['content' => 'A', 'is_correct' => true],
            ['content' => 'B', 'is_correct' => false],
        ]);

        // First question answered correctly (+0.5), second wrongly (0) → 0.5 earned of a 2.0 max.
        $questions = $this->assignment->questions()->with('options')->get()->values();
        $answers = [
            [
                'question_id' => $questions[0]->hash_id,
                'selected_option_id' => $questions[0]->options->firstWhere('is_correct', true)->hash_id,
            ],
            [
                'question_id' => $questions[1]->hash_id,
                'selected_option_id' => $questions[1]->options->firstWhere('is_correct', false)->hash_id,
            ],
        ];

        $result = AssignmentQuizService::grade($this->assignment, $answers);

        $this->assertSame(0.5, $result['score']);
        $this->assertSame(2, $result['max_score']);
    }
}
