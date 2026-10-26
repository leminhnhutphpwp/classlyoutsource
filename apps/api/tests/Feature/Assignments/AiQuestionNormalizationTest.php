<?php

namespace Tests\Feature\Assignments;

use App\Services\AI\AiQuestionService;
use ReflectionMethod;
use Tests\TestCase;

/**
 * Normalizer unit tests for the exam question shapes. These exercise the defensive
 * normalization (model output → assignment_questions/options shape) via reflection,
 * so no billable AI call is involved.
 */
class AiQuestionNormalizationTest extends TestCase
{
    private function normalize(array $raw, string $type): ?array
    {
        $service = app(AiQuestionService::class);
        $method = new ReflectionMethod(AiQuestionService::class, 'normalizeQuestion');
        $method->setAccessible(true);

        return $method->invoke($service, $raw, $type);
    }

    public function test_registry_types_include_all_seven_shapes(): void
    {
        $this->assertSame([
            'single_choice', 'multiple_choice', 'short_answer',
            'true_false_not_given', 'matching', 'ordering', 'gap_fill',
        ], AiQuestionService::types());
    }

    public function test_tfng_statement_has_no_options(): void
    {
        $result = $this->normalize([
            'question_type' => 'true_false_not_given',
            'title' => 'The library opens at 9am on Sundays.',
            'points' => 1,
            'explanation' => 'The text says 10am.',
            'options' => [],
            'items' => [],
            'distractors' => [],
            'text_with_gaps' => '',
        ], 'true_false_not_given');

        $this->assertNotNull($result);
        $this->assertSame('The library opens at 9am on Sundays.', $result['title']);
        $this->assertSame([], $result['options']); // auto-seeded server-side at sync
    }

    public function test_matching_pairs_map_to_item_options_with_distractors(): void
    {
        $result = $this->normalize([
            'question_type' => 'matching',
            'title' => 'Nối địa danh với quốc gia.',
            'points' => 2,
            'explanation' => '',
            'options' => [],
            'items' => [
                ['label' => 'Eiffel', 'content' => 'Pháp'],
                ['label' => 'Colosseum', 'content' => 'Ý'],
                ['label' => '', 'content' => 'missing'], // dropped: empty label
            ],
            'distractors' => ['Đức', ''],
            'text_with_gaps' => '',
        ], 'matching');

        $this->assertNotNull($result);
        $this->assertCount(2, $result['options']); // the empty-label pair is dropped
        $this->assertSame('Eiffel', $result['options'][0]['label']);
        $this->assertSame('Pháp', $result['options'][0]['content']);
        $this->assertTrue($result['options'][0]['is_correct']);
        $this->assertSame(['Đức'], $result['settings']['distractors']);
    }

    public function test_matching_with_one_pair_is_rejected(): void
    {
        $result = $this->normalize([
            'question_type' => 'matching',
            'title' => 't',
            'points' => 1,
            'explanation' => '',
            'options' => [],
            'items' => [['label' => 'A', 'content' => 'B']],
            'distractors' => [],
            'text_with_gaps' => '',
        ], 'matching');

        $this->assertNull($result);
    }

    public function test_ordering_steps_become_sequential_options(): void
    {
        $result = $this->normalize([
            'question_type' => 'ordering',
            'title' => 'Sắp xếp các bước pha trà.',
            'points' => 3,
            'explanation' => '',
            'options' => [],
            'items' => [
                ['label' => '', 'content' => 'Đun nước sôi'],
                ['label' => '', 'content' => 'Cho trà vào ấm'],
                ['label' => '', 'content' => 'Rót nước vào ấm'],
            ],
            'distractors' => [],
            'text_with_gaps' => '',
        ], 'ordering');

        $this->assertNotNull($result);
        $this->assertSame(['A', 'B', 'C'], array_column($result['options'], 'label'));
        $this->assertSame(['Đun nước sôi', 'Cho trà vào ấm', 'Rót nước vào ấm'], array_column($result['options'], 'content'));
        $this->assertTrue($result['settings']['partial_ordering']);
    }

    public function test_gap_fill_title_holds_text_and_options_hold_gap_answers(): void
    {
        $result = $this->normalize([
            'question_type' => 'gap_fill',
            'title' => 'fallback',
            'points' => 2,
            'explanation' => '',
            'options' => [],
            'items' => [
                ['label' => '1', 'content' => 'is'],
                ['label' => '2', 'content' => 'are'],
            ],
            'distractors' => [],
            'text_with_gaps' => 'She {{1}} a doctor. They {{2}} nurses.',
        ], 'gap_fill');

        $this->assertNotNull($result);
        $this->assertSame('She {{1}} a doctor. They {{2}} nurses.', $result['title']);
        $this->assertSame([
            ['label' => '1', 'content' => 'is', 'is_correct' => true],
            ['label' => '2', 'content' => 'are', 'is_correct' => true],
        ], $result['options']);
    }

    public function test_gap_fill_without_placeholders_is_rejected(): void
    {
        $result = $this->normalize([
            'question_type' => 'gap_fill',
            'title' => 'No gaps here.',
            'points' => 1,
            'explanation' => '',
            'options' => [],
            'items' => [['label' => '1', 'content' => 'x']],
            'distractors' => [],
            'text_with_gaps' => 'No gaps here.',
        ], 'gap_fill');

        $this->assertNull($result);
    }

    public function test_short_answer_flags_all_options_accepted(): void
    {
        $result = $this->normalize([
            'question_type' => 'short_answer',
            'title' => 'Thủ đô Việt Nam?',
            'points' => 1,
            'explanation' => '',
            'options' => [
                ['content' => 'Hà Nội', 'is_correct' => false],
                ['content' => 'Hanoi', 'is_correct' => false],
            ],
            'items' => [],
            'distractors' => [],
            'text_with_gaps' => '',
        ], 'short_answer');

        $this->assertNotNull($result);
        $this->assertTrue($result['options'][0]['is_correct']);
        $this->assertTrue($result['options'][1]['is_correct']);
    }
}
