"use client";
import { useDashboard } from "@/hooks/use-api";
import { useAuthContext } from "@/contexts/auth-context";
import { useLockContext } from "@/contexts/lock-context";
import { RemindersWidget } from "./reminders-widget";
import { RevenueChart } from "./revenue-chart";
import { ClassesChart } from "./classes-chart";
import { StudentsChart } from "./students-chart";
import { AttendanceChart } from "./attendance-chart";
import { GradesDistributionChart } from "./grades-distribution-chart";
import { AssignmentsCompletionChart } from "./assignments-completion-chart";
import { CardSkeleton } from "@/components/ui/loading";

export function DashboardOverview() {
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const shouldFetchData = !actionsLocked && !planFeatureMessage;
  const { data, loading, error } = useDashboard(shouldFetchData);
  const { user } = useAuthContext();
  const isStudent = data?.user_type === 'student' || user?.role === 'student';

  if (loading) {
    return <DashboardOverviewSkeleton />;
  }

  // Chỉ báo lỗi khi CHƯA CÓ dữ liệu. Lỗi của lần revalidate nền
  // (stale-while-revalidate) không được xoá mất nội dung đang hiển thị.
  if (error && !data) {
    return (
      <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-6 text-neutral-700 dark:bg-neutral-900/20 dark:border-neutral-800 dark:text-neutral-400">
        Lỗi tải bảng điều khiển: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg bg-gray-50 border border-gray-200 p-6 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
        Không có dữ liệu
      </div>
    );
  }

  // Student dashboard - show different cards
  if (isStudent) {
    return (
      <div className="space-y-6">
        {/* Reminders Widget - ưu tiên cho học viên và giáo viên, hiển thị trước */}
        <RemindersWidget />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Reminders Widget - Full width for tutors, shown first */}
      <RemindersWidget />

      {/* Analytics charts — each self-hides (returns null) when its data slice is absent,
          so a fresh account degrades cleanly to just the reminders above.
          RevenueChart chiếm cả 2 cột: nó là chuỗi thời gian tới 90 điểm, nhồi vào nửa
          chiều rộng thì nhãn ngày chồng nhau và phải xoay chéo mới đọc được. Đặt col-span
          trên chính component (không bọc thêm div) để khi nó trả null thì không để lại ô trống. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RevenueChart className="lg:col-span-2" />
        <StudentsChart />
        <ClassesChart />
        <AttendanceChart />
        <GradesDistributionChart />
        <AssignmentsCompletionChart />
      </div>
    </div>
  );
}

export function DashboardOverviewSkeleton() {
  // Sized to the real content (reminders block + the two-column charts grid)
  // so the loading state doesn't collapse to zero height and cause layout shift.
  return (
    <div className="space-y-6">
      <CardSkeleton className="h-44" lines={3} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CardSkeleton className="h-96" lines={5} />
        <CardSkeleton className="h-96" lines={5} />
      </div>
    </div>
  );
}
