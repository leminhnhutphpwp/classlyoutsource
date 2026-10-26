<?php

namespace Database\Seeders;

use App\Models\EmailTemplate;
use Illuminate\Database\Seeder;

class EmailTemplateSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $templates = [
            // 1. Welcome Email
            [
                'name' => 'Email Chào mừng',
                'slug' => 'welcome',
                'subject' => 'Chào mừng {name} đến với Classly!',
                'body_html' => '<p>Xin chào <strong>{name}</strong>,</p>
<p>Chúc mừng bạn đã có tài khoản tại Classly.</p>
<p>Bạn có thể bắt đầu quản lý lớp học và học viên ngay bây giờ bằng cách đăng nhập vào hệ thống.</p>
<p>Nếu cần hỗ trợ, đừng ngần ngại liên hệ với chúng tôi!</p>
<p>Trân trọng,<br>Đội ngũ Classly</p>',
                'body_text' => 'Xin chào {name},

Chúc mừng bạn đã có tài khoản tại Classly.

Bạn có thể bắt đầu quản lý lớp học và học viên ngay bây giờ bằng cách đăng nhập vào hệ thống.

Nếu cần hỗ trợ, đừng ngần ngại liên hệ với chúng tôi!

Trân trọng,
Đội ngũ Classly',
                'variables' => [
                    'name' => 'Tên người nhận',
                    'email' => 'Email người nhận',
                    'login_url' => 'URL đăng nhập',
                ],
                'description' => 'Email chào mừng gửi khi tài khoản được tạo',
                'category' => 'notification',
            ],

            // 2. Password Reset
            [
                'name' => 'Khôi phục mật khẩu',
                'slug' => 'password-reset',
                'subject' => 'Mã xác nhận đặt lại mật khẩu',
                'body_html' => '<div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #0ea5e9;">
    <h3 style="margin: 0 0 10px 0; color: #0c4a6e;">Đặt lại mật khẩu</h3>
    <p style="margin: 0; color: #075985;">Chúng tôi nhận được yêu cầu khôi phục mật khẩu tài khoản của bạn.</p>
</div>

<p>Xin chào <strong>{name}</strong>,</p>

<p>Mã xác thực của bạn là:</p>

<div style="background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; border: 2px dashed #cbd5e1;">
    <h2 style="margin: 0; font-size: 32px; letter-spacing: 8px; color: #1e293b; font-family: monospace;">{code}</h2>
</div>

<p><strong>Lưu ý:</strong></p>
<ul style="margin: 15px 0; padding-left: 20px;">
    <li>Mã có hiệu lực trong <strong>{expires_in} phút</strong>.</li>
    <li>Tuyệt đối không chia sẻ mã này cho người khác.</li>
    <li>Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</li>
</ul>

<p>Trân trọng,<br>Đội ngũ Classly</p>',
                'body_text' => 'ĐẶT LẠI MẬT KHẨU

Xin chào {name},

Chúng tôi nhận được yêu cầu khôi phục mật khẩu tài khoản của bạn.
Mã xác thực của bạn là:

{code}

Lưu ý:
- Mã có hiệu lực trong {expires_in} phút.
- Tuyệt đối không chia sẻ mã này cho người khác.
- Nếu bạn không yêu cầu, vui lòng bỏ qua email này.

Trân trọng,
Đội ngũ Classly',
                'variables' => [
                    'name' => 'Tên người nhận',
                    'email' => 'Email người nhận',
                    'code' => 'Mã xác nhận 6 số',
                    'expires_in' => 'Thời gian hết hạn (phút)',
                ],
                'description' => 'Email gửi mã xác nhận đặt lại mật khẩu',
                'category' => 'security',
            ],

            // 6.1. Email Verification
            [
                'name' => 'Xác thực địa chỉ email',
                'slug' => 'email-verification',
                'subject' => 'Xác thực địa chỉ email - Classly',
                'body_html' => '<div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #0ea5e9;">
    <h3 style="margin: 0 0 10px 0; color: #0c4a6e;">Xác thực địa chỉ email</h3>
    <p style="margin: 0; color: #075985;">Chúng tôi cần xác thực địa chỉ email của bạn để hoàn tất quá trình đăng ký.</p>
</div>

<p>Xin chào <strong>{name}</strong>,</p>

<p>Mã xác thực của bạn là:</p>

<div style="background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; border: 2px dashed #cbd5e1;">
    <h2 style="margin: 0; font-size: 32px; letter-spacing: 8px; color: #1e293b; font-family: monospace;">{code}</h2>
</div>

<p><strong>Lưu ý:</strong></p>
<ul style="margin: 15px 0; padding-left: 20px;">
    <li>Mã có hiệu lực trong <strong>{expires_in} phút</strong>.</li>
    <li>Tuyệt đối không chia sẻ mã này cho người khác.</li>
    <li>Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</li>
</ul>

<p>Trân trọng,<br>Đội ngũ Classly</p>',
                'body_text' => 'XÁC THỰC ĐỊA CHỈ EMAIL

Xin chào {name},

Chúng tôi cần xác thực địa chỉ email của bạn để hoàn tất quá trình đăng ký.
Mã xác thực của bạn là:

{code}

Lưu ý:
- Mã có hiệu lực trong {expires_in} phút.
- Tuyệt đối không chia sẻ mã này cho người khác.
- Nếu bạn không yêu cầu, vui lòng bỏ qua email này.

Trân trọng,
Đội ngũ Classly',
                'variables' => [
                    'name' => 'Tên người nhận',
                    'email' => 'Email người nhận',
                    'code' => 'Mã xác nhận 6 số',
                    'expires_in' => 'Thời gian hết hạn (phút)',
                ],
                'description' => 'Email gửi mã xác thực địa chỉ email',
                'category' => 'security',
            ],

            // 7. Daily Schedule Reminder
            [
                'name' => 'Nhắc lịch học hằng ngày',
                'slug' => 'daily_schedule_reminder',
                'subject' => 'Lịch học hôm nay: {class_name}',
                'body_html' => '<p>Xin chào <strong>{name}</strong>,</p>
<p>Classly nhắc bạn có lịch học sắp diễn ra:</p>
<div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 15px 0;">
    <h3 style="margin: 0 0 10px 0; color: #0c4a6e;">Thông tin buổi học</h3>
    <p style="margin: 5px 0;"><strong>Lớp:</strong> {class_name}</p>
    <p style="margin: 5px 0;"><strong>Môn:</strong> {subject}</p>
    <p style="margin: 5px 0;"><strong>Thời gian:</strong> {start_time} - {end_time} ({session_date})</p>
    <p style="margin: 5px 0;"><strong>Địa điểm:</strong> {location}</p>
    {notes_text}
</div>
<p>Chúc bạn một buổi học hiệu quả!</p>
<p>Trân trọng,<br>Đội ngũ Classly</p>',
                'body_text' => 'Xin chào {name},

Classly nhắc bạn có lịch học sắp diễn ra:

Thông tin buổi học:
- Lớp: {class_name}
- Môn: {subject}
- Thời gian: {start_time} - {end_time} ({session_date})
- Địa điểm: {location}
{notes_text}

Chúc bạn một buổi học hiệu quả!

Trân trọng,
Đội ngũ Classly',
                'variables' => [
                    'name' => 'Tên người nhận',
                    'email' => 'Email người nhận',
                    'class_name' => 'Tên lớp học',
                    'subject' => 'Môn học',
                    'session_date' => 'Ngày học (dd/mm/yyyy)',
                    'start_time' => 'Giờ bắt đầu (HH:mm)',
                    'end_time' => 'Giờ kết thúc (HH:mm)',
                    'location' => 'Địa điểm học',
                    'notes' => 'Ghi chú (nếu có)',
                    'meeting_url' => 'URL tham gia lớp học online (nếu có)',
                ],
                'description' => 'Email nhắc nhở lịch học hàng ngày cho học viên và giáo viên',
                'category' => 'notification',
            ],

            // 8. Attendance Reminder
            [
                'name' => 'Nhắc nhở điểm danh',
                'slug' => 'attendance_reminder',
                'subject' => 'Nhắc điểm danh: {class_name}',
                'body_html' => '<p>Xin chào <strong>{name}</strong>,</p>
<p>Đừng quên điểm danh cho buổi học vừa diễn ra nhé:</p>
<div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b;">
    <p style="margin: 5px 0;"><strong>Lớp:</strong> {class_name}</p>
    <p style="margin: 5px 0;"><strong>Thời gian:</strong> {start_time} - {session_date}</p>
    <p style="margin: 5px 0;"><strong>Sĩ số:</strong> {student_count} học viên</p>
    {location_text}
</div>
<p><a href="{attendance_url}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0;">Vào điểm danh ngay</a></p>
<p>Trân trọng,<br>Đội ngũ Classly</p>',
                'body_text' => 'Xin chào {name},

Đừng quên điểm danh cho buổi học vừa diễn ra nhé:

- Lớp: {class_name}
- Thời gian: {start_time} - {session_date}
- Sĩ số: {student_count} học viên
{location_text}

Vào điểm danh ngay: {attendance_url}

Trân trọng,
Đội ngũ Classly',
                'variables' => [
                    'name' => 'Tên người nhận',
                    'email' => 'Email người nhận',
                    'class_name' => 'Tên lớp học',
                    'subject' => 'Môn học',
                    'session_date' => 'Ngày học (dd/mm/yyyy)',
                    'start_time' => 'Giờ bắt đầu (HH:mm)',
                    'student_count' => 'Số lượng học viên',
                    'location' => 'Địa điểm học (nếu có)',
                    'attendance_url' => 'URL trang điểm danh',
                ],
                'description' => 'Email nhắc nhở giáo viên điểm danh học viên trước/sau buổi học',
                'category' => 'notification',
            ],

            // 9. New Submission
            [
                'name' => 'Thông báo bài nộp mới',
                'slug' => 'new_submission',
                'subject' => 'Bài nộp mới: {assignment_title} - {student_name}',
                'body_html' => '<p>Xin chào <strong>{name}</strong>,</p>
<p>Học viên <strong>{student_name}</strong> vừa nộp bài tập:</p>
<div style="background: #dbeafe; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #3b82f6;">
    <p style="margin: 5px 0;"><strong>Bài tập:</strong> {assignment_title}</p>
    <p style="margin: 5px 0;"><strong>Lớp:</strong> {class_name}</p>
    <p style="margin: 5px 0;"><strong>Thời gian nộp:</strong> {submitted_at} <span style="color: #ef4444; font-weight: bold;">{is_late_text}</span></p>
    {content_text}
</div>
<p>Vui lòng kiểm tra và chấm điểm.</p>
<p><a href="{submission_url}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0;">Xem bài nộp</a></p>
<p>Trân trọng,<br>Đội ngũ Classly</p>',
                'body_text' => 'Xin chào {name},

Học viên {student_name} vừa nộp bài tập:

- Bài tập: {assignment_title}
- Lớp: {class_name}
- Thời gian nộp: {submitted_at} {is_late_text}
{content_text}

Vui lòng kiểm tra và chấm điểm tại: {submission_url}

Trân trọng,
Đội ngũ Classly',
                'variables' => [
                    'name' => 'Tên người nhận (giáo viên)',
                    'email' => 'Email người nhận',
                    'class_name' => 'Tên lớp học',
                    'assignment_title' => 'Tiêu đề bài tập',
                    'student_name' => 'Tên học viên',
                    'submitted_at' => 'Thời gian nộp (dd/mm/yyyy HH:mm)',
                    'is_late' => 'Có nộp muộn hay không (Có/Không)',
                    'is_late_text' => 'Text nộp muộn ( (Nộp muộn) hoặc rỗng)',
                    'attempt_number' => 'Số lần nộp',
                    'content_preview' => 'Preview nội dung bài nộp (100 ký tự đầu)',
                    'submission_url' => 'URL xem bài nộp',
                ],
                'description' => 'Email thông báo giáo viên khi có học viên nộp bài tập mới',
                'category' => 'notification',
            ],

            // 10. Announcement (General Notification)
            [
                'name' => 'Thông báo chung',
                'slug' => 'announcement',
                'subject' => 'Thông báo: {title}',
                'body_html' => '<div style="margin-bottom: 20px;">
    <p style="color: #6b7280; font-size: 14px; margin: 0;">Thông báo từ: <strong>{sender_name}</strong></p>
</div>
<div style="background: #eef2ff; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #6366f1;">
    <h3 style="margin: 0 0 10px 0; color: #4338ca;">{title}</h3>
    <div style="color: #374151;">{message}</div>
</div>
<p>Nếu có thắc mắc, vui lòng phản hồi lại email này.</p>
<p>Trân trọng,<br>{sender_name}</p>',
                'body_text' => 'THÔNG BÁO TỪ: {sender_name}

{title}

{message}

Nếu có thắc mắc, vui lòng phản hồi lại email này.

Trân trọng,
{sender_name}',
                'variables' => [
                    'name' => 'Tên người nhận',
                    'email' => 'Email người nhận',
                    'title' => 'Tiêu đề thông báo',
                    'message' => 'Nội dung thông báo',
                    'sender_name' => 'Tên người gửi (Giáo viên/Admin)',
                ],
                'description' => 'Template cho thông báo chung và tin tức',
                'category' => 'notification',
            ],

            // 11. Reminder (General)
            [
                'name' => 'Nhắc nhở chung',
                'slug' => 'reminder',
                'subject' => 'Nhắc nhở: {title}',
                'body_html' => '<div style="margin-bottom: 20px;">
    <p style="color: #6b7280; font-size: 14px; margin: 0;">Nhắc nhở từ: <strong>{sender_name}</strong></p>
</div>
<div style="background: #fff7ed; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f97316;">
    <h3 style="margin: 0 0 10px 0; color: #c2410c;">🔔 Nhắc nhở: {title}</h3>
    <div style="color: #374151;">{message}</div>
</div>
<p>Vui lòng kiểm tra và thực hiện các mục được nhắc nhở.</p>
<p>Trân trọng,<br>{sender_name}</p>',
                'body_text' => 'NHẮC NHỞ TỪ: {sender_name}

🔔 NHẮC NHỞ: {title}

{message}

Vui lòng kiểm tra và thực hiện các mục được nhắc nhở.

Trân trọng,
{sender_name}',
                'variables' => [
                    'name' => 'Tên người nhận',
                    'email' => 'Email người nhận',
                    'title' => 'Tiêu đề nhắc nhở',
                    'message' => 'Nội dung nhắc nhở',
                    'sender_name' => 'Tên người gửi (Giáo viên/Admin)',
                ],
                'description' => 'Template cho các nhắc nhở chung',
                'category' => 'notification',
            ],
        ];

        foreach ($templates as $template) {
            EmailTemplate::updateOrCreate(
                ['slug' => $template['slug']],
                $template
            );
        }

        $this->command->info('✅ Tạo/Update '.count($templates).' email templates');
    }
}
