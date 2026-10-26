"use client";
import Link from "next/link";
import { useAuthContext } from "@/contexts/auth-context";
import { useMemo, memo } from "react";
import {
  BellIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  UserGroupIcon,
  ClockIcon,
  BookOpenIcon,
  AcademicCapIcon,
  ClipboardDocumentCheckIcon
} from "@heroicons/react/24/outline";

function QuickActionsComponent() {
  const { user } = useAuthContext();
  const isStudent = user?.role === 'student';

  const tutorActions = useMemo(() => [
    {
      title: "Tạo lớp học",
      description: "Thêm lớp học mới",
      href: "/classes/create",
      icon: (
        <BuildingOfficeIcon className="h-6 w-6" />
      ),
      color: "bg-primary text-white hover:bg-primary/90"
    },
    {
      title: "Thêm học viên",
      description: "Đăng ký học viên mới",
      href: "/students/create",
      icon: (
        <UserGroupIcon className="h-6 w-6" />
      ),
      color: "bg-secondary text-white hover:bg-secondary/90"
    },
    {
      title: "Điểm danh",
      description: "Điểm danh cho hôm nay",
      href: "/attendance/take",
      icon: (
        <CalendarIcon className="h-6 w-6" />
      ),
      color: "bg-success text-white hover:bg-success/90"
    },
    {
      title: "Tạo bài tập",
      description: "Thêm bài tập mới",
      href: "/assignments/create",
      icon: (
        <DocumentTextIcon className="h-6 w-6" />
      ),
      color: "bg-accent text-white hover:bg-accent/90"
    },
    {
      title: "Lịch học",
      description: "Xem và quản lý lịch học",
      href: "/schedules",
      icon: (
        <CalendarIcon className="h-6 w-6" />
      ),
      color: "bg-purple-500 text-white hover:bg-purple-600"
    },
    {
      title: "Chấm điểm",
      description: "Chấm điểm bài tập",
      href: "/grades",
      icon: (
        <AcademicCapIcon className="h-6 w-6" />
      ),
      color: "bg-amber-500 text-white hover:bg-amber-600"
    },
    {
      title: "Học phí",
      description: "Quản lý học phí",
      href: "/payments",
      icon: (
        <CurrencyDollarIcon className="h-6 w-6" />
      ),
      color: "bg-emerald-500 text-white hover:bg-emerald-600"
    },
    {
      title: "Nhắc nhở",
      description: "Tạo nhắc nhở mới",
      href: "/reminders",
      icon: (
        <ClockIcon className="h-6 w-6" />
      ),
      color: "bg-orange-500 text-white hover:bg-orange-600"
    },
    {
      title: "Tài liệu học tập",
      description: "Quản lý tài liệu",
      href: "/learning-resources",
      icon: (
        <BookOpenIcon className="h-6 w-6" />
      ),
      color: "bg-indigo-500 text-white hover:bg-indigo-600"
    },
    {
      title: "Xem báo cáo",
      description: "Kiểm tra phân tích và báo cáo",
      href: "/reports",
      icon: (
        <ChartBarIcon className="h-6 w-6" />
      ),
      color: "bg-info text-white hover:bg-info/90"
    },
    {
      title: "Cài đặt",
      description: "Quản lý tài khoản của bạn",
      href: "/settings",
      icon: (
        <Cog6ToothIcon className="h-6 w-6" />
      ),
      color: "bg-neutral text-white hover:bg-neutral/90"
    }
  ], []);

  const studentActions = useMemo(() => [
    {
      title: "Lớp học của tôi",
      description: "Xem các lớp học đã đăng ký",
      href: "/classes",
      icon: (
        <BuildingOfficeIcon className="h-6 w-6" />
      ),
      color: "bg-primary text-white hover:bg-primary/90"
    },
    {
      title: "Bài tập của tôi",
      description: "Xem và làm bài tập",
      href: "/assignments",
      icon: (
        <DocumentTextIcon className="h-6 w-6" />
      ),
      color: "bg-blue-500 text-white hover:bg-blue-600"
    },
    {
      title: "Bài nộp của tôi",
      description: "Xem bài nộp đã gửi",
      href: "/submissions",
      icon: (
        <ClipboardDocumentCheckIcon className="h-6 w-6" />
      ),
      color: "bg-teal-500 text-white hover:bg-teal-600"
    },
    {
      title: "Điểm số của tôi",
      description: "Xem điểm số và kết quả",
      href: "/grades",
      icon: (
        <AcademicCapIcon className="h-6 w-6" />
      ),
      color: "bg-amber-500 text-white hover:bg-amber-600"
    },
    {
      title: "Điểm danh của tôi",
      description: "Xem lịch sử điểm danh",
      href: "/attendance",
      icon: (
        <CalendarIcon className="h-6 w-6" />
      ),
      color: "bg-green-500 text-white hover:bg-green-600"
    },
    {
      title: "Lịch học",
      description: "Xem lịch học của bạn",
      href: "/calendar",
      icon: (
        <CalendarIcon className="h-6 w-6" />
      ),
      color: "bg-accent text-white hover:bg-accent/90"
    },
    {
      title: "Tài liệu học tập",
      description: "Xem tài liệu và tài nguyên",
      href: "/learning-resources",
      icon: (
        <BookOpenIcon className="h-6 w-6" />
      ),
      color: "bg-indigo-500 text-white hover:bg-indigo-600"
    },
    {
      title: "Báo cáo cá nhân",
      description: "Xem thống kê học tập của bạn",
      href: "/my-reports",
      icon: (
        <ChartBarIcon className="h-6 w-6" />
      ),
      color: "bg-info text-white hover:bg-info/90"
    },
    {
      title: "Học phí",
      description: "Xem và thanh toán học phí",
      href: "/my-payments",
      icon: (
        <CurrencyDollarIcon className="h-6 w-6" />
      ),
      color: "bg-success text-white hover:bg-success/90"
    },
    {
      title: "Thông báo",
      description: "Xem thông báo mới nhất",
      href: "/my-notifications",
      icon: (
        <BellIcon className="h-6 w-6" />
      ),
      color: "bg-secondary text-white hover:bg-secondary/90"
    },
    {
      title: "Cài đặt",
      description: "Quản lý tài khoản của bạn",
      href: "/settings",
      icon: (
        <Cog6ToothIcon className="h-6 w-6" />
      ),
      color: "bg-neutral text-white hover:bg-neutral/90"
    }
  ], []);

  const actions = useMemo(() => isStudent ? studentActions : tutorActions, [isStudent, studentActions, tutorActions]);

  return (
    <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Thao tác nhanh</h3>

      <div className="grid grid-cols-1 gap-3">
        {actions.map((action, index) => (
          <Link
            key={index}
            href={action.href}
            className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${action.color}`}
          >
            {action.icon}
            <div>
              <h4 className="font-medium">{action.title}</h4>
              <p className="text-xs opacity-90">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export const QuickActions = memo(QuickActionsComponent);
