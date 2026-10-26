"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/Auth/ProtectedRoute";
import { useAuthContext } from "@/contexts/auth-context";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";
import { useLockContext } from "@/contexts/lock-context";
import { DashboardOverview } from "./_components/dashboard-overview";
import { RecentActivity } from "./_components/recent-activity";
import { QuickActions } from "./_components/quick-actions";
import { useDashboard } from "@/hooks/use-api";

export default function Dashboard() {
  const { user } = useAuthContext();
  const router = useRouter();
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const { renderError } = useErrorDisplay("Bảng điều khiển");
  const isStudent = user?.role === 'student';
  const isParent = user?.role === 'parent';

  // Phụ huynh không dùng bảng điều khiển giáo viên → đưa về cổng gia đình
  useEffect(() => {
    if (isParent) {
      router.replace('/family');
    }
  }, [isParent, router]);

  const shouldFetchDashboard = !isStudent && !isParent && !actionsLocked && !planFeatureMessage;
  const { data: dashboardData } = useDashboard(shouldFetchDashboard);

  // Get welcome message from API for tutors
  const welcomeTitle = dashboardData?.welcome?.title || 'Chào mừng đến với Classly';
  const welcomeContent = dashboardData?.welcome?.content || 'Hệ thống quản lý lớp học chuyên nghiệp';

  if (actionsLocked || planFeatureMessage) {
    return (
      <ProtectedRoute>
        {renderError()}
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="space-y-4 sm:space-y-6">
        {/* Welcome Header - dùng CSS variables theo theme */}
        <div
          className="relative overflow-hidden rounded-lg p-4 sm:p-6 text-white"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--color-primary-dark), var(--color-primary))",
          }}
        >
          <h1 className="text-xl sm:text-2xl font-bold">
            {isStudent ? `Chào mừng, ${user?.name || 'Học viên'}!` : welcomeTitle}
          </h1>
          <p className="mt-2 opacity-90">
            {isStudent ? 'Theo dõi tiến độ học tập của bạn' : welcomeContent}
          </p>
        </div>

        {/* Overview Cards — component renders its own skeleton while loading
            (useApi is state-based and never suspends, so a Suspense wrapper here
            would be dead code). */}
        <DashboardOverview />

        {/* Bottom Row */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          <div className={`${isStudent ? "lg:col-span-2" : "lg:col-span-2"} order-2 lg:order-1`}>
            <RecentActivity />
          </div>

          <div className="order-1 lg:order-2">
            <QuickActions />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
