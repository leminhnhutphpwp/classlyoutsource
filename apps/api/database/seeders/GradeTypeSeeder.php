<?php

namespace Database\Seeders;

use App\Models\GradeType;
use Illuminate\Database\Seeder;

class GradeTypeSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $types = [
            ['name' => 'Điểm miệng', 'code' => 'ORAL', 'weight' => 1, 'description' => 'Kiểm tra miệng'],
            ['name' => 'Điểm 15 phút', 'code' => '15MIN', 'weight' => 1, 'description' => 'Kiểm tra 15 phút'],
            ['name' => 'Điểm 1 tiết', 'code' => '45MIN', 'weight' => 2, 'description' => 'Kiểm tra 45 phút'],
            ['name' => 'Điểm giữa kỳ', 'code' => 'MID', 'weight' => 2, 'description' => 'Thi giữa kỳ'],
            ['name' => 'Điểm cuối kỳ', 'code' => 'FINAL', 'weight' => 3, 'description' => 'Thi cuối kỳ'],
            ['name' => 'Điểm chuyên cần', 'code' => 'ATTENDANCE', 'weight' => 1, 'description' => 'Điểm điểm danh'],
        ];

        foreach ($types as $type) {
            GradeType::updateOrCreate(
                ['code' => $type['code']],
                $type
            );
        }

        $this->command->info('✅ Tạo GradeTypes thành công '.count($types));
    }
}
