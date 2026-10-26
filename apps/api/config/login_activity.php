<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Maximum Records Per User
    |--------------------------------------------------------------------------
    |
    | Số lượng records tối đa được giữ lại cho mỗi user trong bảng login_activities.
    | Khi vượt quá số lượng này, các records cũ nhất sẽ tự động bị xóa.
    |
    */

    'max_records_per_user' => env('LOGIN_ACTIVITY_MAX_RECORDS_PER_USER', 100),

    /*
    |--------------------------------------------------------------------------
    | Auto Cleanup
    |--------------------------------------------------------------------------
    |
    | Tự động cleanup records cũ sau mỗi lần tạo record mới.
    | Nếu tắt, bạn cần chạy command cleanup thủ công.
    |
    */

    'auto_cleanup' => env('LOGIN_ACTIVITY_AUTO_CLEANUP', true),

    /*
    |--------------------------------------------------------------------------
    | Cleanup Older Than Days
    |--------------------------------------------------------------------------
    |
    | Xóa các records cũ hơn số ngày này (ngoài việc giới hạn số lượng).
    | Set null để không giới hạn theo thời gian.
    |
    */

    'cleanup_older_than_days' => env('LOGIN_ACTIVITY_CLEANUP_OLDER_THAN_DAYS', null),
];
