<?php

namespace Tests\Feature\Assignments;

use App\Models\Assignment;
use App\Models\AssignmentQuestion;
use App\Services\AssignmentQuizService;
use Tests\TestCase;

/**
 * Auto-grading previously handled only single_choice; multi-select and short-answer were blocked at
 * validation and unscored. grade() now branches on question_type.
 */
class QuizGradingTest extends TestCase
{
    private function question(Assignment $assignment, string $type, int $points, array $options, array $settings = []): AssignmentQuestion
    {
        $q = $assignment->questions()->create([
            'question_type' => $type,
            'title' => 'Q '.$type,
            'points' => $points,
            'order' => 1,
            'settings' => $settings ?: null,
        ]);

        $order = 1;
        foreach ($options as $opt) {
            $q->options()->create([
                'content' => $opt['content'],
                'is_correct' => $opt['is_correct'],
                'order' => $order++,
            ]);
        }

        return $q->load('options');
    }

    private function grade(Assignment $assignment, array $answers): array
    {
        return AssignmentQuizService::grade($assignment, $answers, true);
    }

    public function test_single_choice_still_grades(): void
    {
        $assignment = Assignment::factory()->create();
        $q = $this->question($assignment, 'single_choice', 5, [
            ['content' => 'A', 'is_correct' => true],
            ['content' => 'B', 'is_correct' => false],
        ]);
        $correct = $q->options->firstWhere('is_correct', true);

        $result = $this->grade($assignment, [
            ['question_id' => $q->hash_id, 'selected_option_id' => $correct->hash_id],
        ]);

        $this->assertSame(5, $result['score']);
        $this->assertTrue($result['responses'][0]['is_correct']);
    }

    public function test_multiple_choice_exact_set_scores_full(): void
    {
        $assignment = Assignment::factory()->create();
        $q = $this->question($assignment, 'multiple_choice', 10, [
            ['content' => 'A', 'is_correct' => true],
            ['content' => 'B', 'is_correct' => true],
            ['content' => 'C', 'is_correct' => false],
        ]);
        $correctIds = $q->options->where('is_correct', true)->pluck('hash_id')->all();

        $result = $this->grade($assignment, [
            ['question_id' => $q->hash_id, 'selected_option_ids' => $correctIds],
        ]);

        $this->assertSame(10, $result['score']);
        $this->assertTrue($result['responses'][0]['is_correct']);
    }

    public function test_multiple_choice_partial_set_scores_zero(): void
    {
        $assignment = Assignment::factory()->create();
        $q = $this->question($assignment, 'multiple_choice', 10, [
            ['content' => 'A', 'is_correct' => true],
            ['content' => 'B', 'is_correct' => true],
            ['content' => 'C', 'is_correct' => false],
        ]);
        // Only one of the two correct options selected → all-or-nothing → 0.
        $oneCorrect = [$q->options->firstWhere('is_correct', true)->hash_id];

        $result = $this->grade($assignment, [
            ['question_id' => $q->hash_id, 'selected_option_ids' => $oneCorrect],
        ]);

        $this->assertSame(0, $result['score']);
        $this->assertFalse($result['responses'][0]['is_correct']);
    }

    public function test_short_answer_normalized_match(): void
    {
        $assignment = Assignment::factory()->create();
        // Accepted answers stored as is_correct option contents.
        $q = $this->question($assignment, 'short_answer', 4, [
            ['content' => 'Hà Nội', 'is_correct' => true],
        ]);

        // Different case + extra whitespace still matches.
        $hit = $this->grade($assignment, [
            ['question_id' => $q->hash_id, 'text' => '  hà nội '],
        ]);
        $this->assertSame(4, $hit['score']);
        $this->assertTrue($hit['responses'][0]['is_correct']);

        $miss = $this->grade($assignment, [
            ['question_id' => $q->hash_id, 'text' => 'Sài Gòn'],
        ]);
        $this->assertSame(0, $miss['score']);
        $this->assertFalse($miss['responses'][0]['is_correct']);
    }

    public function test_short_answer_ignores_surrounding_punctuation(): void
    {
        $assignment = Assignment::factory()->create();
        $q = $this->question($assignment, 'short_answer', 4, [
            ['content' => 'Hà Nội', 'is_correct' => true],
        ]);

        $result = $this->grade($assignment, [
            ['question_id' => $q->hash_id, 'text' => 'Hà Nội.'],
        ]);
        $this->assertSame(4, $result['score']);
        $this->assertTrue($result['responses'][0]['is_correct']);
    }

    public function test_short_answer_tolerates_a_single_typo_in_a_long_answer(): void
    {
        $assignment = Assignment::factory()->create();
        // "nguyễn trãi" normalizes to 11 chars → tolerance floor(11/8) = 1.
        $q = $this->question($assignment, 'short_answer', 4, [
            ['content' => 'Nguyễn Trãi', 'is_correct' => true],
        ]);

        // One-character slip (ã → a) = edit distance 1 → accepted.
        $hit = $this->grade($assignment, [
            ['question_id' => $q->hash_id, 'text' => 'Nguyễn Trai'],
        ]);
        $this->assertTrue($hit['responses'][0]['is_correct']);

        // Two+ characters off → beyond tolerance → rejected.
        $miss = $this->grade($assignment, [
            ['question_id' => $q->hash_id, 'text' => 'Nguyen Trai'],
        ]);
        $this->assertFalse($miss['responses'][0]['is_correct']);
    }

    public function test_short_answer_under_eight_chars_stays_exact(): void
    {
        $assignment = Assignment::factory()->create();
        // "lê" normalizes to 2 chars → tolerance 0, so even a one-char typo must fail.
        $q = $this->question($assignment, 'short_answer', 4, [
            ['content' => 'Lê', 'is_correct' => true],
        ]);

        $result = $this->grade($assignment, [
            ['question_id' => $q->hash_id, 'text' => 'Le'],
        ]);
        $this->assertFalse($result['responses'][0]['is_correct']);
    }

    public function test_short_answer_tolerance_override_is_honoured(): void
    {
        $assignment = Assignment::factory()->create();
        // Short answer that would be exact-only by default, but the question widens tolerance to 2.
        $q = $this->question($assignment, 'short_answer', 4, [
            ['content' => 'Hà Nội', 'is_correct' => true],
        ], ['short_answer_tolerance' => 2]);

        $result = $this->grade($assignment, [
            ['question_id' => $q->hash_id, 'text' => 'hà nôi'], // 1 edit away
        ]);
        $this->assertTrue($result['responses'][0]['is_correct']);
    }
}
