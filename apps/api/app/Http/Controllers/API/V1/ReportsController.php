<?php

namespace App\Http\Controllers\API\V1;

use App\Exports\ReportExport;
use App\Models\Assignment;
use App\Models\Attendance;
use App\Models\ClassRoom;
use App\Models\Grade;
use App\Models\GradeType;
use App\Models\LoginActivity;
use App\Models\Payment;
use App\Models\PaymentRequest;
use App\Models\ScheduleSession;
use App\Models\Student;
use App\Models\Submission;
use App\Models\User;
use App\Rules\ExistsHashId;
use App\Services\DataJobService;
use App\Services\Reports\CsvExporter;
use App\Traits\DecodesHashIds;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Maatwebsite\Excel\Facades\Excel;

class ReportsController extends BaseController
{
    use DecodesHashIds;

    /**
     * Get overview statistics
     *
     * Query Parameters (Optional):
     * - date_from: YYYY-MM-DD format, filter sessions from this date
     * - date_to: YYYY-MM-DD format, filter sessions to this date
     */
    public function overview(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Validate date format if provided
        $validator = Validator::make($request->all(), [
            'date_from' => 'nullable|date_format:Y-m-d',
            'date_to' => 'nullable|date_format:Y-m-d',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Định dạng ngày không hợp lệ. Sử dụng định dạng YYYY-MM-DD', $validator, 'INVALID_DATE_FORMAT', 422);
        }

        // Validate date range
        if ($request->filled('date_from') && $request->filled('date_to') && $request->date_from > $request->date_to) {
            return $this->errorResponse('date_from phải nhỏ hơn hoặc bằng date_to', null, 'INVALID_DATE_RANGE', 422);
        }

        // Total sessions - count real ScheduleSession rows from tutor's classes (with data isolation).
        // (The legacy ClassSession table was never populated, so this metric used to be ~0.)
        // Get class IDs of tutor (with data isolation)
        $classIdsQuery = ClassRoom::query();
        $classIdsQuery = $this->applyDataIsolation($classIdsQuery, 'classes');
        $classIds = $classIdsQuery->pluck('id');

        // Count sessions that were not cancelled
        $sessionsQuery = ScheduleSession::whereIn('class_id', $classIds)
            ->where('status', '!=', 'cancelled');

        // Filter by date if provided
        if ($request->filled('date_from')) {
            $sessionsQuery->where('session_date', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $sessionsQuery->where('session_date', '<=', $request->date_to);
        }

        // Default: last 30 days if no date filters
        if (! $request->filled('date_from') && ! $request->filled('date_to')) {
            $sessionsQuery->where('session_date', '>=', now()->subDays(30)->toDateString());
        }

        $totalSessions = $sessionsQuery->count();

        // Check capabilities để frontend biết có nên hiển thị các tính năng báo cáo hay không
        $permissions = $this->buildMultiplePermissions([
            'can_view_basic' => 'reports.view_basic',
            'can_view_advanced' => 'reports.view_advanced',
        ]);

        return $this->successResponse([
            'summary' => [
                'total_sessions' => $totalSessions,
            ],
            'permissions' => $permissions,
        ]);
    }

    /**
     * Get revenue statistics grouped by date (from payments)
     *
     * Query Parameters (Optional):
     * - date_from: YYYY-MM-DD format, filter from this date
     * - date_to: YYYY-MM-DD format, filter to this date
     * - payment_method: Filter by payment method (string, e.g. 'bank', 'cash', 'bank_transfer')
     *
     * Default: If no date filters, returns last 30 days
     */
    public function revenue(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        if ($planError = $this->requirePlanCapability('reports.view_advanced')) {
            return $planError;
        }

        // Validate date format if provided
        $validator = Validator::make($request->all(), [
            'date_from' => 'nullable|date_format:Y-m-d',
            'date_to' => 'nullable|date_format:Y-m-d',
            'payment_method' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Định dạng dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        // Validate date range
        if ($request->filled('date_from') && $request->filled('date_to') && $request->date_from > $request->date_to) {
            return $this->errorResponse('date_from phải nhỏ hơn hoặc bằng date_to', null, 'INVALID_DATE_RANGE', 422);
        }

        // Build query with data isolation
        $query = Payment::query();
        $query = $this->applyDataIsolation($query, 'payments');
        $query->where('status', 'paid');

        // Date filters
        if ($request->filled('date_from')) {
            $query->where('payment_date', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->where('payment_date', '<=', $request->date_to);
        }

        // Default: last 30 days if no date filters
        if (! $request->filled('date_from') && ! $request->filled('date_to')) {
            $query->where('payment_date', '>=', now()->subDays(30)->toDateString());
        }

        // Payment method filter
        if ($request->has('payment_method') && ! empty($request->payment_method)) {
            $paymentMethod = $request->payment_method;

            // Handle common mapping
            if ($paymentMethod === 'bank_transfer') {
                $query->where(function ($q) use ($paymentMethod) {
                    $q->where('payment_method', 'bank')
                        ->orWhere('payment_method', 'bank_transfer')
                        ->orWhere('payment_method', $paymentMethod);
                });
            } else {
                $query->where('payment_method', $paymentMethod);
            }
        }

        // Group by date and sum totals
        $rows = $query->orderBy('payment_date')
            ->get(['payment_date', 'amount'])
            ->groupBy(fn ($p) => $p->payment_date->toDateString())
            ->map(function ($g) {
                $total = (float) $g->sum('amount');

                return [
                    'date' => $g->first()->payment_date->toDateString(),
                    'total' => $total,
                    'total_formatted' => $this->formatDecimal($total),
                ];
            })
            ->values();

        return $this->successResponse($rows);
    }

    /**
     * Get payments statistics
     *
     * Query Parameters (Optional):
     * - date_from: YYYY-MM-DD format, filter from this date
     * - date_to: YYYY-MM-DD format, filter to this date
     * - payment_method: Filter by payment method (cash, bank, other)
     *
     * Returns:
     * - Total payments and amounts
     * - Distribution by payment method
     * - Distribution by status
     * - Payment trend over time
     * - Top paying students
     */
    public function payments(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        if ($planError = $this->requirePlanCapability('reports.view_advanced')) {
            return $planError;
        }

        // Validate input
        $validator = Validator::make($request->all(), [
            'date_from' => 'nullable|date_format:Y-m-d',
            'date_to' => 'nullable|date_format:Y-m-d',
            'payment_method' => 'nullable|string|in:cash,bank,bank_transfer,other',
            'status' => 'nullable|string|in:paid,pending,failed,refunded,all',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Định dạng dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        // Validate date range
        if ($request->filled('date_from') && $request->filled('date_to') && $request->date_from > $request->date_to) {
            return $this->errorResponse('date_from phải nhỏ hơn hoặc bằng date_to', null, 'INVALID_DATE_RANGE', 422);
        }

        // Build query with data isolation
        $query = Payment::query()->with(['student', 'class']);

        // Apply data isolation
        $query = $this->applyDataIsolation($query, 'payments');

        // Date filters
        if ($request->filled('date_from')) {
            $query->where('payment_date', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->where('payment_date', '<=', $request->date_to);
        }

        // Default: last 30 days if no date filters
        if (! $request->filled('date_from') && ! $request->filled('date_to')) {
            $query->where('payment_date', '>=', now()->subDays(30)->toDateString());
        }

        // Payment method filter
        if ($request->filled('payment_method')) {
            $method = $request->payment_method === 'bank_transfer' ? 'bank' : $request->payment_method;
            $query->where('payment_method', $method);
        }

        // Status filter
        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Total statistics
        $totalPayments = (clone $query)->count();
        $totalAmount = (clone $query)->sum('amount');
        $averageAmount = $totalPayments > 0 ? $totalAmount / $totalPayments : 0;

        // Group by payment method
        $byMethod = (clone $query)
            ->selectRaw('payment_method, COUNT(*) as count, SUM(amount) as total')
            ->groupBy('payment_method')
            ->get()
            ->map(function ($item) use ($totalAmount) {
                $itemTotal = (float) $item->total;
                $percentage = $totalAmount > 0 ? ($itemTotal / $totalAmount) * 100 : 0;

                return [
                    'payment_method' => $item->payment_method,
                    'count' => (int) $item->count,
                    'total' => $itemTotal,
                    'total_formatted' => $this->formatDecimal($itemTotal),
                    'percentage' => $percentage,
                    'percentage_formatted' => $this->formatPercentage($percentage),
                ];
            });

        // Group by status
        $byStatus = (clone $query)
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->get()
            ->map(function ($item) {
                return [
                    'status' => $item->status,
                    'count' => (int) $item->count,
                ];
            });

        // Payment trend by date
        $trend = (clone $query)
            ->selectRaw('DATE(payment_date) as date, COUNT(*) as count, SUM(amount) as total')
            ->whereNotNull('payment_date')
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(function ($item) {
                $itemTotal = (float) $item->total;

                return [
                    'date' => $item->date,
                    'count' => (int) $item->count,
                    'total' => $itemTotal,
                    'total_formatted' => $this->formatDecimal($itemTotal),
                ];
            });

        // Top paying students
        $topStudents = (clone $query)
            ->selectRaw('student_id, COUNT(*) as total_payments, SUM(amount) as total_amount')
            ->whereNotNull('student_id')
            ->groupBy('student_id')
            ->orderBy('total_amount', 'desc')
            ->limit(10)
            ->with('student')
            ->get()
            ->map(function ($item) {
                $itemTotal = (float) $item->total_amount;

                return [
                    'student_id' => $item->student_id,
                    'student_name' => $item->student?->name ?? 'N/A',
                    'total_payments' => (int) $item->total_payments,
                    'total_amount' => $itemTotal,
                    'total_amount_formatted' => $this->formatDecimal($itemTotal),
                ];
            });

        // Period label
        $periodLabel = 'last 30 days';
        if ($request->filled('date_from') && $request->filled('date_to')) {
            $periodLabel = "{$request->date_from} to {$request->date_to}";
        } elseif ($request->filled('date_from')) {
            $periodLabel = "from {$request->date_from}";
        } elseif ($request->filled('date_to')) {
            $periodLabel = "until {$request->date_to}";
        }

        return $this->successResponse([
            'period' => $periodLabel,
            'summary' => [
                'total_payments' => $totalPayments,
                'total_amount' => (float) $totalAmount,
                'total_amount_formatted' => $this->formatDecimal($totalAmount),
                'average_amount' => $averageAmount,
                'average_amount_formatted' => $this->formatDecimal($averageAmount),
            ],
            'by_method' => $byMethod,
            'by_status' => $byStatus,
            'trend' => $trend,
            'top_students' => $topStudents,
        ]);
    }

    /**
     * Get attendance statistics
     *
     * Query Parameters (Optional):
     * - date_from: YYYY-MM-DD format, filter from this date
     * - date_to: YYYY-MM-DD format, filter to this date
     * - class_id: Filter by specific class
     *
     * Returns:
     * - Overall attendance rate
     * - Distribution by class
     * - Attendance trend over time
     * - Top students by attendance rate
     */
    public function attendance(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Validate input
        $validator = Validator::make($request->all(), [
            'date_from' => 'nullable|date_format:Y-m-d',
            'date_to' => 'nullable|date_format:Y-m-d',
            'class_id' => ['nullable', new ExistsHashId(ClassRoom::class)],
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Định dạng dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        $this->decodeHashId($request, 'class_id', ClassRoom::class);

        // Validate date range
        if ($request->filled('date_from') && $request->filled('date_to') && $request->date_from > $request->date_to) {
            return $this->errorResponse('date_from phải nhỏ hơn hoặc bằng date_to', null, 'INVALID_DATE_RANGE', 422);
        }

        if ($validator->fails()) {
            return $this->errorResponse('Định dạng dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        // Build query with data isolation
        $query = Attendance::query()->with(['class', 'student']);

        // Apply data isolation
        $query = $this->applyDataIsolation($query, 'attendances');

        // Date filters
        if ($request->filled('date_from')) {
            $query->where('date', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->where('date', '<=', $request->date_to);
        }

        // Default: last 30 days if no date filters
        if (! $request->filled('date_from') && ! $request->filled('date_to')) {
            $query->where('date', '>=', now()->subDays(30)->toDateString());
        }

        // Class filter
        if ($request->filled('class_id')) {
            $query->where('class_id', $request->class_id);
        }

        // Overall statistics
        $totalRecords = (clone $query)->count();
        $presentCount = (clone $query)->where('status', 'present')->count();
        $absentCount = (clone $query)->where('status', 'absent')->count();
        $lateCount = (clone $query)->where('status', 'late')->count();
        $excusedCount = (clone $query)->where('status', 'excused')->count();
        $attendanceRate = $totalRecords > 0 ? ($presentCount / $totalRecords) * 100 : 0;

        // Distribution by status
        $byStatus = [
            'present' => $presentCount,
            'absent' => $absentCount,
            'late' => $lateCount,
            'excused' => $excusedCount,
        ];

        // Distribution by class
        $byClass = (clone $query)
            ->selectRaw('class_id, COUNT(*) as total, 
                SUM(CASE WHEN status = "present" THEN 1 ELSE 0 END) as present_count,
                SUM(CASE WHEN status = "absent" THEN 1 ELSE 0 END) as absent_count')
            ->whereNotNull('class_id')
            ->groupBy('class_id')
            ->with('class:id,name')
            ->get()
            ->map(function ($item) {
                $attendanceRate = $item->total > 0
                    ? ($item->present_count / $item->total) * 100
                    : 0;

                return [
                    'class_id' => $item->class_id,
                    'class_name' => $item->class?->name ?? 'N/A',
                    'total_records' => (int) $item->total,
                    'present_count' => (int) $item->present_count,
                    'absent_count' => (int) $item->absent_count,
                    'attendance_rate' => $attendanceRate,
                    'attendance_rate_formatted' => $this->formatPercentage($attendanceRate),
                ];
            });

        // Attendance trend by date
        $trend = (clone $query)
            ->selectRaw('DATE(date) as date, 
                COUNT(*) as total,
                SUM(CASE WHEN status = "present" THEN 1 ELSE 0 END) as present_count')
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(function ($item) {
                $attendanceRate = $item->total > 0
                    ? ($item->present_count / $item->total) * 100
                    : 0;

                return [
                    'date' => $item->date,
                    'total' => (int) $item->total,
                    'present_count' => (int) $item->present_count,
                    'attendance_rate' => $attendanceRate,
                    'attendance_rate_formatted' => $this->formatPercentage($attendanceRate),
                ];
            });

        // Top students by attendance rate
        // When class_id is provided, use min 1 record; otherwise min 1 to show all students
        // (Previously 5, but this excluded many students with fewer attendance records)
        $minRecords = 1;

        if ($request->filled('class_id')) {
            // When filtering by class_id: group by student_id, class_id (one class per student)
            $topStudentsQuery = (clone $query)
                ->selectRaw('student_id, class_id,
                    COUNT(*) as total_records,
                    SUM(CASE WHEN status = "present" THEN 1 ELSE 0 END) as present_count')
                ->whereNotNull('student_id')
                ->where('class_id', $request->class_id)
                ->groupBy('student_id', 'class_id')
                ->havingRaw('COUNT(*) >= ?', [$minRecords]);

            $topStudents = $topStudentsQuery
                ->with(['student:id,name', 'class:id,name'])
                ->get()
                ->map(function ($item) {
                    $attendanceRate = $item->total_records > 0
                        ? ($item->present_count / $item->total_records) * 100
                        : 0;

                    return [
                        'student_id' => $item->student_id,
                        'student_name' => $item->student?->name ?? 'N/A',
                        'class_id' => $item->class_id,
                        'class_name' => $item->class?->name ?? 'N/A',
                        'total_records' => (int) $item->total_records,
                        'present_count' => (int) $item->present_count,
                        'attendance_rate' => $attendanceRate,
                        'attendance_rate_formatted' => $this->formatPercentage($attendanceRate),
                    ];
                })
                ->sortByDesc('attendance_rate')
                ->take(10)
                ->values();
        } else {
            // When no class_id filter: group by student_id only (aggregate across all classes)
            $topStudentsQuery = (clone $query)
                ->selectRaw('student_id,
                    COUNT(*) as total_records,
                    SUM(CASE WHEN status = "present" THEN 1 ELSE 0 END) as present_count,
                    MAX(class_id) as class_id')
                ->whereNotNull('student_id')
                ->groupBy('student_id')
                ->havingRaw('COUNT(*) >= ?', [$minRecords]);

            $topStudents = $topStudentsQuery
                ->with(['student:id,name'])
                ->get()
                ->map(function ($item) {
                    $attendanceRate = $item->total_records > 0
                        ? ($item->present_count / $item->total_records) * 100
                        : 0;

                    // Load class info if class_id exists
                    $class = $item->class_id ? ClassRoom::find($item->class_id) : null;

                    return [
                        'student_id' => $item->student_id,
                        'student_name' => $item->student?->name ?? 'N/A',
                        'class_id' => $item->class_id,
                        'class_name' => $class?->name ?? null,
                        'total_records' => (int) $item->total_records,
                        'present_count' => (int) $item->present_count,
                        'attendance_rate' => $attendanceRate,
                        'attendance_rate_formatted' => $this->formatPercentage($attendanceRate),
                    ];
                })
                ->sortByDesc('attendance_rate')
                ->take(10)
                ->values();
        }

        // Period label
        $periodLabel = 'last 30 days';
        if ($request->filled('date_from') && $request->filled('date_to')) {
            $periodLabel = "{$request->date_from} to {$request->date_to}";
        } elseif ($request->filled('date_from')) {
            $periodLabel = "from {$request->date_from}";
        } elseif ($request->filled('date_to')) {
            $periodLabel = "until {$request->date_to}";
        }

        return $this->successResponse([
            'period' => $periodLabel,
            'summary' => [
                'total_records' => $totalRecords,
                'present_count' => $presentCount,
                'absent_count' => $absentCount,
                'late_count' => $lateCount,
                'excused_count' => $excusedCount,
                'attendance_rate' => $attendanceRate,
                'attendance_rate_formatted' => $this->formatPercentage($attendanceRate),
            ],
            'by_status' => $byStatus,
            'by_class' => $byClass,
            'trend' => $trend,
            'top_students' => $topStudents,
        ]);
    }

    /**
     * Get students statistics
     *
     * Query Parameters (Optional):
     * - date_from: YYYY-MM-DD format, filter students created from this date
     * - date_to: YYYY-MM-DD format, filter students created to this date
     *
     * Returns:
     * - Total students count
     * - Growth trend
     * - Distribution by class
     * - Distribution by status
     * - New students in period
     */
    public function students(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Validate input
        $validator = Validator::make($request->all(), [
            'date_from' => 'nullable|date_format:Y-m-d',
            'date_to' => 'nullable|date_format:Y-m-d',
            'status' => 'nullable|string|in:active,inactive,graduated,all',
            'class_id' => ['nullable', new ExistsHashId(ClassRoom::class)],
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Định dạng dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        $this->decodeHashId($request, 'class_id', ClassRoom::class);

        // Build query with data isolation
        $query = Student::query();

        // Apply data isolation
        $query = $this->applyDataIsolation($query, 'students');

        // Overall statistics (not filtered by date)
        $totalStudents = (clone $query)->count();
        $activeStudents = (clone $query)->where('status', 'active')->count();
        $inactiveStudents = (clone $query)->where('status', 'inactive')->count();
        $graduatedStudents = (clone $query)->where('status', 'graduated')->count();

        // Optional filters
        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }
        if ($request->filled('class_id')) {
            $query->whereHas('classes', function ($q) use ($request) {
                $q->where('class_id', $request->class_id);
            });
        }

        // New students in period
        $newStudentsQuery = Student::query();
        $newStudentsQuery = $this->applyDataIsolation($newStudentsQuery, 'students');

        if ($request->filled('date_from')) {
            $newStudentsQuery->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $newStudentsQuery->whereDate('created_at', '<=', $request->date_to);
        }

        $newStudentsCount = $newStudentsQuery->count();

        // Distribution by status
        $byStatus = collect([
            ['status' => 'active', 'count' => $activeStudents],
            ['status' => 'inactive', 'count' => $inactiveStudents],
            ['status' => 'graduated', 'count' => $graduatedStudents],
        ]);

        // Distribution by class (using enrollment pivot) - apply data isolation
        $classIdsQuery = ClassRoom::query();
        $classIdsQuery = $this->applyDataIsolation($classIdsQuery, 'classes');
        $allowedClassIds = $classIdsQuery->pluck('id');

        if ($allowedClassIds->isEmpty()) {
            $byClass = collect([]);
        } else {
            $byClass = DB::table('class_student')
                ->join('students', 'class_student.student_id', '=', 'students.id')
                ->join('classes', 'class_student.class_id', '=', 'classes.id')
                ->selectRaw('classes.id as class_id, classes.name as class_name, COUNT(DISTINCT students.id) as student_count')
                ->where('class_student.status', 'active')
                ->when($request->filled('class_id'), function ($q) use ($request) {
                    $q->where('classes.id', $request->class_id);
                })
                ->whereIn('classes.id', $allowedClassIds)
                ->groupBy('classes.id', 'classes.name')
                ->get()
                ->map(function ($item) {
                    return [
                        'class_id' => $item->class_id,
                        'class_name' => $item->class_name,
                        'student_count' => (int) $item->student_count,
                    ];
                });
        }

        // Growth trend (by month)
        $growthQuery = Student::query();
        $growthQuery = $this->applyDataIsolation($growthQuery, 'students');

        if ($request->filled('date_from')) {
            $growthQuery->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $growthQuery->whereDate('created_at', '<=', $request->date_to);
        } else {
            // Default: last 12 months
            $growthQuery->where('created_at', '>=', now()->subMonths(12));
        }

        // Gom nhóm theo tháng Ở TẦNG PHP, không dùng DATE_FORMAT của MySQL.
        //
        // DATE_FORMAT không tồn tại trên SQLite → toàn bộ endpoint này trả 500 ở môi trường local
        // (`no such function: DATE_FORMAT`), làm vỡ tab Báo cáo → Học viên. Đây là quy ước đã có
        // trong repo: PayrollCalculator và PayrollCostReader đều ghi rõ "NEVER MySQL DATE_FORMAT"
        // và gom nhóm bằng PHP (design §6 risk 8). Chỉ còn duy nhất chỗ này sót lại.
        //
        // Chỉ lấy cột created_at nên vẫn nhẹ; tập dữ liệu đã bị chặn bởi bộ lọc 12 tháng ở trên.
        $growth = $growthQuery
            ->reorder()
            ->orderBy('created_at')
            ->pluck('created_at')
            ->groupBy(fn ($createdAt) => $createdAt?->format('Y-m'))
            ->map(fn ($rows, $month) => ['month' => (string) $month, 'count' => $rows->count()])
            ->values();

        // Period label
        $periodLabel = 'all';
        if ($request->filled('date_from') && $request->filled('date_to')) {
            $periodLabel = "{$request->date_from} to {$request->date_to}";
        } elseif ($request->filled('date_from')) {
            $periodLabel = "from {$request->date_from}";
        } elseif ($request->filled('date_to')) {
            $periodLabel = "until {$request->date_to}";
        }

        return $this->successResponse([
            'period' => $periodLabel,
            'summary' => [
                'total_students' => $totalStudents,
                'active_students' => $activeStudents,
                'inactive_students' => $inactiveStudents,
                'graduated_students' => $graduatedStudents,
                'new_students_in_period' => $newStudentsCount,
            ],
            'by_status' => $byStatus,
            'by_class' => $byClass,
            'growth' => $growth,
        ]);
    }

    /**
     * Get classes statistics
     *
     * Query Parameters (Optional):
     * - date_from: YYYY-MM-DD format, filter classes created from this date
     * - date_to: YYYY-MM-DD format, filter classes created to this date
     *
     * Returns:
     * - Total classes count
     * - Distribution by status
     * - Classes with most students
     * - Class performance (based on attendance)
     */
    public function classes(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Validate input
        $validator = Validator::make($request->all(), [
            'date_from' => 'nullable|date_format:Y-m-d',
            'date_to' => 'nullable|date_format:Y-m-d',
            'status' => 'nullable|string|in:active,inactive,completed,all',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Định dạng dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        // Build query with data isolation
        $query = ClassRoom::query();

        // Apply data isolation
        $query = $this->applyDataIsolation($query, 'classes');

        // Overall statistics (not filtered by date)
        $totalClasses = (clone $query)->count();
        $activeClasses = (clone $query)->where('status', 'active')->count();
        $inactiveClasses = (clone $query)->where('status', 'inactive')->count();
        $completedClasses = (clone $query)->where('status', 'completed')->count();

        // New classes in period
        $newClassesQuery = ClassRoom::query();
        $newClassesQuery = $this->applyDataIsolation($newClassesQuery, 'classes');

        if ($request->filled('date_from')) {
            $newClassesQuery->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $newClassesQuery->whereDate('created_at', '<=', $request->date_to);
        }

        $newClassesCount = $newClassesQuery->count();

        // Distribution by status
        // Status filter
        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        $byStatus = collect([
            ['status' => 'active', 'count' => $activeClasses],
            ['status' => 'inactive', 'count' => $inactiveClasses],
            ['status' => 'completed', 'count' => $completedClasses],
        ]);

        // Get allowed class IDs for data isolation
        $allowedClassIds = (clone $query)->pluck('id');

        // Classes with most students (with data isolation)
        if ($allowedClassIds->isEmpty()) {
            $topClasses = collect([]);
        } else {
            $topClasses = DB::table('class_student')
                ->join('classes', 'class_student.class_id', '=', 'classes.id')
                ->selectRaw('classes.id as class_id, classes.name as class_name, COUNT(DISTINCT class_student.student_id) as student_count')
                ->where('class_student.status', 'active')
                ->whereIn('classes.id', $allowedClassIds)
                ->groupBy('classes.id', 'classes.name')
                ->orderBy('student_count', 'desc')
                ->limit(10)
                ->get()
                ->map(function ($item) {
                    return [
                        'class_id' => $item->class_id,
                        'class_name' => $item->class_name,
                        'student_count' => (int) $item->student_count,
                    ];
                });
        }

        // Class performance (based on attendance rate) - apply data isolation
        $attendanceQuery = Attendance::query();
        $attendanceQuery = $this->applyDataIsolation($attendanceQuery, 'attendances');
        $attendanceClassIds = (clone $attendanceQuery)->distinct('class_id')->pluck('class_id');

        if ($attendanceClassIds->isEmpty()) {
            $classPerformance = collect([]);
        } else {
            $classPerformance = DB::table('attendance')
                ->join('classes', 'attendance.class_id', '=', 'classes.id')
                ->selectRaw('classes.id as class_id, classes.name as class_name,
                    COUNT(*) as total_attendance,
                    SUM(CASE WHEN attendance.status = "present" THEN 1 ELSE 0 END) as present_count')
                ->whereIn('classes.id', $attendanceClassIds)
                ->groupBy('classes.id', 'classes.name')
                ->havingRaw('COUNT(*) >= 1') // At least 1 attendance record (reduced from 10 to show all classes)
                ->get()
                ->map(function ($item) {
                    $attendanceRate = $item->total_attendance > 0
                        ? round(($item->present_count / $item->total_attendance) * 100, 2)
                        : 0;

                    return [
                        'class_id' => $item->class_id,
                        'class_name' => $item->class_name,
                        'total_attendance' => (int) $item->total_attendance,
                        'present_count' => (int) $item->present_count,
                        'attendance_rate' => $attendanceRate,
                    ];
                })
                ->sortByDesc('attendance_rate')
                ->take(10)
                ->values();
        }

        // Period label
        $periodLabel = 'all';
        if ($request->filled('date_from') && $request->filled('date_to')) {
            $periodLabel = "{$request->date_from} to {$request->date_to}";
        } elseif ($request->filled('date_from')) {
            $periodLabel = "from {$request->date_from}";
        } elseif ($request->filled('date_to')) {
            $periodLabel = "until {$request->date_to}";
        }

        return $this->successResponse([
            'period' => $periodLabel,
            'summary' => [
                'total_classes' => $totalClasses,
                'active_classes' => $activeClasses,
                'inactive_classes' => $inactiveClasses,
                'completed_classes' => $completedClasses,
                'new_classes_in_period' => $newClassesCount,
            ],
            'by_status' => $byStatus,
            'top_classes_by_students' => $topClasses,
            'top_classes_by_performance' => $classPerformance,
        ]);
    }

    /**
     * Get assignments statistics
     *
     * Query Parameters (Optional):
     * - date_from: YYYY-MM-DD format, filter assignments created from this date
     * - date_to: YYYY-MM-DD format, filter assignments created to this date
     *
     * Returns:
     * - Total assignments count
     * - Submission rate
     * - Distribution by status
     * - Score distribution
     */
    public function assignments(Request $request): JsonResponse
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 403);
        }

        // Validate input
        $validator = Validator::make($request->all(), [
            'date_from' => 'nullable|date_format:Y-m-d',
            'date_to' => 'nullable|date_format:Y-m-d',
            'status' => 'nullable|string|in:published,draft,closed,all',
            'class_id' => ['nullable', new ExistsHashId(ClassRoom::class)],
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Định dạng dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        $this->decodeHashId($request, 'class_id', ClassRoom::class);

        // Build query with data isolation
        $query = Assignment::query();

        // Apply data isolation
        $query = $this->applyDataIsolation($query, 'assignments');

        // Date filters
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        // Overall statistics (before applying status filter, but after class_id filter if provided)
        // Apply class_id filter first if provided
        if ($request->filled('class_id')) {
            $query->where('class_id', $request->class_id);
        }

        // Calculate by_status BEFORE applying status filter (always show all statuses)
        $publishedAssignments = (clone $query)->where('status', 'published')->count();
        $draftAssignments = (clone $query)->where('status', 'draft')->count();
        $closedAssignments = (clone $query)->where('status', 'closed')->count();

        // Distribution by status (always show all statuses, regardless of status filter)
        $byStatus = collect([
            ['status' => 'published', 'count' => $publishedAssignments],
            ['status' => 'draft', 'count' => $draftAssignments],
            ['status' => 'closed', 'count' => $closedAssignments],
        ]);

        // Now apply status filter for overall statistics
        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Overall statistics (after applying all filters)
        $totalAssignments = (clone $query)->count();

        // Get all assignment IDs in the filtered set
        $assignmentIds = (clone $query)->pluck('id');

        if ($assignmentIds->isEmpty()) {
            $totalSubmissions = 0;
            $averageSubmissionRate = 0;
            $submissionStats = null;
            $scoreDistribution = collect([]);
        } else {
            // Submission statistics - filter by assignment IDs (already isolated via assignments query)
            $submissionQuery = Submission::query()
                ->whereHas('assignment', function ($q) use ($assignmentIds) {
                    $q->whereIn('id', $assignmentIds);
                });

            $totalSubmissions = (clone $submissionQuery)->count();

            // Calculate submission rate: Get total students enrolled in these assignments' classes
            $totalStudents = DB::table('class_student')
                ->join('assignments', 'class_student.class_id', '=', 'assignments.class_id')
                ->whereIn('assignments.id', $assignmentIds)
                ->where('class_student.status', 'active')
                ->distinct('class_student.student_id')
                ->count('class_student.student_id');

            // Expected submissions = assignments * students (assuming each student should submit to each assignment)
            $expectedSubmissions = $totalAssignments * max($totalStudents, 1);
            $averageSubmissionRate = $expectedSubmissions > 0
                ? round(($totalSubmissions / $expectedSubmissions) * 100, 2)
                : 0;

            // Get detailed submission stats
            $submissionStats = (clone $submissionQuery)
                ->selectRaw('
                    COUNT(*) as total_submissions,
                    SUM(CASE WHEN status != "not_submitted" THEN 1 ELSE 0 END) as submitted_count,
                    SUM(CASE WHEN status = "graded" THEN 1 ELSE 0 END) as graded_count,
                    AVG(score) as average_score,
                    MAX(score) as max_score,
                    MIN(score) as min_score
                ')
                ->first();

            // Score distribution
            $scoreDistribution = (clone $submissionQuery)
                ->whereNotNull('score')
                ->selectRaw('
                    CASE 
                        WHEN score >= 90 THEN "A (90-100)"
                        WHEN score >= 80 THEN "B (80-89)"
                        WHEN score >= 70 THEN "C (70-79)"
                        WHEN score >= 60 THEN "D (60-69)"
                        ELSE "F (<60)"
                    END as grade_range,
                    COUNT(*) as count
                ')
                ->groupBy('grade_range')
                ->get()
                ->map(function ($item) {
                    return [
                        'grade_range' => $item->grade_range,
                        'count' => (int) $item->count,
                    ];
                });
        }

        // Period label
        $periodLabel = 'all';
        if ($request->filled('date_from') && $request->filled('date_to')) {
            $periodLabel = "{$request->date_from} to {$request->date_to}";
        } elseif ($request->filled('date_from')) {
            $periodLabel = "from {$request->date_from}";
        } elseif ($request->filled('date_to')) {
            $periodLabel = "until {$request->date_to}";
        }

        return $this->successResponse([
            'period' => $periodLabel,
            'total_assignments' => $totalAssignments,
            'submission_rate' => $averageSubmissionRate,
            'average_grade' => $submissionStats ? round((float) $submissionStats->average_score, 2) : 0,
            'by_status' => $byStatus,
            'by_grade' => $scoreDistribution,
            'grade_stats' => [
                'average' => $submissionStats ? round((float) $submissionStats->average_score, 2) : 0,
                'max' => $submissionStats ? (float) $submissionStats->max_score : 0,
                'min' => $submissionStats ? (float) $submissionStats->min_score : 0,
            ],
        ]);
    }

    /**
     * Export Revenue Report
     *
     * Query Parameters:
     * - format (required): excel | csv
     * - date_from (optional): YYYY-MM-DD format
     * - date_to (optional): YYYY-MM-DD format
     * - payment_method (optional): bank_transfer, cash, other, all
     */
    public function exportRevenue(Request $request)
    {
        return $this->handleExport($request, 'revenue', function ($request) {
            $jsonResponse = $this->revenue($request);
            $data = json_decode($jsonResponse->getContent(), true);
            $result = $data['data'] ?? [];

            // Thêm thông tin period vào data để hiển thị trong CSV
            $periodLabel = '30 ngày gần nhất (mặc định)';
            if ($request->filled('date_from') && $request->filled('date_to')) {
                $periodLabel = "{$request->date_from} đến {$request->date_to}";
            } elseif ($request->filled('date_from')) {
                $periodLabel = "Từ {$request->date_from}";
            } elseif ($request->filled('date_to')) {
                $periodLabel = "Đến {$request->date_to}";
            }

            // Nếu result là array, thêm period vào
            if (is_array($result)) {
                $result = array_merge(['period' => $periodLabel], $result);
            }

            return $result;
        });
    }

    /**
     * Export Payments Report
     *
     * Query Parameters:
     * - format (required): excel | csv
     * - date_from (optional): YYYY-MM-DD format
     * - date_to (optional): YYYY-MM-DD format
     * - payment_method (optional): bank, bank_transfer, cash, other
     * - status (optional): paid, pending, failed, refunded, all
     */
    public function exportPayments(Request $request)
    {
        return $this->handleExport($request, 'payments', function ($request) {
            $jsonResponse = $this->payments($request);
            $data = json_decode($jsonResponse->getContent(), true);

            return $data['data'] ?? [];
        });
    }

    /**
     * Export Attendance Report
     *
     * Query Parameters:
     * - format (required): excel | csv
     * - date_from (optional): YYYY-MM-DD format
     * - date_to (optional): YYYY-MM-DD format
     * - class_id (optional): integer (class ID)
     */
    public function exportAttendance(Request $request)
    {
        // Decode HashIDs
        $this->decodeHashId($request, 'class_id', ClassRoom::class);

        return $this->handleExport($request, 'attendance', function ($request) {
            $jsonResponse = $this->attendance($request);
            $data = json_decode($jsonResponse->getContent(), true);

            return $data['data'] ?? [];
        });
    }

    /**
     * Export Students Report
     *
     * Query Parameters:
     * - format (required): excel | csv
     * - date_from (optional): YYYY-MM-DD format
     * - date_to (optional): YYYY-MM-DD format
     * - status (optional): active, inactive, graduated, all
     * - class_id (optional): integer (class ID)
     */
    public function exportStudents(Request $request)
    {
        // Decode HashIDs
        $this->decodeHashId($request, 'class_id', ClassRoom::class);

        return $this->handleExport($request, 'students', function ($request) {
            $jsonResponse = $this->students($request);
            $data = json_decode($jsonResponse->getContent(), true);

            return $data['data'] ?? [];
        });
    }

    /**
     * Export Classes Report
     *
     * Query Parameters:
     * - format (required): excel | csv
     * - date_from (optional): YYYY-MM-DD format
     * - date_to (optional): YYYY-MM-DD format
     * - status (optional): active, inactive, completed, all
     */
    public function exportClasses(Request $request)
    {
        return $this->handleExport($request, 'classes', function ($request) {
            $jsonResponse = $this->classes($request);
            $data = json_decode($jsonResponse->getContent(), true);

            return $data['data'] ?? [];
        });
    }

    /**
     * Export Assignments Report
     *
     * Query Parameters:
     * - format (required): excel | csv
     * - date_from (optional): YYYY-MM-DD format
     * - date_to (optional): YYYY-MM-DD format
     * - status (optional): published, draft, closed, all
     * - class_id (optional): integer (class ID)
     */
    public function exportAssignments(Request $request)
    {
        // Decode HashIDs
        $this->decodeHashId($request, 'class_id', ClassRoom::class);

        return $this->handleExport($request, 'assignments', function ($request) {
            $jsonResponse = $this->assignments($request);
            $data = json_decode($jsonResponse->getContent(), true);

            return $data['data'] ?? [];
        });
    }

    /**
     * Export Payment Requests Report
     *
     * Query Parameters:
     * - format (required): excel | csv
     * - date_from (optional): YYYY-MM-DD format
     * - date_to (optional): YYYY-MM-DD format
     * - status (optional): pending, active, cancelled, all
     * - class_id (optional): integer (class ID)
     */
    public function exportPaymentRequests(Request $request)
    {
        // Decode HashIDs
        $this->decodeHashId($request, 'class_id', ClassRoom::class);

        return $this->handleExport($request, 'payment-requests', function ($request) {
            $user = $this->getAuthUser();
            if (! $user) {
                return [];
            }

            $query = PaymentRequest::with(['class', 'creator', 'payments']);

            // Apply data isolation. Org owner/manager aggregate over the whole org (before the
            // plain-tutor branch — R1); a plain tutor sees only their own classes.
            if ($user->isOrgViewerAll()) {
                $orgId = $user->currentOrganization()?->id;
                $query->whereHas('class', function ($q) use ($orgId) {
                    $q->where('organization_id', $orgId);
                });
            } elseif ($user->isTutor() && ! $user->isSuperAdmin()) {
                $query->whereHas('class', function ($q) use ($user) {
                    $q->where('tutor_id', $user->id);
                });
            }

            // Filters
            if ($request->filled('date_from')) {
                $query->whereDate('created_at', '>=', $request->date_from);
            }
            if ($request->filled('date_to')) {
                $query->whereDate('created_at', '<=', $request->date_to);
            }
            if ($request->filled('status') && $request->status !== 'all') {
                $query->where('status', $request->status);
            }
            if ($request->filled('class_id')) {
                $query->where('class_id', $request->class_id);
            }

            $paymentRequests = $query->get();

            return $paymentRequests->map(function ($pr) {
                return [
                    '_id' => $pr->hash_id,
                    'class_name' => $pr->class->name ?? '',
                    'period_name' => $pr->period_name,
                    'period_month' => $pr->period_month,
                    'amount_per_student' => $pr->amount_per_student,
                    'due_date' => $pr->due_date?->format('Y-m-d'),
                    'status' => $pr->status,
                    'total_students' => $pr->payments->count(),
                    'paid_count' => $pr->payments->where('status', 'paid')->count(),
                    'pending_count' => $pr->payments->where('status', 'pending')->count(),
                    'total_collected' => $pr->payments->where('status', 'paid')->sum('amount'),
                    'created_at' => $pr->created_at->format('Y-m-d H:i:s'),
                ];
            })->toArray();
        });
    }

    /**
     * Export Grades Report
     *
     * Query Parameters:
     * - format (required): excel | csv
     * - date_from (optional): YYYY-MM-DD format (grade_date_from)
     * - date_to (optional): YYYY-MM-DD format (grade_date_to)
     * - class_id (optional): integer (class ID)
     * - student_id (optional): integer (student ID)
     * - grade_type_id (optional): integer (grade type ID)
     * - assignment_id (optional): integer (assignment ID)
     * - semester (optional): string
     */
    public function exportGrades(Request $request)
    {
        // Decode HashIDs
        $this->decodeHashId($request, 'class_id', ClassRoom::class);
        $this->decodeHashId($request, 'student_id', Student::class);
        $this->decodeHashId($request, 'grade_type_id', GradeType::class);
        $this->decodeHashId($request, 'assignment_id', Assignment::class);

        return $this->handleExport($request, 'grades', function ($request) {
            $user = $this->getAuthUser();
            if (! $user) {
                return [];
            }

            $query = Grade::with(['student', 'class', 'gradeType', 'assignment', 'tutor']);

            // Apply data isolation. Org owner/manager aggregate over the whole org (before the
            // plain-tutor branch — R1); a plain tutor sees only their own classes.
            if ($user->isOrgViewerAll()) {
                $orgId = $user->currentOrganization()?->id;
                $query->whereHas('class', function ($q) use ($orgId) {
                    $q->where('organization_id', $orgId);
                });
            } elseif ($user->isTutor() && ! $user->isSuperAdmin()) {
                $query->whereHas('class', function ($q) use ($user) {
                    $q->where('tutor_id', $user->id);
                });
            } elseif ($user->isStudent()) {
                $query->where('student_id', $user->studentProfile->id ?? 0);
            }

            // Filters
            if ($request->filled('date_from') || $request->filled('grade_date_from')) {
                $dateFrom = $request->date_from ?? $request->grade_date_from;
                $query->whereDate('grade_date', '>=', $dateFrom);
            }
            if ($request->filled('date_to') || $request->filled('grade_date_to')) {
                $dateTo = $request->date_to ?? $request->grade_date_to;
                $query->whereDate('grade_date', '<=', $dateTo);
            }
            if ($request->filled('class_id')) {
                $query->where('class_id', $request->class_id);
            }
            if ($request->filled('student_id')) {
                $query->where('student_id', $request->student_id);
            }
            if ($request->filled('grade_type_id')) {
                $query->where('grade_type_id', $request->grade_type_id);
            }
            if ($request->filled('assignment_id')) {
                $query->where('assignment_id', $request->assignment_id);
            }
            if ($request->filled('semester')) {
                $query->where('semester', $request->semester);
            }

            $grades = $query->orderBy('grade_date', 'desc')->orderBy('created_at', 'desc')->get();

            return $grades->map(function ($grade) {
                return [
                    '_id' => $grade->hash_id,
                    'student_name' => $grade->student->name ?? '',
                    'student_email' => $grade->student->email ?? '',
                    'class_name' => $grade->class->name ?? '',
                    'title' => $grade->title,
                    'score' => $grade->score,
                    'max_score' => $grade->max_score,
                    'percentage' => $grade->max_score > 0 ? round(($grade->score / $grade->max_score) * 100, 2) : 0,
                    'grade_type_name' => $grade->gradeType->name ?? '',
                    'assignment_title' => $grade->assignment->title ?? '',
                    'tutor_name' => $grade->tutor->name ?? '',
                    'grade_date' => $grade->grade_date?->format('Y-m-d'),
                    'semester' => $grade->semester,
                    'comments' => $grade->comments,
                    'created_at' => $grade->created_at->format('Y-m-d H:i:s'),
                ];
            })->toArray();
        });
    }

    /**
     * Export Login Activities Report
     *
     * Query Parameters:
     * - format (required): excel | csv
     * - date_from (optional): YYYY-MM-DD format
     * - date_to (optional): YYYY-MM-DD format
     * - status (optional): success, failed, tutor_inactive, etc.
     * - is_success (optional): true | false
     */
    public function exportLoginActivities(Request $request)
    {
        return $this->handleExport($request, 'login-activities', function ($request) {
            $user = $this->getAuthUser();
            if (! $user) {
                return [];
            }

            $query = LoginActivity::with('user');

            // Apply data isolation. Org owner/manager see login activity of every member + their
            // students (scoped by org), aggregated over the whole org (before the plain-tutor branch — R1).
            if ($user->isOrgViewerAll()) {
                $orgId = $user->currentOrganization()?->id;
                $orgTutorIds = $this->orgTutorIds($user->currentOrganization());
                $query->where(function ($q) use ($orgTutorIds, $orgId) {
                    $q->whereIn('user_id', $orgTutorIds)
                        ->orWhereHas('user', function ($q2) use ($orgId) {
                            $q2->whereHas('studentProfile', function ($q3) use ($orgId) {
                                $q3->whereHas('classes', function ($q4) use ($orgId) {
                                    $q4->where('organization_id', $orgId);
                                });
                            });
                        });
                });
            } elseif ($user->isTutor() && ! $user->isSuperAdmin()) {
                // Tutor can see their own activities and their students' activities
                $query->where(function ($q) use ($user) {
                    $q->where('user_id', $user->id)
                        ->orWhereHas('user', function ($q2) use ($user) {
                            $q2->whereHas('studentProfile', function ($q3) use ($user) {
                                $q3->whereHas('classes', function ($q4) use ($user) {
                                    $q4->where('tutor_id', $user->id);
                                });
                            });
                        });
                });
            } elseif ($user->isStudent()) {
                // Student can only see their own activities
                $query->where('user_id', $user->id)
                    ->where('status', '!=', 'tutor_inactive');
            }

            // Filters
            if ($request->filled('date_from')) {
                $query->whereDate('logged_in_at', '>=', $request->date_from);
            }
            if ($request->filled('date_to')) {
                $query->whereDate('logged_in_at', '<=', $request->date_to);
            }
            if ($request->filled('status')) {
                $query->where('status', $request->status);
            }
            if ($request->filled('is_success')) {
                $query->where('is_success', $request->boolean('is_success'));
            }

            $activities = $query->orderBy('logged_in_at', 'desc')->get();

            return $activities->map(function ($activity) {
                return [
                    '_id' => $activity->hash_id,
                    'user_id' => User::encodeId($activity->user_id),
                    'user_email' => $activity->email,
                    'user_name' => $activity->user->name ?? '',
                    'is_success' => $activity->is_success ? 'Yes' : 'No',
                    'status' => $activity->status,
                    'ip_address' => $activity->ip_address,
                    'device_name' => $activity->device_name ?? '',
                    'location' => $activity->location ?? '',
                    'user_agent' => $activity->user_agent ?? '',
                    'message' => $activity->message ?? '',
                    'logged_in_at' => $activity->logged_in_at?->format('Y-m-d H:i:s'),
                    'created_at' => $activity->created_at->format('Y-m-d H:i:s'),
                ];
            })->toArray();
        });
    }

    /**
     * Handle export request (used by reports & data export endpoints).
     *
     * @param  string  $reportType  Tên báo cáo/module (dùng cho đặt tên file + logging)
     * @param  callable  $dataCallback  Hàm callback trả về mảng dữ liệu để export
     * @return Response|JsonResponse
     */
    public function handleExport(Request $request, string $reportType, callable $dataCallback)
    {
        $user = $this->getAuthUser();

        if (! $user) {
            return $this->errorResponse('Không có quyền truy cập', null, 'UNAUTHORIZED', 401);
        }

        // Check capability for data export
        if ($capabilityError = $this->requirePlanCapability('data.export')) {
            return $capabilityError;
        }

        // Validate format
        $validator = Validator::make($request->all(), [
            'format' => 'required|string|in:excel,csv',
            'date_from' => 'nullable|date_format:Y-m-d',
            'date_to' => 'nullable|date_format:Y-m-d',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Định dạng dữ liệu không hợp lệ', $validator, 'VALIDATION_ERROR', 422);
        }

        $format = $request->input('format');

        $job = DataJobService::start('export', $reportType, $user, [
            'format' => $format,
            'meta' => [
                'path' => $request->path(),
                'query' => $request->all(),
            ],
        ]);

        try {
            // Get data using the callback
            $data = $dataCallback($request);

            $totalRows = is_countable($data) ? count($data) : null;

            // Generate file based on format
            if ($format === 'csv') {
                $response = $this->generateCsv($data, $reportType, $request);
                DataJobService::finishSuccess($job, [
                    'total_rows' => $totalRows,
                ]);

                return $response;
            } elseif ($format === 'excel') {
                $response = $this->generateExcel($data, $reportType, $request);
                DataJobService::finishSuccess($job, [
                    'total_rows' => $totalRows,
                ]);

                return $response;
            }

            DataJobService::finishFailed($job, 'INVALID_FORMAT');

            return $this->errorResponse('Định dạng không được hỗ trợ', null, 'INVALID_FORMAT', 400);
        } catch (\Exception $e) {
            DataJobService::finishFailed($job, $e->getMessage());

            return $this->errorResponse('Lỗi khi tạo file export: '.$e->getMessage(), null, 'EXPORT_ERROR', 500);
        }
    }

    /**
     * Generate CSV file
     */
    private function generateCsv(array $data, string $reportType, Request $request): Response
    {
        $exporter = new CsvExporter;
        $filename = $exporter->generateFilename($reportType, 'csv', $request);

        // Convert data to CSV format
        $csvContent = $exporter->convert($data, $reportType);

        return response($csvContent, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    /**
     * Generate Excel file
     *
     * @return Response|JsonResponse
     */
    private function generateExcel(array $data, string $reportType, Request $request)
    {
        // Safety net: if the package is ever removed, fall back to CSV rather than 500.
        if (! class_exists(Excel::class)) {
            return $this->generateCsv($data, $reportType, $request);
        }

        $exporter = new CsvExporter;
        $filename = $exporter->generateFilename($reportType, 'xlsx', $request);

        // Reuse the CSV column layout so Excel and CSV never diverge, then render as a real .xlsx.
        $export = ReportExport::fromCsv($exporter->convert($data, $reportType));

        return Excel::download($export, $filename);
    }
}
