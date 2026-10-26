<?php

use App\Http\Controllers\API\V1\AiController;
use App\Http\Controllers\API\V1\AssignmentController;
use App\Http\Controllers\API\V1\AssignmentTypeController;
use App\Http\Controllers\API\V1\AttendanceController;
use App\Http\Controllers\API\V1\AttendanceQrController;
use App\Http\Controllers\API\V1\AuthController;
use App\Http\Controllers\API\V1\CenterExpenseController;
use App\Http\Controllers\API\V1\ClassRoomController;
use App\Http\Controllers\API\V1\CompensationProfileController;
use App\Http\Controllers\API\V1\DashboardController;
use App\Http\Controllers\API\V1\DataJobController;
use App\Http\Controllers\API\V1\EmailTemplateController;
use App\Http\Controllers\API\V1\EnrollmentController;
use App\Http\Controllers\API\V1\FinanceReportsController;
use App\Http\Controllers\API\V1\GradeController;
use App\Http\Controllers\API\V1\GradeLevelController;
use App\Http\Controllers\API\V1\GradeTypeController;
use App\Http\Controllers\API\V1\InviteAcceptController;
use App\Http\Controllers\API\V1\LearningResourceController;
use App\Http\Controllers\API\V1\LessonNoteController;
use App\Http\Controllers\API\V1\LoginActivityController;
use App\Http\Controllers\API\V1\MediaOptimizationController;
use App\Http\Controllers\API\V1\NotificationController;
use App\Http\Controllers\API\V1\NotificationPreferenceController;
use App\Http\Controllers\API\V1\OrganizationController;
use App\Http\Controllers\API\V1\OrganizationMemberController;
use App\Http\Controllers\API\V1\OrganizationBankAccountController;
use App\Http\Controllers\API\V1\ParentController;
use App\Http\Controllers\API\V1\PaymentController;
use App\Http\Controllers\API\V1\PaymentRequestController;
use App\Http\Controllers\API\V1\PayrollItemController;
use App\Http\Controllers\API\V1\PayrollPeriodController;
use App\Http\Controllers\API\V1\ReminderController;
use App\Http\Controllers\API\V1\ReportsController;
use App\Http\Controllers\API\V1\ScheduleController;
use App\Http\Controllers\API\V1\SettingsController;
use App\Http\Controllers\API\V1\StudentController;
use App\Http\Controllers\API\V1\StudentInviteController;
use App\Http\Controllers\API\V1\SubjectController;
use App\Http\Controllers\API\V1\SubmissionController;
use App\Http\Controllers\API\V1\SystemConfigController;
use App\Http\Controllers\API\V1\TwoFactorController;
use App\Http\Controllers\API\V1\UserController;
use App\Http\Middleware\AuthenticateApi;
use App\Http\Middleware\CheckUserActionLock;
use App\Http\Middleware\DdosProtection;
use App\Http\Middleware\RateLimitApi;
use App\Http\Middleware\VerifyClientSignature;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes - Version 1
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| Public Routes (No Authentication)
|--------------------------------------------------------------------------
*/

Route::middleware([
    DdosProtection::class,
    RateLimitApi::class.':auth', // Stricter limits for auth endpoints
])->group(function () {
    Route::prefix('auth')->name('auth.')->group(function () {
        Route::post('/login', [AuthController::class, 'login'])->name('login');
        Route::post('/refresh', [AuthController::class, 'refresh'])->name('refresh');
        Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->name('forgot-password');
        Route::post('/verify-code', [AuthController::class, 'verifyCode'])->name('verify-code');
        Route::post('/reset-password', [AuthController::class, 'resetPassword'])->name('reset-password');

        // 2FA login step 2 — exchange {challenge, code} for the real JWT (public + :auth limited).
        Route::post('/2fa/verify', [AuthController::class, 'verifyTwoFactor'])->name('2fa.verify');

        // Student/parent invite acceptance (completes the previously half-built StudentInvite flow).
        Route::get('/invite/{token}', [InviteAcceptController::class, 'show'])->name('invite.show');
        Route::post('/accept-invite', [InviteAcceptController::class, 'accept'])->name('accept-invite');
    });

    // Public System Config
    Route::get('/config', [SystemConfigController::class, 'index'])->name('config');
});

/*
|--------------------------------------------------------------------------
| Media Access Routes (Token-based, no JWT required)
|--------------------------------------------------------------------------
| These endpoints support media tokens in query string, no JWT required.
| Still protected by VerifyClientSignature middleware.
*/
Route::middleware([
    DdosProtection::class,
    RateLimitApi::class,
    VerifyClientSignature::class,
])->group(function () {
    Route::get('learning-resources/{learningResource}/preview', [LearningResourceController::class, 'preview'])->name('learning-resources.preview');
    Route::get('learning-resources/{learningResource}/optimized-preview', [LearningResourceController::class, 'optimizedPreview'])->name('learning-resources.optimized-preview');
    Route::get('learning-resources/{learningResource}/stream', [LearningResourceController::class, 'stream'])->name('learning-resources.stream');
    Route::get('learning-resources/{learningResource}/optimized-stream', [LearningResourceController::class, 'optimizedStream'])->name('learning-resources.optimized-stream');
    Route::get('learning-resources/{learningResource}/download', [LearningResourceController::class, 'download'])->name('learning-resources.download');
    Route::get('learning-resources/{learningResource}/thumbnail', [LearningResourceController::class, 'thumbnail'])->name('learning-resources.thumbnail');
});

/*
|--------------------------------------------------------------------------
| Protected Routes (JWT Authentication Required)
|--------------------------------------------------------------------------
*/

Route::middleware([
    DdosProtection::class,
    RateLimitApi::class,
    VerifyClientSignature::class,
    AuthenticateApi::class.':api',
])->group(function () {

    /*
    |--------------------------------------------------------------------------
    | Auth Routes (không áp dụng action lock để luôn cho phép logout, xem profile)
    |--------------------------------------------------------------------------
    */
    Route::prefix('auth')->name('auth.')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
        Route::get('/me', [AuthController::class, 'me'])->name('me');
        Route::put('/profile', [AuthController::class, 'updateProfile'])->name('profile.update');
        Route::put('/mode', [AuthController::class, 'updateMode'])->name('mode.update');
        Route::post('/change-password', [AuthController::class, 'changePassword'])->name('password.change');
        Route::get('/login-history', [LoginActivityController::class, 'index'])->name('login-history');

        // Email verification
        Route::post('/send-verification-email', [AuthController::class, 'sendVerificationEmail'])->name('send-verification-email');
        Route::post('/verify-email', [AuthController::class, 'verifyEmail'])->name('verify-email');

        // Two-factor (TOTP) management for the authenticated user.
        Route::prefix('2fa')->name('2fa.')->group(function () {
            Route::post('/enable', [TwoFactorController::class, 'enable'])->name('enable');
            Route::post('/confirm', [TwoFactorController::class, 'confirm'])->name('confirm');
            Route::post('/disable', [TwoFactorController::class, 'disable'])->name('disable');
            Route::post('/recovery-codes/regenerate', [TwoFactorController::class, 'regenerateRecoveryCodes'])->name('recovery-codes.regenerate');
        });
    });

    /*
    |--------------------------------------------------------------------------
    | Login Activity Routes
    |--------------------------------------------------------------------------
    */
    Route::prefix('login-activity')->name('login-activity.')->group(function () {
        Route::get('/students', [LoginActivityController::class, 'allStudentsHistory'])->name('students');
    });

    // Các route còn lại áp dụng middleware CheckUserActionLock
    Route::middleware([CheckUserActionLock::class])->group(function () {

        /*
        |--------------------------------------------------------------------------
        | Settings Routes (User-specific settings)
        |--------------------------------------------------------------------------
        */
        Route::prefix('settings')->name('settings.')->group(function () {
            // Profile Settings
            Route::prefix('profile')->name('profile.')->group(function () {
                Route::get('/', [SettingsController::class, 'getProfile'])->name('get');
                Route::put('/', [SettingsController::class, 'updateProfile'])->name('update');
                Route::post('/avatar', [SettingsController::class, 'uploadAvatar'])->name('avatar.upload');
            });

            // Security Settings
            Route::prefix('security')->name('security.')->group(function () {
                Route::get('/', [SettingsController::class, 'getSecurity'])->name('get');
                Route::post('/change-password', [SettingsController::class, 'changePassword'])->name('change-password');
                Route::post('/change-email', [SettingsController::class, 'changeEmail'])->name('change-email');
            });

            // Notification Settings
            Route::prefix('notifications')->name('notifications.')->group(function () {
                Route::get('/', [SettingsController::class, 'getNotifications'])->name('get');
                Route::put('/', [SettingsController::class, 'updateNotifications'])->name('update');
            });

            // Payment Settings
            Route::prefix('payment')->name('payment.')->group(function () {
                Route::get('/bank-info', [SettingsController::class, 'getBankInfo'])->name('bank-info');
                Route::put('/bank-info', [SettingsController::class, 'updateBankInfo'])->name('bank-info.update');
            });

            // Account Management
            Route::prefix('account')->name('account.')->group(function () {
                Route::post('/deactivate', [SettingsController::class, 'deactivateAccount'])->name('deactivate');
                Route::post('/delete', [SettingsController::class, 'deleteAccount'])->name('delete');
            });
        });

        /*
        |--------------------------------------------------------------------------
        | 1. Core Resources (Classes, Students, Subjects, etc.)
        |--------------------------------------------------------------------------
        */

        // Classes & Related
        Route::apiResource('classes', ClassRoomController::class)->parameters(['classes' => 'classRoom']);
        Route::prefix('classes/{classRoom}')->group(function () {
            Route::get('students', [ClassRoomController::class, 'students'])->name('classes.students');
            Route::post('students', [ClassRoomController::class, 'enrollStudent'])->name('classes.students.enroll');
            Route::delete('students/{student}', [ClassRoomController::class, 'unenrollStudent'])->name('classes.students.unenroll');
            Route::post('students/{student}/pause', [ClassRoomController::class, 'pauseStudent'])->name('classes.students.pause');
            Route::post('students/{student}/resume', [ClassRoomController::class, 'resumeStudent'])->name('classes.students.resume');

            Route::get('schedules', [ScheduleController::class, 'byClass'])->name('classes.schedules');
            Route::get('assignments', [AssignmentController::class, 'byClass'])->name('classes.assignments');
            Route::get('attendance', [AttendanceController::class, 'byClass'])->name('classes.attendance');
            Route::get('grades', [GradeController::class, 'byClass'])->name('classes.grades');
            Route::get('gradebook', [GradeController::class, 'gradebook'])->name('classes.gradebook');
            Route::get('students/{student}/report-card', [GradeController::class, 'reportCard'])->name('classes.students.report-card');
            Route::get('lesson-notes', [LessonNoteController::class, 'byClass'])->name('classes.lesson-notes');

            // Payment Requests for Class
            Route::get('payment-requests', [PaymentRequestController::class, 'index'])->name('classes.payment-requests.index');
            Route::post('payment-requests', [PaymentRequestController::class, 'store'])->name('classes.payment-requests.store');
            Route::post('payment-requests/bulk', [PaymentRequestController::class, 'bulkCreate'])->name('classes.payment-requests.bulk');
        });

        // Students & Related
        Route::get('students/export', [StudentController::class, 'export'])->name('students.export');
        Route::post('students/import', [StudentController::class, 'import'])->name('students.import');
        Route::apiResource('students', StudentController::class)->parameters(['students' => 'student']);
        Route::prefix('students/{student}')->group(function () {
            Route::get('classes', [StudentController::class, 'classes'])->name('students.classes');
            Route::get('assignments', [StudentController::class, 'assignments'])->name('students.assignments');
            Route::get('attendance', [AttendanceController::class, 'byStudent'])->name('students.attendance');
            Route::get('grades', [GradeController::class, 'byStudent'])->name('students.grades');
            Route::get('payments', [PaymentController::class, 'byStudent'])->name('students.payments');
            Route::get('recent-activity', [StudentController::class, 'recentActivity'])->name('students.recent-activity');
            Route::get('statistics', [StudentController::class, 'statistics'])->name('students.statistics');
            Route::get('login-history', [LoginActivityController::class, 'studentHistory'])->name('students.login-history');
            Route::post('lock', [StudentController::class, 'lockStudent'])->name('students.lock');
            Route::post('unlock', [StudentController::class, 'unlockStudent'])->name('students.unlock');
            Route::post('reset-password', [StudentController::class, 'resetPassword'])->name('students.reset-password');
        });
        Route::apiResource('student-invites', StudentInviteController::class)->only(['index', 'store', 'destroy'])->parameters(['student-invites' => 'id']);

        // Subjects
        Route::get('subjects/export', [SubjectController::class, 'export'])->name('subjects.export');
        Route::post('subjects/import', [SubjectController::class, 'import'])->name('subjects.import');
        Route::apiResource('subjects', SubjectController::class);

        // Grade Levels
        Route::get('grade-levels/export', [GradeLevelController::class, 'export'])->name('grade-levels.export');
        Route::post('grade-levels/import', [GradeLevelController::class, 'import'])->name('grade-levels.import');
        Route::apiResource('grade-levels', GradeLevelController::class)->parameters(['grade-levels' => 'gradeLevel']);

        /*
        |--------------------------------------------------------------------------
        | 2. Academic Resources (Schedules, Attendance, Grades, etc.)
        |--------------------------------------------------------------------------
        */

        // Schedules & Sessions
        Route::apiResource('schedules', ScheduleController::class)->parameters(['schedules' => 'schedule']);
        Route::post('schedules/{schedule}/generate-sessions', [ScheduleController::class, 'generateSessions'])->name('schedules.generate-sessions');
        Route::post('schedules/{schedule}/regenerate-sessions', [ScheduleController::class, 'regenerateSessions'])->name('schedules.regenerate-sessions');
        Route::get('schedules/{schedule}/sessions', [ScheduleController::class, 'sessions'])->name('schedules.sessions');
        Route::put('schedules/{schedule}/toggle-mode', [ScheduleController::class, 'toggleMode'])->name('schedules.toggle-mode');

        Route::prefix('schedule-sessions/{scheduleSession}')->group(function () {
            Route::get('/', [ScheduleController::class, 'showSession'])->name('schedule-sessions.show');
            Route::put('/', [ScheduleController::class, 'updateSession'])->name('schedule-sessions.update');
            Route::post('complete', [ScheduleController::class, 'completeSession'])->name('schedule-sessions.complete');
            Route::post('cancel', [ScheduleController::class, 'cancelSession'])->name('schedule-sessions.cancel');
            Route::post('reschedule', [ScheduleController::class, 'rescheduleSession'])->name('schedule-sessions.reschedule');

            // QR attendance (tutor): open session for check-in, rotate the token, watch the live roster.
            Route::post('attendance/start', [AttendanceQrController::class, 'start'])->name('schedule-sessions.attendance.start');
            Route::get('attendance/token', [AttendanceQrController::class, 'token'])->name('schedule-sessions.attendance.token');
            Route::get('attendance/live', [AttendanceQrController::class, 'live'])->name('schedule-sessions.attendance.live');
        });

        // Attendance
        Route::get('attendance/status-options', [AttendanceController::class, 'statusOptions'])->name('attendance.status-options');
        Route::post('attendance/check-in', [AttendanceQrController::class, 'checkIn'])->name('attendance.check-in'); // student self-mark
        Route::post('attendance/bulk-update', [AttendanceController::class, 'bulkUpdate'])->name('attendance.bulk-update');
        Route::post('attendance/import', [AttendanceController::class, 'import'])->name('attendance.import');
        Route::apiResource('attendance', AttendanceController::class)->parameters(['attendance' => 'attendance']);

        // Assignments & Submissions
        Route::get('assignment-types/export', [AssignmentTypeController::class, 'export'])->name('assignment-types.export');
        Route::post('assignment-types/import', [AssignmentTypeController::class, 'import'])->name('assignment-types.import');
        Route::apiResource('assignment-types', AssignmentTypeController::class)->parameters(['assignment-types' => 'assignmentType']);

        Route::get('assignments/{assignment}/quiz/schema', [AssignmentController::class, 'quizSchema'])->name('assignments.quiz.schema');
        Route::get('assignments/{assignment}/quiz/take', [AssignmentController::class, 'quizTake'])->name('assignments.quiz.take');
        Route::get('assignments/{assignment}/submissions', [AssignmentController::class, 'submissions'])->name('assignments.submissions');
        Route::get('assignments/{assignment}/skill-report', \App\Http\Controllers\API\V1\AssignmentSkillReportController::class)
            ->name('assignments.skill_report');
        Route::apiResource('assignments', AssignmentController::class)->parameters(['assignments' => 'assignment']);

        Route::apiResource('submissions', SubmissionController::class)->parameters(['submissions' => 'submission']);
        Route::post('submissions/{submission}/grade', [SubmissionController::class, 'grade'])->name('submissions.grade');
        // Review an exam attempt: the owning student sees their own paper (correct answers gated
        // by quiz_settings.show_correct_answers), staff sees everything.
        Route::get('submissions/{submission}/review', [SubmissionController::class, 'review'])->name('submissions.review');

        // AI (tùy chọn, bật qua env). These calls cost money → modest per-user throttle on top of the global limiter.
        Route::middleware('throttle:20,1')->group(function () {
            Route::post('submissions/{submission}/ai-grade', [AiController::class, 'gradeSubmission'])->name('submissions.ai_grade');
            Route::post('submissions/{submission}/ai-grade/accept', [AiController::class, 'acceptGrade'])->name('submissions.ai_grade_accept');
            Route::post('assignments/{assignment}/ai-generate-questions', [AiController::class, 'generateQuestions'])->name('assignments.ai_generate');
        });
        Route::get('submissions/assignment/{assignment}/latest', [SubmissionController::class, 'latest'])->name('submissions.latest');
        Route::get('submissions/assignment/{assignment}/history', [SubmissionController::class, 'history'])->name('submissions.history');

        // Grades
        Route::get('grade-types/export', [GradeTypeController::class, 'export'])->name('grade-types.export');
        Route::post('grade-types/import', [GradeTypeController::class, 'import'])->name('grade-types.import');
        Route::apiResource('grade-types', GradeTypeController::class)->parameters(['grade-types' => 'gradeType']);

        Route::post('grades/import', [GradeController::class, 'import'])->name('grades.import');
        Route::post('grades/bulk', [GradeController::class, 'bulkStore'])->name('grades.bulk');
        Route::apiResource('grades', GradeController::class);

        // Lesson Notes
        Route::apiResource('lesson-notes', LessonNoteController::class)->parameters(['lesson-notes' => 'lessonNote']);

        /*
        |--------------------------------------------------------------------------
        | 3. Financial Resources (Payments)
        |--------------------------------------------------------------------------
        */

        Route::get('payments/student/{student}', [PaymentController::class, 'byStudent'])->name('payments.by-student');
        Route::get('payments/statistics', [PaymentController::class, 'statistics'])->name('payments.statistics');
        Route::post('payments/import', [PaymentController::class, 'import'])->name('payments.import');
        Route::prefix('payments/{payment}')->group(function () {
            Route::post('approve', [PaymentController::class, 'approve'])->name('payments.approve');
            Route::post('reject', [PaymentController::class, 'reject'])->name('payments.reject');
            Route::post('refund', [PaymentController::class, 'refund'])->name('payments.refund');
            Route::post('mark-failed', [PaymentController::class, 'markFailed'])->name('payments.mark-failed');
        });
        Route::apiResource('payments', PaymentController::class)->parameters(['payments' => 'payment']);

        // Payment Requests (Show/Update/Delete)
        Route::prefix('payment-requests/{paymentRequest}')->group(function () {
            Route::get('/', [PaymentRequestController::class, 'show'])->name('payment-requests.show');
            Route::get('statistics', [PaymentRequestController::class, 'statistics'])->name('payment-requests.statistics');
            Route::match(['put', 'patch'], '/', [PaymentRequestController::class, 'update'])->name('payment-requests.update');
            Route::delete('/', [PaymentRequestController::class, 'destroy'])->name('payment-requests.destroy');
        });

        /*
        |--------------------------------------------------------------------------
        | 4. System & Support (Media, Notifications, Stats, Settings)
        |--------------------------------------------------------------------------
        */

        // Learning Resources (Media)
        Route::post('learning-resources/upload', [LearningResourceController::class, 'upload'])->name('learning-resources.upload');
        Route::post('learning-resources/upload-images', [LearningResourceController::class, 'uploadImages'])->name('learning-resources.upload-images');
        Route::post('learning-resources/{learningResource}', [LearningResourceController::class, 'update'])->name('learning-resources.update.post');
        Route::apiResource('learning-resources', LearningResourceController::class)->parameters(['learning-resources' => 'learningResource']);

        // Media Optimization
        Route::prefix('media-optimization')->group(function () {
            Route::get('stats', [MediaOptimizationController::class, 'stats'])->name('media-optimization.stats');
            Route::post('retry-failed', [MediaOptimizationController::class, 'retryFailed'])->name('media-optimization.retry-failed');
            Route::get('{mediaId}/status', [MediaOptimizationController::class, 'status'])->name('media-optimization.status');
        });

        // Notifications
        Route::get('notifications/unread', [NotificationController::class, 'unread'])->name('notifications.unread');
        Route::prefix('notifications/{notification}')->group(function () {
            Route::post('mark-read', [NotificationController::class, 'markAsRead'])->name('notifications.mark-read');
            Route::post('send', [NotificationController::class, 'send'])->name('notifications.send');
            Route::get('recipients', [NotificationController::class, 'recipients'])->name('notifications.recipients');
            Route::post('send-email-batch', [NotificationController::class, 'sendEmailBatch'])->name('notifications.send-email-batch');
            Route::post('resend-failed', [NotificationController::class, 'resendFailed'])->name('notifications.resend-failed');
        });
        Route::apiResource('notifications', NotificationController::class)->parameters(['notifications' => 'notification']);

        // Parent (guardian) portal — read a guarded child's data + pay tuition.
        Route::prefix('parent')->name('parent.')->group(function () {
            $pc = ParentController::class;
            Route::get('children', [$pc, 'children'])->name('children');
            Route::get('children/{student}/grades', [$pc, 'grades'])->name('grades');
            Route::get('children/{student}/attendance', [$pc, 'attendance'])->name('attendance');
            Route::get('children/{student}/schedule', [$pc, 'schedule'])->name('schedule');
            Route::get('children/{student}/assignments', [$pc, 'assignments'])->name('assignments');
            Route::get('children/{student}/tuition', [$pc, 'tuition'])->name('tuition');
            Route::post('payments/{payment}/intent', [$pc, 'paymentIntent'])->name('payment-intent');
        });

        // Notification Preferences
        Route::prefix('notification-preferences')->name('notification-preferences.')->group(function () {
            Route::get('/', [NotificationPreferenceController::class, 'index'])->name('index');
            Route::get('available-channels', [NotificationPreferenceController::class, 'availableChannels'])->name('available-channels');
            Route::post('bulk-update', [NotificationPreferenceController::class, 'bulkUpdate'])->name('bulk-update');
            Route::get('{type}', [NotificationPreferenceController::class, 'show'])->name('show');
            Route::put('{type}', [NotificationPreferenceController::class, 'update'])->name('update');
        });

        /*
        |--------------------------------------------------------------------------
        | Organizations (trung tâm / multi-tutor center)
        |--------------------------------------------------------------------------
        | Org context is ALWAYS derived from the caller's active membership, never from the URL/body.
        | Every {organization} endpoint fail-closes (404) for a non-member or a different org.
        */
        // "current" MUST be declared before "{organization}" so it isn't decoded as a hashid.
        Route::get('organizations/current', [OrganizationController::class, 'current'])->name('organizations.current');
        Route::post('organizations', [OrganizationController::class, 'store'])->name('organizations.store');
        Route::patch('organizations/{organization}', [OrganizationController::class, 'update'])->name('organizations.update');
        Route::get('organizations/{organization}/dashboard', [OrganizationController::class, 'dashboard'])->name('organizations.dashboard');
        Route::post('organizations/{organization}/members', [OrganizationMemberController::class, 'store'])->name('organizations.members.store');
        Route::patch('organizations/{organization}/members/{member}', [OrganizationMemberController::class, 'updateRole'])->name('organizations.members.update-role');
        Route::delete('organizations/{organization}/members/{member}', [OrganizationMemberController::class, 'remove'])->name('organizations.members.remove');
        Route::post('organizations/{organization}/members/{member}/restore', [OrganizationMemberController::class, 'restore'])->name('organizations.members.restore');
        Route::get('organizations/{organization}/ai-usage', [OrganizationController::class, 'aiUsage'])->name('organizations.ai-usage');
        Route::post('organizations/{organization}/classes/{classRoom}/assign', [OrganizationMemberController::class, 'assignClass'])->name('organizations.classes.assign');

        // Organization bank accounts
        Route::prefix('organizations/current')->name('organizations.current.')->group(function () {
            Route::get('bank-accounts', [OrganizationBankAccountController::class, 'index'])->name('bank-accounts.index');
            Route::post('bank-accounts', [OrganizationBankAccountController::class, 'store'])->name('bank-accounts.store');
            Route::put('bank-accounts/{id}', [OrganizationBankAccountController::class, 'update'])->name('bank-accounts.update');
            Route::delete('bank-accounts/{id}', [OrganizationBankAccountController::class, 'destroy'])->name('bank-accounts.destroy');
            Route::post('bank-accounts/{id}/set-default', [OrganizationBankAccountController::class, 'setDefault'])->name('bank-accounts.set-default');
        });

        // Center finance — expenses CRUD (Wave 2). Gated in-controller: reports.finance +
        // owner/manager/accountant + org-context. Money is org-anchored (center_expenses).
        Route::get('organizations/{organization}/expenses', [CenterExpenseController::class, 'index'])->name('organizations.expenses.index');
        Route::post('organizations/{organization}/expenses', [CenterExpenseController::class, 'store'])->name('organizations.expenses.store');
        Route::patch('organizations/{organization}/expenses/{expense}', [CenterExpenseController::class, 'update'])->name('organizations.expenses.update');
        Route::delete('organizations/{organization}/expenses/{expense}', [CenterExpenseController::class, 'destroy'])->name('organizations.expenses.destroy');

        /*
        |--------------------------------------------------------------------------
        | Payroll (Wave 3) — money that is MEMBER-anchored, not class-anchored.
        |--------------------------------------------------------------------------
        | Gated in-controller by the triple: payroll.manage + org-role + org-context (from membership,
        | never the URL). Owner/manager manage; MARK-PAID is owner-only; member-tutor self-service via
        | my-payslips (own approved only). Every row is org-anchored (organization_id, pattern b).
        */
        // Compensation profiles (pay rules) — owner/manager.
        Route::get('organizations/{organization}/compensation-profiles', [CompensationProfileController::class, 'index'])->name('organizations.compensation-profiles.index');
        Route::post('organizations/{organization}/compensation-profiles', [CompensationProfileController::class, 'store'])->name('organizations.compensation-profiles.store');
        Route::get('organizations/{organization}/compensation-profiles/{profile}', [CompensationProfileController::class, 'show'])->name('organizations.compensation-profiles.show');
        Route::patch('organizations/{organization}/compensation-profiles/{profile}', [CompensationProfileController::class, 'update'])->name('organizations.compensation-profiles.update');
        Route::delete('organizations/{organization}/compensation-profiles/{profile}', [CompensationProfileController::class, 'destroy'])->name('organizations.compensation-profiles.destroy');

        // Member self-service payslips (own approved only) — declared BEFORE the {period} routes so
        // "my-payslips" is never mistaken for a resource id.
        Route::get('organizations/{organization}/my-payslips', [PayrollItemController::class, 'myPayslips'])->name('organizations.my-payslips');

        // Payroll periods (pay runs) — owner/manager; mark-paid owner-only (in-controller).
        Route::get('organizations/{organization}/payroll-periods', [PayrollPeriodController::class, 'index'])->name('organizations.payroll-periods.index');
        Route::post('organizations/{organization}/payroll-periods', [PayrollPeriodController::class, 'store'])->name('organizations.payroll-periods.store');
        Route::get('organizations/{organization}/payroll-periods/{period}', [PayrollPeriodController::class, 'show'])->name('organizations.payroll-periods.show');
        Route::post('organizations/{organization}/payroll-periods/{period}/compute', [PayrollPeriodController::class, 'compute'])->name('organizations.payroll-periods.compute');
        Route::post('organizations/{organization}/payroll-periods/{period}/approve', [PayrollPeriodController::class, 'approve'])->name('organizations.payroll-periods.approve');
        Route::post('organizations/{organization}/payroll-periods/{period}/mark-paid', [PayrollPeriodController::class, 'markPaid'])->name('organizations.payroll-periods.mark-paid');
        Route::delete('organizations/{organization}/payroll-periods/{period}', [PayrollPeriodController::class, 'destroy'])->name('organizations.payroll-periods.destroy');
        Route::post('organizations/{organization}/payroll-periods/{period}/reopen', [PayrollPeriodController::class, 'reopen'])->name('organizations.payroll-periods.reopen');
        Route::get('organizations/{organization}/payroll-periods/{period}/items', [PayrollPeriodController::class, 'items'])->name('organizations.payroll-periods.items');

        // Payslip item show + adjustments (org derived from caller membership, no {organization} param).
        Route::get('payroll-items/{item}', [PayrollItemController::class, 'show'])->name('payroll-items.show');
        Route::post('payroll-items/{item}/adjustments', [PayrollItemController::class, 'storeAdjustment'])->name('payroll-items.adjustments.store');
        Route::delete('payroll-adjustments/{adjustment}', [PayrollItemController::class, 'destroyAdjustment'])->name('payroll-adjustments.destroy');

        // Dashboard & Reports
        Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');
        Route::get('dashboard/statistics', [DashboardController::class, 'statistics'])->name('dashboard.statistics');
        Route::get('dashboard/recent-activity', [DashboardController::class, 'recentActivity'])->name('dashboard.recent-activity');
        Route::get('reminders', [ReminderController::class, 'index'])->name('reminders.index');

        Route::prefix('reports')->name('reports.')->group(function () {
            Route::get('overview', [ReportsController::class, 'overview'])->name('overview');
            Route::get('revenue', [ReportsController::class, 'revenue'])->name('revenue');
            Route::get('revenue/export', [ReportsController::class, 'exportRevenue'])->name('export.revenue');
            Route::get('payments', [ReportsController::class, 'payments'])->name('payments');
            Route::get('payments/export', [ReportsController::class, 'exportPayments'])->name('export.payments');
            Route::get('payment-requests/export', [ReportsController::class, 'exportPaymentRequests'])->name('export.payment-requests');
            Route::get('attendance', [ReportsController::class, 'attendance'])->name('attendance');
            Route::get('attendance/export', [ReportsController::class, 'exportAttendance'])->name('export.attendance');
            Route::get('grades/export', [ReportsController::class, 'exportGrades'])->name('export.grades');
            Route::get('students', [ReportsController::class, 'students'])->name('students');
            Route::get('students/export', [ReportsController::class, 'exportStudents'])->name('export.students');
            Route::get('classes', [ReportsController::class, 'classes'])->name('classes');
            Route::get('classes/export', [ReportsController::class, 'exportClasses'])->name('export.classes');
            Route::get('assignments', [ReportsController::class, 'assignments'])->name('assignments');
            Route::get('assignments/export', [ReportsController::class, 'exportAssignments'])->name('export.assignments');
            Route::get('login-activities/export', [ReportsController::class, 'exportLoginActivities'])->name('export.login-activities');

            // Consolidated center finance reports (Wave 2). Gated in-controller: reports.finance +
            // owner/manager/accountant + org-context (derived from the caller's membership).
            Route::prefix('finance')->name('finance.')->group(function () {
                Route::get('pnl', [FinanceReportsController::class, 'pnl'])->name('pnl');
                Route::get('receivables', [FinanceReportsController::class, 'receivables'])->name('receivables');
                // Wave 4 — finance complete: tutor cost (PayrollCostReader), cashflow, payables.
                Route::get('tutor-profitability', [FinanceReportsController::class, 'tutorProfitability'])->name('tutor-profitability');
                Route::get('cashflow', [FinanceReportsController::class, 'cashflow'])->name('cashflow');
                Route::get('payables', [FinanceReportsController::class, 'payables'])->name('payables');
                // Export (CSV/Excel) — gated reports.finance + org-role in-controller AND data.export in
                // handleExport. {report} constrained to the exportable set.
                Route::get('{report}/export', [FinanceReportsController::class, 'export'])
                    ->where('report', 'pnl|tutor-profitability|cashflow|payables')
                    ->name('export');
            });
        });

        // Other Imports/Exports
        Route::post('enrollments/import', [EnrollmentController::class, 'import'])->name('enrollments.import');
        Route::get('settings/export', [SettingsController::class, 'export'])->name('settings.export');
        Route::post('settings/import', [SettingsController::class, 'import'])->name('settings.import');
        Route::get('email-templates/export', [EmailTemplateController::class, 'export'])->name('email-templates.export');
        Route::post('email-templates/import', [EmailTemplateController::class, 'import'])->name('email-templates.import');
        Route::get('login-activities/export', [LoginActivityController::class, 'export'])->name('login-activities.export');

        // Data Jobs
        Route::apiResource('data-jobs', DataJobController::class)->only(['index', 'show'])->parameters(['data-jobs' => 'dataJob']);

        // Users Management
        Route::post('users/{user}/reset-password', [UserController::class, 'resetPassword'])->name('users.reset-password');
        Route::post('users/{user}/activate', [UserController::class, 'activate'])->name('users.activate');
        Route::post('users/{user}/deactivate', [UserController::class, 'deactivate'])->name('users.deactivate');
        Route::apiResource('users', UserController::class)->parameters(['users' => 'user']);

        // Root Payment decoding
        Route::get('payment/decode/{token}', [PaymentController::class, 'decodeToken'])->name('payment.decode-token');
    });
});
