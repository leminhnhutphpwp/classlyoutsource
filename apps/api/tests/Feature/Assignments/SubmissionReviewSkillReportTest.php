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
 * GET /api/v1/submissions/{submission}/review — skill_report block.
 * Guards: the owning student and class staff both see the per-skill aggregate; another
 * student gets 403 (fail closed); an unscored attempt gets skill_report = null (FE shows
 * the "waiting for grading" state instead of an empty dashboard).
 */
class SubmissionReviewSkillReportTest extends TestCase
{
    private ClassRoom $class;

    private User $tutor;

    private Student $student;

    private User $studentUser;

    private User $otherStudentUser;

    private Assignment $assignment;

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

        $otherUser = $this->studentUser();
        $this->otherStudentUser = $otherUser;
        Student::factory()->create([
            'user_id' => $otherUser->id,
            'class_id' => $this->class->id,
        ]);
        $this->enroll(Student::where('user_id', $otherUser->id)->first(), $this->class);

        $this->assignment = Assignment::factory()->published()->create([
            'class_id' => $this->class->id,
            'tutor_id' => $this->tutor->id,
            'mode' => 'quiz',
            'due_date' => now()->addDays(7),
            'deadline' => now()->addDays(7)->setTime(23, 59),
            'allow_late_submission' => true,
        ]);

        AssignmentQuizService::syncQuestions($this->assignment, [
            [
                'title' => 'Listen and pick.',
                'question_type' => 'single_choice',
                'points' => 2,
                'options' => [
                    ['content' => 'morning', 'is_correct' => true],
                    ['content' => 'evening', 'is_correct' => false],
                ],
            ],
            [
                'title' => 'Read and decide.',
                'question_type' => 'single_choice',
                'points' => 2,
                'options' => [
                    ['content' => 'true', 'is_correct' => true],
                    ['content' => 'false', 'is_correct' => false],
                ],
            ],
        ], [
            ['_key' => 'l1', 'title' => 'Listening', 'section_type' => 'listening', 'order' => 1],
            ['_key' => 'r1', 'title' => 'Reading', 'section_type' => 'reading', 'order' => 2],
        ]);

        [$listening, $reading] = $this->assignment->sections()->orderBy('order')->get();
        $questions = $this->assignment->questions()->orderBy('order')->get();
        $questions[0]->update(['section_id' => $listening->id]);
        $questions[1]->update(['section_id' => $reading->id]);
        $this->assignment->refresh();
    }

    private function submit(array $answers): string
    {
        $res = $this->actingAsApi($this->studentUser)
            ->postJson('/api/v1/submissions', [
                'assignment_id' => $this->assignment->hash_id,
                'started_at' => now()->subMinutes(5)->toISOString(),
                'answers' => $answers,
            ])->assertStatus(201);

        return $res->json('data._id');
    }

    public function test_review_returns_skill_report_for_owning_student(): void
    {
        $questions = $this->assignment->questions()->orderBy('order')->get();
        $correct = $questions[0]->options->firstWhere('is_correct', true);
        $id = $this->submit([
            ['question_id' => $questions[0]->hash_id, 'option_id' => $correct->hash_id], // 2/2 listening
            ['question_id' => $questions[1]->hash_id], // 0/2 reading
        ]);

        $res = $this->actingAsApi($this->studentUser)
            ->getJson("/api/v1/submissions/{$id}/review")
            ->assertStatus(200);

        $report = $res->json('data.skill_report');
        $this->assertNotNull($report);

        $this->assertEquals(2, $report['overall']['earned']);
        $this->assertEquals(4, $report['overall']['possible']);
        $this->assertSame(50, $report['overall']['percent']);

        $bySkill = collect($report['skills'])->keyBy('type');
        $this->assertSame(100, $bySkill['listening']['percent']);
        $this->assertSame(0, $bySkill['reading']['percent']);
    }

    public function test_review_returns_skill_report_for_tutor(): void
    {
        $questions = $this->assignment->questions()->orderBy('order')->get();
        $correct = $questions[0]->options->firstWhere('is_correct', true);
        $id = $this->submit([
            ['question_id' => $questions[0]->hash_id, 'option_id' => $correct->hash_id],
        ]);

        $res = $this->actingAsApi($this->tutor)
            ->getJson("/api/v1/submissions/{$id}/review")
            ->assertStatus(200);

        $report = $res->json('data.skill_report');
        $this->assertNotNull($report);
        $this->assertSame(50, $report['overall']['percent']);
    }

    public function test_review_other_students_paper_fails_closed(): void
    {
        $questions = $this->assignment->questions()->orderBy('order')->get();
        $correct = $questions[0]->options->firstWhere('is_correct', true);

        // Real graded attempt by the owning student.
        $id = $this->submit([
            ['question_id' => $questions[0]->hash_id, 'option_id' => $correct->hash_id],
        ]);

        $this->actingAsApi($this->otherStudentUser)
            ->getJson("/api/v1/submissions/{$id}/review")
            ->assertStatus(403);
    }

    public function test_unscored_attempt_has_null_skill_report(): void
    {
        // A plain (non-quiz) submission has no question responses → no score → null report.
        $submission = \App\Models\Submission::factory()->create([
            'assignment_id' => $this->assignment->id,
            'student_id' => $this->student->id,
            'status' => 'submitted',
            'score' => null,
            'submission_type' => 'text',
        ]);

        // The review endpoint requires a quiz submission, so use a quiz submission without responses.
        $submission->update(['submission_type' => 'quiz']);

        $res = $this->actingAsApi($this->tutor)
            ->getJson("/api/v1/submissions/{$submission->hash_id}/review")
            ->assertStatus(200);

        $this->assertNull($res->json('data.skill_report'));
    }
}
