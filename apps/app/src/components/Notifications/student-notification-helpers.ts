"use client";

import type { ComponentType } from "react";
import {
  AcademicCapIcon,
  BanknotesIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  InformationCircleIcon,
  MegaphoneIcon,
  CalendarIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  LockClosedIcon,
  HandRaisedIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { getObjId } from "@/lib/id-utils";

type NotificationTypeKey =
  | "announcement"
  | "reminder"
  | "payment"
  | "attendance"
  | "grade"
  | "other"
  // New notification types from backend
  | "payment_success"
  | "payment_failed"
  | "password_reset"
  | "welcome"
  | "daily_schedule_reminder"
  | "attendance_reminder"
  | "new_submission"
  | "default";

type NotificationTypeMeta = {
  label: string;
  badgeClass: string;
  icon: ComponentType<{ className?: string }>;
};

const notificationTypeMeta: Record<NotificationTypeKey, NotificationTypeMeta> = {
  announcement: {
    label: "Thông báo chung",
    badgeClass: "bg-indigo-50 text-indigo-600 ring-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400",
    icon: MegaphoneIcon,
  },
  reminder: {
    label: "Nhắc nhở",
    badgeClass: "bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-900/20 dark:text-amber-400",
    icon: ClockIcon,
  },
  payment: {
    label: "Học phí",
    badgeClass: "bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400",
    icon: BanknotesIcon,
  },
  attendance: {
    label: "Điểm danh",
    badgeClass: "bg-sky-50 text-sky-600 ring-sky-100 dark:bg-sky-900/20 dark:text-sky-400",
    icon: ClipboardDocumentCheckIcon,
  },
  grade: {
    label: "Điểm số",
    badgeClass: "bg-purple-50 text-purple-600 ring-purple-100 dark:bg-purple-900/20 dark:text-purple-400",
    icon: AcademicCapIcon,
  },
  other: {
    label: "Khác",
    badgeClass: "bg-gray-100 text-gray-600 ring-gray-200 dark:bg-gray-800 dark:text-gray-400",
    icon: InformationCircleIcon,
  },
  // New notification types
  payment_success: {
    label: "Thanh toán thành công",
    badgeClass: "bg-green-50 text-green-600 ring-green-100 dark:bg-green-900/20 dark:text-green-400",
    icon: CheckCircleIcon,
  },
  payment_failed: {
    label: "Thanh toán thất bại",
    badgeClass: "bg-red-50 text-red-600 ring-red-100 dark:bg-red-900/20 dark:text-red-400",
    icon: XCircleIcon,
  },
  password_reset: {
    label: "Đặt lại mật khẩu",
    badgeClass: "bg-blue-50 text-blue-600 ring-blue-100 dark:bg-blue-900/20 dark:text-blue-400",
    icon: LockClosedIcon,
  },
  welcome: {
    label: "Chào mừng",
    badgeClass: "bg-blue-50 text-blue-600 ring-blue-100 dark:bg-blue-900/20 dark:text-blue-400",
    icon: HandRaisedIcon,
  },
  daily_schedule_reminder: {
    label: "Nhắc nhở lịch học",
    badgeClass: "bg-blue-50 text-blue-600 ring-blue-100 dark:bg-blue-900/20 dark:text-blue-400",
    icon: CalendarIcon,
  },
  attendance_reminder: {
    label: "Nhắc nhở điểm danh",
    badgeClass: "bg-orange-50 text-orange-600 ring-orange-100 dark:bg-orange-900/20 dark:text-orange-400",
    icon: ClipboardDocumentCheckIcon,
  },
  new_submission: {
    label: "Bài nộp mới",
    badgeClass: "bg-blue-50 text-blue-600 ring-blue-100 dark:bg-blue-900/20 dark:text-blue-400",
    icon: DocumentTextIcon,
  },
  default: {
    label: "Thông báo",
    badgeClass: "bg-gray-100 text-gray-600 ring-gray-200 dark:bg-gray-800 dark:text-gray-400",
    icon: InformationCircleIcon,
  },
};

export const notificationTypeFilters = [
  { value: "all", label: "Tất cả" },
  { value: "announcement", label: notificationTypeMeta.announcement.label },
  { value: "reminder", label: notificationTypeMeta.reminder.label },
  { value: "payment", label: notificationTypeMeta.payment.label },
  { value: "attendance", label: notificationTypeMeta.attendance.label },
  { value: "grade", label: notificationTypeMeta.grade.label },
  // New notification types
  { value: "payment_success", label: notificationTypeMeta.payment_success.label },
  { value: "payment_failed", label: notificationTypeMeta.payment_failed.label },
  { value: "password_reset", label: notificationTypeMeta.password_reset.label },
  { value: "welcome", label: notificationTypeMeta.welcome.label },
  { value: "daily_schedule_reminder", label: notificationTypeMeta.daily_schedule_reminder.label },
  { value: "attendance_reminder", label: notificationTypeMeta.attendance_reminder.label },
  { value: "new_submission", label: notificationTypeMeta.new_submission.label },
  { value: "other", label: notificationTypeMeta.other.label },
];

export function getNotificationTypeMeta(type?: string | null) {
  if (!type) {
    return notificationTypeMeta.default;
  }
  return notificationTypeMeta[(type as NotificationTypeKey) ?? "default"] || notificationTypeMeta.default;
}

export function formatRelativeTime(date?: string | null) {
  if (!date) return "";
  const timestamp = new Date(date).getTime();
  if (Number.isNaN(timestamp)) return "";

  const diffInSeconds = Math.round((Date.now() - timestamp) / 1000);
  const absDiff = Math.abs(diffInSeconds);
  const suffix = diffInSeconds >= 0 ? "trước" : "nữa";

  if (absDiff < 5) {
    return diffInSeconds >= 0 ? "vừa xong" : "sắp tới";
  }

  const units = [
    { limit: 60, name: "giây", divisor: 1 },
    { limit: 3600, name: "phút", divisor: 60 },
    { limit: 86400, name: "giờ", divisor: 3600 },
    { limit: 604800, name: "ngày", divisor: 86400 },
  ];

  for (const unit of units) {
    if (absDiff < unit.limit) {
      const value = Math.max(1, Math.floor(absDiff / unit.divisor));
      return `${value} ${unit.name} ${suffix}`;
    }
  }

  const days = Math.floor(absDiff / 86400);
  if (days < 30) {
    return `${days} ngày ${suffix}`;
  }

  // Tiếp tục với tuần và tháng
  const weeks = Math.floor(days / 7);
  if (weeks < 4) {
    return `${weeks} tuần ${suffix}`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months} tháng ${suffix}`;
  }

  const years = Math.floor(days / 365);
  return `${years} năm ${suffix}`;
}

export function getTargetLabel(target?: string | null) {
  switch (target) {
    case "student":
      return "Học viên";
    case "parent":
      return "Phụ huynh";
    case "tutor":
      return "Giáo viên";
    case "all":
      return "Tất cả";
    default:
      return "Không xác định";
  }
}

export function getChannelLabel(channel?: string | null) {
  switch (channel) {
    case "email":
      return "Email";
    case "in_app":
      return "Trong ứng dụng";
    default:
      return "Không xác định";
  }
}

/**
 * Get action URL for notification based on type
 * @param notification Notification object
 * @returns Action URL or null if no action
 */
export function getNotificationActionUrl(notification: any): string | null {
  if (!notification?.type) return null;

  const data = notification.data || {};
  const type = notification.type;

  switch (type) {
    case "daily_schedule_reminder":
      // Ưu tiên meeting_url nếu có, nếu không thì link đến schedule
      if (data.meeting_url) {
        return data.meeting_url;
      }
      const dailySessionId = data.session_id || getObjId(data);
      if (dailySessionId && String(dailySessionId) !== "undefined") {
        return `/schedule-sessions/${dailySessionId}`;
      }
      if (data.class_id && String(data.class_id) !== "undefined") {
        return `/classes/${data.class_id}`;
      }
      return "/calendar";

    case "attendance_reminder":
      const attSessionId = data.session_id || getObjId(data);
      if (attSessionId && String(attSessionId) !== "undefined") {
        return `/attendance/take?session_id=${attSessionId}`;
      }
      if (data.class_id && String(data.class_id) !== "undefined") {
        return `/classes/${data.class_id}`;
      }
      return "/attendance/take";

    case "new_submission":
      if (data.submission_id) {
        return `/submissions/${data.submission_id}`;
      }
      if (data.assignment_id) {
        return `/assignments/${data.assignment_id}`;
      }
      if (data.class_id) {
        return `/classes/${data.class_id}/assignments`;
      }
      return "/submissions";

    case "payment_success":
    case "payment_failed":
      return "/my-payments";

    case "welcome":
      return "/dashboard";

    default:
      return null;
  }
}

/**
 * Get action label for notification based on type
 * @param notification Notification object
 * @returns Action label or null if no action
 */
export function getNotificationActionLabel(notification: any): string | null {
  if (!notification?.type) return null;

  const type = notification.type;

  switch (type) {
    case "daily_schedule_reminder":
      return "Xem lịch học";
    case "attendance_reminder":
      return "Điểm danh ngay";
    case "new_submission":
      return "Xem bài nộp";
    case "payment_success":
    case "payment_failed":
      return "Xem chi tiết";
    case "welcome":
      return "Xem hướng dẫn";
    default:
      return null;
  }
}


