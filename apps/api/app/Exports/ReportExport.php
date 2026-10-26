<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;

/**
 * Renders a report as .xlsx by reusing the exact column layout the CSV exporter already produces
 * (App\Services\Reports\CsvExporter). Rather than duplicate the per-report column logic, we parse the
 * generated CSV once and hand its header + rows to maatwebsite/excel — so CSV and Excel exports can never
 * drift apart.
 */
class ReportExport implements FromArray, WithHeadings
{
    /**
     * @param  array<int, string>  $headings
     * @param  array<int, array<int, string>>  $rows
     */
    public function __construct(
        private array $headings,
        private array $rows,
    ) {}

    /** Build from a CSV string produced by CsvExporter::convert(). First non-empty line is the header. */
    public static function fromCsv(string $csv): self
    {
        $handle = fopen('php://temp', 'r+');
        fwrite($handle, $csv);
        rewind($handle);

        $records = [];
        // Explicit args incl. $escape='' — PHP 8.4 deprecates relying on the default escape character.
        while (($record = fgetcsv($handle, null, ',', '"', '')) !== false) {
            // Skip fully blank lines that fgetcsv yields as [null].
            if ($record === [null]) {
                continue;
            }
            $records[] = $record;
        }
        fclose($handle);

        $headings = array_shift($records) ?? [];

        return new self($headings, $records);
    }

    public function array(): array
    {
        return $this->rows;
    }

    public function headings(): array
    {
        return $this->headings;
    }
}
