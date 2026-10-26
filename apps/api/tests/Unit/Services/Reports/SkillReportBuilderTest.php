<?php

namespace Tests\Unit\Services\Reports;

use App\Models\Assignment;
use App\Models\AssignmentQuestionSubmission;
use App\Models\ClassRoom;
use App\Models\Student;
use App\Models\Submission;
use App\Models\User;
use App\Services\AssignmentQuizService;
use App\Services\Reports\SkillReportBuilder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Direct unit test of SkillReportBuilder — no HTTP. Builds a real quiz assignment with two
 * sections, a graded submission with known per-question scores, and asserts the aggregated
 * overall/skills/strengths/improvements shape (the same contract the review endpoint serves).
 */
class SkillReportBuilderTest extends TestCase
{
    use RefreshDatabase;

    private Assignment $assignment;

    private Submission $submission;

    protected function setUp(): void
    {
        parent::setUp();

        $tutor = $this->tutor();
        $class = ClassRoom::factory()->create(['tutor_id' => $tutor->id]);
        $student = Student::factory()->create(['class_id' => $class->id]);

        $this->assignment = Assignment::factory()->create([
            'class_id' => $class->id,
            'tutor_id' => $tutor->id,
            'mode' => 'quiz',
            'max_score' => 8,
        ]);

        // 2 listening questions (2+2) + 1 reading question (4).
        AssignmentQuizService::syncQuestions($this->assignment, [
            [
                'title' => 'Listen and pick.',
                'question_type' => 'single_choice',
                'points' => 2,
                'options' => [['content' => 'morning', 'is_correct' => true]],
            ],
            [
                'title' => 'Complete the fee.',
                'question_type' => 'gap_fill',
                'points' => 2,
                'options' => [['label' => '1', 'content' => '450', 'is_correct' => true]],
            ],
            [
                'title' => 'Pick the heading.',
                'question_type' => 'matching',
                'points' => 4,
                'options' => [
                    ['label' => 'Para A', 'content' => 'The origins', 'is_correct' => true],
                    ['label' => 'Para B', 'content' => 'The risks', 'is_correct' => true],
                ],
            ],
        ], [
            ['_key' => 'l1', 'title' => 'Listening Part 1', 'section_type' => 'listening', 'order' => 1],
            ['_key' => 'r1', 'title' => 'Reading Passage 1', 'section_type' => 'reading', 'order' => 2],
        ]);

        [$listening, $reading] = $this->assignment->sections()->orderBy('order')->get();
        $questions = $this->assignment->questions()->orderBy('order')->get();
        $questions[0]->update(['section_id' => $listening->id]);
        $questions[1]->update(['section_id' => $listening->id]);
        $questions[2]->update(['section_id' => $reading->id]);

        $this->submission = Submission::factory()->create([
            'assignment_id' => $this->assignment->id,
            'student_id' => $student->id,
            'status' => 'graded',
            'score' => 2,
        ]);

        // Known scores: listening 2/4 (q0 full, q1 zero), reading 0/4.
        foreach ($questions as $i => $q) {
            $earned = $i === 0 ? 2.0 : 0.0;
            AssignmentQuestionSubmission::create([
                'submission_id' => $this->submission->id,
                'question_id' => $q->id,
                'score' => $earned,
                'is_correct' => $earned > 0,
                'meta' => ['max_points' => $q->points],
            ]);
        }
    }

    public function test_build_groups_by_section_type_and_returns_overall(): void
    {
        $report = app(SkillReportBuilder::class)->build($this->submission);

        $this->assertEquals(2, $report['overall']['earned']);
        $this->assertEquals(8, $report['overall']['possible']);
        $this->assertSame(25, $report['overall']['percent']);
        $this->assertSame('Chưa đạt', $report['overall']['label']);

        $bySkill = collect($report['skills'])->keyBy('type');

        $this->assertEquals(2, $bySkill['listening']['earned']);
        $this->assertEquals(4, $bySkill['listening']['possible']);
        $this->assertSame(50, $bySkill['listening']['percent']);
        $this->assertSame('Cần cải thiện', $bySkill['listening']['label']);

        $this->assertEquals(0, $bySkill['reading']['earned']);
        $this->assertEquals(4, $bySkill['reading']['possible']);
        $this->assertSame(0, $bySkill['reading']['percent']);
        $this->assertSame('Chưa đạt', $bySkill['reading']['label']);
    }

    public function test_strengths_and_improvements_split_by_threshold(): void
    {
        $report = app(SkillReportBuilder::class)->build($this->submission);

        // Nothing reached 60% → strengths falls back to the top row, improvements holds the rest.
        $this->assertNotEmpty($report['strengths']);
        $this->assertSame('listening', $report['strengths'][0]['type']);
        $this->assertCount(1, $report['improvements']);
        $this->assertSame('reading', $report['improvements'][0]['type']);
    }

    public function test_flat_quiz_without_sections_falls_back_to_general(): void
    {
        $flat = Assignment::factory()->create([
            'class_id' => $this->assignment->class_id,
            'tutor_id' => $this->assignment->tutor_id,
            'mode' => 'quiz',
            'max_score' => 2,
        ]);
        AssignmentQuizService::syncQuestions($flat, [
            [
                'title' => 'No section.',
                'question_type' => 'single_choice',
                'points' => 2,
                'options' => [['content' => 'yes', 'is_correct' => true]],
            ],
        ]);

        $question = $flat->questions()->first();
        $submission = Submission::factory()->create([
            'assignment_id' => $flat->id,
            'student_id' => $this->submission->student_id,
            'status' => 'graded',
            'score' => 2,
        ]);
        AssignmentQuestionSubmission::create([
            'submission_id' => $submission->id,
            'question_id' => $question->id,
            'score' => 2,
            'is_correct' => true,
            'meta' => ['max_points' => 2],
        ]);

        $report = app(SkillReportBuilder::class)->build($submission);

        $this->assertCount(1, $report['skills']);
        $this->assertSame('general', $report['skills'][0]['type']);
        $this->assertSame(100, $report['overall']['percent']);
        $this->assertSame('Đạt tốt', $report['overall']['label']);
    }

    public function test_unscored_submission_returns_zeroed_report(): void
    {
        $submission = Submission::factory()->create([
            'assignment_id' => $this->assignment->id,
            'student_id' => $this->submission->student_id,
            'status' => 'submitted',
            'score' => null,
        ]);

        $report = app(SkillReportBuilder::class)->build($submission);

        $this->assertSame(0, $report['overall']['earned']);
        $this->assertSame(0, $report['overall']['possible']);
        $this->assertSame(0, $report['overall']['percent']);
        $this->assertSame('Chưa đạt', $report['overall']['label']);
    }
}
