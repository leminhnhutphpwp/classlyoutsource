<?php

namespace Tests\Unit\Exports;

use App\Exports\ReportExport;
use PHPUnit\Framework\TestCase;

class ReportExportTest extends TestCase
{
    public function test_it_splits_a_csv_into_headings_and_rows(): void
    {
        $csv = "Name,Score\nAn,10\nBình,8\n";

        $export = ReportExport::fromCsv($csv);

        $this->assertSame(['Name', 'Score'], $export->headings());
        $this->assertSame([['An', '10'], ['Bình', '8']], $export->array());
    }

    public function test_it_preserves_quoted_fields_containing_commas(): void
    {
        $csv = "Name,Note\n\"Nguyễn, Văn A\",\"good, steady\"\n";

        $export = ReportExport::fromCsv($csv);

        $this->assertSame(['Name', 'Note'], $export->headings());
        $this->assertSame([['Nguyễn, Văn A', 'good, steady']], $export->array());
    }

    public function test_empty_data_yields_no_rows(): void
    {
        $export = ReportExport::fromCsv("No data\n");

        $this->assertSame(['No data'], $export->headings());
        $this->assertSame([], $export->array());
    }
}
