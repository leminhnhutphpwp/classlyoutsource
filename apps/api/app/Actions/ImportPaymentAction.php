<?php

namespace App\Actions;

use App\Actions\Concerns\ResolvesImportEntities;
use App\Models\Payment;
use App\Models\PaymentRequest;
use App\Models\User;
use App\Services\ImportService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ImportPaymentAction
{
    use ResolvesImportEntities;

    /**
     * Import payments from file data.
     *
     * @param  array  $rows  Array of rows from ImportService::readFile()
     * @param  int  $userId  User ID creating the import
     * @param  bool  $overrideExisting  Override existing payment records
     * @return array ['success' => int, 'failed' => int, 'skipped' => int, 'errors' => []]
     */
    public static function execute(array $rows, int $userId, bool $overrideExisting = false): array
    {
        $success = 0;
        $failed = 0;
        $skipped = 0;
        $errors = [];

        $user = User::find($userId);
        if (! $user) {
            return [
                'success' => 0,
                'failed' => count($rows),
                'skipped' => 0,
                'errors' => [['row' => 0, 'errors' => ['Người dùng không tồn tại.']]],
            ];
        }

        DB::beginTransaction();

        try {
            foreach ($rows as $rowInfo) {
                $rowNumber = $rowInfo['row_number'];
                $rowData = $rowInfo['data'];

                // Map column names
                $mappedData = self::mapRowData($rowData);

                // Validate row
                $validation = self::validateRow($mappedData);
                if (! $validation['valid']) {
                    $failed++;
                    $errors[] = [
                        'row' => $rowNumber,
                        'data' => $mappedData,
                        'errors' => $validation['errors'],
                    ];

                    continue;
                }

                // Find student
                $student = self::findStudent($mappedData);
                if (! $student) {
                    $failed++;
                    $errors[] = [
                        'row' => $rowNumber,
                        'data' => $mappedData,
                        'errors' => ['Không tìm thấy học viên (kiểm tra email, số điện thoại hoặc mã học viên).'],
                    ];

                    continue;
                }

                // Find payment request (if provided)
                $paymentRequest = null;
                if (! empty($mappedData['payment_request_id']) || ! empty($mappedData['invoice_number'])) {
                    $paymentRequest = self::findPaymentRequest($mappedData);
                    if (! $paymentRequest) {
                        $failed++;
                        $errors[] = [
                            'row' => $rowNumber,
                            'data' => $mappedData,
                            'errors' => ['Không tìm thấy yêu cầu thanh toán hoặc hóa đơn.'],
                        ];

                        continue;
                    }

                    // Check access (tutor can only import payments for their classes)
                    if ($user->isTutor() && ! $user->isSuperAdmin()) {
                        if ($paymentRequest->class->tutor_id !== $userId) {
                            $failed++;
                            $errors[] = [
                                'row' => $rowNumber,
                                'data' => $mappedData,
                                'errors' => ['Không có quyền import thanh toán cho lớp này.'],
                            ];

                            continue;
                        }
                    }
                }

                // Find class (from payment request or directly)
                $class = null;
                if ($paymentRequest) {
                    $class = $paymentRequest->class;
                } elseif (! empty($mappedData['class_code']) || ! empty($mappedData['class_name']) || ! empty($mappedData['class_id'])) {
                    $class = self::findClass($mappedData, $userId);
                    if (! $class) {
                        $failed++;
                        $errors[] = [
                            'row' => $rowNumber,
                            'data' => $mappedData,
                            'errors' => ['Không tìm thấy lớp học.'],
                        ];

                        continue;
                    }
                }

                // A payment must belong to a class the student is ACTIVELY enrolled in — importing a
                // payment for a non-enrolled student would book revenue with no service (design §cash).
                if ($class) {
                    $activeEnrollment = \App\Models\Enrollment::where('student_id', $student->id)
                        ->where('class_id', $class->id)
                        ->where('status', 'active')
                        ->exists();
                    if (! $activeEnrollment) {
                        $failed++;
                        $errors[] = [
                            'row' => $rowNumber,
                            'data' => $mappedData,
                            'errors' => ['Học viên chưa đăng ký hoạt động vào lớp này.'],
                        ];

                        continue;
                    }
                }

                // Check if payment already exists (by invoice_number or payment_request_id + student_id)
                $existingPayment = null;
                if (! empty($mappedData['invoice_number'])) {
                    $existingPayment = Payment::where('invoice_number', $mappedData['invoice_number'])->first();
                } elseif ($paymentRequest) {
                    $existingPayment = Payment::where('payment_request_id', $paymentRequest->id)
                        ->where('student_id', $student->id)
                        ->first();
                }

                if ($existingPayment && ! $overrideExisting) {
                    $skipped++;
                    $errors[] = [
                        'row' => $rowNumber,
                        'data' => $mappedData,
                        'errors' => ['Thanh toán đã tồn tại. Sử dụng override_existing=true để ghi đè.'],
                    ];

                    continue;
                }

                // Create or update payment
                try {
                    $paymentDate = $mappedData['payment_date'] ?? now();

                    $paymentData = [
                        'student_id' => $student->id,
                        'amount' => $mappedData['amount'],
                        'payment_method' => $mappedData['payment_method'] ?? 'other',
                        'payment_date' => $paymentDate,
                        // payments.month is NOT NULL — default to the payment_date's month when the
                        // file has no month column instead of letting the insert fail.
                        'month' => $mappedData['month'] ?? \Illuminate\Support\Carbon::parse($paymentDate)->format('Y-m'),
                        'status' => $mappedData['status'] ?? 'paid',
                        'note' => $mappedData['note'] ?? null,
                    ];

                    if ($class) {
                        $paymentData['class_id'] = $class->id;
                    }

                    if ($paymentRequest) {
                        $paymentData['payment_request_id'] = $paymentRequest->id;
                    }

                    if (! empty($mappedData['invoice_number'])) {
                        $paymentData['invoice_number'] = $mappedData['invoice_number'];
                    }

                    if (! empty($mappedData['transaction_id'])) {
                        $paymentData['transaction_id'] = $mappedData['transaction_id'];
                    }

                    if (! empty($mappedData['due_date'])) {
                        $paymentData['due_date'] = $mappedData['due_date'];
                    }

                    if ($existingPayment && $overrideExisting) {
                        $existingPayment->update($paymentData);
                    } else {
                        Payment::create($paymentData);
                    }

                    $success++;
                } catch (\Exception $e) {
                    $failed++;
                    $errors[] = [
                        'row' => $rowNumber,
                        'data' => $mappedData,
                        'errors' => ['Lỗi khi tạo thanh toán: '.$e->getMessage()],
                    ];
                    Log::channel('payments')->error('Import payment error', [
                        'row' => $rowNumber,
                        'data' => $mappedData,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            DB::commit();

            Log::channel('payments')->info('Payments imported', [
                'user_id' => $userId,
                'success' => $success,
                'failed' => $failed,
                'skipped' => $skipped,
            ]);

            return [
                'success' => $success,
                'failed' => $failed,
                'skipped' => $skipped,
                'errors' => $errors,
            ];
        } catch (\Exception $e) {
            DB::rollBack();

            Log::channel('payments')->error('Import payments transaction failed', [
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => 0,
                'failed' => count($rows),
                'skipped' => 0,
                'errors' => [['row' => 0, 'errors' => ['Lỗi hệ thống: '.$e->getMessage()]]],
            ];
        }
    }

    /**
     * Map row data to standard keys.
     */
    private static function mapRowData(array $rowData): array
    {
        $mapped = [];

        // Column mapping
        $mappings = [
            'student_email' => ['email học viên', 'student_email', 'email', 'email_student'],
            'student_phone' => ['số điện thoại học viên', 'student_phone', 'phone', 'phone_student'],
            'student_id' => ['mã học viên', 'student_id', 'id học viên', 'student_code'],
            'payment_request_id' => ['mã yêu cầu', 'payment_request_id', 'id yêu cầu', 'request_id'],
            'invoice_number' => ['số hóa đơn', 'invoice_number', 'invoice', 'mã hóa đơn'],
            'class_code' => ['mã lớp', 'class_code', 'code', 'mã lớp học'],
            'class_name' => ['tên lớp', 'class_name', 'name', 'tên lớp học'],
            'class_id' => ['id lớp', 'class_id', 'id lớp học'],
            'amount' => ['số tiền', 'amount', 'số tiền thanh toán', 'tiền'],
            'payment_method' => ['phương thức', 'payment_method', 'method', 'phương thức thanh toán'],
            'payment_date' => ['ngày thanh toán', 'payment_date', 'date', 'ngày'],
            'status' => ['trạng thái', 'status', 'trạng thái thanh toán'],
            'transaction_id' => ['mã giao dịch', 'transaction_id', 'transaction', 'mã transaction'],
            'month' => ['tháng', 'month', 'tháng thanh toán'],
            'due_date' => ['hạn thanh toán', 'due_date', 'due', 'hạn'],
            'note' => ['ghi chú', 'notes', 'note', 'mô tả'],
        ];

        foreach ($mappings as $key => $possibleNames) {
            foreach ($possibleNames as $possibleName) {
                foreach ($rowData as $rowKey => $value) {
                    if (strcasecmp(trim($rowKey), trim($possibleName)) === 0) {
                        $mapped[$key] = $value;
                        break 2;
                    }
                }
            }
        }

        return $mapped;
    }

    /**
     * Validate row data.
     */
    private static function validateRow(array $data): array
    {
        // At least one student identifier is required
        $hasStudentId = ! empty($data['student_email']) ||
                       ! empty($data['student_phone']) ||
                       ! empty($data['student_id']);

        $errors = [];
        if (! $hasStudentId) {
            $errors[] = 'Thiếu thông tin học viên (cần email, số điện thoại hoặc mã học viên).';
        }
        if (empty($data['amount'])) {
            $errors[] = 'Thiếu số tiền thanh toán.';
        }

        if (! empty($errors)) {
            return [
                'valid' => false,
                'errors' => $errors,
            ];
        }

        // Additional validation
        $rules = [
            'amount' => 'required|numeric|min:0',
            'payment_method' => 'nullable|in:cash,bank,bank_transfer,other',
            'status' => 'nullable|in:paid,pending,failed,refunded',
        ];

        if (! empty($data['payment_date'])) {
            $rules['payment_date'] = 'date';
        }
        if (! empty($data['due_date'])) {
            $rules['due_date'] = 'date';
        }
        if (! empty($data['student_email'])) {
            $rules['student_email'] = 'email|max:255';
        }

        return ImportService::validateRow($data, $rules);
    }

    /**
     * Find payment request by ID or invoice number.
     */
    private static function findPaymentRequest(array $data): ?PaymentRequest
    {
        $query = PaymentRequest::query();

        if (! empty($data['payment_request_id'])) {
            $query->where('id', $data['payment_request_id']);
        } elseif (! empty($data['invoice_number'])) {
            // Try to find payment request via payment with this invoice_number
            $payment = Payment::where('invoice_number', $data['invoice_number'])->first();
            if ($payment && $payment->payment_request_id) {
                return PaymentRequest::find($payment->payment_request_id);
            }
        }

        return $query->first();
    }
}
