<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class PermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // 1. Tạo đầy đủ tất cả permission mà hệ thống tham chiếu
        $this->ensurePermissions($this->getAllPermissionNames());

        // 2. Tạo roles (idempotent)
        $superAdmin = Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
        $admin = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $tutor = Role::firstOrCreate(['name' => 'tutor', 'guard_name' => 'web']);
        $student = Role::firstOrCreate(['name' => 'student', 'guard_name' => 'web']);
        $parent = Role::firstOrCreate(['name' => 'parent', 'guard_name' => 'web']);

        $this->command->info('✅ Đã tạo Roles: super_admin, admin, tutor, student, parent');

        // 3. Gán permissions cho từng role
        // Super Admin: TẤT CẢ PERMISSIONS (guard web)
        $allPermissions = Permission::where('guard_name', 'web')->get();
        $superAdmin->syncPermissions($allPermissions);
        $this->command->info("   Super Admin: {$allPermissions->count()} permissions");

        // Admin: Quản lý hệ thống (tương tự super_admin nhưng có thể giới hạn)
        $adminPermissions = $this->getPermissionsForGuard([
            // Users
            'view_user', 'view_any_user', 'create_user', 'update_user', 'delete_user',

            // Classes
            'view_class::room', 'view_any_class::room', 'create_class::room', 'update_class::room', 'delete_class::room',

            // Students
            'view_student', 'view_any_student', 'create_student', 'update_student', 'delete_student',
            'restore_student', 'restore_any_student',

            // Attendance
            'view_attendance', 'view_any_attendance', 'create_attendance', 'update_attendance', 'delete_attendance',

            // Payments
            'view_payment', 'view_any_payment', 'create_payment', 'update_payment',

            // Payment Requests (chỉ một lần)
            'view_payment::request', 'view_any_payment::request', 'create_payment::request',
            'update_payment::request', 'delete_payment::request',

            // Assignments
            'view_assignment', 'view_any_assignment', 'create_assignment', 'update_assignment', 'delete_assignment',

            // Submissions
            'view_submission', 'view_any_submission', 'update_submission', 'delete_submission',

            // Grades
            'view_grade', 'view_any_grade', 'create_grade', 'update_grade', 'delete_grade',

            // Lesson Notes
            'view_lesson::note', 'view_any_lesson::note', 'create_lesson::note', 'update_lesson::note', 'delete_lesson::note',

            // Notifications
            'view_notification', 'view_any_notification', 'create_notification', 'update_notification', 'delete_notification',

            // Learning Resources
            'view_learning::resource', 'view_any_learning::resource', 'create_learning::resource',
            'update_learning::resource', 'delete_learning::resource',

            // Schedules
            'view_schedule', 'view_any_schedule', 'create_schedule', 'update_schedule', 'delete_schedule',

            // Enrollments
            'view_enrollment', 'view_any_enrollment', 'create_enrollment', 'update_enrollment', 'delete_enrollment',

            // Settings
            'view_setting', 'view_any_setting', 'create_setting', 'update_setting', 'delete_setting',

            // Media
            'view_media', 'view_any_media', 'create_media', 'update_media', 'delete_media',

            // Master Data
            'view_subject', 'view_any_subject', 'create_subject', 'update_subject', 'delete_subject',
            'view_grade::level', 'view_any_grade::level', 'create_grade::level', 'update_grade::level', 'delete_grade::level',
            'view_assignment::type', 'view_any_assignment::type', 'create_assignment::type', 'update_assignment::type', 'delete_assignment::type',
            'view_grade::type', 'view_any_grade::type', 'create_grade::type', 'update_grade::type', 'delete_grade::type',

            // Login Activities
            'view_login::activity', 'view_any_login::activity',

            // Reminders
            'view_reminder',
        ]);
        $admin->syncPermissions($adminPermissions);
        $this->command->info("   Admin: {$adminPermissions->count()} permissions");

        // Tutor: Quản lý lớp học, học viên, bài tập của chính họ
        $tutorPermissions = $this->getPermissionsForGuard([
            // Classes (chỉ lớp của họ)
            'view_class::room', 'view_any_class::room', 'create_class::room', 'update_class::room', 'delete_class::room',

            // Students (học viên trong lớp của họ)
            'view_student', 'view_any_student', 'create_student', 'update_student',

            // Attendance (lớp của họ)
            'view_attendance', 'view_any_attendance', 'create_attendance', 'update_attendance',

            // Payments (lớp của họ)
            'view_payment', 'view_any_payment', 'create_payment', 'update_payment',

            // Assignments (lớp của họ)
            'view_assignment', 'view_any_assignment', 'create_assignment', 'update_assignment', 'delete_assignment',

            // Submissions (lớp của họ)
            'view_submission', 'view_any_submission', 'update_submission',

            // Grades (học viên của họ)
            'view_grade', 'view_any_grade', 'create_grade', 'update_grade',

            // Lesson Notes (lớp của họ)
            'view_lesson::note', 'view_any_lesson::note', 'create_lesson::note', 'update_lesson::note', 'delete_lesson::note',

            // Notifications (gửi cho học viên của họ)
            'view_notification', 'view_any_notification', 'create_notification', 'update_notification', 'delete_notification',

            // Learning Resources (của họ)
            'view_learning::resource', 'view_any_learning::resource', 'create_learning::resource',
            'update_learning::resource', 'delete_learning::resource',

            // Schedules (lớp của họ)
            'view_schedule', 'view_any_schedule', 'create_schedule', 'update_schedule', 'delete_schedule',

            // Enrollments (lớp của họ)
            'view_enrollment', 'view_any_enrollment', 'create_enrollment', 'update_enrollment', 'delete_enrollment',

            // Media
            'view_media', 'view_any_media', 'create_media', 'update_media', 'delete_media',

            // Master Data (xem và quản lý để sử dụng)
            'view_subject', 'view_any_subject', 'create_subject', 'update_subject', 'delete_subject',
            'view_grade::level', 'view_any_grade::level', 'create_grade::level', 'update_grade::level', 'delete_grade::level',
            'view_assignment::type', 'view_any_assignment::type', 'create_assignment::type', 'update_assignment::type', 'delete_assignment::type',
            'view_grade::type', 'view_any_grade::type', 'create_grade::type', 'update_grade::type', 'delete_grade::type',

            // Login Activities
            'view_login::activity', 'view_student_login::activity',

            // Reminders
            'view_reminder',
        ]);
        $tutor->syncPermissions($tutorPermissions);
        $this->command->info("   Tutor: {$tutorPermissions->count()} permissions");

        // Student: Chỉ xem dữ liệu của chính họ
        $studentPermissions = $this->getPermissionsForGuard([
            // Classes: các lớp họ tham gia
            'view_class::room',

            // Students: chỉ thông tin của chính họ
            'view_student',

            // Attendance: chỉ điểm danh của chính họ
            'view_attendance',

            // Assignments: từ các lớp họ tham gia
            'view_assignment',

            // Submissions: chỉ bài nộp của chính họ
            'view_submission',
            'create_submission', // Có thể nộp bài
            'update_submission', // Có thể sửa bài nộp (nếu chưa chấm)
            'delete_submission', // Có thể xóa bài nộp (nếu chưa chấm)

            // Grades: chỉ điểm của chính họ
            'view_grade',

            // Schedules: từ các lớp họ tham gia
            'view_schedule',

            // Lesson Notes: từ các lớp họ tham gia
            'view_lesson::note',

            // Learning Resources: từ các lớp họ tham gia
            'view_learning::resource',

            // Notifications: chỉ notifications có target là 'student' hoặc 'all'
            'view_notification',

            // Payments: chỉ payments của chính họ
            'view_payment',

            // Master Data: cần để hiển thị thông tin
            'view_subject',
            'view_grade::level',
            'view_assignment::type',
            'view_grade::type',

            // Login Activities
            'view_login::activity',

            // Reminders
            'view_reminder',
        ]);
        $student->syncPermissions($studentPermissions);
        $this->command->info("   Student: {$studentPermissions->count()} permissions");

        // Parent: Xem thông tin con cái (tương tự student nhưng có thể xem nhiều học viên)
        $parentPermissions = $this->getPermissionsForGuard([
            // Classes: các lớp con cái tham gia
            'view_class::room',

            // Students: thông tin con cái
            'view_student',

            // Attendance: điểm danh của con cái
            'view_attendance',

            // Assignments: từ các lớp con cái tham gia
            'view_assignment',

            // Submissions: bài nộp của con cái
            'view_submission',

            // Grades: điểm của con cái
            'view_grade',

            // Schedules: từ các lớp con cái tham gia
            'view_schedule',

            // Lesson Notes: từ các lớp con cái tham gia
            'view_lesson::note',

            // Learning Resources: từ các lớp con cái tham gia
            'view_learning::resource',

            // Notifications: chỉ notifications có target là 'parent', 'student' hoặc 'all'
            'view_notification',

            // Payments: payments của con cái
            'view_payment',

            // Master Data: cần để hiển thị thông tin
            'view_subject',
            'view_grade::level',
            'view_assignment::type',
            'view_grade::type',

            // Login Activities
            'view_login::activity',

            // Reminders
            'view_reminder',
        ]);
        $parent->syncPermissions($parentPermissions);
        $this->command->info("   Parent: {$parentPermissions->count()} permissions");

        $this->command->info('');
        $this->command->info('✅ Permission Seeder hoàn thành!');
    }

    /**
     * Tạo các permission nếu chưa tồn tại (idempotent).
     */
    private function ensurePermissions(array $permissions): void
    {
        foreach ($permissions as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }
    }

    /**
     * Lấy danh sách Permission đã tồn tại cho một guard cụ thể.
     */
    private function getPermissionsForGuard(array $names, string $guard = 'web')
    {
        return Permission::whereIn('name', $names)
            ->where('guard_name', $guard)
            ->get();
    }

    /**
     * Danh sách đầy đủ tất cả permission mà hệ thống tham chiếu.
     * Đưa toàn bộ vào ensurePermissions() để đảm bảo chúng tồn tại trước khi sync roles.
     */
    private function getAllPermissionNames(): array
    {
        return [
            // User
            'view_user', 'view_any_user', 'create_user', 'update_user', 'delete_user',
            // Class
            'view_class::room', 'view_any_class::room', 'create_class::room', 'update_class::room', 'delete_class::room',
            // Student
            'view_student', 'view_any_student', 'create_student', 'update_student', 'delete_student',
            'restore_student', 'restore_any_student',
            // Attendance
            'view_attendance', 'view_any_attendance', 'create_attendance', 'update_attendance', 'delete_attendance',
            // Payment
            'view_payment', 'view_any_payment', 'create_payment', 'update_payment', 'delete_payment',
            // Payment Request
            'view_payment::request', 'view_any_payment::request', 'create_payment::request',
            'update_payment::request', 'delete_payment::request',
            // Assignment
            'view_assignment', 'view_any_assignment', 'create_assignment', 'update_assignment', 'delete_assignment',
            // Submission
            'view_submission', 'view_any_submission', 'create_submission', 'update_submission', 'delete_submission',
            // Grade
            'view_grade', 'view_any_grade', 'create_grade', 'update_grade', 'delete_grade',
            // Lesson Note
            'view_lesson::note', 'view_any_lesson::note', 'create_lesson::note', 'update_lesson::note', 'delete_lesson::note',
            // Notification
            'view_notification', 'view_any_notification', 'create_notification', 'update_notification', 'delete_notification',
            // Learning Resource
            'view_learning::resource', 'view_any_learning::resource', 'create_learning::resource',
            'update_learning::resource', 'delete_learning::resource',
            // Schedule
            'view_schedule', 'view_any_schedule', 'create_schedule', 'update_schedule', 'delete_schedule',
            // Enrollment
            'view_enrollment', 'view_any_enrollment', 'create_enrollment', 'update_enrollment', 'delete_enrollment',
            // Setting
            'view_setting', 'view_any_setting', 'create_setting', 'update_setting', 'delete_setting',
            // Media
            'view_media', 'view_any_media', 'create_media', 'update_media', 'delete_media',
            // Subject
            'view_subject', 'view_any_subject', 'create_subject', 'update_subject', 'delete_subject',
            // Grade Level
            'view_grade::level', 'view_any_grade::level', 'create_grade::level', 'update_grade::level', 'delete_grade::level',
            // Assignment Type
            'view_assignment::type', 'view_any_assignment::type', 'create_assignment::type',
            'update_assignment::type', 'delete_assignment::type',
            // Grade Type
            'view_grade::type', 'view_any_grade::type', 'create_grade::type', 'update_grade::type', 'delete_grade::type',
            // Login Activity
            'view_login::activity', 'view_any_login::activity', 'view_student_login::activity',
            // Report & Reminder
            'view_report', 'view_advanced_report', 'view_reminder',
        ];
    }
}