<?php

namespace App\Http\Controllers\API\V1;

use App\Models\Assignment;
use App\Models\Attendance;
use App\Models\ClassRoom;
use App\Models\Grade;
use App\Models\Payment;
use App\Models\Setting;
use App\Models\Student;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends BaseController
{
    /**
     * Get dashboard overview data.
     */
    public function index(): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        if ($user->hasRole('super_admin')) {
            return $this->superAdminDashboard();
        } elseif ($user->isTutor()) {
            return $this->tutorDashboard();
        } elseif ($user->isStudent()) {
            return $this->studentDashboard();
        }

        return $this->errorResponse('Loại người dùng không hợp lệ', null, 'INVALID_USER', 403);
    }

    /**
     * Dashboard for Super Admin.
     */
    private function superAdminDashboard(): JsonResponse
    {
        // Super Admin sees all data
        $totalClasses = ClassRoom::count();
        $activeClasses = ClassRoom::where('status', 'active')->count();

        $totalStudents = Student::count();
        $activeStudents = Student::where('status', 'active')->count();

        $totalTutors = User::where('role', 'tutor')->count();

        // Attendance this month
        $attendanceThisMonth = Attendance::whereMonth('date', now()->month)
            ->whereYear('date', now()->year)
            ->count();

        // Payments this month
        $revenueThisMonth = Payment::whereMonth('payment_date', now()->month)
            ->whereYear('payment_date', now()->year)
            ->sum('amount');

        // Assignments this month
        $assignmentsThisMonth = Assignment::whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->count();

        // Get welcome message from settings
        $welcomeTitle = Setting::get('welcome_title', 'Chào mừng đến với Classly!');
        $welcomeContent = Setting::get('welcome_content', 'Chúng tôi rất vui được đồng hành cùng bạn trong hành trình học tập và phát triển.');

        return $this->successResponse([
            'user_type' => 'super_admin',
            'welcome' => [
                'title' => $welcomeTitle,
                'content' => $welcomeContent,
            ],
            'statistics' => [
                'total_classes' => $totalClasses,
                'active_classes' => $activeClasses,
                'total_students' => $totalStudents,
                'active_students' => $activeStudents,
                'total_tutors' => $totalTutors,
                'attendance_this_month' => $attendanceThisMonth,
                'revenue_this_month' => $revenueThisMonth,
                'assignments_this_month' => $assignmentsThisMonth,
            ],
        ]);
    }

    /**
     * Dashboard for Tutor.
     */
    private function tutorDashboard(): JsonResponse
    {
        $user = $this->getAuthUser();

        // Org owner/manager get the aggregate view across ALL member tutors of their org.
        if ($user->isOrgViewerAll()) {
            return $this->orgOwnerDashboard($user);
        }

        // Classes
        $totalClasses = ClassRoom::where('tutor_id', $user->id)->count();
        $activeClasses = ClassRoom::where('tutor_id', $user->id)
            ->where('status', 'active')
            ->count();

        // Students
        $classIds = ClassRoom::where('tutor_id', $user->id)->pluck('id');
        $totalStudents = DB::table('class_student')
            ->whereIn('class_id', $classIds)
            ->distinct('student_id')
            ->count('student_id');

        // Attendance this month
        $attendanceThisMonth = Attendance::whereIn('class_id', $classIds)
            ->whereMonth('date', now()->month)
            ->whereYear('date', now()->year)
            ->count();

        // Assignments this month
        $assignmentsThisMonth = Assignment::where('tutor_id', $user->id)
            ->whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->count();

        // Get welcome message from settings
        $welcomeTitle = Setting::get('welcome_title', 'Chào mừng đến với Classly!');
        $welcomeContent = Setting::get('welcome_content', 'Chúng tôi rất vui được đồng hành cùng bạn trong hành trình học tập và phát triển.');

        return $this->successResponse([
            'user_type' => 'tutor',
            'welcome' => [
                'title' => $welcomeTitle,
                'content' => $welcomeContent,
            ],
            'statistics' => [
                'total_classes' => $totalClasses,
                'active_classes' => $activeClasses,
                'total_students' => $totalStudents,
                'attendance_this_month' => $attendanceThisMonth,
                'assignments_this_month' => $assignmentsThisMonth,
            ],
        ]);
    }

    /**
     * Aggregate dashboard for an organization owner/manager: totals across EVERY member tutor's
     * classes (scoped by classes.organization_id) plus a per-tutor break-down. Scope is derived from
     * the caller's active membership — never from request input.
     */
    private function orgOwnerDashboard(User $user): JsonResponse
    {
        $org = $user->currentOrganization();
        if (! $org) {
            return $this->errorResponse('Không tìm thấy tổ chức', null, 'NOT_FOUND', 404);
        }
        $orgId = $org->id;

        $orgClassIds = ClassRoom::where('organization_id', $orgId)->pluck('id');

        $totalClasses = $orgClassIds->count();
        $activeClasses = ClassRoom::where('organization_id', $orgId)
            ->where('status', 'active')
            ->count();

        $totalStudents = DB::table('class_student')
            ->whereIn('class_id', $orgClassIds)
            ->distinct('student_id')
            ->count('student_id');

        $attendanceThisMonth = Attendance::whereIn('class_id', $orgClassIds)
            ->whereMonth('date', now()->month)
            ->whereYear('date', now()->year)
            ->count();

        $revenueThisMonth = Payment::whereIn('class_id', $orgClassIds)
            ->where('status', 'paid')
            ->whereMonth('payment_date', now()->month)
            ->whereYear('payment_date', now()->year)
            ->sum('amount');

        $assignmentsThisMonth = Assignment::whereIn('class_id', $orgClassIds)
            ->whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->count();

        // Per-tutor break-down (each active member: their classes, students, attendance, revenue this month).
        $breakdown = [];
        foreach ($org->activeMembers()->with('user')->get() as $member) {
            $memberUser = $member->user;
            if (! $memberUser) {
                continue;
            }

            $memberClassIds = ClassRoom::where('organization_id', $orgId)
                ->where('tutor_id', $memberUser->id)
                ->pluck('id');

            $breakdown[] = [
                'tutor_id' => $memberUser->hash_id ?? null,
                'tutor_name' => $memberUser->name,
                'org_role' => $member->org_role,
                'total_classes' => $memberClassIds->count(),
                'total_students' => DB::table('class_student')
                    ->whereIn('class_id', $memberClassIds)
                    ->distinct('student_id')
                    ->count('student_id'),
                'attendance_this_month' => Attendance::whereIn('class_id', $memberClassIds)
                    ->whereMonth('date', now()->month)
                    ->whereYear('date', now()->year)
                    ->count(),
                'revenue_this_month' => Payment::whereIn('class_id', $memberClassIds)
                    ->where('status', 'paid')
                    ->whereMonth('payment_date', now()->month)
                    ->whereYear('payment_date', now()->year)
                    ->sum('amount'),
            ];
        }

        $welcomeTitle = Setting::get('welcome_title', 'Chào mừng đến với Classly!');
        $welcomeContent = Setting::get('welcome_content', 'Chúng tôi rất vui được đồng hành cùng bạn trong hành trình học tập và phát triển.');

        return $this->successResponse([
            'user_type' => 'organization',
            'org_role' => $user->orgRole(),
            'organization' => [
                '_id' => $org->hash_id,
                'name' => $org->name,
            ],
            'welcome' => [
                'title' => $welcomeTitle,
                'content' => $welcomeContent,
            ],
            'statistics' => [
                'total_classes' => $totalClasses,
                'active_classes' => $activeClasses,
                'total_students' => $totalStudents,
                'attendance_this_month' => $attendanceThisMonth,
                'revenue_this_month' => $revenueThisMonth,
                'assignments_this_month' => $assignmentsThisMonth,
            ],
            'tutor_breakdown' => $breakdown,
        ]);
    }

    /**
     * Dashboard for Student.
     * Student: chỉ thấy thống kê của chính họ.
     */
    private function studentDashboard(): JsonResponse
    {
        $user = $this->getAuthUser();

        // Check capability for advanced reports (học viên cần reports.view_advanced để xem dashboard)
        if ($capabilityError = $this->requirePlanCapability('reports.view_advanced')) {
            return $capabilityError;
        }

        // Lấy student profile (cached)
        $student = $this->getCurrentStudent();

        if (! $student) {
            return $this->errorResponse('Không tìm thấy thông tin học sinh', null, 'STUDENT_NOT_FOUND', 404);
        }

        // Lấy các lớp học mà student tham gia (cached)
        $classIds = $this->getStudentClassIds($student);

        // Get welcome message from settings
        $welcomeTitle = Setting::get('welcome_title', 'Chào mừng đến với Classly!');
        $welcomeContent = Setting::get('welcome_content', 'Chúng tôi rất vui được đồng hành cùng bạn trong hành trình học tập và phát triển.');

        if (empty($classIds)) {
            return $this->successResponse([
                'user_type' => 'student',
                'welcome' => [
                    'title' => $welcomeTitle,
                    'content' => $welcomeContent,
                ],
                'statistics' => [
                    'total_classes' => 0,
                    'total_assignments' => 0,
                    'total_submissions' => 0,
                    'pending_submissions' => 0,
                    'graded_submissions' => 0,
                    'total_grades' => 0,
                    'average_score' => 0,
                ],
            ]);
        }

        // Classes
        $totalClasses = count($classIds);

        // Assignments: từ các lớp họ tham gia
        $totalAssignments = Assignment::whereIn('class_id', $classIds)
            ->where('status', 'published')
            ->count();

        // Submissions: chỉ bài nộp của chính họ
        $totalSubmissions = Submission::where('student_id', $student->id)
            ->whereHas('assignment', function ($q) use ($classIds) {
                $q->whereIn('class_id', $classIds);
            })
            ->count();

        $pendingSubmissions = Submission::where('student_id', $student->id)
            ->where('status', 'pending')
            ->whereHas('assignment', function ($q) use ($classIds) {
                $q->whereIn('class_id', $classIds);
            })
            ->count();

        $gradedSubmissions = Submission::where('student_id', $student->id)
            ->where('status', 'graded')
            ->whereHas('assignment', function ($q) use ($classIds) {
                $q->whereIn('class_id', $classIds);
            })
            ->count();

        // Grades: chỉ điểm của chính họ
        $totalGrades = Grade::where('student_id', $student->id)
            ->whereIn('class_id', $classIds)
            ->count();

        // Average score — weighted by GradeType.weight (defaults to 1). See Grade::weightedAveragePercentage().
        $averageScore = Grade::weightedAveragePercentage(
            Grade::where('student_id', $student->id)->whereIn('class_id', $classIds)
        );

        // Attendance this month
        $attendanceThisMonth = Attendance::where('student_id', $student->id)
            ->whereIn('class_id', $classIds)
            ->whereMonth('date', now()->month)
            ->whereYear('date', now()->year)
            ->count();

        // Get welcome message from settings
        $welcomeTitle = Setting::get('welcome_title', 'Chào mừng đến với Classly!');
        $welcomeContent = Setting::get('welcome_content', 'Chúng tôi rất vui được đồng hành cùng bạn trong hành trình học tập và phát triển.');

        return $this->successResponse([
            'user_type' => 'student',
            'welcome' => [
                'title' => $welcomeTitle,
                'content' => $welcomeContent,
            ],
            'statistics' => [
                'total_classes' => $totalClasses,
                'total_assignments' => $totalAssignments,
                'total_submissions' => $totalSubmissions,
                'pending_submissions' => $pendingSubmissions,
                'graded_submissions' => $gradedSubmissions,
                'total_grades' => $totalGrades,
                'average_score' => round($averageScore, 2),
                'attendance_this_month' => $attendanceThisMonth,
            ],
        ]);
    }

    /**
     * Get detailed statistics.
     */
    public function statistics(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        $period = $request->get('period', '30'); // days
        $startDate = now()->subDays($period);

        if ($user->hasRole('super_admin')) {
            // Super Admin sees all data
            $classIds = ClassRoom::pluck('id');
        } elseif ($user->isOrgViewerAll()) {
            // Org owner/manager: aggregate across the whole org (before isTutor — R1).
            $classIds = ClassRoom::where('organization_id', $user->currentOrganization()?->id)->pluck('id');
        } elseif ($user->isTutor()) {
            $classIds = ClassRoom::where('tutor_id', $user->id)->pluck('id');
        } elseif ($user->isStudent()) {
            // Check capability for students
            if ($planError = $this->requirePlanCapability('reports.view_advanced')) {
                return $planError;
            }

            // Student: chỉ classes họ tham gia (cached)
            $student = $this->getCurrentStudent();
            if ($student) {
                $classIds = $this->getStudentClassIds($student);
            } else {
                $classIds = collect([]);
            }
        } else {
            return $this->errorResponse('Loại người dùng không hợp lệ', null, 'INVALID_USER', 403);
        }

        // Attendance trend
        $attendanceTrend = Attendance::whereIn('class_id', $classIds)
            ->where('date', '>=', $startDate)
            ->selectRaw('DATE(date) as date, COUNT(*) as count')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        // Assignment trend
        $assignmentTrend = Assignment::whereIn('class_id', $classIds)
            ->where('created_at', '>=', $startDate)
            ->selectRaw('DATE(created_at) as date, COUNT(*) as count')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return $this->successResponse([
            'period' => "{$period} days",
            'attendance_trend' => $attendanceTrend,
            'assignment_trend' => $assignmentTrend,
        ]);
    }

    /**
     * Get recent activity.
     */
    public function recentActivity(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        $limit = min($request->get('limit', 10), 50);

        if ($user->hasRole('super_admin')) {
            // Super Admin sees all data
            $classIds = ClassRoom::pluck('id');
        } elseif ($user->isOrgViewerAll()) {
            // Org owner/manager: aggregate across the whole org (before isTutor — R1).
            $classIds = ClassRoom::where('organization_id', $user->currentOrganization()?->id)->pluck('id');
        } elseif ($user->isTutor()) {
            $classIds = ClassRoom::where('tutor_id', $user->id)->pluck('id');
        } elseif ($user->isStudent()) {
            // Check capability for students
            if ($planError = $this->requirePlanCapability('reports.view_advanced')) {
                return $planError;
            }

            // Student: chỉ classes họ tham gia (cached)
            $student = $this->getCurrentStudent();
            if ($student) {
                $classIds = $this->getStudentClassIds($student);
            } else {
                $classIds = collect([]);
            }
        } else {
            return $this->errorResponse('Loại người dùng không hợp lệ', null, 'INVALID_USER', 403);
        }

        // Recent attendance
        $recentAttendance = Attendance::whereIn('class_id', $classIds)
            ->with(['class', 'student'])
            ->latest('date')
            ->take($limit)
            ->get()
            ->map(function ($attendance) {
                return [
                    'type' => 'attendance',
                    'date' => $attendance->date,
                    'description' => ($attendance->student?->name ?? 'Unknown Student').' - '.($attendance->class?->name ?? 'Unknown Class'),
                    'status' => $attendance->status,
                ];
            });

        // Recent assignments
        $recentAssignments = Assignment::whereIn('class_id', $classIds)
            ->with('class') // You might want ->with(['class' => fn($q) => $q->withTrashed()]) if you want to show deleted classes
            ->latest('created_at')
            ->take($limit)
            ->get()
            ->map(function ($assignment) {
                return [
                    'type' => 'assignment',
                    'date' => $assignment->created_at,
                    'description' => $assignment->title.' - '.($assignment->class?->name ?? 'Unknown Class'),
                    'due_date' => $assignment->due_date,
                ];
            });

        // Merge and sort
        $activities = $recentAttendance->concat($recentAssignments)
            ->sortByDesc('date')
            ->take($limit)
            ->values();

        return $this->successResponse([
            'activities' => $activities,
            'count' => $activities->count(),
        ]);
    }
}
