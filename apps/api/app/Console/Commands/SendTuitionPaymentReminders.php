<?php

namespace App\Console\Commands;

use App\Models\Payment;
use App\Models\PaymentRequest;
use App\Models\Setting;
use App\Models\Student;
use App\Models\User;
use App\Models\UserNotificationPreference;
use App\Notifications\TuitionPaymentReminderNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SendTuitionPaymentReminders extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'notifications:send-payment-reminders 
                            {--days= : Số ngày trước đó để gửi nhắc nhở (mặc định: từ cài đặt hoặc 3)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Gửi thông báo nhắc nhở đóng học phí cho học viên khi sắp tới hạn';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $daysOpt = $this->option('days');
        $daysAhead = $daysOpt !== null
            ? (int) $daysOpt
            : (int) Setting::get('notification.reminder_payment_days_before', 3);

        $targetDate = now()->addDays($daysAhead)->startOfDay();

        $this->info("Đang kiểm tra nhắc nhở học phí sắp đến hạn vào ngày {$targetDate->format('d/m/Y')}...");

        $sentCount = 0;
        $errorCount = 0;

        // 1. Process specific pending Payments
        // Using logic similar to ReminderService: get payments due on target date
        $payments = Payment::with(['student.user', 'class'])
            ->whereDate('due_date', $targetDate)
            ->where('status', 'pending')
            ->get();

        foreach ($payments as $payment) {
            if (! $payment->student || ! $payment->student->user) {
                continue;
            }

            $user = $payment->student->user;

            // Format data similar to ReminderService
            $data = [
                'amount' => $payment->amount,
                'due_date' => $payment->due_date,
                'class_name' => $payment->class->name ?? 'N/A',
                'class_id' => $payment->class_id,
                'payment_id' => $payment->id,
                'message' => 'Bạn có khoản học phí '.number_format($payment->amount, 0, ',', '.').' VNĐ cho lớp '.($payment->class->name ?? 'N/A').' sắp đến hạn.',
            ];

            if ($this->sendReminder($user, $data)) {
                $sentCount++;
            }
        }

        // 2. Process Payment Requests
        // These are class-wide requests that apply to students who have NOT paid yet.
        $requests = PaymentRequest::with(['class.students.user'])
            ->whereDate('due_date', $targetDate)
            ->where('status', 'active')
            ->get();

        foreach ($requests as $request) {
            if (! $request->class) {
                continue;
            }

            foreach ($request->class->students as $student) {
                if (! $student->user) {
                    continue;
                }
                if ($student->pivot->status !== 'active') {
                    continue;
                }

                // Check if student has already paid or has a specific pending payment link
                // If a Payment record exists for this request + student, it determines status.
                // If it's 'paid', we skip. If it's 'pending', it was handled in loop #1 (if due dates match).
                // However, PaymentRequest due_date might differ from individual Payment due_date if manually adjusted?
                // Usually they match.

                $existingPayment = Payment::where('payment_request_id', $request->id)
                    ->where('student_id', $student->id)
                    ->exists();

                if ($existingPayment) {
                    continue; // Handled by individual payment check or already paid/processed
                }

                $data = [
                    'amount' => $request->amount_per_student,
                    'due_date' => $request->due_date,
                    'class_name' => $request->class->name ?? 'N/A',
                    'class_id' => $request->class_id,
                    'payment_request_id' => $request->id,
                    'message' => 'Bạn có đợt thu học phí '.number_format($request->amount_per_student, 0, ',', '.').' VNĐ cho lớp '.($request->class->name ?? 'N/A').' ('.$request->period_name.') sắp đến hạn.',
                ];

                if ($this->sendReminder($student->user, $data)) {
                    $sentCount++;
                }
            }
        }

        $this->info("Đã gửi {$sentCount} nhắc nhở học phí.");

        Log::channel('notifications')->info('Payment reminders sent', [
            'target_date' => $targetDate->toDateString(),
            'sent_count' => $sentCount,
        ]);

        return Command::SUCCESS;
    }

    protected function sendReminder(User $user, array $data)
    {
        try {
            // Check email verification
            if (! $user->hasVerifiedEmail()) {
                // $this->line("  ⊘ Bỏ qua user: {$user->name} (email chưa xác thực)");
                return false;
            }

            // Check preferences using the existing system logic
            // Assuming 'payment_reminder' is the key we want to use
            if (! UserNotificationPreference::shouldSendNotification($user->id, 'payment_reminder', 'email')) {
                $this->line("Bỏ qua user: {$user->name} (đã tắt thông báo)");

                return false;
            }

            $user->notify((new TuitionPaymentReminderNotification($data))->delay(now()->addSeconds(2)));
            $this->line("Đã gửi nhắc nhở tới: {$user->name} ({$user->email})");

            return true;

        } catch (\Exception $e) {
            $this->error("Gửi thất bại tới {$user->email}: {$e->getMessage()}");
            Log::channel('notifications')->error('Gửi nhắc nhở học phí thất bại', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }
}
