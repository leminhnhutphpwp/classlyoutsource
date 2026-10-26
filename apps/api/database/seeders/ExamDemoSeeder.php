<?php

namespace Database\Seeders;

use App\Models\Assignment;
use App\Models\ClassRoom;
use App\Models\Student;
use App\Models\User;
use App\Services\AssignmentQuizService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Demo exam assignments showcasing the question-type registry end-to-end:
 * IELTS Listening (gap_fill + TFNG), IELTS Reading (TFNG + matching), TOEIC Part 5
 * (single_choice), IELTS Writing (manual-graded short_answer) and IELTS Speaking.
 *
 * Runs after DemoDataSeeder and reuses its org/class/tutor/students; falls back to
 * creating a minimal scope of its own when the demo data is absent.
 */
class ExamDemoSeeder extends Seeder
{
    public function run(): void
    {
        [$class, $tutor, $students] = $this->resolveScope();

        if ($class->assignments()->where('mode', 'quiz')->where('title', 'like', 'IELTS %')->exists()) {
            echo "⏭  Đề mẫu IELTS/TOEIC đã tồn tại — bỏ qua.\n\n";

            return;
        }

        $this->seedIeltsListening($class, $tutor, $students);
        $this->seedIeltsReading($class, $tutor, $students);
        $this->seedToeicPart5($class, $tutor, $students);
        $this->seedIeltsWriting($class, $tutor, $students);
        $this->seedIeltsSpeaking($class, $tutor, $students);

        echo "✅ Đã tạo 5 đề mẫu luyện thi (IELTS Listening/Reading/Writing/Speaking + TOEIC Part 5).\n\n";
    }

    /** @return array{0: ClassRoom, 1: User, 2: array<int, Student>} */
    private function resolveScope(): array
    {
        // Idempotent: reuse the demo tutor/class when present, otherwise create a small
        // standalone scope — the seeder must be re-runnable without unique-constraint errors.
        $tutor = User::firstOrCreate(
            ['email' => 'exam-demo@classly.io.vn'],
            [
                'name' => 'Gia sư luyện thi',
                'password' => Hash::make('Classly@2024'),
                'role' => 'tutor',
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );
        if (! $tutor->hasRole('tutor')) {
            $tutor->assignRole('tutor');
        }

        $class = ClassRoom::firstOrCreate(
            ['tutor_id' => $tutor->id, 'name' => 'Lớp Luyện Thi IELTS Demo'],
            [
                'subject' => 'Anh Văn',
                'start_date' => now()->toDateString(),
                'end_date' => now()->addMonths(3)->toDateString(),
                'status' => 'active',
                'max_students' => 20,
            ]
        );

        $students = $class->students()->get()->all();
        if (count($students) === 0) {
            $studentUser = User::firstOrCreate(
                ['email' => 'exam-student-demo@classly.io.vn'],
                [
                    'name' => 'Học viên Demo Thi',
                    'password' => Hash::make('Classly@2024'),
                    'role' => 'student',
                    'status' => 'active',
                    'email_verified_at' => now(),
                ]
            );
            if (! $studentUser->hasRole('student')) {
                $studentUser->assignRole('student');
            }

            $student = Student::firstOrCreate(
                ['user_id' => $studentUser->id],
                [
                    'created_by' => $tutor->id,
                    'name' => 'Học viên Demo Thi',
                    'email' => $studentUser->email,
                    'status' => 'active',
                ]
            );
            $class->students()->syncWithoutDetaching([
                $student->id => ['enrolled_at' => now(), 'status' => 'active', 'is_paused' => false],
            ]);
            $student->update(['class_id' => $class->id]);
            $students = [$student];
        }

        return [$class, $tutor, $students];
    }

    private function createExam(
        ClassRoom $class,
        User $tutor,
        array $students,
        string $title,
        string $description,
        array $sections,
        array $questions,
        array $settings = [],
    ): Assignment {
        $assignment = Assignment::create([
            'class_id' => $class->id,
            'tutor_id' => $tutor->id,
            'title' => $title,
            'description' => $description,
            'instructions' => $description,
            'assigned_date' => now()->toDateString(),
            'due_date' => now()->addDays(14)->toDateString(),
            'deadline' => now()->addDays(14)->setTime(23, 59),
            'allow_late_submission' => true,
            'status' => 'published',
            'mode' => 'quiz',
            'allowed_submission_types' => ['quiz'],
            'max_score' => 0,
        ]);

        AssignmentQuizService::syncQuestions($assignment, $questions, $sections);
        $assignment->update(['quiz_settings' => array_merge([
            'auto_grade' => true,
            'shuffle_questions' => false,
            'show_correct_answers' => false,
            'show_score_to_student' => true,
            'time_limit_minutes' => null,
        ], $settings)]);

        echo "   📝 {$title} — ".count($questions)." câu, ".count($sections)." phần\n";

        return $assignment;
    }

    private function seedIeltsListening(ClassRoom $class, User $tutor, array $students): void
    {
        $sections = [
            ['_key' => 'p1', 'section_type' => 'listening', 'title' => 'Part 1: Complete the notes (Questions 1-3)',
             'instruction' => 'Listen to the conversation between a student and a housing officer. Complete the notes below with NO MORE THAN TWO WORDS.', 'order' => 1],
            ['_key' => 'p2', 'section_type' => 'listening', 'title' => 'Part 2: TRUE / FALSE / NOT GIVEN (Questions 4-5)',
             'instruction' => 'Decide whether the following statements agree with the information given in the recording.', 'order' => 2],
        ];

        $questions = [
            ['title' => 'The rental fee is {{1}} dollars per month, paid on the {{2}} of each month.',
             'question_type' => 'gap_fill', 'points' => 2, 'section_key' => 'p1',
             'options' => [
                 ['label' => '1', 'content' => '450', 'is_correct' => true],
                 ['label' => '1', 'content' => 'four hundred and fifty', 'is_correct' => true],
                 ['label' => '2', 'content' => 'first', 'is_correct' => true],
             ]],
            ['title' => 'The deposit is refundable at the end of the contract.',
             'question_type' => 'true_false_not_given', 'points' => 1, 'section_key' => 'p2', 'options' => []],
            ['title' => 'Gas and electricity bills are included in the rental fee.',
             'question_type' => 'true_false_not_given', 'points' => 1, 'section_key' => 'p2', 'options' => []],
        ];

        $this->createExam($class, $tutor, $students, 'IELTS Listening — Part 1 & 2 (Demo)', 'Mô phỏng IELTS Listening: điền từ + True/False/Not Given.', $sections, $questions);
    }

    private function seedIeltsReading(ClassRoom $class, User $tutor, array $students): void
    {
        $sections = [
            ['_key' => 'p1', 'section_type' => 'reading', 'title' => 'Passage 1: TRUE / FALSE / NOT GIVEN (Questions 1-2)',
             'instruction' => 'Read the passage about urban beekeeping and decide if the statements agree with the writer\'s claims.', 'order' => 1],
            ['_key' => 'p2', 'section_type' => 'reading', 'title' => 'Passage 2: Match each paragraph with a heading (Question 3)',
             'instruction' => 'Choose the correct heading for each paragraph from the list of headings below.', 'order' => 2],
        ];

        $questions = [
            ['title' => 'Beekeepers in cities report healthier colonies than rural ones.',
             'question_type' => 'true_false_not_given', 'points' => 1, 'section_key' => 'p1', 'options' => []],
            ['title' => 'The writer believes urban beekeeping is only a passing trend.',
             'question_type' => 'true_false_not_given', 'points' => 1, 'section_key' => 'p1', 'options' => []],
            ['title' => 'Nối mỗi đoạn với tiêu đề phù hợp.',
             'question_type' => 'matching', 'points' => 3, 'section_key' => 'p2',
             'options' => [
                 ['label' => 'Paragraph A — lịch sử nuôi ong đô thị', 'content' => 'The origins of urban apiculture', 'is_correct' => true],
                 ['label' => 'Paragraph B — lợi ích với cây trồng', 'content' => 'Benefits for city gardens', 'is_correct' => true],
                 ['label' => 'Paragraph C — rủi ro và quy định', 'content' => 'Safety rules and public concerns', 'is_correct' => true],
             ],
             'settings' => ['distractors' => ['A return to rural farms', 'The cost of honey production']]],
        ];

        $this->createExam($class, $tutor, $students, 'IELTS Reading — Passage 1 & 2 (Demo)', 'Mô phỏng IELTS Reading: TFNG + Matching Headings.', $sections, $questions);
    }

    private function seedToeicPart5(ClassRoom $class, User $tutor, array $students): void
    {
        $sections = [
            ['_key' => 'p5', 'section_type' => 'general', 'title' => 'TOEIC Part 5: Incomplete Sentences (Questions 1-3)',
             'instruction' => 'Choose the word or phrase that best completes the sentence.', 'order' => 1],
        ];

        $questions = [
            ['title' => 'All employees are required to ____ their timesheets by Friday.',
             'question_type' => 'single_choice', 'points' => 1, 'section_key' => 'p5',
             'options' => [
                 ['label' => 'A', 'content' => 'submit', 'is_correct' => true],
                 ['label' => 'B', 'content' => 'submission', 'is_correct' => false],
                 ['label' => 'C', 'content' => 'submitting', 'is_correct' => false],
                 ['label' => 'D', 'content' => 'submissive', 'is_correct' => false],
             ]],
            ['title' => 'The seminar on marketing strategy was ____ attended by managers.',
             'question_type' => 'single_choice', 'points' => 1, 'section_key' => 'p5',
             'options' => [
                 ['label' => 'A', 'content' => 'heavily', 'is_correct' => true],
                 ['label' => 'B', 'content' => 'heavy', 'is_correct' => false],
                 ['label' => 'C', 'content' => 'heavier', 'is_correct' => false],
                 ['label' => 'D', 'content' => 'heaviness', 'is_correct' => false],
             ]],
            ['title' => 'Ms. Nguyen has been ____ to the position of regional director.',
             'question_type' => 'single_choice', 'points' => 1, 'section_key' => 'p5',
             'options' => [
                 ['label' => 'A', 'content' => 'promoted', 'is_correct' => true],
                 ['label' => 'B', 'content' => 'promoting', 'is_correct' => false],
                 ['label' => 'C', 'content' => 'promotional', 'is_correct' => false],
                 ['label' => 'D', 'content' => 'promotion', 'is_correct' => false],
             ]],
        ];

        $this->createExam($class, $tutor, $students, 'TOEIC Part 5 — Grammar (Demo)', 'Mô phỏng TOEIC Part 5: chọn từ đúng.', $sections, $questions);
    }

    private function seedIeltsWriting(ClassRoom $class, User $tutor, array $students): void
    {
        $sections = [
            ['_key' => 'task2', 'section_type' => 'writing', 'title' => 'IELTS Writing Task 2 (min 250 words)',
             'instruction' => 'You should spend about 40 minutes on this task. Write about the following topic and give your own opinion with relevant examples.', 'order' => 1],
        ];

        $questions = [
            ['title' => 'Some people believe that universities should only offer places to students with the highest grades, while others think everyone deserves access to higher education. Discuss both views and give your own opinion.',
             'question_type' => 'short_answer', 'points' => 10, 'section_key' => 'task2',
             'options' => []],
        ];

        $this->createExam(
            $class, $tutor, $students,
            'IELTS Writing — Task 2 (Demo, chấm thủ công)',
            'Bài viết 250 chữ — bài nộp sẽ ở trạng thái chờ giáo viên chấm.',
            $sections, $questions,
            ['auto_grade' => false]
        );
    }

    private function seedIeltsSpeaking(ClassRoom $class, User $tutor, array $students): void
    {
        $sections = [
            ['_key' => 'part1', 'section_type' => 'speaking', 'title' => 'IELTS Speaking Part 1: Introduction & Interview',
             'instruction' => 'Record your answers for each question. Speak for 20-30 seconds per answer.', 'order' => 1],
        ];

        $questions = [
            ['title' => 'Describe your hometown and say what visitors usually do there.',
             'question_type' => 'short_answer', 'points' => 2, 'section_key' => 'part1', 'options' => []],
            ['title' => 'Do you prefer studying in the morning or in the evening? Why?',
             'question_type' => 'short_answer', 'points' => 2, 'section_key' => 'part1', 'options' => []],
        ];

        $this->createExam(
            $class, $tutor, $students,
            'IELTS Speaking — Part 1 (Demo, chấm thủ công)',
            'Câu hỏi phỏng vấn Part 1 — học viên trả lời, giáo viên chấm theo band.',
            $sections, $questions,
            ['auto_grade' => false]
        );
    }
}
