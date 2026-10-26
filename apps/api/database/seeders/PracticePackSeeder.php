<?php

namespace Database\Seeders;

use App\Models\Assignment;
use App\Models\ClassRoom;
use App\Models\Student;
use App\Models\User;
use App\Services\AssignmentQuizService;
use Illuminate\Database\Seeder;

/**
 * Full practice pack for manual testing, seeded into the class of a target student
 * (an.nguyen@example.vn → Toán 10A). Covers every mechanic end-to-end:
 *
 *  1. Quiz with 2 sections — all 7 question types, partial credit, review UI
 *  2. Flat timed quiz (5 minutes, no sections) — countdown + auto-submit
 *  3. Standard essay assignment — text submission, pending manual grade
 *  4. Standard file assignment — upload flow
 *
 * All quizzes allow unlimited attempts so the tester can retry freely.
 */
class PracticePackSeeder extends Seeder
{
    private const TARGET_STUDENT_EMAIL = 'an.nguyen@example.vn';

    public function run(): void
    {
        $class = $this->resolveClass();
        if (! $class) {
            echo "⚠️  Không tìm thấy học viên ".self::TARGET_STUDENT_EMAIL." — bỏ qua PracticePackSeeder.\n";

            return;
        }

        $existing = $class->assignments()->pluck('title')->all();
        $created = 0;

        $created += $this->createIfMissing($class, $existing, 'Đề test 7 dạng câu hỏi', function (ClassRoom $class) {
            return $this->createAllTypesExam($class);
        });

        $created += $this->createIfMissing($class, $existing, 'Quiz nhanh 5 phút — Phương trình bậc nhất', function (ClassRoom $class) {
            return $this->createTimedFlatQuiz($class);
        });

        $created += $this->createIfMissing($class, $existing, 'Đề tự luận — Giải hệ phương trình', function (ClassRoom $class) {
            return $this->createEssayAssignment($class);
        });

        $created += $this->createIfMissing($class, $existing, 'Bài nộp file — Vẽ đồ thị hàm số', function (ClassRoom $class) {
            return $this->createFileAssignment($class);
        });

        if ($created === 0) {
            echo "⏭  Bộ đề test cho {$class->name} đã tồn tại — bỏ qua.\n";

            return;
        }

        echo "✅ Đã tạo {$created} bài test cho lớp {$class->name} (đăng nhập bằng ".self::TARGET_STUDENT_EMAIL." để làm bài).\n\n";
    }

    /** Find the target student's primary class; null when the demo student is missing. */
    private function resolveClass(): ?ClassRoom
    {
        $user = User::where('email', self::TARGET_STUDENT_EMAIL)->first();
        if (! $user) {
            return null;
        }

        $student = Student::where('user_id', $user->id)->orderBy('id')->first();
        if (! $student) {
            return null;
        }

        return $student->classes()->orderBy('id')->first();
    }

    private function createIfMissing(ClassRoom $class, array $existingTitles, string $title, \Closure $factory): int
    {
        foreach ($existingTitles as $existing) {
            if (str_contains($existing, $title)) {
                echo "   ⏭ {$title} — đã có.\n";

                return 0;
            }
        }

        $factory($class);
        echo "   📝 {$title}\n";

        return 1;
    }

    private function baseAttributes(ClassRoom $class, string $title, string $description): array
    {
        return [
            'class_id' => $class->id,
            'tutor_id' => $class->tutor_id,
            'title' => $title.' — '.$class->name,
            'description' => $description,
            'instructions' => $description,
            'assigned_date' => now()->toDateString(),
            'due_date' => now()->addDays(14)->toDateString(),
            'deadline' => now()->addDays(14)->setTime(23, 59),
            'allow_late_submission' => true,
            'status' => 'published',
        ];
    }

    /** Quiz with two sections covering all 7 registered question types (math-themed). */
    private function createAllTypesExam(ClassRoom $class): Assignment
    {
        $assignment = Assignment::create(array_merge($this->baseAttributes(
            $class,
            'Đề test 7 dạng câu hỏi',
            'Bộ đề thử nghiệm đầy đủ 7 dạng: một đáp án, nhiều đáp án, trả lời ngắn, đúng/sai, nối, sắp xếp, điền từ.'
        ), [
            'mode' => 'quiz',
            'max_attempts' => null, // unlimited — the tester can retry freely
        ]));

        AssignmentQuizService::syncQuestions($assignment, [
            // Phần I — Lý thuyết
            ['title' => 'Đồ thị hàm số y = 2x + 3 cắt trục tung tại điểm nào?',
             'question_type' => 'single_choice', 'points' => 2, 'section_key' => 'p1',
             'options' => [
                 ['label' => 'A', 'content' => '(0; 3)', 'is_correct' => true],
                 ['label' => 'B', 'content' => '(3; 0)', 'is_correct' => false],
                 ['label' => 'C', 'content' => '(0; −3)', 'is_correct' => false],
                 ['label' => 'D', 'content' => '(−3; 0)', 'is_correct' => false],
             ]],
            ['title' => 'Hàm số y = −3x + 1 nghịch biến trên ℝ.',
             'question_type' => 'true_false_not_given', 'points' => 1, 'section_key' => 'p1', 'options' => []],
            ['title' => 'Trong các hàm số sau, hàm số nào là hàm bậc nhất? (chọn nhiều đáp án)',
             'question_type' => 'multiple_choice', 'points' => 2, 'section_key' => 'p1',
             'options' => [
                 ['label' => 'A', 'content' => 'y = 2x + 1', 'is_correct' => true],
                 ['label' => 'B', 'content' => 'y = x² + 1', 'is_correct' => false],
                 ['label' => 'C', 'content' => 'y = −x', 'is_correct' => true],
                 ['label' => 'D', 'content' => 'y = 3/x', 'is_correct' => false],
             ]],
            // Phần II — Thực hành
            ['title' => 'Hệ phương trình { x + y = 3 ; x − y = 1 } có nghiệm x = {{1}} và y = {{2}}.',
             'question_type' => 'gap_fill', 'points' => 2, 'section_key' => 'p2',
             'options' => [
                 ['label' => '1', 'content' => '2', 'is_correct' => true],
                 ['label' => '2', 'content' => '1', 'is_correct' => true],
             ]],
            ['title' => 'Nối mỗi hàm số với đặc trưng đồ thị của nó.',
             'question_type' => 'matching', 'points' => 3, 'section_key' => 'p2',
             'options' => [
                 ['label' => 'y = 2x', 'content' => 'Đường thẳng đi qua gốc tọa độ', 'is_correct' => true],
                 ['label' => 'y = x + 1', 'content' => 'Đường thẳng song song với y = x', 'is_correct' => true],
                 ['label' => 'y = x²', 'content' => 'Đường parabol có đỉnh tại gốc tọa độ', 'is_correct' => true],
             ],
             'settings' => ['distractors' => ['Đường tròn bán kính 1', 'Đường hyperbol']]],
            ['title' => 'Sắp xếp các bước giải hệ phương trình bằng phương pháp thế theo đúng thứ tự.',
             'question_type' => 'ordering', 'points' => 2, 'section_key' => 'p2',
             'options' => [
                 ['label' => 'A', 'content' => 'Rút x theo y từ phương trình thứ nhất', 'is_correct' => true],
                 ['label' => 'B', 'content' => 'Thế biểu thức vào phương trình thứ hai', 'is_correct' => true],
                 ['label' => 'C', 'content' => 'Giải phương trình bậc nhất một ẩn', 'is_correct' => true],
                 ['label' => 'D', 'content' => 'Thay ngược lại để tìm ẩn còn lại', 'is_correct' => true],
             ],
             'settings' => ['partial_ordering' => true]],
            ['title' => 'Tập nghiệm của phương trình 2x = 10 là gì? (viết ngắn gọn)',
             'question_type' => 'short_answer', 'points' => 1, 'section_key' => 'p2',
             'options' => [
                 ['label' => 'A', 'content' => 'x = 5', 'is_correct' => true],
                 ['label' => 'A', 'content' => 'x=5', 'is_correct' => true],
                 ['label' => 'A', 'content' => '5', 'is_correct' => true],
                 ['label' => 'A', 'content' => '{5}', 'is_correct' => true],
             ]],
        ], [
            ['_key' => 'p1', 'title' => 'Phần I — Lý thuyết', 'section_type' => 'general',
             'instruction' => 'Chọn đáp án đúng cho các câu hỏi lý thuyết.', 'order' => 1],
            ['_key' => 'p2', 'title' => 'Phần II — Thực hành', 'section_type' => 'general',
             'instruction' => 'Điền từ, nối cặp, sắp xếp bước và trả lời ngắn.', 'order' => 2],
        ]);

        $assignment->update(['quiz_settings' => [
            'auto_grade' => true,
            'shuffle_questions' => false,
            'show_correct_answers' => true, // tester sees the answer key after submitting
            'show_score_to_student' => true,
            'time_limit_minutes' => null,
        ]]);

        return $assignment;
    }

    /** Flat (section-less) quiz with a 5-minute timer: countdown + auto-submit path. */
    private function createTimedFlatQuiz(ClassRoom $class): Assignment
    {
        $assignment = Assignment::create(array_merge($this->baseAttributes(
            $class,
            'Quiz nhanh 5 phút — Phương trình bậc nhất',
            'Bài kiểm tra ngắn có giới hạn thời gian 5 phút. Hết giờ hệ thống tự động nộp bài.'
        ), [
            'mode' => 'quiz',
            'max_attempts' => null,
        ]));

        AssignmentQuizService::syncQuestions($assignment, [
            ['title' => 'Nghiệm của phương trình x + 2 = 5 là:',
             'question_type' => 'single_choice', 'points' => 1,
             'options' => [
                 ['label' => 'A', 'content' => 'x = 2', 'is_correct' => false],
                 ['label' => 'B', 'content' => 'x = 3', 'is_correct' => true],
                 ['label' => 'C', 'content' => 'x = 7', 'is_correct' => false],
                 ['label' => 'D', 'content' => 'x = −3', 'is_correct' => false],
             ]],
            ['title' => 'Trong các số sau, số nào là số nguyên tố? (chọn nhiều)',
             'question_type' => 'multiple_choice', 'points' => 2,
             'options' => [
                 ['label' => 'A', 'content' => '2', 'is_correct' => true],
                 ['label' => 'B', 'content' => '9', 'is_correct' => false],
                 ['label' => 'C', 'content' => '11', 'is_correct' => true],
                 ['label' => 'D', 'content' => '15', 'is_correct' => false],
             ]],
            ['title' => 'Kết quả của 7 × 8 = ?',
             'question_type' => 'short_answer', 'points' => 1,
             'options' => [
                 ['label' => 'A', 'content' => '56', 'is_correct' => true],
             ]],
        ]);

        $assignment->update(['quiz_settings' => [
            'auto_grade' => true,
            'shuffle_questions' => false,
            'show_correct_answers' => true,
            'show_score_to_student' => true,
            'time_limit_minutes' => 5,
        ]]);

        return $assignment;
    }

    /** Standard essay: text submission, stays pending until the tutor grades it. */
    private function createEssayAssignment(ClassRoom $class): Assignment
    {
        return Assignment::create(array_merge($this->baseAttributes(
            $class,
            'Đề tự luận — Giải hệ phương trình',
            "Giải hệ phương trình sau và trình bày từng bước:\n\n2x + y = 5\nx − y = 1"
        ), [
            'mode' => 'standard',
            'max_score' => 10,
            'allowed_submission_types' => ['text'],
        ]));
    }

    /** Standard upload: image/file submission flow. */
    private function createFileAssignment(ClassRoom $class): Assignment
    {
        return Assignment::create(array_merge($this->baseAttributes(
            $class,
            'Bài nộp file — Vẽ đồ thị hàm số',
            "Vẽ đồ thị hàm số y = 2x − 1 trên mặt phẳng tọa độ Oxy.\nChụp ảnh hoặc scan bài làm và nộp file."
        ), [
            'mode' => 'standard',
            'max_score' => 10,
            'allowed_submission_types' => ['file', 'image'],
        ]));
    }
}
