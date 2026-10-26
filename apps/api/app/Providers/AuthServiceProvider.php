<?php

namespace App\Providers;

use App\Models\Assignment;
use App\Models\Attendance;
use App\Models\CenterExpense;
use App\Models\ClassRoom;
use App\Models\Enrollment;
use App\Models\GradeLevel;
use App\Models\LearningResource;
use App\Models\Payment;
use App\Models\PayrollAdjustment;
use App\Models\PayrollItem;
use App\Models\PayrollPeriod;
use App\Models\Schedule;
use App\Models\Student;
use App\Models\Subject;
use App\Models\TutorCompensationProfile;
use App\Models\User;
use App\Policies\AssignmentPolicy;
use App\Policies\AttendancePolicy;
use App\Policies\CenterExpensePolicy;
use App\Policies\ClassRoomPolicy;
use App\Policies\EnrollmentPolicy;
use App\Policies\GradeLevelPolicy;
use App\Policies\LearningResourcePolicy;
use App\Policies\PaymentPolicy;
use App\Policies\PayrollAdjustmentPolicy;
use App\Policies\PayrollItemPolicy;
use App\Policies\PayrollPeriodPolicy;
use App\Policies\SchedulePolicy;
use App\Policies\StudentPolicy;
use App\Policies\SubjectPolicy;
use App\Policies\TutorCompensationProfilePolicy;
use App\Policies\UserPolicy;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;

class AuthServiceProvider extends ServiceProvider
{
    /**
     * The policy mappings for the application.
     *
     * @var array<class-string, class-string>
     */
    protected $policies = [
        ClassRoom::class => ClassRoomPolicy::class,
        Student::class => StudentPolicy::class,
        User::class => UserPolicy::class,
        Attendance::class => AttendancePolicy::class,
        Payment::class => PaymentPolicy::class,
        Assignment::class => AssignmentPolicy::class,
        LearningResource::class => LearningResourcePolicy::class,
        Schedule::class => SchedulePolicy::class,
        Enrollment::class => EnrollmentPolicy::class,
        Subject::class => SubjectPolicy::class,
        GradeLevel::class => GradeLevelPolicy::class,
        CenterExpense::class => CenterExpensePolicy::class,
        TutorCompensationProfile::class => TutorCompensationProfilePolicy::class,
        PayrollPeriod::class => PayrollPeriodPolicy::class,
        PayrollItem::class => PayrollItemPolicy::class,
        PayrollAdjustment::class => PayrollAdjustmentPolicy::class,
    ];

    /**
     * Register any authentication / authorization services.
     */
    public function boot(): void
    {
        $this->registerPolicies();
    }
}
