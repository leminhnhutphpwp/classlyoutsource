<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;
use Maatwebsite\Excel\Facades\Excel;

class ImportService
{
    /**
     * Read file and return rows and errors.
     *
     * @return array ['rows' => array, 'errors' => array]
     */
    public static function readFile(?UploadedFile $file, array $requiredColumns = []): array
    {
        if (! $file) {
            return ['rows' => [], 'errors' => ['Không tìm thấy file.']];
        }

        try {
            $extension = strtolower($file->getClientOriginalExtension());
            $result = ['rows' => [], 'errors' => []];

            if ($extension === 'csv') {
                $result = self::readCsv($file);
            } elseif (in_array($extension, ['xlsx', 'xls', 'ods'])) {
                $result = self::readExcel($file);
            } else {
                return ['rows' => [], 'errors' => ['Định dạng file không hỗ trợ ('.$extension.').']];
            }

            // Check required columns if any
            if (! empty($requiredColumns) && ! empty($result['rows'])) {
                $firstRow = $result['rows'][0]['data'];
                $presentColumns = array_keys($firstRow);

                foreach ($requiredColumns as $col) {
                    if (! in_array($col, $presentColumns)) {
                        return ['rows' => [], 'errors' => ["File thiếu cột bắt buộc: {$col}"]];
                    }
                }
            }

            return $result;
        } catch (\Exception $e) {
            return ['rows' => [], 'errors' => ['Lỗi khi đọc file: '.$e->getMessage()]];
        }
    }

    /**
     * Read CSV file.
     */
    private static function readCsv(UploadedFile $file): array
    {
        $rows = [];
        $header = null;

        $filePath = $file->getRealPath();

        // Detect delimiter and check for BOM
        $handle = fopen($filePath, 'r');
        if (! $handle) {
            return ['rows' => [], 'errors' => ['Không thể mở file.']];
        }
        $firstLine = fgets($handle);
        fclose($handle);

        $delimiter = str_contains($firstLine, ';') ? ';' : ',';

        if (($handle = fopen($filePath, 'r')) !== false) {
            $rowNumber = 0;
            while (($data = fgetcsv($handle, 0, $delimiter)) !== false) {
                $rowNumber++;

                // Check for empty row
                if (count(array_filter($data)) === 0) {
                    continue;
                }

                if (! $header) {
                    // Stripping BOM from the first header element if present
                    if (isset($data[0])) {
                        $data[0] = self::stripBom($data[0]);
                    }
                    $header = array_map('trim', $data);

                    continue;
                }

                // Ensure data and header have same length
                if (count($header) !== count($data)) {
                    if (count($data) < count($header)) {
                        $data = array_pad($data, count($header), null);
                    } else {
                        $data = array_slice($data, 0, count($header));
                    }
                }

                $rowData = array_combine($header, $data);
                $rows[] = [
                    'row_number' => $rowNumber,
                    'data' => $rowData,
                ];
            }
            fclose($handle);
        }

        return ['rows' => $rows, 'errors' => []];
    }

    /**
     * Strip UTF-8 BOM from string.
     */
    private static function stripBom(string $string): string
    {
        if (strpos($string, "\xEF\xBB\xBF") === 0) {
            return substr($string, 3);
        }

        return $string;
    }

    /**
     * Read Excel file.
     */
    private static function readExcel(UploadedFile $file): array
    {
        // toArray returns array per sheet
        try {
            $data = Excel::toArray(new class {}, $file);
        } catch (\Exception $e) {
            return ['rows' => [], 'errors' => ['Lỗi khi đọc file Excel: '.$e->getMessage()]];
        }

        $rows = [];

        if (! empty($data) && ! empty($data[0])) {
            $sheet = $data[0];
            $header = null;

            foreach ($sheet as $index => $row) {
                $rowNumber = $index + 1;

                // Skip empty rows
                if (count(array_filter($row)) === 0) {
                    continue;
                }

                if (! $header) {
                    $header = array_map(function ($val) {
                        return trim((string) $val);
                    }, $row);

                    continue;
                }

                // array_combine needs same length
                if (count($header) !== count($row)) {
                    if (count($row) < count($header)) {
                        $row = array_pad($row, count($header), null);
                    } else {
                        $row = array_slice($row, 0, count($header));
                    }
                }

                try {
                    $rowData = array_combine($header, $row);
                    $rows[] = [
                        'row_number' => $rowNumber,
                        'data' => $rowData,
                    ];
                } catch (\Exception $e) {
                    // Skip if mapping fails for some reason
                    continue;
                }
            }
        }

        return ['rows' => $rows, 'errors' => []];
    }

    /**
     * Validate a single row.
     */
    public static function validateRow(array $data, array $rules): array
    {
        $validator = Validator::make($data, $rules);

        if ($validator->fails()) {
            return [
                'valid' => false,
                'errors' => $validator->errors()->all(),
            ];
        }

        return [
            'valid' => true,
            'errors' => [],
        ];
    }
}
