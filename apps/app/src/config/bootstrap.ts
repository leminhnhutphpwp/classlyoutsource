
/**
 * Display-only configuration for the login bootstrap timeline.
 *
 * Keyed by the STABLE stepKey emitted by use-initial-bootstrap's
 * buildBootstrapSteps(). This file no longer drives which steps run or for
 * which roles — role rules live with each step in use-initial-bootstrap.ts
 * (single source of truth). Anything missing here falls back to the step's
 * short label in the loader.
 */
export interface BootstrapStepMeta {
    key: string;   // Stable stepKey (matches buildBootstrapSteps stepKey)
    title: string; // Tên hiển thị chuyên nghiệp (VD: "Module Dữ liệu Đào tạo")
    desc: string;  // Mô tả chi tiết
}

export const BOOTSTRAP_STEP_META: Record<string, BootstrapStepMeta> = {
    'notifications:unread': {
        key: 'notifications:unread',
        title: 'Thông báo',
        desc: 'Cập nhật các tin tức mới nhất...',
    },
    'notifications': {
        key: 'notifications',
        title: 'Bảng tin',
        desc: 'Đang lấy danh sách thông báo...',
    },
    'dashboard:overview': {
        key: 'dashboard:overview',
        title: 'Cấu hình Hệ thống',
        desc: 'Thiết lập các tùy chọn cơ bản...',
    },
    'dashboard:recent-activity:10': {
        key: 'dashboard:recent-activity:10',
        title: 'Nhật ký Hoạt động',
        desc: 'Ghi lại phiên làm việc...',
    },
    'reminders:all:1:1:2:all': {
        key: 'reminders:all:1:1:2:all',
        title: 'Lịch Nhắc việc',
        desc: 'Kiểm tra các sự kiện sắp diễn ra...',
    },
    'reminders:all:10:1:7:all': {
        key: 'reminders:all:10:1:7:all',
        title: 'Danh sách Việc cần làm',
        desc: 'Sắp xếp lịch trình công việc...',
    },
    'classes:list:{}': {
        key: 'classes:list:{}',
        title: 'Quản lý Lớp học',
        desc: 'Đang vào không gian lớp học ảo...',
    },
    'students:list:{}': {
        key: 'students:list:{}',
        title: 'Hồ sơ Học viên',
        desc: 'Đang mở danh sách lớp và học viên...',
    },
    'assignments:list:{}': {
        key: 'assignments:list:{}',
        title: 'Bài tập & Kiểm tra',
        desc: 'Lấy danh sách bài tập đã giao...',
    },
    'attendance:list:{}': {
        key: 'attendance:list:{}',
        title: 'Điểm danh',
        desc: 'Tải trạng thái điểm danh gần đây...',
    },
    'grades:list:{}': {
        key: 'grades:list:{}',
        title: 'Điểm số',
        desc: 'Tải dữ liệu điểm số gần đây...',
    },
    'reports:revenue': {
        key: 'reports:revenue',
        title: 'Doanh thu',
        desc: 'Tổng hợp dòng tiền thu được...',
    },
    'reports:overview': {
        key: 'reports:overview',
        title: 'Tổng hợp Dữ liệu',
        desc: 'Tổng hợp thông tin hoạt động...',
    },
    'subjects:list': {
        key: 'subjects:list',
        title: 'Dữ liệu Môn học',
        desc: 'Đang lấy danh sách các môn học...',
    },
    'assignment-types:list': {
        key: 'assignment-types:list',
        title: 'Kho Học liệu',
        desc: 'Phân loại các dạng bài tập có sẵn...',
    },
    'grade-types:list': {
        key: 'grade-types:list',
        title: 'Cấu hình Điểm số',
        desc: 'Thiết lập thang điểm đánh giá...',
    },
    'grade-levels:list': {
        key: 'grade-levels:list',
        title: 'Danh mục Khối lớp',
        desc: 'Sắp xếp danh sách khối và trình độ...',
    },
    'learning-resources:list': {
        key: 'learning-resources:list',
        title: 'Kho Tài liệu',
        desc: 'Tải tài nguyên bài giảng số hóa...',
    },
    'classes:list:page': {
        key: 'classes:list:page',
        title: 'Danh sách Lớp học',
        desc: 'Chuẩn bị trang quản lý lớp học...',
    },
    'students:list:page': {
        key: 'students:list:page',
        title: 'Danh sách Học viên',
        desc: 'Chuẩn bị trang quản lý học viên...',
    },
    'assignments:list:page': {
        key: 'assignments:list:page',
        title: 'Danh sách Bài tập',
        desc: 'Chuẩn bị trang bài tập & kiểm tra...',
    },
    'schedules:list:page': {
        key: 'schedules:list:page',
        title: 'Lịch Hoạt động',
        desc: 'Đồng bộ lịch trình cá nhân...',
    },
    'schedules:list:calendar': {
        key: 'schedules:list:calendar',
        title: 'Thời khóa biểu',
        desc: 'Cập nhật lịch học cá nhân...',
    },
    'payments:list': {
        key: 'payments:list',
        title: 'Thanh toán',
        desc: 'Kiểm tra trạng thái hóa đơn...',
    },
};
