<?php

namespace Database\Seeders;

use App\Models\GradeLevel;
use Illuminate\Database\Seeder;

class GradeLevelSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $levels = [
            ['name' => 'Lớp 1', 'code' => 'G1', 'level' => 1, 'group' => 'primary'],
            ['name' => 'Lớp 2', 'code' => 'G2', 'level' => 2, 'group' => 'primary'],
            ['name' => 'Lớp 3', 'code' => 'G3', 'level' => 3, 'group' => 'primary'],
            ['name' => 'Lớp 4', 'code' => 'G4', 'level' => 4, 'group' => 'primary'],
            ['name' => 'Lớp 5', 'code' => 'G5', 'level' => 5, 'group' => 'primary'],
            ['name' => 'Lớp 6', 'code' => 'G6', 'level' => 6, 'group' => 'secondary'],
            ['name' => 'Lớp 7', 'code' => 'G7', 'level' => 7, 'group' => 'secondary'],
            ['name' => 'Lớp 8', 'code' => 'G8', 'level' => 8, 'group' => 'secondary'],
            ['name' => 'Lớp 9', 'code' => 'G9', 'level' => 9, 'group' => 'secondary'],
            ['name' => 'Lớp 10', 'code' => 'G10', 'level' => 10, 'group' => 'high_school'],
            ['name' => 'Lớp 11', 'code' => 'G11', 'level' => 11, 'group' => 'high_school'],
            ['name' => 'Lớp 12', 'code' => 'G12', 'level' => 12, 'group' => 'high_school'],
            ['name' => 'Đại Học', 'code' => 'UNI', 'level' => 13, 'group' => 'university'],
            ['name' => 'Người Đi Làm', 'code' => 'ADULT', 'level' => 14, 'group' => 'adult'],
            ['name' => 'Khác', 'code' => 'OTHER', 'level' => 0, 'group' => 'other'],
        ];

        foreach ($levels as $level) {
            GradeLevel::updateOrCreate(
                ['code' => $level['code']],
                $level
            );
        }

        $this->command->info('✅ Tạo GradeLevels thành công '.count($levels));
    }
}
