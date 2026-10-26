<?php

namespace Database\Seeders;

use App\Models\AssignmentType;
use Illuminate\Database\Seeder;

class AssignmentTypeSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $types = [
            ['name' => 'Bài tập về nhà', 'code' => 'HOMEWORK', 'description' => 'Bài tập làm ở nhà'],
            ['name' => 'Kiểm tra 15 phút', 'code' => 'TEST_15', 'description' => 'Kiểm tra ngắn'],
            ['name' => 'Kiểm tra 1 tiết', 'code' => 'TEST_45', 'description' => 'Kiểm tra 45 phút'],
            ['name' => 'Thi giữa kỳ', 'code' => 'MIDTERM', 'description' => 'Thi giữa học kỳ'],
            ['name' => 'Thi cuối kỳ', 'code' => 'FINAL', 'description' => 'Thi cuối học kỳ'],
            ['name' => 'Bài thực hành', 'code' => 'PRACTICE', 'description' => 'Bài tập thực hành'],
            ['name' => 'Dự án', 'code' => 'PROJECT', 'description' => 'Bài tập lớn/Dự án'],
            ['name' => 'Khác', 'code' => 'OTHER', 'description' => 'Các loại bài tập khác'],
        ];

        foreach ($types as $type) {
            AssignmentType::updateOrCreate(
                ['code' => $type['code']],
                $type
            );
        }

        $this->command->info('✅ Tạo Loại Bài Tập thành công '.count($types));
    }
}
