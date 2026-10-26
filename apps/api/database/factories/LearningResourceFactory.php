<?php

namespace Database\Factories;

use App\Models\LearningResource;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<LearningResource>
 */
class LearningResourceFactory extends Factory
{
    protected $model = LearningResource::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $types = ['document', 'video', 'image', 'audio', 'link'];
        $type = fake()->randomElement($types);

        $subjects = ['Toán', 'Văn', 'Anh Văn', 'Hóa Học', 'Vật Lý', 'Sinh Học', 'Lịch Sử', 'Địa Lý'];
        $topics = [
            'Toán' => ['Đại số', 'Hình học', 'Giải tích', 'Xác suất thống kê'],
            'Văn' => ['Văn học', 'Tiếng Việt', 'Làm văn', 'Đọc hiểu'],
            'Anh Văn' => ['Grammar', 'Vocabulary', 'Reading', 'Writing', 'Listening', 'Speaking'],
        ];

        $subject = fake()->randomElement($subjects);
        $topic = $topics[$subject] ?? ['Lý thuyết', 'Bài tập', 'Ôn tập'];

        $gradeLevels = ['Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9', 'Lớp 10', 'Lớp 11', 'Lớp 12', 'IELTS 5.5', 'IELTS 6.5', 'IELTS 7.0'];

        $tags = fake()->randomElements(['cơ bản', 'nâng cao', 'luyện thi', 'ôn tập', 'bài tập', 'video hướng dẫn', 'tài liệu tham khảo'], fake()->numberBetween(1, 3));

        return [
            'title' => $this->generateTitle($type, $subject, $topic),
            'description' => fake()->paragraph(),
            'type' => $type,
            'subject' => $subject,
            'topic' => fake()->randomElement($topic),
            'grade_level' => fake()->randomElement($gradeLevels),
            'tags' => $tags,
            'external_url' => $type === 'link' ? fake()->randomElement([
                'https://www.youtube.com/watch?v='.fake()->regexify('[a-zA-Z0-9]{11}'),
                'https://drive.google.com/file/d/'.fake()->regexify('[a-zA-Z0-9]{33}'),
                'https://www.coursera.org/learn/'.fake()->slug(),
            ]) : null,
            'downloads' => fake()->numberBetween(0, 100),
            'views' => fake()->numberBetween(0, 500),
            'is_public' => fake()->boolean(60), // 60% chance of being public
            'status' => fake()->randomElement(['active', 'active', 'active', 'archived']), // 75% active
        ];
    }

    private function generateTitle(string $type, string $subject, array $topics): string
    {
        $titles = [
            'document' => [
                'Tài liệu '.$subject.' - '.fake()->randomElement($topics),
                'Đề cương '.$subject.' '.fake()->randomElement($topics),
                'Bài giảng '.$subject.' - Chương '.fake()->numberBetween(1, 10),
                'Tóm tắt lý thuyết '.$subject,
            ],
            'video' => [
                'Video hướng dẫn '.$subject.' - '.fake()->randomElement($topics),
                'Bài giảng video '.$subject,
                'Hướng dẫn giải bài tập '.$subject,
            ],
            'image' => [
                'Sơ đồ tư duy '.$subject,
                'Mindmap '.fake()->randomElement($topics),
                'Infographic '.$subject,
            ],
            'audio' => [
                'Bài nghe '.$subject.' - '.fake()->randomElement($topics),
                'Audio lesson '.$subject,
            ],
            'link' => [
                'Link tài liệu '.$subject.' online',
                'Khóa học online '.$subject,
            ],
        ];

        return fake()->randomElement($titles[$type] ?? ['Tài liệu '.$subject]);
    }

    /**
     * Indicate that the resource is created by a specific tutor.
     */
    public function byTutor(int $tutorId): static
    {
        return $this->state(fn (array $attributes) => [
            'tutor_id' => $tutorId,
        ]);
    }

    /**
     * Indicate that the resource is public.
     */
    public function public(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_public' => true,
        ]);
    }

    /**
     * Indicate that the resource is private.
     */
    public function private(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_public' => false,
        ]);
    }
}
