<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class AssignRolesToUsersSeeder extends Seeder
{
    /**
     * Assign roles to existing users based on their 'role' column.
     * Roles: Super Admin, Admin, Tutor, Student, Parent.
     */
    public function run(): void
    {
        $this->command->info('Gán vai trò cho users...');

        $roles = [
            'super_admin' => 'Super Admin',
            'admin' => 'Admin',
            'tutor' => 'Tutor',
            'student' => 'Student',
            'parent' => 'Parent',
        ];

        foreach ($roles as $roleSlug => $roleLabel) {
            $count = 0;
            // Tìm user có column role = slug (ví dụ 'tutor')
            User::where('role', $roleSlug)->each(function ($user) use ($roleSlug, &$count) {
                if (! $user->hasRole($roleSlug)) {
                    $user->assignRole($roleSlug);
                    $count++;
                }
            });

            if ($count > 0) {
                $this->command->info("  ✅ Gán vai trò '{$roleSlug}' thành công {$count} users.");
            } else {
                $this->command->info("  ℹ️ Không tìm thấy users có vai trò '{$roleSlug}' (hoặc đã gán).");
            }
        }

        $this->command->info('✅ Gán vai trò thành công!');
    }
}
