"use client";
import { useRecentActivity } from "@/hooks/use-api";
import { useLockContext } from "@/contexts/lock-context";
import { memo } from "react";
import { useAuthContext } from "@/contexts/auth-context";
import { isStudent } from "@/lib/authz";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { ListSkeleton } from "@/components/ui/loading";

function RecentActivityComponent() {
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const { user } = useAuthContext();
  const isStudentUser = isStudent(user);
  const shouldFetchData = !actionsLocked && !planFeatureMessage;
  const { data, loading, error } = useRecentActivity(10, shouldFetchData);

  if (loading) {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Hoạt động gần đây</h3>
        <ListSkeleton count={5} showAvatar={true} />
      </div>
    );
  }

  // Chỉ báo lỗi khi CHƯA CÓ dữ liệu. Lỗi của lần revalidate nền
  // (stale-while-revalidate) không được xoá mất nội dung đang hiển thị.
  if (error && !data) {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Hoạt động gần đây</h3>
        <div className="text-red-600 dark:text-red-400">Lỗi tải hoạt động: {error}</div>
      </div>
    );
  }

  const activities = data?.activities || [];

  return (
    <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Hoạt động gần đây</h3>

      {activities.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2">Chưa có hoạt động nào</p>
            <p className="text-sm">Hoạt động sẽ hiển thị ở đây khi bạn sử dụng hệ thống</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((activity: any, index: number) => (
            <div key={index} className="flex items-start gap-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${activity.type === 'attendance' ? 'bg-success/10' : 'bg-primary/10'
                }`}>
                <span className={`text-xs font-medium ${activity.type === 'attendance' ? 'text-success' : 'text-primary'
                  }`}>
                  {activity.type === 'attendance' ? '✓' : '📝'}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {activity.description}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(activity.date).toLocaleString("vi-VN")}
                </p>
                {activity.status && (
                  <span
                    className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${activity.status === 'graded'
                      ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                      : activity.status === 'pending'
                        ? 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]'
                        : activity.status === 'present'
                          ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                          : activity.status === 'absent'
                            ? 'bg-[var(--status-badge-error)] text-[var(--status-badge-error-text)]'
                            : activity.status === 'late'
                              ? 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]'
                              : activity.status === 'excused'
                                ? 'bg-[var(--status-badge-completed)] text-[var(--status-badge-completed-text)]'
                                : activity.status === 'published'
                                  ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                                  : activity.status === 'submitted'
                                    ? 'bg-[var(--status-badge-completed)] text-[var(--status-badge-completed-text)]'
                                    : activity.status === 'active'
                                      ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                                      : 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]'
                      }`}
                  >
                    {activity.status === 'graded'
                      ? 'Đã chấm'
                      : activity.status === 'pending'
                        ? 'Đang chờ'
                        : activity.status === 'present'
                          ? 'Có mặt'
                          : activity.status === 'absent'
                            ? 'Vắng'
                            : activity.status === 'late'
                              ? 'Muộn'
                              : activity.status === 'submitted'
                                ? 'Đã nộp'
                                : activity.status === 'active'
                                  ? (activity.type === 'student' ? 'Đang học' : (activity.type === 'class' ? (isStudentUser ? 'Đang học' : 'Đang dạy') : 'Đang dùng'))
                                  : activity.status === 'published' && activity.type === 'submission'
                                    ? 'Đã nộp'
                                    : activity.status === 'published'
                                      ? (isStudentUser ? 'Đang làm' : 'Đang giao')
                                      : activity.status}
                  </span>
                )}
                {activity.due_date && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Hạn: {new Date(activity.due_date).toLocaleDateString('vi-VN')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const RecentActivity = memo(RecentActivityComponent);
