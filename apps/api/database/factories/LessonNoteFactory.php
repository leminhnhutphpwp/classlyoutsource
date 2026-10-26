<?php

namespace Database\Factories;

use App\Models\ClassRoom;
use App\Models\LessonNote;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<LessonNote>
 */
class LessonNoteFactory extends Factory
{
    protected $model = LessonNote::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $topics = [
            'Ôn tập kiến thức cũ',
            'Bài mới: Phương trình bậc 2',
            'Luyện tập nâng cao',
            'Kiểm tra đầu giờ',
            'Ôn thi giữa kỳ',
            'Present Perfect Tense',
            'Reading comprehension',
            'Grammar review',
            'Định luật Newton',
            'Bài tập vận dụng',
        ];

        $studentNotes = [];
        $studentCount = fake()->numberBetween(5, 15);

        for ($i = 1; $i <= $studentCount; $i++) {
            $studentNotes[] = [
                'student_id' => $i,
                'note' => fake()->randomElement([
                    'Tiến bộ tốt',
                    'Cần cố gắng thêm',
                    'Chưa hiểu bài',
                    'Xuất sắc',
                    'Đi học muộn',
                    null,
                ]),
                'behavior' => fake()->randomElement(['excellent', 'good', 'average', 'poor']),
            ];
        }

        return [
            'class_id' => ClassRoom::factory(),
            'tutor_id' => User::factory()->tutor(),
            'lesson_date' => fake()->dateTimeBetween('-2 months', 'now'),
            'topic' => fake()->randomElement($topics),
            'content' => fake()->paragraph(3),
            'homework' => fake()->optional(0.8)->sentence(),
            'observations' => fake()->optional(0.6)->paragraph(),
            'student_notes' => $studentNotes,
            'rating' => fake()->numberBetween(3, 5),
            'attachments' => fake()->optional(0.3)->passthrough(['Sách giáo khoa', 'Bài tập nâng cao', 'Video bài giảng']),
        ];
    }

    /**
     * Indicate that the lesson has high rating.
     */
    public function excellent(): static
    {
        return $this->state(fn (array $attributes) => [
            'rating' => 5,
        ]);
    }
}
