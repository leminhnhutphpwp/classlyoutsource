<?php

namespace App\Console\Commands;

use App\Models\Payment;
use App\Models\PaymentRequest;
use Illuminate\Console\Command;

class SyncMissedClassPayments extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'payments:sync-missed {--dry-run : Chỉ hiển thị những gì sẽ được tạo mà không thực sự tạo bản ghi}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Tạo bản ghi thanh toán còn thiếu cho học viên đã ghi danh vào lớp có yêu cầu thanh toán đang hoạt động.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Bắt đầu đồng bộ các khoản thanh toán còn thiếu...');

        $isDryRun = $this->option('dry-run');
        if ($isDryRun) {
            $this->warn('CHẾ ĐỘ THỬ NGHIỆM: Không có bản ghi nào sẽ được tạo.');
        }

        // Get all active payment requests
        $paymentRequests = PaymentRequest::where('status', 'active')->with('class')->get();

        $count = 0;
        $totalChecked = 0;

        $bar = $this->output->createProgressBar(count($paymentRequests));
        $bar->start();

        foreach ($paymentRequests as $request) {
            $class = $request->class;

            if (! $class) {
                continue;
            }

            // Get all active students in the class
            // We use the relation to ensure we respect how students are retrieved
            $students = $class->students()->wherePivot('status', 'active')->get();

            foreach ($students as $student) {
                $totalChecked++;

                // Check if payment exists
                $exists = Payment::where('payment_request_id', $request->id)
                    ->where('student_id', $student->id)
                    ->exists();

                if (! $exists) {
                    if (! $isDryRun) {
                        try {
                            Payment::create([
                                'student_id' => $student->id,
                                'class_id' => $request->class_id,
                                'payment_request_id' => $request->id,
                                'amount' => $request->amount_per_student,
                                'month' => $request->period_month,
                                'due_date' => $request->due_date,
                                'status' => 'pending',
                                'note' => $request->description,
                            ]);
                        } catch (\Exception $e) {
                            $this->error("\nLỗi khi tạo thanh toán cho Học viên ID {$student->id} trong Yêu cầu ID {$request->id}: ".$e->getMessage());

                            continue;
                        }
                    } else {
                        $this->line("\n[Chạy thử] Sẽ tạo thanh toán cho Học viên: {$student->name} (ID: {$student->id}) trong Lớp: {$class->name} cho Đợt: {$request->period_name}");
                    }
                    $count++;
                }
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();

        if ($isDryRun) {
            $this->info("Chạy thử hoàn tất. Phát hiện {$count} khoản thanh toán còn thiếu trong {$totalChecked} lần kiểm tra.");
        } else {
            $this->info("Đồng bộ hoàn tất. Đã tạo {$count} khoản thanh toán còn thiếu trong {$totalChecked} lần kiểm tra.");
        }
    }
}
