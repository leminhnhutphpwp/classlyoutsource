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
 * GET /api/v1/assignments/{assignment}/skill-report — the tutor's per-skill progress dashboard.
 * Guards: staff-only (enrolled students get 404), and the aggregation groups earned/max points
 * by the section_type of each question's section (flat quizzes fall into "general").
 */
class AssignmentSkillReportTest extends TestCase
{
    private ClassRoom $class;

    private User $tutor;

    private Student $student;

    private User $studentUser;

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

        // Exam with one listening section (2 questions) and one reading section (1 question).
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
                'title' => 'Complete: The fee is {{1}} dollars.',
                'question_type' => 'gap_fill',
                'points' => 2,
                'options' => [['label' => '1', 'content' => '450', 'is_correct' => true]],
            ],
            [
                'title' => 'Read and decide the heading.',
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
        $this->assignment->refresh();
    }

    private function submit(array $answers): void
    {
        $this->actingAsApi($this->studentUser)
            ->postJson('/api/v1/submissions', [
                'assignment_id' => $this->assignment->hash_id,
                'started_at' => now()->subMinutes(5)->toISOString(),
                'answers' => $answers,
            ])->assertStatus(201);
    }

    public function test_tutor_gets_per_skill_aggregation_for_the_class(): void
    {
        $questions = $this->assignment->questions()->orderBy('order')->get();
        $correct = $questions[0]->options->firstWhere('is_correct', true);

        // Student: full marks on the single_choice (listening), half on gap_fill, zero on matching.
        $this->submit([
            ['question_id' => $questions[0]->hash_id, 'option_id' => $correct->hash_id],   // 2/2 listening
            ['question_id' => $questions[1]->hash_id, 'response' => ['1' => '999']],        // 0/2 listening
            ['question_id' => $questions[2]->hash_id, 'response' => []],                    // 0/4 reading
        ]);

        $response = $this->actingAsApi($this->tutor)
            ->getJson("/api/v1/assignments/{$this->assignment->hash_id}/skill-report");

        $response->assertStatus(200);
        $payload = $response->json('data');

        $this->assertCount(1, $payload['students']);
        $student = $payload['students'][0];
        $this->assertSame($this->student->hash_id, $student['student_id']);
        $this->assertSame(1, $student['attempt_count']);

        $bySkill = collect($student['skills'])->keyBy(fn ($s) => $s['type']);
        // Response shape: list of skill rows with earned/possible/percent.
        $listening = $bySkill->get('listening');
        $this->assertNotNull($listening);
        $this->assertEquals(2.0, (float) $listening['earned']);
        $this->assertEquals(4.0, (float) $listening['possible']);
        $this->assertSame(50, (int) $listening['percent']);

        $reading = $bySkill->get('reading');
        $this->assertNotNull($reading);
        $this->assertEquals(0.0, (float) $reading['earned']);
        $this->assertEquals(4.0, (float) $reading['possible']);

        // Whole-exam totals: 2/8 = 25%.
        $this->assertEquals(2.0, (float) $student['earned']);
        $this->assertEquals(8.0, (float) $student['possible']);
        $this->assertSame(25, (int) $student['percent']);
    }

    public function test_enrolled_student_cannot_read_the_class_skill_report(): void
    {
        $this->actingAsApi($this->studentUser)
            ->getJson("/api/v1/assignments/{$this->assignment->hash_id}/skill-report")
            ->assertStatus(404);
    }

    public function test_report_is_empty_when_no_one_has_submitted(): void
    {
        $response = $this->actingAsApi($this->tutor)
            ->getJson("/api/v1/assignments/{$this->assignment->hash_id}/skill-report");

        $response->assertStatus(200);
        $this->assertSame([], $response->json('data.students'));
    }

    public function test_other_class_tutor_cannot_read_the_report(): void
    {
        $otherTutor = $this->tutor();

        $this->actingAsApi($otherTutor)
            ->getJson("/api/v1/assignments/{$this->assignment->hash_id}/skill-report")
            ->assertStatus(404);
    }
}
