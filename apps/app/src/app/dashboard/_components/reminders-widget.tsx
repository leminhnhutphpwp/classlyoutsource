"use client";
import { useReminders } from "@/hooks/use-api";
import { useLockContext } from "@/contexts/lock-context";
import { useAuthContext } from "@/contexts/auth-context";
import { memo, useMemo } from "react";
import Link from "next/link";
import {
  BellIcon,
  CheckCircleIcon
} from "@heroicons/react/24/outline";
import { ListSkeleton } from "@/components/ui/loading";
import ReminderCard, { Reminder } from "@/components/Reminders/ReminderCard";
import { hasCapability, isStudent } from "@/lib/permissions-utils";

interface RemindersData {
  user_type: 'tutor' | 'student';
  reminders: {
    schedule: {
      all: Reminder[];
      upcoming: Reminder[];
      overdue: Reminder[];
    };
    payment: {
      all: Reminder[];
    };
    assignment?: {
      all: Reminder[];
    };
  };
  items: Reminder[]; // Sorted array by priority + days_remaining
  summary: {
    total: number;
    schedule_upcoming: number;
    schedule_overdue: number;
    payment_due: number;
    assignment_due?: number;
    high_priority: number;
  };
  meta?: {
    schedule?: {
      page: number;
      per_page: number;
      total: number;
      last_page: number;
      counts?: {
        upcoming?: number;
        overdue?: number;
      };
    };
    payment?: {
      page: number;
      per_page: number;
      total: number;
      last_page: number;
    };
    assignment?: {
      page: number;
      per_page: number;
      total: number;
      last_page: number;
    };
  };
}

const REMINDERS_API_OPTIONS = {
  type: 'all' as const,
  limit: 1,
  page: 1,
  days_ahead: 2,
};

const SEE_ALL_HREF = '/reminders';

function RemindersWidgetComponent() {
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const { user } = useAuthContext();

  // Check if user has reminders capability
  const hasRemindersCapability = hasCapability(user, 'reminders.use');
  const isStudentUser = isStudent(user);

  // Only fetch if user has capability and not locked
  const shouldFetchData = hasRemindersCapability && !actionsLocked && !planFeatureMessage;

  const { data, loading, error } = useReminders(REMINDERS_API_OPTIONS, shouldFetchData);

  const { combinedReminders, totalReminders, remindersData } = useMemo(() => {
    if (!data) {
      return {
        combinedReminders: [],
        totalReminders: 0,
        remindersData: null
      };
    }

    const remindersData = data as RemindersData;
    // Use items array (already sorted by backend)
    const items = remindersData.items || [];
    const total = remindersData.summary?.total ?? items.length;
    return {
      combinedReminders: items,
      totalReminders: total,
      remindersData
    };
  }, [data]);

  // Don't render widget if user doesn't have capability (sau tất cả hook để
  // giữ hook order ổn định giữa các render).
  if (!hasRemindersCapability) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <BellIcon className="h-5 w-5" />
          Nhắc nhở
        </h3>
        <ListSkeleton count={3} showAvatar={false} />
      </div>
    );
  }

  // Error state — chỉ báo lỗi khi CHƯA CÓ dữ liệu. Lỗi của lần revalidate nền
  // (stale-while-revalidate) không được xoá mất nội dung đang hiển thị.
  if (error && !data) {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <BellIcon className="h-5 w-5" />
          Nhắc nhở
        </h3>
        <div className="text-red-600 dark:text-red-400 text-sm">Lỗi tải nhắc nhở: {error}</div>
      </div>
    );
  }

  if (!remindersData) {
    return null;
  }

  const hasHighPriority = remindersData.summary?.high_priority > 0;
  const hasMore = totalReminders > combinedReminders.length;

  return (
    <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <BellIcon className="h-5 w-5" />
          Nhắc nhở
          {hasHighPriority && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
              {remindersData.summary.high_priority}
            </span>
          )}
        </h3>
        {hasMore && (
          <Link href={SEE_ALL_HREF} className="text-sm text-primary hover:underline">
            Xem tất cả
          </Link>
        )}
      </div>

      {combinedReminders.length === 0 ? (
        <div className="flex py-6 items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-center max-w-[80%]">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
              <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
              {isStudentUser
                ? "Bạn đang làm rất tốt!"
                : "Không có nhắc nhở mới"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isStudentUser
                ? "Hiện tại không có nhắc nhở nào cần chú ý."
                : "Bạn hiện không có công việc cần xử lý."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {combinedReminders.map((reminder, index) => {
            const targetUrl =
              reminder.category === 'payment' && isStudentUser
                ? '/my-payments'
                : reminder.action_url;

            // Create unique key by combining id, category, and index to avoid duplicates
            const uniqueKey = `${reminder.id}-${reminder.category || 'unknown'}-${index}`;

            return (
              <ReminderCard
                key={uniqueKey}
                reminder={reminder}
                targetUrl={targetUrl}
                variant="widget"
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export const RemindersWidget = memo(RemindersWidgetComponent);

