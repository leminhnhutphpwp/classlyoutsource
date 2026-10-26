"use client";
import { LockClosedIcon } from "@heroicons/react/24/outline";
import type { UserLock } from "@/lib/api-config";

// Helper function to format date
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return dateString;
  }
};

interface LockStatusBadgeProps {
  userLocks?: UserLock[];
  className?: string;
}

const LOCK_TYPE_CONFIG = {
  login: {
    label: "Đã khóa đăng nhập",
    description: "Học viên không thể đăng nhập vào hệ thống. Chỉ có thể xem dữ liệu nếu đã đăng nhập trước đó.",
    color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
    iconColor: "text-red-600 dark:text-red-400",
  },
  actions: {
    label: "Đã khóa thao tác",
    description: "Học viên có thể đăng nhập nhưng không thể thực hiện các thao tác (nộp bài, cập nhật thông tin, v.v.)",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
    iconColor: "text-orange-600 dark:text-orange-400",
  },
  all: {
    label: "Đã khóa toàn bộ",
    description: "Học viên không thể đăng nhập và không thể thực hiện bất kỳ thao tác nào trong hệ thống",
    color: "bg-red-200 text-red-900 dark:bg-red-900/30 dark:text-red-300",
    iconColor: "text-red-700 dark:text-red-400",
  },
};

export default function LockStatusBadge({
  userLocks = [],
  className = "",
}: LockStatusBadgeProps) {
  // Filter only active locks
  const activeLocks = userLocks.filter((lock: UserLock) => lock.status === 'active');
  
  if (activeLocks.length === 0) {
    return null;
  }

  // Get the most restrictive lock (all > actions > login)
  const getLockPriority = (type: 'login' | 'actions' | 'all'): number => {
    if (type === 'all') return 3;
    if (type === 'actions') return 2;
    if (type === 'login') return 1;
    return 0;
  };

  const primaryLock = activeLocks.reduce((prev: UserLock, current: UserLock) => {
    return getLockPriority(current.type) > getLockPriority(prev.type) ? current : prev;
  }, activeLocks[0]);

  const config = LOCK_TYPE_CONFIG[primaryLock.type];
  if (!config) {
    return null;
  }

  return (
    <div className={`rounded-lg border border-red-200 dark:border-red-800 p-3 sm:p-4 ${config.color} ${className}`}>
      <div className="flex items-start gap-3">
        <LockClosedIcon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${config.iconColor}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm sm:text-base">{config.label}</span>
          </div>
          <p className="text-xs sm:text-sm mt-1 opacity-90">{config.description}</p>
          
          {primaryLock.reason && (
            <p className="text-xs sm:text-sm mt-2 font-medium">
              <span className="opacity-75">Lý do:</span> {primaryLock.reason}
            </p>
          )}

          {(primaryLock.start_at || primaryLock.end_at) && (
            <div className="mt-2 text-xs sm:text-sm space-y-1">
              {primaryLock.start_at && (
                <p className="opacity-75">
                  <span className="font-medium">Bắt đầu:</span> {formatDate(primaryLock.start_at)}
                </p>
              )}
              {primaryLock.end_at ? (
                <p className="opacity-75">
                  <span className="font-medium">Hết hạn:</span> {formatDate(primaryLock.end_at)}
                </p>
              ) : (
                <p className="opacity-75 font-medium">Vô thời hạn</p>
              )}
            </div>
          )}

          {/* Hiển thị thông tin nếu có nhiều lock */}
          {activeLocks.length > 1 && (
            <p className="text-xs sm:text-sm mt-2 opacity-75 italic">
              Có {activeLocks.length} đợt khóa đang hoạt động
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

