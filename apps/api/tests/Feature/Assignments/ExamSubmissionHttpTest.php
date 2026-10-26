<?php

namespace Tests\Feature\Assignments;

use App\Models\Assignment;
use App\Models\ClassRoom;
use App\Models\Student;
use App\Models\User;
use App\Services\AssignmentQuizService;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * HTTP-level exam flows: a student posts a submission through POST /api/v1/submissions for
 * every answer shape (multi-select ids, short-answer text, structured response maps) and
 * reviews their paper through GET /api/v1/submissions/{id}/review — with answer-key exposure
 * gated by quiz_settings.show_correct_answers. Guards the previously-broken validation rules
 * (option_id was wrongly required on every answer row, which 422'd multi-select + text).
 */
class ExamSubmissionHttpTest extends TestCase
{
    private ClassRoom $class;

    private User $tutor;

    private Student $student;

    private User $studentUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tutor = $this->tutor();
        $this->class = ClassRoom::factory()->create(['tutor_id' => $this->tutor->id]);
        $this->studentUser = $this->studentUser(['password' => Hash::make('secret123')]);
        $this->student = Student::factory()->create([
            'user_id' => $this->studentUser->id,
            'class_id' => $this->class->id,
        ]);
        $this->enroll($this->student, $this->class);
    }

    /** Create a published quiz assignment with one section and 2 questions; return [assignment, questions]. */
    private function createExam(): array
    {
        $assignment = Assignment::factory()->published()->create([
            'class_id' => $this->class->id,
            'tutor_id' => $this->tutor->id,
            'mode' => 'quiz',
            // The factory randomizes due_date (can land earlier today) and allow_late_submission;
            // pin both so submissions never flake on the overdue guard.
            'due_date' => now()->addDays(7),
            'deadline' => now()->addDays(7)->setTime(23, 59),
            'allow_late_submission' => true,
        ]);

        AssignmentQuizService::syncQuestions($assignment, [
            [
                'title' => 'Pick the correct plural.',
                'question_type' => 'single_choice',
                'points' => 2,
                'options' => [
                    ['content' => 'children', 'is_correct' => true],
                    ['content' => 'childs', 'is_correct' => false],
                ],
            ],
            [
                'title' => 'Select TWO animals.',
                'question_type' => 'multiple_choice',
                'points' => 2,
                'options' => [
                    ['content' => 'cat', 'is_correct' => true],
                    ['content' => 'dog', 'is_correct' => true],
                    ['content' => 'chair', 'is_correct' => false],
                ],
            ],
            [
                'title' => 'Name the capital of Vietnam.',
                'question_type' => 'short_answer',
                'points' => 1,
                'options' => [
                    ['content' => 'Hà Nội', 'is_correct' => true],
                ],
            ],
        ], [
            ['_key' => 's1', 'title' => 'Part 1', 'section_type' => 'listening', 'order' => 1],
        ]);

        $assignment->questions()->update(['section_id' => $assignment->sections()->first()->id]);
        $assignment->refresh();

        return [$assignment, $assignment->questions()->with('options')->orderBy('order')->get()];
    }

    private function postSubmission(array $answers): \Illuminate\Testing\TestResponse
    {
        return $this->actingAsApi($this->studentUser)
            ->postJson('/api/v1/submissions', [
                'assignment_id' => $this->assignment->hash_id,
                'started_at' => now()->subMinutes(5)->toISOString(),
                'answers' => $answers,
            ]);
    }

    public function test_student_submits_multi_select_and_text_answers_via_http(): void
    {
        [$assignment, $questions] = $this->createExam();
        $this->assignment = $assignment;

        $single = $questions[0];
        $multi = $questions[1];
        $text = $questions[2];

        $response = $this->postSubmission([
            // single_choice: option_id
            ['question_id' => $single->hash_id, 'option_id' => $single->options->firstWhere('is_correct', true)->hash_id],
            // multiple_choice: selected_option_ids — this is the shape the old rule 422'd.
            ['question_id' => $multi->hash_id, 'selected_option_ids' => [
                $multi->options->firstWhere('content', 'cat')->hash_id,
                $multi->options->firstWhere('content', 'dog')->hash_id,
            ]],
            // short_answer: text
            ['question_id' => $text->hash_id, 'text' => 'Hà Nội'],
        ]);

        $response->assertStatus(201);

        $submission = $response->json('data');
        $this->assertSame(5, (int) $submission['score']);
        $this->assertSame('graded', $submission['status']);
        $this->assertSame(5, $submission['max_score']);
    }

    public function test_student_submits_structured_response_for_exam_items_via_http(): void
    {
        [$assignment, $questions] = $this->createExam();
        $this->assignment = $assignment;

        // Send a matching-style response map on a multiple-choice question — the grader for the
        // type reads what it knows, an unknown field just leaves the answer blank (scored 0),
        // and the request itself must validate.
        $multi = $questions[1];
        $response = $this->postSubmission([
            ['question_id' => $multi->hash_id, 'response' => ['item' => 'cat']],
        ]);

        $response->assertStatus(201);
        $this->assertSame(0, (int) $response->json('data.score'));
    }

    public function test_blank_answers_still_submit_and_score_zero(): void
    {
        [$assignment, $questions] = $this->createExam();
        $this->assignment = $assignment;

        $response = $this->postSubmission([
            ['question_id' => $questions[0]->hash_id],
            ['question_id' => $questions[1]->hash_id],
        ]);

        $response->assertStatus(201);
        $this->assertSame(0, (int) $response->json('data.score'));
    }

    public function test_tutor_grades_per_question_and_total_recomputes(): void
    {
        [$assignment, $questions] = $this->createExam();
        $this->assignment = $assignment;

        // Student answers only question 0 correctly (2 points) and leaves the rest blank.
        $single = $questions[0];
        $created = $this->postSubmission([
            ['question_id' => $single->hash_id, 'option_id' => $single->options->firstWhere('is_correct', true)->hash_id],
        ]);
        $submissionId = $created->json('data._id');
        $this->assertSame(2, (int) $created->json('data.score'));

        // Tutor grades each question by hand: full points on q1 (2), half on q2 (0.5).
        $graded = $this->actingAsApi($this->tutor)
            ->postJson("/api/v1/submissions/{$submissionId}/grade", [
                'feedback' => 'Chấm tay từng câu',
                'question_scores' => [
                    $questions[1]->hash_id => 2,
                    $questions[2]->hash_id => 0.5,
                ],
            ]);

        $graded->assertStatus(200);
        // Total = 2 (auto) + 2 (q1 full) + 0.5 (q2 half) = 4.5
        $this->assertSame(4.5, (float) $graded->json('data.score'));
        $this->assertSame('graded', $graded->json('data.status'));

        // Per-question scores actually landed on the answer rows.
        $row1 = $created->json('data'); // submission resource does not carry rows; check via review
        $review = $this->actingAsApi($this->tutor)
            ->getJson("/api/v1/submissions/{$submissionId}/review")
            ->assertStatus(200)
            ->json('data');
        $scoresByQuestion = collect($review['responses'])
            ->mapWithKeys(fn ($r) => [$r['question_id'] => $r['score']])
            ->toArray();
        $this->assertSame(2, $scoresByQuestion[$questions[1]->hash_id]);
        $this->assertSame(0.5, $scoresByQuestion[$questions[2]->hash_id]);
    }

    public function test_per_question_grade_clamps_against_max_points(): void
    {
        [$assignment, $questions] = $this->createExam();
        $this->assignment = $assignment;

        $created = $this->postSubmission([
            ['question_id' => $questions[0]->hash_id],
        ]);
        $submissionId = $created->json('data._id');

        // Trying to give q0 (max 2 points) 99 points gets clamped, not rejected.
        $graded = $this->actingAsApi($this->tutor)
            ->postJson("/api/v1/submissions/{$submissionId}/grade", [
                'question_scores' => [$questions[0]->hash_id => 99],
            ]);

        $graded->assertStatus(200);
        $this->assertSame(2.0, (float) $graded->json('data.score'));
    }

    public function test_student_reviews_own_paper_with_answers_hidden(): void
    {
        [$assignment, $questions] = $this->createExam();
        $this->assignment = $assignment;

        $single = $questions[0];
        $created = $this->postSubmission([
            ['question_id' => $single->hash_id, 'option_id' => $single->options->firstWhere('is_correct', true)->hash_id],
        ]);
        $submissionId = $created->json('data._id');

        $review = $this->actingAsApi($this->studentUser)
            ->getJson("/api/v1/submissions/{$submissionId}/review");

        $review->assertStatus(200);

        $payload = $review->json('data');
        $this->assertFalse($payload['expose_correct']);

        // The student's own answer rides along, correct flags on options do not.
        $this->assertNotNull($payload['responses'][0]['selected_option_id']);
        $this->assertNull($payload['questions'][0]['options'][0]['is_correct']);
        $this->assertArrayNotHasKey('correct_option_ids', $payload['responses'][0]);
    }

    public function test_review_exposes_correct_answers_when_enabled(): void
    {
        [$assignment, $questions] = $this->createExam();
        $assignment->update(['quiz_settings' => ['show_correct_answers' => true]]);
        $this->assignment = $assignment;

        $single = $questions[0];
        $created = $this->postSubmission([
            ['question_id' => $single->hash_id, 'option_id' => $single->options->firstWhere('content', 'childs')->hash_id],
        ]);
        $submissionId = $created->json('data._id');

        $payload = $this->actingAsApi($this->studentUser)
            ->getJson("/api/v1/submissions/{$submissionId}/review")
            ->assertStatus(200)
            ->json('data');

        $this->assertTrue($payload['expose_correct']);
        $this->assertContains(
            $questions[0]->options->firstWhere('is_correct', true)->hash_id,
            collect($payload['responses'][0]['meta']['correct_option_ids'] ?? [])->all()
        );
    }

    public function test_another_student_cannot_review_someone_elses_paper(): void
    {
        [$assignment, $questions] = $this->createExam();
        $this->assignment = $assignment;

        $single = $questions[0];
        $created = $this->postSubmission([
            ['question_id' => $single->hash_id, 'option_id' => $single->options->firstWhere('is_correct', true)->hash_id],
        ]);
        $submissionId = $created->json('data._id');

        $otherUser = $this->studentUser();
        $otherStudent = Student::factory()->create(['user_id' => $otherUser->id, 'class_id' => $this->class->id]);
        $this->enroll($otherStudent, $this->class);

        $this->actingAsApi($otherUser)
            ->getJson("/api/v1/submissions/{$submissionId}/review")
            ->assertStatus(403);
    }

    public function test_tutor_reviews_student_paper_with_full_answer_key(): void
    {
        [$assignment, $questions] = $this->createExam();
        $this->assignment = $assignment;

        $single = $questions[0];
        $created = $this->postSubmission([
            ['question_id' => $single->hash_id, 'option_id' => $single->options->firstWhere('is_correct', true)->hash_id],
        ]);
        $submissionId = $created->json('data._id');

        $payload = $this->actingAsApi($this->tutor)
            ->getJson("/api/v1/submissions/{$submissionId}/review")
            ->assertStatus(200)
            ->json('data');

        $this->assertTrue($payload['expose_correct']);
        $this->assertNotNull($payload['responses'][0]['meta']['correct_option_ids']);
    }

    public function test_sync_persists_sections_and_binds_questions(): void
    {
        [$assignment, $questions] = $this->createExam();

        $this->assertSame(1, $assignment->sections()->count());
        $section = $assignment->sections()->first();
        $this->assertSame('Part 1', $section->title);
        $this->assertSame('listening', $section->section_type);
        $this->assertSame(3, $section->questions()->count());

        // Take payload (student-facing) carries sections + questions with section_id linkage.
        $take = AssignmentQuizService::transformSections($assignment);
        $this->assertSame('listening', $take[0]['section_type']);
        $this->assertSame($section->hash_id, $take[0]['_id']);
    }
}
