<?php

namespace Tests\Feature;

use Database\Seeders\PermissionSeeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PermissionSeederTest extends TestCase
{
    public function test_it_creates_all_expected_permissions(): void
    {
        $this->seed(PermissionSeeder::class);

        $totalPermissions = Permission::where('guard_name', 'web')->count();

        // Đếm trực tiếp qua danh sách mong đợi thay vì hardcode con số.
        $expectedCount = count($this->expectedPermissionNames());

        $this->assertEquals($expectedCount, $totalPermissions);
    }

    public function test_super_admin_has_all_permissions(): void
    {
        $this->seed(PermissionSeeder::class);

        $superAdmin = Role::findByName('super_admin', 'web');
        $allPermissions = Permission::where('guard_name', 'web')->get();

        $this->assertEquals($allPermissions->count(), $superAdmin->permissions->count());
        $this->assertTrue($superAdmin->hasPermissionTo('create_user'));
        $this->assertTrue($superAdmin->hasPermissionTo('delete_grade::level'));
        $this->assertTrue($superAdmin->hasPermissionTo('view_reminder'));
    }

    public function test_tutor_has_core_teaching_permissions(): void
    {
        $this->seed(PermissionSeeder::class);

        $tutor = Role::findByName('tutor', 'web');

        // Quyền cốt lõi giáo viên cần có để thấy menu
        $this->assertTrue($tutor->hasPermissionTo('view_class::room'));
        $this->assertTrue($tutor->hasPermissionTo('view_any_class::room'));
        $this->assertTrue($tutor->hasPermissionTo('create_class::room'));
        $this->assertTrue($tutor->hasPermissionTo('update_class::room'));
        $this->assertTrue($tutor->hasPermissionTo('delete_class::room'));

        $this->assertTrue($tutor->hasPermissionTo('view_student'));
        $this->assertTrue($tutor->hasPermissionTo('view_any_student'));
        $this->assertTrue($tutor->hasPermissionTo('create_student'));

        $this->assertTrue($tutor->hasPermissionTo('view_assignment'));
        $this->assertTrue($tutor->hasPermissionTo('create_assignment'));

        $this->assertTrue($tutor->hasPermissionTo('view_grade'));
        $this->assertTrue($tutor->hasPermissionTo('create_grade'));

        $this->assertTrue($tutor->hasPermissionTo('view_reminder'));

        // Không có quyền quản trị user
        $this->assertFalse($tutor->hasPermissionTo('view_user'));
        $this->assertFalse($tutor->hasPermissionTo('create_user'));
        $this->assertFalse($tutor->hasPermissionTo('delete_user'));
    }

    public function test_student_has_only_view_and_own_submission_permissions(): void
    {
        $this->seed(PermissionSeeder::class);

        $student = Role::findByName('student', 'web');

        // Học viên có quyền xem (chỉ đọc)
        $this->assertTrue($student->hasPermissionTo('view_class::room'));
        $this->assertTrue($student->hasPermissionTo('view_student'));
        $this->assertTrue($student->hasPermissionTo('view_attendance'));
        $this->assertTrue($student->hasPermissionTo('view_assignment'));
        $this->assertTrue($student->hasPermissionTo('view_submission'));
        $this->assertTrue($student->hasPermissionTo('view_grade'));
        $this->assertTrue($student->hasPermissionTo('view_schedule'));
        $this->assertTrue($student->hasPermissionTo('view_lesson::note'));
        $this->assertTrue($student->hasPermissionTo('view_learning::resource'));
        $this->assertTrue($student->hasPermissionTo('view_notification'));
        $this->assertTrue($student->hasPermissionTo('view_payment'));
        $this->assertTrue($student->hasPermissionTo('view_reminder'));

        // Học viên có thể nộp/sửa/xóa bài nộp của chính mình
        $this->assertTrue($student->hasPermissionTo('create_submission'));
        $this->assertTrue($student->hasPermissionTo('update_submission'));
        $this->assertTrue($student->hasPermissionTo('delete_submission'));

        // Học viên KHÔNG có quyền tạo/sửa/xóa
        $this->assertFalse($student->hasPermissionTo('create_class::room'));
        $this->assertFalse($student->hasPermissionTo('update_class::room'));
        $this->assertFalse($student->hasPermissionTo('delete_class::room'));
        $this->assertFalse($student->hasPermissionTo('create_student'));
        $this->assertFalse($student->hasPermissionTo('update_student'));
        $this->assertFalse($student->hasPermissionTo('delete_student'));
        $this->assertFalse($student->hasPermissionTo('create_assignment'));
        $this->assertFalse($student->hasPermissionTo('update_assignment'));
        $this->assertFalse($student->hasPermissionTo('delete_assignment'));
        $this->assertFalse($student->hasPermissionTo('create_grade'));
        $this->assertFalse($student->hasPermissionTo('update_grade'));
        $this->assertFalse($student->hasPermissionTo('delete_grade'));
        $this->assertFalse($student->hasPermissionTo('create_notification'));
        $this->assertFalse($student->hasPermissionTo('view_user'));
        $this->assertFalse($student->hasPermissionTo('create_user'));
    }

    public function test_parent_has_read_only_permissions_for_their_children(): void
    {
        $this->seed(PermissionSeeder::class);

        $parent = Role::findByName('parent', 'web');

        $this->assertTrue($parent->hasPermissionTo('view_class::room'));
        $this->assertTrue($parent->hasPermissionTo('view_student'));
        $this->assertTrue($parent->hasPermissionTo('view_attendance'));
        $this->assertTrue($parent->hasPermissionTo('view_assignment'));
        $this->assertTrue($parent->hasPermissionTo('view_submission'));
        $this->assertTrue($parent->hasPermissionTo('view_grade'));
        $this->assertTrue($parent->hasPermissionTo('view_schedule'));
        $this->assertTrue($parent->hasPermissionTo('view_lesson::note'));
        $this->assertTrue($parent->hasPermissionTo('view_learning::resource'));
        $this->assertTrue($parent->hasPermissionTo('view_notification'));
        $this->assertTrue($parent->hasPermissionTo('view_payment'));
        $this->assertTrue($parent->hasPermissionTo('view_reminder'));

        // Không có quyền tạo/sửa/xóa
        $this->assertFalse($parent->hasPermissionTo('create_class::room'));
        $this->assertFalse($parent->hasPermissionTo('update_student'));
        $this->assertFalse($parent->hasPermissionTo('create_assignment'));
        $this->assertFalse($parent->hasPermissionTo('create_submission'));
        $this->assertFalse($parent->hasPermissionTo('update_submission'));
        $this->assertFalse($parent->hasPermissionTo('delete_submission'));
        $this->assertFalse($parent->hasPermissionTo('create_grade'));
        $this->assertFalse($parent->hasPermissionTo('view_user'));
        $this->assertFalse($parent->hasPermissionTo('create_user'));
    }

    public function test_admin_has_system_management_permissions(): void
    {
        $this->seed(PermissionSeeder::class);

        $admin = Role::findByName('admin', 'web');

        $this->assertTrue($admin->hasPermissionTo('view_user'));
        $this->assertTrue($admin->hasPermissionTo('create_user'));
        $this->assertTrue($admin->hasPermissionTo('update_user'));
        $this->assertTrue($admin->hasPermissionTo('delete_user'));

        $this->assertTrue($admin->hasPermissionTo('view_class::room'));
        $this->assertTrue($admin->hasPermissionTo('create_class::room'));
        $this->assertTrue($admin->hasPermissionTo('update_class::room'));
        $this->assertTrue($admin->hasPermissionTo('delete_class::room'));

        $this->assertTrue($admin->hasPermissionTo('view_student'));
        $this->assertTrue($admin->hasPermissionTo('create_student'));
        $this->assertTrue($admin->hasPermissionTo('restore_student'));

        $this->assertTrue($admin->hasPermissionTo('view_reminder'));
    }

    /**
     * @return string[]
     */
    private function expectedPermissionNames(): array
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
