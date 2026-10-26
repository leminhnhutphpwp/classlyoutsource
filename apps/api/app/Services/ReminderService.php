<?php

namespace App\Services;

use App\Models\Assignment;
use App\Models\Payment;
use App\Models\PaymentRequest;
use App\Models\ScheduleSession;
use App\Models\Setting;
use App\Models\Student;
use App\Models\Submission;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ReminderService
{
    /**
     * Get all reminders for a user.
     */
    public function getRemindersForUser(User $user, array $options = []): array
    {
        $type = $options['type'] ?? 'all';
        $limit = min($options['limit'] ?? 20, 50);
        $page = max((int) ($options['page'] ?? 1), 1);
        $daysAhead = $options['days_ahead'] ?? null;
        $classId = $options['class_id'] ?? null;

        $reminders = [
            'schedule' => ['upcoming' => [], 'overdue' => [], 'all' => []],
            'payment' => ['all' => []],
            'assignment' => ['all' => []],
        ];

        $meta = [
            'schedule' => ['page' => $page, 'per_page' => $limit, 'total' => 0, 'last_page' => 1, 'counts' => ['upcoming' => 0, 'overdue' => 0]],
            'payment' => ['page' => $page, 'per_page' => $limit, 'total' => 0, 'last_page' => 1],
            'assignment' => ['page' => $page, 'per_page' => $limit, 'total' => 0, 'last_page' => 1],
        ];

        if ($user->isTutor()) {
            if ($type === 'all' || $type === 'schedule') {
                $result = $this->getScheduleRemindersForTutor($user, $daysAhead, $limit, $page, $classId);
                $reminders['schedule'] = $result['data'];
                $meta['schedule'] = $result['meta'];
            }

            if ($type === 'all' || $type === 'assignment') {
                $result = $this->getAssignmentRemindersForTutor($user, $daysAhead, $limit, $page, $classId);
                $reminders['assignment'] = $result['data'];
                $meta['assignment'] = $result['meta'];
            }
        } elseif ($user->isStudent()) {
            $student = $user->studentProfile()->first();
            if (! $student) {
                return [
                    'summary' => $this->calculateSummary($reminders, $meta),
                    'items' => [],
                    'meta' => $meta,
                ];
            }

            if ($type === 'all' || $type === 'schedule') {
                $result = $this->getScheduleRemindersForStudent($student, $daysAhead, $limit, $page, $classId);
                $reminders['schedule'] = $result['data'];
                $meta['schedule'] = $result['meta'];
            }

            if ($type === 'all' || $type === 'payment') {
                $result = $this->getPaymentRemindersForStudent($student, $daysAhead, $limit, $page, $classId);
                $reminders['payment'] = $result['data'];
                $meta['payment'] = $result['meta'];
            }

            if ($type === 'all' || $type === 'assignment') {
                $result = $this->getAssignmentRemindersForStudent($student, $daysAhead, $limit, $page, $classId);
                $reminders['assignment'] = $result['data'];
                $meta['assignment'] = $result['meta'];
            }
        }

        // Build flat list of all reminders, sorted by priority then days_remaining
        $flatItems = $this->sortByPriorityAndDate(array_merge(
            $reminders['schedule']['all'] ?? [],
            $reminders['payment']['all'] ?? [],
            $reminders['assignment']['all'] ?? []
        ));

        $summary = $this->calculateSummary($reminders, $meta);

        return [
            'summary' => $summary,
            'items' => $flatItems,
            'meta' => $meta,
        ];
    }

    /**
     * Get schedule reminders for tutor.
     */
    public function getScheduleRemindersForTutor(User $tutor, ?int $daysAhead = null, int $limit = 20, int $page = 1, ?int $classId = null): array
    {
        $daysAhead = $daysAhead ?? (int) Setting::get('notification.reminder_schedule_days_before', 7);
        $today = now()->startOfDay();
        $tomorrow = $today->copy()->addDay();
        $weekEnd = $today->copy()->addDays($daysAhead);

        $upcomingQuery = ScheduleSession::with(['class:id,name', 'schedule:id'])
            ->whereHas('class', fn ($q) => $q->where('tutor_id', $tutor->id))
            ->where('session_date', '>=', $today)
            ->where('session_date', '<=', $weekEnd)
            ->whereIn('status', ['scheduled', 'ongoing']);

        if ($classId) {
            $upcomingQuery->where('class_id', $classId);
        }

        $upcomingSessions = $upcomingQuery->orderBy('session_date')->orderBy('start_time')->get();

        $now = now();
        $overdueQuery = ScheduleSession::with(['class:id,name', 'schedule:id'])
            ->whereHas('class', fn ($q) => $q->where('tutor_id', $tutor->id))
            ->where(function ($q) use ($today, $now) {
                $q->where('session_date', '<', $today)
                    ->orWhere(function ($subQ) use ($today, $now) {
                        $subQ->whereDate('session_date', $today)
                            ->whereRaw("CONCAT(session_date, ' ', end_time) < ?", [$now]);
                    });
            })
            ->whereNotIn('status', ['completed', 'cancelled']);

        if ($classId) {
            $overdueQuery->where('class_id', $classId);
        }

        $overdueSessions = $overdueQuery->orderBy('session_date', 'desc')->orderBy('start_time', 'desc')->get();

        $upcoming = $upcomingSessions->map(fn ($s) => $this->formatScheduleReminder($s, 'upcoming', $today, $tomorrow))->toArray();
        $overdue = $overdueSessions->map(fn ($s) => $this->formatScheduleReminder($s, 'overdue', $today))->toArray();
        $all = $this->sortByPriorityAndDate(array_merge($upcoming, $overdue));

        [$paginated, $meta] = $this->paginateArray($all, $limit, $page);

        return [
            'data' => [
                'all' => $paginated,
                'upcoming' => array_values(array_filter($paginated, fn ($i) => $i['type'] === 'schedule_upcoming')),
                'overdue' => array_values(array_filter($paginated, fn ($i) => $i['type'] === 'schedule_overdue')),
            ],
            'meta' => array_merge($meta, ['counts' => ['upcoming' => count($upcoming), 'overdue' => count($overdue)]]),
        ];
    }

    /**
     * Get schedule reminders for student.
     */
    public function getScheduleRemindersForStudent(Student $student, ?int $daysAhead = null, int $limit = 20, int $page = 1, ?int $classId = null): array
    {
        $daysAhead = $daysAhead ?? (int) Setting::get('notification.reminder_schedule_days_before', 7);
        $today = now()->startOfDay();
        $tomorrow = $today->copy()->addDay();
        $weekEnd = $today->copy()->addDays($daysAhead);

        $classIds = DB::table('class_student')
            ->where('student_id', $student->id)
            ->when($classId, fn ($q) => $q->where('class_id', $classId))
            ->pluck('class_id')
            ->toArray();

        if (empty($classIds)) {
            return [
                'data' => ['upcoming' => [], 'overdue' => [], 'all' => []],
                'meta' => ['page' => $page, 'per_page' => $limit, 'total' => 0, 'last_page' => 1, 'counts' => ['upcoming' => 0, 'overdue' => 0]],
            ];
        }

        $upcomingSessions = ScheduleSession::with(['class:id,name', 'schedule:id'])
            ->whereIn('class_id', $classIds)
            ->when($classId, fn ($q) => $q->where('class_id', $classId))
            ->where('session_date', '>=', $today)
            ->where('session_date', '<=', $weekEnd)
            ->whereIn('status', ['scheduled', 'ongoing'])
            ->orderBy('session_date')
            ->orderBy('start_time')
            ->get();

        $upcoming = $upcomingSessions->map(fn ($s) => $this->formatScheduleReminder($s, 'upcoming', $today, $tomorrow, true))->toArray();
        $all = $this->sortByPriorityAndDate($upcoming);
        [$paginated, $meta] = $this->paginateArray($all, $limit, $page);

        return [
            'data' => ['all' => $paginated, 'upcoming' => $paginated, 'overdue' => []],
            'meta' => array_merge($meta, ['counts' => ['upcoming' => count($upcoming), 'overdue' => 0]]),
        ];
    }

    /**
     * Get payment reminders for student.
     */
    public function getPaymentRemindersForStudent(Student $student, ?int $daysAhead = null, int $limit = 20, int $page = 1, ?int $classId = null): array
    {
        $daysAhead = $daysAhead ?? (int) Setting::get('notification.reminder_payment_days_before', 7);
        $today = now()->startOfDay();
        $weekEnd = $today->copy()->addDays($daysAhead);

        $classIds = DB::table('class_student')
            ->where('student_id', $student->id)
            ->when($classId, fn ($q) => $q->where('class_id', $classId))
            ->pluck('class_id')
            ->toArray();

        if (empty($classIds)) {
            return [
                'data' => ['all' => []],
                'meta' => ['page' => $page, 'per_page' => $limit, 'total' => 0, 'last_page' => 1],
            ];
        }

        $payments = Payment::with(['class:id,name', 'paymentRequest:id,period_name'])
            ->where('student_id', $student->id)
            ->where('status', 'pending')
            ->whereBetween('due_date', [$today, $weekEnd])
            ->when($classId, fn ($q) => $q->where('class_id', $classId))
            ->orderBy('due_date')
            ->get();

        $paymentRequests = PaymentRequest::with(['class:id,name'])
            ->where('status', 'active')
            ->whereIn('class_id', $classIds)
            ->whereBetween('due_date', [$today, $weekEnd])
            ->whereDoesntHave('payments', fn ($q) => $q->where('student_id', $student->id)->where('status', 'paid'))
            ->when($classId, fn ($q) => $q->where('class_id', $classId))
            ->orderBy('due_date')
            ->get();

        $reminders = array_merge(
            $payments->map(fn ($p) => $this->formatPaymentReminder($p))->toArray(),
            $paymentRequests->map(fn ($r) => $this->formatPaymentRequestReminder($r, $student))->toArray()
        );

        usort($reminders, fn ($a, $b) => strtotime($a['due_date']) <=> strtotime($b['due_date']));
        [$paginated, $meta] = $this->paginateArray($reminders, $limit, $page);

        return ['data' => ['all' => $paginated], 'meta' => $meta];
    }

    /**
     * Get assignment reminders for student.
     */
    public function getAssignmentRemindersForStudent(Student $student, ?int $daysAhead = null, int $limit = 20, int $page = 1, ?int $classId = null): array
    {
        $daysAhead = $daysAhead ?? (int) Setting::get('notification.reminder_assignment_days_before', 3);
        $today = now()->startOfDay();
        $endDate = $today->copy()->addDays($daysAhead);

        // Get class IDs where student is enrolled
        $classIds = DB::table('class_student')
            ->where('student_id', $student->id)
            ->when($classId, fn ($q) => $q->where('class_id', $classId))
            ->pluck('class_id')
            ->toArray();

        if (empty($classIds)) {
            return [
                'data' => ['all' => []],
                'meta' => ['page' => $page, 'per_page' => $limit, 'total' => 0, 'last_page' => 1],
            ];
        }

        // Get assignments that student hasn't submitted yet
        $assignments = Assignment::with(['class:id,name'])
            ->whereIn('class_id', $classIds)
            ->where('status', 'published')
            ->whereNotNull('due_date')
            ->whereBetween('due_date', [$today, $endDate])
            ->when($classId, fn ($q) => $q->where('class_id', $classId))
            ->whereDoesntHave('submissions', fn ($q) => $q->where('student_id', $student->id)->where('status', '!=', 'not_submitted'))
            ->orderBy('due_date')
            ->get();

        $reminders = $assignments->map(fn ($assignment) => $this->formatStudentAssignmentReminder($assignment))->toArray();
        $reminders = $this->sortByPriorityAndDate($reminders);
        [$paginated, $meta] = $this->paginateArray($reminders, $limit, $page);

        return ['data' => ['all' => $paginated], 'meta' => $meta];
    }

    /**
     * Get assignment reminders for tutor.
     */
    public function getAssignmentRemindersForTutor(User $tutor, ?int $daysAhead = null, int $limit = 20, int $page = 1, ?int $classId = null): array
    {
        $daysAhead = $daysAhead ?? (int) Setting::get('notification.reminder_assignment_days_before', 3);
        $today = now()->startOfDay();
        $endDate = $today->copy()->addDays($daysAhead);
        $reminders = [];

        // 1. Assignments sắp đến hạn mà còn học viên chưa nộp
        $assignments = Assignment::with(['class:id,name', 'submissions:id,assignment_id,status'])
            ->where('tutor_id', $tutor->id)
            ->where('status', 'published')
            ->whereNotNull('due_date')
            ->whereBetween('due_date', [$today, $endDate])
            ->when($classId, fn ($q) => $q->where('class_id', $classId))
            ->get();

        foreach ($assignments as $assignment) {
            if (! $assignment->class) {
                continue;
            }

            $submittedCount = $assignment->submissions->where('status', '!=', 'not_submitted')->count();
            $totalStudents = $assignment->class->getActiveStudentCount();

            if ($submittedCount < $totalStudents) {
                $reminders[] = $this->formatAssignmentDueReminder($assignment, $totalStudents - $submittedCount);
            }
        }

        // 2. Submissions chưa chấm - Query trực tiếp từ DB
        $submissionIds = DB::table('submissions')
            ->join('assignments', 'submissions.assignment_id', '=', 'assignments.id')
            ->where('assignments.tutor_id', $tutor->id)
            ->where('submissions.status', '!=', 'not_submitted')
            ->whereNotNull('submissions.submitted_at')
            ->whereNull('submissions.graded_at')
            ->when($classId, fn ($q) => $q->where('assignments.class_id', $classId))
            ->pluck('submissions.id')
            ->toArray();

        if (! empty($submissionIds)) {
            $ungradedSubmissions = Submission::with(['assignment.class:id,name', 'student:id,name'])
                ->whereIn('id', $submissionIds)
                ->get();

            foreach ($ungradedSubmissions as $submission) {
                if ($submission->assignment && $submission->assignment->class) {
                    $reminders[] = $this->formatSubmissionUngradedReminder($submission);
                }
            }
        }

        $reminders = $this->sortByPriorityAndDate($reminders);
        [$paginated, $meta] = $this->paginateArray($reminders, $limit, $page);

        return ['data' => ['all' => $paginated], 'meta' => $meta];
    }

    /**
     * Format student assignment reminder (bài tập chưa nộp).
     */
    private function formatStudentAssignmentReminder(Assignment $assignment): array
    {
        $today = now()->startOfDay();
        $dueDate = $assignment->due_date instanceof Carbon
            ? $assignment->due_date->copy()->startOfDay()
            : Carbon::parse($assignment->due_date)->startOfDay();

        $daysRemaining = $today->diffInDays($dueDate, false);

        if ($daysRemaining < 0) {
            $priority = 'high';
            $title = 'Bài tập quá hạn';
            $message = "Bạn chưa nộp bài tập \"{$assignment->title}\" - đã quá hạn ".abs($daysRemaining).' ngày';
        } elseif ($daysRemaining === 0) {
            $priority = 'high';
            $title = 'Bài tập đến hạn hôm nay';
            $message = "Bạn chưa nộp bài tập \"{$assignment->title}\" - đến hạn hôm nay";
        } elseif ($daysRemaining <= 2) {
            $priority = 'medium';
            $title = 'Bài tập sắp đến hạn';
            $message = "Bạn chưa nộp bài tập \"{$assignment->title}\" - đến hạn vào ngày {$dueDate->format('d/m/Y')}";
        } else {
            $priority = 'low';
            $title = 'Bài tập sắp đến hạn';
            $message = "Bạn chưa nộp bài tập \"{$assignment->title}\" - đến hạn vào ngày {$dueDate->format('d/m/Y')}";
        }

        return [
            '_id' => $assignment->hash_id,
            'category' => 'assignment',
            'type' => $daysRemaining < 0 ? 'assignment_overdue' : ($daysRemaining === 0 ? 'assignment_due_today' : 'assignment_due_soon'),
            'title' => $title,
            'message' => $message,
            'priority' => $priority,
            'due_date' => $assignment->due_date->format('Y-m-d'),
            'days_remaining' => $daysRemaining < 0 ? null : $daysRemaining,
            'days_overdue' => $daysRemaining < 0 ? abs($daysRemaining) : null,
            'class' => $assignment->class ? ['_id' => $assignment->class->hash_id, 'name' => $assignment->class->name] : null,
            'assignment' => ['_id' => $assignment->hash_id, 'title' => $assignment->title],
            'action_url' => "/assignments/{$assignment->hash_id}",
            'action_label' => 'Nộp bài ngay',
            'created_at' => $assignment->created_at->toIso8601String(),
        ];
    }

    /**
     * Format assignment due reminder (còn học viên chưa nộp - cho gia sư).
     */
    private function formatAssignmentDueReminder(Assignment $assignment, int $unsubmittedCount): array
    {
        $today = now()->startOfDay();
        $dueDate = $assignment->due_date instanceof Carbon
            ? $assignment->due_date->copy()->startOfDay()
            : Carbon::parse($assignment->due_date)->startOfDay();

        $daysRemaining = $today->diffInDays($dueDate, false);

        if ($daysRemaining < 0) {
            $priority = 'high';
            $title = 'Bài tập quá hạn';
            $message = "Bài tập \"{$assignment->title}\" đã quá hạn nhưng còn {$unsubmittedCount} học viên chưa nộp";
        } elseif ($daysRemaining === 0) {
            $priority = 'high';
            $title = 'Bài tập đến hạn hôm nay';
            $message = "Bài tập \"{$assignment->title}\" đến hạn hôm nay nhưng còn {$unsubmittedCount} học viên chưa nộp";
        } elseif ($daysRemaining <= 2) {
            $priority = 'medium';
            $title = 'Bài tập sắp đến hạn';
            $message = "Bài tập \"{$assignment->title}\" sắp đến hạn vào ngày {$dueDate->format('d/m/Y')} nhưng còn {$unsubmittedCount} học viên chưa nộp";
        } else {
            $priority = 'low';
            $title = 'Bài tập sắp đến hạn';
            $message = "Bài tập \"{$assignment->title}\" đến hạn vào ngày {$dueDate->format('d/m/Y')} nhưng còn {$unsubmittedCount} học viên chưa nộp";
        }

        return [
            '_id' => $assignment->hash_id,
            'category' => 'assignment',
            'type' => $daysRemaining < 0 ? 'assignment_overdue' : ($daysRemaining === 0 ? 'assignment_due_today' : 'assignment_due_soon'),
            'title' => $title,
            'message' => $message,
            'priority' => $priority,
            'due_date' => $assignment->due_date->format('Y-m-d'),
            'days_remaining' => $daysRemaining < 0 ? null : $daysRemaining,
            'days_overdue' => $daysRemaining < 0 ? abs($daysRemaining) : null,
            'unsubmitted_count' => $unsubmittedCount,
            'class' => $assignment->class ? ['_id' => $assignment->class->hash_id, 'name' => $assignment->class->name] : null,
            'assignment' => ['_id' => $assignment->hash_id, 'title' => $assignment->title],
            'action_url' => "/assignments/{$assignment->hash_id}",
            'action_label' => 'Xem chi tiết',
            'created_at' => $assignment->created_at->toIso8601String(),
        ];
    }

    /**
     * Format submission ungraded reminder.
     */
    private function formatSubmissionUngradedReminder(Submission $submission): array
    {
        $assignment = $submission->assignment;
        $student = $submission->student;
        $studentName = $student ? $student->name : 'Học viên';
        $message = "Bài nộp của {$studentName} cho bài tập \"{$assignment->title}\" chưa được chấm";

        $priority = 'medium';
        $dueDate = null;
        $daysRemaining = null;
        $daysOverdue = null;

        if ($assignment->due_date) {
            $dueDate = $assignment->due_date instanceof Carbon
                ? $assignment->due_date->copy()->startOfDay()
                : Carbon::parse($assignment->due_date)->startOfDay();

            $today = now()->startOfDay();
            $daysRemaining = $today->diffInDays($dueDate, false);

            if ($daysRemaining < 0) {
                $priority = 'high';
                $daysOverdue = abs($daysRemaining);
            }
        }

        return [
            '_id' => $submission->hash_id,
            'category' => 'assignment',
            'type' => 'submission_ungraded',
            'title' => 'Bài nộp chưa chấm',
            'message' => $message,
            'priority' => $priority,
            'due_date' => $dueDate ? $dueDate->format('Y-m-d') : null,
            'days_remaining' => $daysRemaining !== null && $daysRemaining >= 0 ? $daysRemaining : null,
            'days_overdue' => $daysOverdue,
            'class' => $assignment->class ? ['_id' => $assignment->class->hash_id, 'name' => $assignment->class->name] : null,
            'assignment' => ['_id' => $assignment->hash_id, 'title' => $assignment->title],
            'student' => $student ? ['_id' => $student->hash_id, 'name' => $student->name] : null,
            'action_url' => "/submissions/{$submission->hash_id}",
            'action_label' => 'Xem chi tiết',
            'created_at' => ($submission->submitted_at ?: $submission->created_at)->toIso8601String(),
        ];
    }

    /**
     * Format schedule reminder.
     */
    private function formatScheduleReminder(ScheduleSession $session, string $type, Carbon $today, ?Carbon $tomorrow = null, bool $isStudent = false): array
    {
        $sessionDate = $session->session_date instanceof Carbon
            ? $session->session_date->copy()->startOfDay()
            : Carbon::parse($session->session_date)->startOfDay();

        if (! $tomorrow) {
            $tomorrow = $today->copy()->addDay()->startOfDay();
        } else {
            $tomorrow = $tomorrow->copy()->startOfDay();
        }

        $daysDiff = $today->diffInDays($sessionDate, false);
        $prefix = $isStudent ? 'Buổi học' : 'Lịch dạy';
        $verb = $isStudent ? 'buổi học' : 'lịch dạy';
        $className = $session->class->name ?? 'N/A';

        if ($type === 'upcoming') {
            if ($sessionDate->isToday()) {
                $priority = 'high';
                $title = "{$prefix} hôm nay";
                $message = "Bạn có {$verb} lớp {$className} vào hôm nay lúc {$session->start_time->format('H:i')}";
            } elseif ($sessionDate->isSameDay($tomorrow)) {
                $priority = 'high';
                $title = "{$prefix} ngày mai";
                $message = "Bạn có {$verb} lớp {$className} vào ngày mai ({$sessionDate->format('d/m/Y')}) lúc {$session->start_time->format('H:i')}";
            } elseif ($daysDiff > 0 && $daysDiff <= 3) {
                $priority = 'medium';
                $title = "{$prefix} sắp tới";
                $message = "Bạn có {$verb} lớp {$className} vào ngày {$sessionDate->format('d/m/Y')} lúc {$session->start_time->format('H:i')}";
            } else {
                $priority = 'low';
                $title = "{$prefix} sắp tới";
                $message = "Bạn có {$verb} lớp {$className} vào ngày {$sessionDate->format('d/m/Y')} lúc {$session->start_time->format('H:i')}";
            }

            $daysRemaining = max(0, $daysDiff);
            $daysOverdue = null;
        } else {
            $daysOverdue = $today->diffInDays($sessionDate);
            $priority = 'high';
            $title = $isStudent ? 'Buổi học chưa hoàn thành' : 'Lịch dạy chưa hoàn thành';
            $message = ($isStudent ? 'Buổi học' : 'Lịch dạy')." lớp {$className} ngày {$sessionDate->format('d/m/Y')} chưa được đánh dấu hoàn thành";
            $daysRemaining = null;
        }

        $location = '';
        if ($session->mode === 'online' && $session->online_meeting_url) {
            $location = $session->online_meeting_url;
        } elseif ($session->mode === 'offline') {
            $location = $session->location ?: ($session->room ? "Phòng {$session->room}" : '');
        }

        return [
            '_id' => $session->hash_id,
            'category' => 'schedule',
            'type' => $type === 'upcoming' ? 'schedule_upcoming' : 'schedule_overdue',
            'title' => $title,
            'message' => $message,
            'priority' => $priority,
            'session_date' => $session->session_date->format('Y-m-d'),
            'start_time' => $session->start_time->format('H:i'),
            'end_time' => $session->end_time->format('H:i'),
            'mode' => $session->mode,
            'location' => $location,
            'class' => $session->class ? ['_id' => $session->class->hash_id, 'name' => $session->class->name] : null,
            'days_remaining' => $daysRemaining,
            'days_overdue' => $daysOverdue,
            'action_url' => "/schedule-sessions/{$session->hash_id}",
            'action_label' => $type === 'overdue' ? 'Đánh dấu hoàn thành' : 'Xem chi tiết',
            'created_at' => $session->created_at->toIso8601String(),
        ];
    }

    /**
     * Format payment reminder.
     */
    private function formatPaymentReminder(Payment $payment): array
    {
        $today = now()->startOfDay();
        $dueDate = Carbon::parse($payment->due_date);
        $daysRemaining = $today->diffInDays($dueDate, false);
        $className = $payment->class->name ?? 'N/A';
        $amount = number_format($payment->amount, 0, ',', '.');

        if ($daysRemaining < 0) {
            $priority = 'high';
            $title = 'Học phí quá hạn';
            $message = "Bạn có khoản học phí {$amount} VNĐ cho lớp {$className} đã quá hạn ".abs($daysRemaining).' ngày';
        } elseif ($daysRemaining === 0) {
            $priority = 'high';
            $title = 'Học phí đến hạn hôm nay';
            $message = "Bạn có khoản học phí {$amount} VNĐ cho lớp {$className} đến hạn hôm nay";
        } elseif ($daysRemaining <= 3) {
            $priority = 'medium';
            $title = 'Học phí sắp đến hạn';
            $message = "Bạn có khoản học phí {$amount} VNĐ cho lớp {$className} đến hạn vào ngày {$dueDate->format('d/m/Y')}";
        } else {
            $priority = 'low';
            $title = 'Học phí sắp tới hạn';
            $message = "Bạn có khoản học phí {$amount} VNĐ cho lớp {$className} đến hạn vào ngày {$dueDate->format('d/m/Y')}";
        }

        return [
            '_id' => $payment->hash_id,
            'category' => 'payment',
            'type' => $daysRemaining < 0 ? 'payment_overdue' : ($daysRemaining === 0 ? 'payment_due_today' : ($daysRemaining <= 3 ? 'payment_due_soon' : 'payment_upcoming')),
            'title' => $title,
            'message' => $message,
            'priority' => $priority,
            'amount' => (float) $payment->amount,
            'due_date' => $payment->due_date->format('Y-m-d'),
            'days_remaining' => $daysRemaining,
            'class' => $payment->class ? ['_id' => $payment->class->hash_id, 'name' => $payment->class->name] : null,
            'payment_request' => $payment->paymentRequest ? ['_id' => $payment->paymentRequest->hash_id, 'period_name' => $payment->paymentRequest->period_name] : null,
            'action_url' => "/payments/{$payment->hash_id}",
            'action_label' => 'Xem chi tiết',
            'created_at' => $payment->created_at->toIso8601String(),
        ];
    }

    /**
     * Format payment request reminder.
     */
    private function formatPaymentRequestReminder(PaymentRequest $request, Student $student): array
    {
        $today = now()->startOfDay();
        $dueDate = Carbon::parse($request->due_date);
        $daysRemaining = $today->diffInDays($dueDate, false);
        $className = $request->class->name ?? 'N/A';
        $amount = number_format($request->amount_per_student, 0, ',', '.');

        if ($daysRemaining < 0) {
            $priority = 'high';
            $title = 'Học phí quá hạn';
            $message = "Bạn có đợt thu học phí {$amount} VNĐ cho lớp {$className} ({$request->period_name}) đã quá hạn ".abs($daysRemaining).' ngày';
        } elseif ($daysRemaining === 0) {
            $priority = 'high';
            $title = 'Học phí đến hạn hôm nay';
            $message = "Bạn có đợt thu học phí {$amount} VNĐ cho lớp {$className} ({$request->period_name}) đến hạn hôm nay";
        } elseif ($daysRemaining <= 3) {
            $priority = 'medium';
            $title = 'Học phí sắp đến hạn';
            $message = "Bạn có đợt thu học phí {$amount} VNĐ cho lớp {$className} ({$request->period_name}) đến hạn vào ngày {$dueDate->format('d/m/Y')}";
        } else {
            $priority = 'low';
            $title = 'Học phí sắp tới hạn';
            $message = "Bạn có đợt thu học phí {$amount} VNĐ cho lớp {$className} ({$request->period_name}) đến hạn vào ngày {$dueDate->format('d/m/Y')}";
        }

        return [
            '_id' => $request->hash_id,
            'category' => 'payment',
            'type' => $daysRemaining < 0 ? 'payment_overdue' : ($daysRemaining === 0 ? 'payment_due_today' : ($daysRemaining <= 3 ? 'payment_due_soon' : 'payment_upcoming')),
            'title' => $title,
            'message' => $message,
            'priority' => $priority,
            'amount' => (float) $request->amount_per_student,
            'due_date' => $request->due_date->format('Y-m-d'),
            'days_remaining' => $daysRemaining,
            'class' => $request->class ? ['_id' => $request->class->hash_id, 'name' => $request->class->name] : null,
            'payment_request' => ['_id' => $request->hash_id, 'period_name' => $request->period_name],
            'action_url' => "/classes/{$request->class->hash_id}/payments",
            'action_label' => 'Xem chi tiết',
            'created_at' => $request->created_at->toIso8601String(),
        ];
    }

    /**
     * Calculate summary statistics.
     */
    private function calculateSummary(array $reminders, array $meta): array
    {
        $scheduleUpcoming = $meta['schedule']['counts']['upcoming'] ?? count($reminders['schedule']['upcoming'] ?? []);
        $scheduleOverdue = $meta['schedule']['counts']['overdue'] ?? count($reminders['schedule']['overdue'] ?? []);
        $paymentDue = $meta['payment']['total'] ?? count($reminders['payment']['all'] ?? []);
        $assignmentDue = $meta['assignment']['total'] ?? count($reminders['assignment']['all'] ?? []);

        $highPriority = 0;
        foreach (['schedule', 'payment', 'assignment'] as $type) {
            foreach ($reminders[$type]['all'] ?? [] as $reminder) {
                if (($reminder['priority'] ?? null) === 'high') {
                    $highPriority++;
                }
            }
        }

        return [
            'total' => $scheduleUpcoming + $scheduleOverdue + $paymentDue + $assignmentDue,
            'schedule_upcoming' => $scheduleUpcoming,
            'schedule_overdue' => $scheduleOverdue,
            'payment_due' => $paymentDue,
            'assignment_due' => $assignmentDue,
            'high_priority' => $highPriority,
        ];
    }

    /**
     * Paginate an array of items.
     */
    private function paginateArray(array $items, int $perPage, int $page): array
    {
        $total = count($items);
        $perPage = max(1, $perPage);
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = max(1, min($page, $lastPage));
        $offset = ($page - 1) * $perPage;

        return [
            array_slice($items, $offset, $perPage),
            ['page' => $page, 'per_page' => $perPage, 'total' => $total, 'last_page' => $lastPage],
        ];
    }

    /**
     * Sort reminders by priority then date/time.
     */
    private function sortByPriorityAndDate(array $items): array
    {
        $priorityOrder = ['high' => 3, 'medium' => 2, 'low' => 1];

        usort($items, function ($a, $b) use ($priorityOrder) {
            $pa = $priorityOrder[$a['priority']] ?? 1;
            $pb = $priorityOrder[$b['priority']] ?? 1;

            if ($pa !== $pb) {
                return $pb <=> $pa;
            }

            $da = isset($a['days_overdue']) && $a['days_overdue'] !== null
                ? -abs((int) $a['days_overdue'])
                : (isset($a['days_remaining']) && $a['days_remaining'] !== null ? (int) $a['days_remaining'] : PHP_INT_MAX);

            $db = isset($b['days_overdue']) && $b['days_overdue'] !== null
                ? -abs((int) $b['days_overdue'])
                : (isset($b['days_remaining']) && $b['days_remaining'] !== null ? (int) $b['days_remaining'] : PHP_INT_MAX);

            if ($da !== $db) {
                return $da <=> $db;
            }

            $dateA = $a['session_date'] ?? $a['due_date'] ?? null;
            $dateB = $b['session_date'] ?? $b['due_date'] ?? null;

            return ($dateA && $dateB && $dateA !== $dateB) ? strcmp($dateA, $dateB) : 0;
        });

        return $items;
    }
}
