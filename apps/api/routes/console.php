<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Schedule tasks (Laravel 11+)

// Xóa các ghi log login cũ (chỉ giữ số lượng lớn nhất)
Schedule::command('login-activity:cleanup')
    ->daily()
    ->at('02:00') // Giờ thấp điểm
    ->withoutOverlapping()
    ->description('Xóa các ghi log login cũ (chỉ giữ số lượng lớn nhất)');

// Tự động quét và tạo các khoản thanh toán bị sót (Failsafe)
Schedule::command('payments:sync-missed')
    ->dailyAt('02:30') // Chạy sau giờ dọn dẹp log
    ->withoutOverlapping()
    ->description('Đồng bộ các khoản thanh toán lớp học bị sót');

// Gửi thông báo nhắc nhở lịch học hàng ngày
Schedule::command('notifications:send-schedule-reminders')
    ->daily()
    ->at('18:00')
    ->withoutOverlapping()
    ->description('Gửi thông báo nhắc nhở lịch học hàng ngày');

// Gửi thông báo nhắc nhở điểm danh hàng ngày
Schedule::command('notifications:send-attendance-reminders')
    ->daily()
    ->at('18:15') // Dời lại 15p để giảm tải server mail
    ->withoutOverlapping()
    ->description('Gửi thông báo nhắc nhở điểm danh hàng ngày');

// Xác nhận các khóa người dùng đã hết hạn
Schedule::command('user-locks:expire')
    ->everyMinute()
    ->withoutOverlapping()
    ->description('Xác nhận các khóa người dùng đã hết hạn');

// Tự động đóng các buổi học đã qua giờ (thu hồi mã QR điểm danh còn sống)
Schedule::command('sessions:auto-complete')
    ->everyFifteenMinutes()
    ->withoutOverlapping()
    ->description('Tự động hoàn tất các buổi học đã qua giờ kết thúc');

// Gửi thông báo nhắc nhở đóng học phí sắp tới hạn
Schedule::command('notifications:send-payment-reminders')
    ->dailyAt('08:00')
    ->withoutOverlapping()
    ->description('Gửi thông báo nhắc nhở đóng học phí sắp tới hạn');

// Gửi thông báo đã hẹn giờ (Custom notifications)
Schedule::command('notifications:send-scheduled')
    ->everyMinute()
    ->withoutOverlapping()
    ->description('Gửi các thông báo chung đã đến giờ hẹn');

// Retry media optimizations that are stuck in pending status
Schedule::command('media:retry-pending --older-than=30 --limit=50')
    ->everyFifteenMinutes()
    ->withoutOverlapping()
    ->description('Retry media optimizations stuck in pending status');

// Cleanup orphaned optimized files weekly
Schedule::command('media:cleanup-orphaned')
    ->weekly()
    ->sundays()
    ->at('03:00')
    ->withoutOverlapping()
    ->description('Clean up orphaned optimized media files');
