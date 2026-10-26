<?php

namespace Tests\Unit;

use App\Services\Reports\CsvExporter;
use Illuminate\Http\Request;
use PHPUnit\Framework\TestCase;

/**
 * Direct unit test of the extracted CsvExporter (report SQL uses MySQL-only DATE_FORMAT, so the export
 * endpoint can't run on SQLite — this exercises the pure array->string rendering instead).
 */
class CsvExporterTest extends TestCase
{
    public function test_students_report_renders_known_headers(): void
    {
        $csv = (new CsvExporter)->convert([
            'summary' => [
                'total_students' => 3,
                'new_students_in_period' => 1,
                'active_students' => 2,
                'inactive_students' => 1,
                'graduated_students' => 0,
            ],
            'by_status' => [['status' => 'active', 'count' => 2]],
        ], 'students');

        $this->assertStringContainsString('Báo cáo học sinh', $csv);
        $this->assertStringContainsString('Tổng số học sinh,3', $csv);
        $this->assertStringContainsString('active', $csv);
    }

    public function test_revenue_report_renders(): void
    {
        $csv = (new CsvExporter)->convert(['summary' => []], 'revenue');
        $this->assertIsString($csv);
        $this->assertNotEmpty($csv);
    }

    public function test_generate_filename(): void
    {
        $req = new Request(['date_from' => '2026-01-01', 'status' => 'active']);
        $name = (new CsvExporter)->generateFilename('students', 'csv', $req);
        $this->assertStringStartsWith('students', $name);
        $this->assertStringEndsWith('.csv', $name);
        $this->assertStringContainsString('from_2026-01-01', $name);
    }

    // =============================================================================================
    // FINANCE renderers (Wave 4) — pure array -> CSV, known fixture -> expected CSV. These run on
    // SQLite/no-DB precisely because the renderer is DB-free (design §6 risk 8).
    // =============================================================================================

    public function test_finance_pnl_renders_summary_and_by_month(): void
    {
        $csv = (new CsvExporter)->convert([
            'basis' => 'cash',
            'payroll_available' => true,
            'period' => ['from' => '2026-01-01', 'to' => '2026-12-31'],
            'summary' => [
                'total_revenue' => 1000000,
                'total_expenses' => 400000,
                'tutor_cost' => 300000,
                'net_profit' => 300000,
                'margin_pct' => 30.0,
            ],
            'by_month' => [
                ['month' => '2026-07', 'revenue' => 1000000, 'expenses' => 400000, 'net_profit' => 600000, 'margin_pct' => 60.0],
            ],
            'expenses_by_category' => [
                ['category' => 'rent', 'total' => 400000],
            ],
        ], 'finance-pnl');

        $this->assertStringContainsString('Báo cáo lãi lỗ (P&L)', $csv);
        $this->assertStringContainsString('Tổng doanh thu,1.000.000', $csv);
        $this->assertStringContainsString('Chi phí lương (gia sư),300.000', $csv);
        $this->assertStringContainsString('Lợi nhuận ròng,300.000', $csv);
        $this->assertStringContainsString('2026-07', $csv);
        $this->assertStringContainsString('rent', $csv);
        $this->assertStringContainsString('Đã tích hợp bảng lương,Có', $csv);
    }

    public function test_finance_tutor_profitability_renders_rows(): void
    {
        $csv = (new CsvExporter)->convert([
            'summary' => [
                'total_revenue' => 1000000,
                'total_payroll_cost' => 300000,
                'total_attributed_expenses' => 50000,
                'total_margin' => 650000,
            ],
            'tutors' => [
                ['tutor_name' => 'Cô A', 'org_role' => 'tutor', 'revenue' => 1000000, 'payroll_cost' => 300000, 'attributed_expenses' => 50000, 'margin' => 650000, 'margin_pct' => 65.0],
            ],
        ], 'finance-tutor-profitability');

        $this->assertStringContainsString('Báo cáo lợi nhuận theo gia sư', $csv);
        $this->assertStringContainsString('Cô A', $csv);
        $this->assertStringContainsString('650.000', $csv);
        $this->assertStringContainsString('Tổng biên lợi nhuận,650.000', $csv);
    }

    public function test_finance_cashflow_renders_in_out_net(): void
    {
        $csv = (new CsvExporter)->convert([
            'summary' => [
                'total_in' => 1000000,
                'total_out' => 700000,
                'expense_out' => 400000,
                'payroll_out' => 300000,
                'net_flow' => 300000,
            ],
            'by_month' => [
                ['month' => '2026-07', 'money_in' => 1000000, 'money_out' => 700000, 'expense_out' => 400000, 'payroll_out' => 300000, 'net_flow' => 300000],
            ],
        ], 'finance-cashflow');

        $this->assertStringContainsString('Báo cáo dòng tiền', $csv);
        $this->assertStringContainsString('Tiền vào,1.000.000', $csv);
        $this->assertStringContainsString('Dòng tiền ròng,300.000', $csv);
        $this->assertStringContainsString('2026-07', $csv);
    }

    public function test_finance_payables_renders_payroll_and_expenses(): void
    {
        $csv = (new CsvExporter)->convert([
            'payroll_available' => true,
            'summary' => [
                'total_payable' => 900000,
                'payroll_payable' => 500000,
                'expense_payable' => 400000,
            ],
            'payroll' => [
                ['tutor_id' => 'abc', 'tutor_name' => 'Thầy B', 'amount' => 500000],
            ],
            'expenses' => [
                ['_id' => 'x', 'category' => 'rent', 'amount' => 400000, 'expense_date' => '2026-07-01', 'description' => 'Thuê nhà "tháng 7"'],
            ],
        ], 'finance-payables');

        $this->assertStringContainsString('Báo cáo công nợ phải trả', $csv);
        $this->assertStringContainsString('Tổng phải trả,900.000', $csv);
        $this->assertStringContainsString('Thầy B', $csv);
        $this->assertStringContainsString('rent', $csv);
        // Embedded double-quotes in the description are CSV-escaped ("" ), never breaking the row.
        $this->assertStringContainsString('Thuê nhà ""tháng 7""', $csv);
    }
}
