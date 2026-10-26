<?php

namespace Database\Seeders;

use App\Models\Subject;
use Illuminate\Database\Seeder;

class SubjectSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $subjects = [
            ['name' => 'Toán Học', 'code' => 'MATH', 'description' => 'Môn Toán'],
            ['name' => 'Vật Lý', 'code' => 'PHYS', 'description' => 'Môn Vật Lý'],
            ['name' => 'Hóa Học', 'code' => 'CHEM', 'description' => 'Môn Hóa Học'],
            ['name' => 'Sinh Học', 'code' => 'BIO', 'description' => 'Môn Sinh Học'],
            ['name' => 'Ngữ Văn', 'code' => 'LIT', 'description' => 'Môn Ngữ Văn'],
            ['name' => 'Tiếng Anh', 'code' => 'ENG', 'description' => 'Môn Tiếng Anh'],
            ['name' => 'Lịch Sử', 'code' => 'HIST', 'description' => 'Môn Lịch Sử'],
            ['name' => 'Địa Lý', 'code' => 'GEO', 'description' => 'Môn Địa Lý'],
            ['name' => 'Giáo Dục Công Dân', 'code' => 'CIVIC', 'description' => 'Môn GDCD'],
            ['name' => 'Tin Học', 'code' => 'IT', 'description' => 'Môn Tin Học'],
            ['name' => 'Âm Nhạc', 'code' => 'MUSIC', 'description' => 'Môn Âm Nhạc'],
            ['name' => 'Mỹ Thuật', 'code' => 'ART', 'description' => 'Môn Mỹ Thuật'],
            ['name' => 'Thể Dục', 'code' => 'PE', 'description' => 'Môn Thể Dục'],
            ['name' => 'Khoa Học Tự Nhiên', 'code' => 'NS', 'description' => 'Khoa học tự nhiên'],
            ['name' => 'Khoa Học Xã Hội', 'code' => 'SS', 'description' => 'Khoa học xã hội'],
            ['name' => 'Tiếng Việt', 'code' => 'VIE', 'description' => 'Tiếng Việt cho tiểu học'],
            ['name' => 'IELTS', 'code' => 'IELTS', 'description' => 'Luyện thi IELTS'],
            ['name' => 'TOEIC', 'code' => 'TOEIC', 'description' => 'Luyện thi TOEIC'],
        ];

        foreach ($subjects as $subject) {
            Subject::updateOrCreate(
                ['code' => $subject['code']],
                $subject
            );
        }

        $this->command->info('✅ Tạo Subjects thành công '.count($subjects));
    }
}
