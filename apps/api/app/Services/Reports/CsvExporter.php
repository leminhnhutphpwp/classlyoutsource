<?php

namespace App\Services\Reports;

use Illuminate\Http\Request;

/**
 * CSV rendering for the reports module. Extracted verbatim from ReportsController to remove the
 * ~700-line block of near-duplicate convert*ToCsv methods. Pure array->string; no controller state.
 * Entry point: convert($data, $reportType).
 */
class CsvExporter
{
    /**
     * Convert data to CSV format
     */
    public function convert(array $data, string $reportType): string
    {
        // Add BOM for UTF-8 (Excel compatibility)
        $csv = "\xEF\xBB\xBF";

        // Convert data based on report type
        switch ($reportType) {
            case 'revenue':
                $csv .= $this->convertRevenueToCsv($data);
                break;
            case 'payments':
                $csv .= $this->convertPaymentsToCsv($data);
                break;
            case 'attendance':
                $csv .= $this->convertAttendanceToCsv($data);
                break;
            case 'students':
                $csv .= $this->convertStudentsToCsv($data);
                break;
            case 'students-data':
                $csv .= $this->convertStudentsDataToCsv($data);
                break;
            case 'assignment-types-data':
                $csv .= $this->convertAssignmentTypesDataToCsv($data);
                break;
            case 'subjects-data':
                $csv .= $this->convertSubjectsDataToCsv($data);
                break;
            case 'grade-levels-data':
                $csv .= $this->convertGradeLevelsDataToCsv($data);
                break;
            case 'grade-types-data':
                $csv .= $this->convertGradeTypesDataToCsv($data);
                break;
            case 'classes':
                $csv .= $this->convertClassesToCsv($data);
                break;
            case 'assignments':
                $csv .= $this->convertAssignmentsToCsv($data);
                break;
            case 'grades':
                $csv .= $this->convertGradesToCsv($data);
                break;
            case 'payment-requests':
                $csv .= $this->convertPaymentRequestsToCsv($data);
                break;
            case 'login-activities':
                $csv .= $this->convertLoginActivitiesToCsv($data);
                break;
            case 'finance-pnl':
                $csv .= $this->convertFinancePnlToCsv($data);
                break;
            case 'finance-tutor-profitability':
                $csv .= $this->convertFinanceTutorProfitabilityToCsv($data);
                break;
            case 'finance-cashflow':
                $csv .= $this->convertFinanceCashflowToCsv($data);
                break;
            case 'finance-payables':
                $csv .= $this->convertFinancePayablesToCsv($data);
                break;
            default:
                $csv .= $this->convertGenericToCsv($data);
        }

        return $csv;
    }

    /**
     * Generate filename
     */
    public function generateFilename(string $reportType, string $format, Request $request): string
    {
        $timestamp = now()->format('Y-m-d');
        $filters = [];

        if ($request->filled('date_from')) {
            $filters[] = 'from_'.$request->date_from;
        }
        if ($request->filled('date_to')) {
            $filters[] = 'to_'.$request->date_to;
        }
        if ($request->filled('status') && $request->status !== 'all') {
            $filters[] = $request->status;
        }
        if ($request->filled('class_id')) {
            $filters[] = 'class'.$request->class_id;
        }
        if ($request->filled('payment_method') && $request->payment_method !== 'all') {
            $filters[] = $request->payment_method;
        }

        $filterStr = ! empty($filters) ? '_'.implode('_', $filters) : '_all';
        $extension = $format === 'excel' ? 'xlsx' : $format;

        return "{$reportType}{$filterStr}_{$timestamp}.{$extension}";
    }

    /**
     * Convert generic data to CSV
     */
    private function convertGenericToCsv(array $data): string
    {
        if (empty($data)) {
            return "No data\n";
        }

        $csv = '';
        $this->flattenArrayToCsv($data, $csv);

        return $csv;
    }

    /**
     * Flatten array to CSV format
     *
     * @param  mixed  $data
     */
    private function flattenArrayToCsv($data, string &$csv, string $prefix = ''): void
    {
        if (is_array($data)) {
            foreach ($data as $key => $value) {
                $newKey = $prefix ? "{$prefix}.{$key}" : $key;
                if (is_array($value) && isset($value[0]) && is_array($value[0])) {
                    // Array of objects - create table
                    $csv .= "\n{$newKey}\n";
                    if (! empty($value)) {
                        // Headers
                        $headers = array_keys($value[0]);
                        $csv .= '"'.implode('","', $headers)."\"\n";
                        // Rows
                        foreach ($value as $row) {
                            $csv .= '"'.implode('","', array_map(function ($v) {
                                return is_array($v) ? json_encode($v) : $v;
                            }, $row))."\"\n";
                        }
                    }
                } else {
                    $this->flattenArrayToCsv($value, $csv, $newKey);
                }
            }
        } else {
            $csv .= "\"{$prefix}\",\"{$data}\"\n";
        }
    }

    // Convert methods for each report type
    private function convertRevenueToCsv(array $data): string
    {
        $csv = "Báo cáo doanh thu\n\n";

        // Thêm thông tin về khoảng thời gian
        $csv .= 'Khoảng thời gian: ';
        if (isset($data['period'])) {
            $csv .= $data['period'];
        } else {
            $csv .= '30 ngày gần nhất (mặc định)';
        }
        $csv .= "\n\n";

        // Remove period từ data nếu có
        if (isset($data['period'])) {
            unset($data['period']);
        }

        if (! empty($data) && is_array($data)) {
            $csv .= "\"Ngày\",\"Tổng tiền\"\n";
            foreach ($data as $item) {
                if (is_array($item) && isset($item['date'])) {
                    $csv .= "\"{$item['date']}\",".number_format($item['total'] ?? 0, 0, ',', '.')."\n";
                }
            }
        } else {
            $csv .= "Không có dữ liệu doanh thu trong khoảng thời gian được chọn.\n";
        }

        return $csv;
    }

    private function convertPaymentsToCsv(array $data): string
    {
        $csv = "Báo cáo thanh toán\n\n";

        // Summary
        $summary = $data['summary'] ?? [];
        $csv .= 'Tổng số thanh toán,'.($summary['total_payments'] ?? 0)."\n";
        $csv .= 'Tổng tiền,'.number_format($summary['total_amount'] ?? 0, 0, ',', '.')."\n";
        $csv .= 'Trung bình,'.number_format($summary['average_amount'] ?? 0, 0, ',', '.')."\n\n";

        // By method
        if (! empty($data['by_method'])) {
            $csv .= "Theo phương thức\n";
            $csv .= "\"Phương thức\",\"Số lượng\",\"Tổng tiền\",\"Tỷ lệ\"\n";
            foreach ($data['by_method'] as $item) {
                $csv .= "\"{$item['payment_method']}\",".($item['count'] ?? 0).','.number_format($item['total'] ?? 0, 0, ',', '.').','.($item['percentage'] ?? 0)."%\n";
            }
            $csv .= "\n";
        }

        // By status
        if (! empty($data['by_status'])) {
            $csv .= "Theo trạng thái\n";
            $csv .= "\"Trạng thái\",\"Số lượng\"\n";
            foreach ($data['by_status'] as $item) {
                $csv .= "\"{$item['status']}\",".($item['count'] ?? 0)."\n";
            }
            $csv .= "\n";
        }

        // Top students
        if (! empty($data['top_students'])) {
            $csv .= "Top học sinh thanh toán nhiều nhất\n";
            $csv .= "\"Học sinh\",\"Số lần\",\"Tổng tiền\"\n";
            foreach ($data['top_students'] as $item) {
                $csv .= "\"{$item['student_name']}\",".($item['total_payments'] ?? 0).','.number_format($item['total_amount'] ?? 0, 0, ',', '.')."\n";
            }
        }

        return $csv;
    }

    private function convertAttendanceToCsv(array $data): string
    {
        $csv = "Báo cáo điểm danh\n\n";

        // Summary
        $summary = $data['summary'] ?? [];
        $csv .= 'Tổng số bản ghi,'.($summary['total_records'] ?? 0)."\n";
        $csv .= 'Có mặt,'.($summary['present_count'] ?? 0)."\n";
        $csv .= 'Vắng mặt,'.($summary['absent_count'] ?? 0)."\n";
        $csv .= 'Đi muộn,'.($summary['late_count'] ?? 0)."\n";
        $csv .= 'Có phép,'.($summary['excused_count'] ?? 0)."\n";
        $csv .= 'Tỷ lệ điểm danh,'.($summary['attendance_rate'] ?? 0)."%\n\n";

        // By status
        if (! empty($data['by_status'])) {
            $csv .= "Theo trạng thái\n";
            $csv .= "\"Trạng thái\",\"Số lượng\"\n";
            foreach ($data['by_status'] as $status => $count) {
                $csv .= "\"{$status}\",".$count."\n";
            }
            $csv .= "\n";
        }

        // By class
        if (! empty($data['by_class'])) {
            $csv .= "Theo lớp học\n";
            $csv .= "\"Lớp\",\"Tổng\",\"Có mặt\",\"Vắng\",\"Tỷ lệ\"\n";
            foreach ($data['by_class'] as $item) {
                $csv .= "\"{$item['class_name']}\",".($item['total_records'] ?? 0).','.($item['present_count'] ?? 0).','.($item['absent_count'] ?? 0).','.($item['attendance_rate'] ?? 0)."%\n";
            }
            $csv .= "\n";
        }

        // Top students
        if (! empty($data['top_students'])) {
            $csv .= "Top học sinh điểm danh tốt nhất\n";
            $csv .= "\"Học sinh\",\"Lớp\",\"Tổng\",\"Có mặt\",\"Tỷ lệ\"\n";
            foreach ($data['top_students'] as $item) {
                $csv .= "\"{$item['student_name']}\",\"{$item['class_name']}\",".($item['total_records'] ?? 0).','.($item['present_count'] ?? 0).','.($item['attendance_rate'] ?? 0)."%\n";
            }
        }

        return $csv;
    }

    private function convertStudentsToCsv(array $data): string
    {
        $csv = "Báo cáo học sinh\n\n";

        // Summary
        $summary = $data['summary'] ?? [];
        $csv .= 'Tổng số học sinh,'.($summary['total_students'] ?? 0)."\n";
        $csv .= 'Học sinh mới trong kỳ,'.($summary['new_students_in_period'] ?? 0)."\n";
        $csv .= 'Học sinh đang hoạt động,'.($summary['active_students'] ?? 0)."\n";
        $csv .= 'Học sinh không hoạt động,'.($summary['inactive_students'] ?? 0)."\n";
        $csv .= 'Học sinh đã tốt nghiệp,'.($summary['graduated_students'] ?? 0)."\n\n";

        // By status
        if (! empty($data['by_status'])) {
            $csv .= "Theo trạng thái\n";
            $csv .= "\"Trạng thái\",\"Số lượng\"\n";
            foreach ($data['by_status'] as $item) {
                $csv .= "\"{$item['status']}\",".($item['count'] ?? 0)."\n";
            }
            $csv .= "\n";
        }

        // By class
        if (! empty($data['by_class'])) {
            $csv .= "Theo lớp học\n";
            $csv .= "\"Lớp\",\"Số học sinh\"\n";
            foreach ($data['by_class'] as $item) {
                $csv .= "\"{$item['class_name']}\",".($item['student_count'] ?? 0)."\n";
            }
        }

        return $csv;
    }

    /**
     * Convert raw students data (students-data) to CSV (table, mỗi học viên 1 dòng).
     */
    private function convertStudentsDataToCsv(array $data): string
    {
        if (empty($data)) {
            return "No data\n";
        }

        $csv = '';

        // Header row
        $headers = [
            'ID',
            'Tên',
            'Phụ huynh',
            'Email',
            'Điện thoại',
            'Trạng thái',
            'Ngày sinh',
            'Giới tính',
            'Lớp',
            'Ngày tạo',
            'Ngày cập nhật',
        ];

        $csv .= '"'.implode('","', $headers)."\"\n";

        // Rows
        foreach ($data as $row) {
            $values = [
                $row['id'] ?? '',
                $row['name'] ?? '',
                $row['parent_name'] ?? '',
                $row['email'] ?? '',
                $row['phone'] ?? '',
                $row['status'] ?? '',
                $row['birth_date'] ?? '',
                $row['gender'] ?? '',
                $row['classes'] ?? '',
                $row['created_at'] ?? '',
                $row['updated_at'] ?? '',
            ];

            // Escape dấu " trong dữ liệu
            $values = array_map(function ($value) {
                $value = (string) $value;

                return str_replace('"', '""', $value);
            }, $values);

            $csv .= '"'.implode('","', $values)."\"\n";
        }

        return $csv;
    }

    private function convertAssignmentTypesDataToCsv(array $data): string
    {
        if (empty($data)) {
            return "No data\n";
        }

        $headers = ['ID', 'Tên loại bài tập', 'Mã', 'Mô tả', 'Kích hoạt', 'Thứ tự'];

        $csv = '"'.implode('","', $headers)."\"\n";

        foreach ($data as $row) {
            $values = [
                $row['id'] ?? '',
                $row['name'] ?? '',
                $row['code'] ?? '',
                $row['description'] ?? '',
                $row['is_active'] ?? '',
                $row['order'] ?? '',
            ];

            $values = array_map(function ($value) {
                $value = (string) $value;

                return str_replace('"', '""', $value);
            }, $values);

            $csv .= '"'.implode('","', $values)."\"\n";
        }

        return $csv;
    }

    private function convertSubjectsDataToCsv(array $data): string
    {
        if (empty($data)) {
            return "No data\n";
        }

        $headers = ['ID', 'Tên môn học', 'Mã', 'Mô tả', 'Kích hoạt', 'Thứ tự'];

        $csv = '"'.implode('","', $headers)."\"\n";

        foreach ($data as $row) {
            $values = [
                $row['id'] ?? '',
                $row['name'] ?? '',
                $row['code'] ?? '',
                $row['description'] ?? '',
                $row['is_active'] ?? '',
                $row['order'] ?? '',
            ];

            $values = array_map(function ($value) {
                $value = (string) $value;

                return str_replace('"', '""', $value);
            }, $values);

            $csv .= '"'.implode('","', $values)."\"\n";
        }

        return $csv;
    }

    private function convertGradeLevelsDataToCsv(array $data): string
    {
        if (empty($data)) {
            return "No data\n";
        }

        $headers = ['ID', 'Tên cấp độ/khối', 'Mã', 'Mô tả', 'Kích hoạt', 'Thứ tự'];

        $csv = '"'.implode('","', $headers)."\"\n";

        foreach ($data as $row) {
            $values = [
                $row['id'] ?? '',
                $row['name'] ?? '',
                $row['code'] ?? '',
                $row['description'] ?? '',
                $row['is_active'] ?? '',
                $row['order'] ?? '',
            ];

            $values = array_map(function ($value) {
                $value = (string) $value;

                return str_replace('"', '""', $value);
            }, $values);

            $csv .= '"'.implode('","', $values)."\"\n";
        }

        return $csv;
    }

    private function convertGradeTypesDataToCsv(array $data): string
    {
        if (empty($data)) {
            return "No data\n";
        }

        $headers = ['ID', 'Tên loại điểm', 'Mã', 'Mô tả', 'Kích hoạt', 'Thứ tự'];

        $csv = '"'.implode('","', $headers)."\"\n";

        foreach ($data as $row) {
            $values = [
                $row['id'] ?? '',
                $row['name'] ?? '',
                $row['code'] ?? '',
                $row['description'] ?? '',
                $row['is_active'] ?? '',
                $row['order'] ?? '',
            ];

            $values = array_map(function ($value) {
                $value = (string) $value;

                return str_replace('"', '""', $value);
            }, $values);

            $csv .= '"'.implode('","', $values)."\"\n";
        }

        return $csv;
    }

    private function convertClassesToCsv(array $data): string
    {
        $csv = "Báo cáo lớp học\n\n";

        // Summary
        $summary = $data['summary'] ?? [];
        $csv .= 'Tổng số lớp,'.($summary['total_classes'] ?? 0)."\n";
        $csv .= 'Lớp mới trong kỳ,'.($summary['new_classes_in_period'] ?? 0)."\n";
        $csv .= 'Lớp đang hoạt động,'.($summary['active_classes'] ?? 0)."\n";
        $csv .= 'Lớp không hoạt động,'.($summary['inactive_classes'] ?? 0)."\n";
        $csv .= 'Lớp đã hoàn thành,'.($summary['completed_classes'] ?? 0)."\n\n";

        // By status
        if (! empty($data['by_status'])) {
            $csv .= "Theo trạng thái\n";
            $csv .= "\"Trạng thái\",\"Số lượng\"\n";
            foreach ($data['by_status'] as $item) {
                $csv .= "\"{$item['status']}\",".($item['count'] ?? 0)."\n";
            }
            $csv .= "\n";
        }

        // Top classes by students
        if (! empty($data['top_classes_by_students'])) {
            $csv .= "Top lớp có nhiều học sinh nhất\n";
            $csv .= "\"Lớp\",\"Số học sinh\"\n";
            foreach ($data['top_classes_by_students'] as $item) {
                $csv .= "\"{$item['class_name']}\",".($item['student_count'] ?? 0)."\n";
            }
            $csv .= "\n";
        }

        // Top classes by performance
        if (! empty($data['top_classes_by_performance'])) {
            $csv .= "Top lớp có hiệu suất tốt nhất\n";
            $csv .= "\"Lớp\",\"Tổng điểm danh\",\"Có mặt\",\"Tỷ lệ\"\n";
            foreach ($data['top_classes_by_performance'] as $item) {
                $csv .= "\"{$item['class_name']}\",".($item['total_attendance'] ?? 0).','.($item['present_count'] ?? 0).','.($item['attendance_rate'] ?? 0)."%\n";
            }
        }

        return $csv;
    }

    private function convertAssignmentsToCsv(array $data): string
    {
        $csv = "Báo cáo bài tập\n\n";

        $csv .= 'Tổng số bài tập,'.($data['total_assignments'] ?? 0)."\n";
        $csv .= 'Tỷ lệ nộp bài,'.($data['submission_rate'] ?? 0)."%\n";
        $csv .= 'Điểm trung bình,'.($data['average_grade'] ?? 0)."\n\n";

        // By status
        if (! empty($data['by_status'])) {
            $csv .= "Theo trạng thái\n";
            $csv .= "\"Trạng thái\",\"Số lượng\"\n";
            foreach ($data['by_status'] as $item) {
                $csv .= "\"{$item['status']}\",".($item['count'] ?? 0)."\n";
            }
            $csv .= "\n";
        }

        // By grade
        if (! empty($data['by_grade'])) {
            $csv .= "Phân bố điểm số\n";
            $csv .= "\"Khoảng điểm\",\"Số lượng\"\n";
            foreach ($data['by_grade'] as $item) {
                $csv .= "\"{$item['grade_range']}\",".($item['count'] ?? 0)."\n";
            }
            $csv .= "\n";
        }

        // Grade stats
        if (! empty($data['grade_stats'])) {
            $csv .= "Thống kê điểm số\n";
            $csv .= 'Trung bình,'.($data['grade_stats']['average'] ?? 0)."\n";
            $csv .= 'Cao nhất,'.($data['grade_stats']['max'] ?? 0)."\n";
            $csv .= 'Thấp nhất,'.($data['grade_stats']['min'] ?? 0)."\n";
        }

        return $csv;
    }

    private function convertGradesToCsv(array $data): string
    {
        if (empty($data)) {
            return "No data\n";
        }

        $headers = [
            'ID',
            'Học viên',
            'Email học viên',
            'Lớp',
            'Tiêu đề',
            'Điểm',
            'Điểm tối đa',
            'Tỷ lệ %',
            'Loại điểm',
            'Bài tập',
            'Giáo viên',
            'Ngày chấm',
            'Học kỳ',
            'Nhận xét',
            'Ngày tạo',
        ];

        $csv = '"'.implode('","', $headers)."\"\n";

        foreach ($data as $row) {
            $values = [
                $row['id'] ?? '',
                $row['student_name'] ?? '',
                $row['student_email'] ?? '',
                $row['class_name'] ?? '',
                $row['title'] ?? '',
                $row['score'] ?? '',
                $row['max_score'] ?? '',
                $row['percentage'] ?? '',
                $row['grade_type_name'] ?? '',
                $row['assignment_title'] ?? '',
                $row['tutor_name'] ?? '',
                $row['grade_date'] ?? '',
                $row['semester'] ?? '',
                $row['comments'] ?? '',
                $row['created_at'] ?? '',
            ];

            $values = array_map(function ($value) {
                $value = (string) $value;

                return str_replace('"', '""', $value);
            }, $values);

            $csv .= '"'.implode('","', $values)."\"\n";
        }

        return $csv;
    }

    private function convertPaymentRequestsToCsv(array $data): string
    {
        if (empty($data)) {
            return "No data\n";
        }

        $headers = [
            'ID',
            'Lớp',
            'Kỳ',
            'Tháng',
            'Số tiền/học viên',
            'Hạn thanh toán',
            'Trạng thái',
            'Tổng học viên',
            'Đã thanh toán',
            'Chờ thanh toán',
            'Tổng thu',
            'Ngày tạo',
        ];

        $csv = '"'.implode('","', $headers)."\"\n";

        foreach ($data as $row) {
            $values = [
                $row['id'] ?? '',
                $row['class_name'] ?? '',
                $row['period_name'] ?? '',
                $row['period_month'] ?? '',
                $row['amount_per_student'] ?? '',
                $row['due_date'] ?? '',
                $row['status'] ?? '',
                $row['total_students'] ?? '',
                $row['paid_count'] ?? '',
                $row['pending_count'] ?? '',
                $row['total_collected'] ?? '',
                $row['created_at'] ?? '',
            ];

            $values = array_map(function ($value) {
                $value = (string) $value;

                return str_replace('"', '""', $value);
            }, $values);

            $csv .= '"'.implode('","', $values)."\"\n";
        }

        return $csv;
    }

    private function convertLoginActivitiesToCsv(array $data): string
    {
        if (empty($data)) {
            return "No data\n";
        }

        $headers = [
            'ID',
            'User ID',
            'Email',
            'Tên người dùng',
            'Thành công',
            'Trạng thái',
            'Địa chỉ IP',
            'Thiết bị',
            'Vị trí',
            'User Agent',
            'Thông báo',
            'Thời gian đăng nhập',
            'Ngày tạo',
        ];

        $csv = '"'.implode('","', $headers)."\"\n";

        foreach ($data as $row) {
            $values = [
                $row['id'] ?? '',
                $row['user_id'] ?? '',
                $row['user_email'] ?? '',
                $row['user_name'] ?? '',
                $row['is_success'] ?? '',
                $row['status'] ?? '',
                $row['ip_address'] ?? '',
                $row['device_name'] ?? '',
                $row['location'] ?? '',
                $row['user_agent'] ?? '',
                $row['message'] ?? '',
                $row['logged_in_at'] ?? '',
                $row['created_at'] ?? '',
            ];

            $values = array_map(function ($value) {
                $value = (string) $value;

                return str_replace('"', '""', $value);
            }, $values);

            $csv .= '"'.implode('","', $values)."\"\n";
        }

        return $csv;
    }

    // =============================================================================================
    // FINANCE renderers (Wave 4). Pure array/Collection -> CSV; no DATE_FORMAT, no DB — unit-testable
    // directly on SQLite from a known fixture (design §6 risk 8). Amounts are VND integers.
    // =============================================================================================

    private function convertFinancePnlToCsv(array $data): string
    {
        $summary = $data['summary'] ?? [];
        $period = $data['period'] ?? [];

        $csv = "Báo cáo lãi lỗ (P&L)\n\n";
        $csv .= 'Khoảng thời gian,"'.($period['from'] ?? '').' - '.($period['to'] ?? '')."\"\n";
        $csv .= 'Cơ sở,'.($data['basis'] ?? '')."\n";
        $csv .= 'Đã tích hợp bảng lương,'.(! empty($data['payroll_available']) ? 'Có' : 'Chưa')."\n\n";

        $csv .= 'Tổng doanh thu,'.$this->money($summary['total_revenue'] ?? 0)."\n";
        $csv .= 'Tổng chi phí,'.$this->money($summary['total_expenses'] ?? 0)."\n";
        $csv .= 'Chi phí lương (gia sư),'.$this->money($summary['tutor_cost'] ?? 0)."\n";
        $csv .= 'Lợi nhuận ròng,'.$this->money($summary['net_profit'] ?? 0)."\n";
        $csv .= 'Biên lợi nhuận (%),'.($summary['margin_pct'] ?? '')."\n\n";

        $csv .= "Theo tháng\n";
        $csv .= "\"Tháng\",\"Doanh thu\",\"Chi phí\",\"Lợi nhuận\",\"Biên (%)\"\n";
        foreach ($data['by_month'] ?? [] as $row) {
            $csv .= '"'.($row['month'] ?? '').'",'
                .$this->money($row['revenue'] ?? 0).','
                .$this->money($row['expenses'] ?? 0).','
                .$this->money($row['net_profit'] ?? 0).','
                .($row['margin_pct'] ?? '')."\n";
        }

        $csv .= "\nChi phí theo hạng mục\n";
        $csv .= "\"Hạng mục\",\"Tổng\"\n";
        foreach ($data['expenses_by_category'] ?? [] as $row) {
            $csv .= '"'.($row['category'] ?? '').'",'.$this->money($row['total'] ?? 0)."\n";
        }

        return $csv;
    }

    private function convertFinanceTutorProfitabilityToCsv(array $data): string
    {
        $summary = $data['summary'] ?? [];

        $csv = "Báo cáo lợi nhuận theo gia sư\n\n";
        $csv .= 'Tổng doanh thu,'.$this->money($summary['total_revenue'] ?? 0)."\n";
        $csv .= 'Tổng chi phí lương,'.$this->money($summary['total_payroll_cost'] ?? 0)."\n";
        $csv .= 'Tổng chi phí phân bổ,'.$this->money($summary['total_attributed_expenses'] ?? 0)."\n";
        $csv .= 'Tổng biên lợi nhuận,'.$this->money($summary['total_margin'] ?? 0)."\n\n";

        $csv .= "\"Gia sư\",\"Vai trò\",\"Doanh thu\",\"Chi phí lương\",\"Chi phí phân bổ\",\"Biên lợi nhuận\",\"Biên (%)\"\n";
        foreach ($data['tutors'] ?? [] as $row) {
            $csv .= '"'.($row['tutor_name'] ?? '').'",'
                .'"'.($row['org_role'] ?? '').'",'
                .$this->money($row['revenue'] ?? 0).','
                .$this->money($row['payroll_cost'] ?? 0).','
                .$this->money($row['attributed_expenses'] ?? 0).','
                .$this->money($row['margin'] ?? 0).','
                .($row['margin_pct'] ?? '')."\n";
        }

        return $csv;
    }

    private function convertFinanceCashflowToCsv(array $data): string
    {
        $summary = $data['summary'] ?? [];

        $csv = "Báo cáo dòng tiền\n\n";
        $csv .= 'Tiền vào,'.$this->money($summary['total_in'] ?? 0)."\n";
        $csv .= 'Tiền ra,'.$this->money($summary['total_out'] ?? 0)."\n";
        $csv .= '  Chi phí,'.$this->money($summary['expense_out'] ?? 0)."\n";
        $csv .= '  Lương,'.$this->money($summary['payroll_out'] ?? 0)."\n";
        $csv .= 'Dòng tiền ròng,'.$this->money($summary['net_flow'] ?? 0)."\n\n";

        $csv .= "\"Tháng\",\"Tiền vào\",\"Tiền ra\",\"Chi phí\",\"Lương\",\"Ròng\"\n";
        foreach ($data['by_month'] ?? [] as $row) {
            $csv .= '"'.($row['month'] ?? '').'",'
                .$this->money($row['money_in'] ?? 0).','
                .$this->money($row['money_out'] ?? 0).','
                .$this->money($row['expense_out'] ?? 0).','
                .$this->money($row['payroll_out'] ?? 0).','
                .$this->money($row['net_flow'] ?? 0)."\n";
        }

        return $csv;
    }

    private function convertFinancePayablesToCsv(array $data): string
    {
        $summary = $data['summary'] ?? [];

        $csv = "Báo cáo công nợ phải trả\n\n";
        $csv .= 'Tổng phải trả,'.$this->money($summary['total_payable'] ?? 0)."\n";
        $csv .= 'Lương chưa trả,'.$this->money($summary['payroll_payable'] ?? 0)."\n";
        $csv .= 'Chi phí chưa trả,'.$this->money($summary['expense_payable'] ?? 0)."\n\n";

        $csv .= "Lương chưa trả\n";
        $csv .= "\"Gia sư\",\"Số tiền\"\n";
        foreach ($data['payroll'] ?? [] as $row) {
            $csv .= '"'.($row['tutor_name'] ?? '').'",'.$this->money($row['amount'] ?? 0)."\n";
        }

        $csv .= "\nChi phí chưa trả\n";
        $csv .= "\"Hạng mục\",\"Số tiền\",\"Ngày\",\"Mô tả\"\n";
        foreach ($data['expenses'] ?? [] as $row) {
            $csv .= '"'.($row['category'] ?? '').'",'
                .$this->money($row['amount'] ?? 0).','
                .'"'.($row['expense_date'] ?? '').'",'
                .'"'.str_replace('"', '""', (string) ($row['description'] ?? ''))."\"\n";
        }

        return $csv;
    }

    /** Format a VND amount as a grouped integer (e.g. 1.000.000) — matches the other money renderers. */
    private function money($amount): string
    {
        return number_format((float) $amount, 0, ',', '.');
    }
}
