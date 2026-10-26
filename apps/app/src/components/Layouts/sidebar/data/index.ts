import * as Icons from "../icons";

export const NAV_DATA = [
  {
    label: "MENU CHÍNH",
    items: [
      {
        title: "Tổng quan",
        icon: Icons.HomeIcon,
        url: "/dashboard",
        items: [],
      },
      {
        title: "Bảng tin",
        icon: Icons.Bell,
        url: "/my-notifications",
        items: [],
      },
      {
        title: "Báo cáo",
        icon: Icons.PieChart,
        url: "/reports",
        items: [],
      },
      {
        title: "Báo cáo",
        icon: Icons.PieChart,
        url: "/my-reports",
        items: [],
      },
    ],
  },
  {
    label: "QUẢN LÝ LỚP HỌC",
    items: [
      {
        title: "Lớp học",
        icon: Icons.Table,
        url: "/classes",
        items: [],
      },
      {
        title: "Lịch học",
        icon: Icons.Calendar,
        url: "/calendar",
        items: [],
      },
    ],
  },
  {
    label: "NỘI DUNG HỌC TẬP",
    items: [
      {
        title: "Bài tập",
        icon: Icons.Alphabet,
        url: "/assignments",
        items: [],
      },
      {
        title: "Tài liệu học tập",
        icon: Icons.BookOpen,
        url: "/learning-resources",
        items: [],
      },
      {
        title: "Ghi chú bài học",
        icon: Icons.PencilSquare,
        url: "/lesson-notes",
        items: [],
      },
      {
        title: "Nhắc nhở",
        icon: Icons.Clock,
        url: "/reminders",
        items: [],
      },
    ],
  },
  {
    label: "TRUNG TÂM",
    items: [
      {
        title: "Tổng quan",
        icon: Icons.UserGroup,
        url: "/organization",
        items: [],
      },
      {
        title: "Thành viên",
        icon: Icons.User,
        url: "/organization/members",
        items: [],
      },
      {
        title: "Tài chính",
        icon: Icons.PieChart,
        url: "/organization/finance",
        items: [],
      },
      {
        title: "Bảng lương",
        icon: Icons.Dollar,
        url: "/organization/payroll",
        items: [],
      },
      {
        title: "Bảng lương của tôi",
        icon: Icons.CreditCard,
        url: "/organization/my-payslips",
        items: [],
      },
    ],
  },
  {
    label: "QUẢN LÝ HỆ THỐNG",
    items: [
      {
        title: "Giáo viên",
        icon: Icons.UserGroup,
        url: "/users",
        items: [],
      },
      {
        title: "Bảng tin",
        icon: Icons.Bell,
        url: "/notifications",
        items: [],
      },
      {
        title: "Nhắc nhở",
        icon: Icons.Clock,
        url: "/reminders",
        items: [],
      },
      {
        title: "Loại bài tập",
        icon: Icons.Tag,
        url: "/assignment-types",
        items: [],
      },
      {
        title: "Môn học",
        icon: Icons.RectangleStack,
        url: "/subjects",
        items: [],
      },
      {
        title: "Cấp độ/Khối",
        icon: Icons.Bars3,
        url: "/grade-levels",
        items: [],
      },
      {
        title: "Loại điểm",
        icon: Icons.Star,
        url: "/grade-types",
        items: [],
      },
    ],
  },
  {
    label: "QUẢN LÝ HỌC VIÊN",
    items: [
      {
        title: "Học viên",
        icon: Icons.User,
        url: "/students",
        items: [],
      },
      {
        title: "Điểm danh",
        icon: Icons.Calendar,
        url: "/attendance",
        items: [],
      },
      {
        title: "Điểm danh QR",
        icon: Icons.Calendar,
        url: "/attendance/check-in",
        items: [],
      },
      {
        title: "Điểm số",
        icon: Icons.Certificate,
        url: "/grades",
        items: [],
      },
      {
        title: "Học phí",
        icon: Icons.Dollar,
        url: "/payments",
        items: [],
      },
      {
        title: "Nhật ký truy cập",
        icon: Icons.Authentication,
        url: "/login-activity",
        items: [],
      },
    ],
  },
  {
    label: "CÀI ĐẶT",
    items: [
      {
        title: "Hồ sơ",
        icon: Icons.User,
        url: "/settings/profile",
        items: [],
      },
      {
        title: "Bảo mật",
        icon: Icons.Authentication,
        url: "/settings/security",
        items: [],
      },
      {
        title: "Thông báo",
        icon: Icons.Bell,
        url: "/settings/notifications",
        items: [],
      },
      {
        title: "Thanh toán",
        icon: Icons.CreditCard,
        url: "/settings/organization/bank-accounts",
        items: [],
      },
      {
        title: "Học phí",
        icon: Icons.Dollar,
        url: "/my-payments",
        items: [],
      },
      {
        title: "Xuất/Nhập",
        icon: Icons.ArrowUpTray,
        url: "/import-export",
        items: [],
      },
    ],
  },
];
