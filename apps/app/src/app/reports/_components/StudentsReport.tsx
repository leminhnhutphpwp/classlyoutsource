"use client";
import SummaryCard from "./summary-card";
import EmptyState from "./empty-state";
import LoadingSkeleton from "./loading-skeleton";
import { StudentsByStatusChart, StudentsByClassChart, StudentsGrowthChart } from "./charts";
import type { BuildDetailUrl, ReportFilters } from "./report-types";
import {
  UserGroupIcon,
  ArrowTrendingUpIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";

interface StudentsReportProps {
  studentsReportLoading: boolean;
  buildDetailUrl: BuildDetailUrl;
  activeFilters: ReportFilters;
  studentsReportData: any;
}

export default function StudentsReport({
  studentsReportLoading,
  buildDetailUrl,
  activeFilters,
  studentsReportData,
}: StudentsReportProps) {
  return (
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {studentsReportLoading ? (
                  <LoadingSkeleton count={3} />
                ) : studentsReportData ? (
                  <>
                    <SummaryCard
                      icon={<UserGroupIcon className="h-6 w-6" />}
                      label="Học viên"
                      value={studentsReportData.summary?.total_students ?? studentsReportData.total_students ?? 0}
                      iconBgColor="bg-primary-100 dark:bg-primary/20"
                      iconTextColor="text-primary-600 dark:text-primary-300"
                      href={buildDetailUrl("/students", activeFilters.statusStudents !== "all" ? { status: activeFilters.statusStudents } : undefined, false)}
                    />
                    <SummaryCard
                      icon={<ArrowTrendingUpIcon className="h-6 w-6" />}
                      label="Học viên mới"
                      value={studentsReportData.summary?.new_students_in_period ?? studentsReportData.new_students ?? 0}
                      iconBgColor="bg-primary-100 dark:bg-primary/20"
                      iconTextColor="text-primary-600 dark:text-primary-300"
                      href={buildDetailUrl("/students", activeFilters.statusStudents !== "all" ? { status: activeFilters.statusStudents } : undefined, false)}
                    />
                    <SummaryCard
                      icon={<ChartBarIcon className="h-6 w-6" />}
                      label="Hoạt động"
                      value={studentsReportData.summary?.active_students ?? studentsReportData.active_students ?? 0}
                      iconBgColor="bg-primary-100 dark:bg-primary/20"
                      iconTextColor="text-primary-600 dark:text-primary-300"
                      href={buildDetailUrl("/students", activeFilters.statusStudents !== "all" ? { status: activeFilters.statusStudents } : undefined, false)}
                    />
                  </>
                ) : (
                  <EmptyState
                    icon={<UserGroupIcon className="h-12 w-12" />}
                    message="Không có dữ liệu học viên"
                  />
                )}
              </div>
    
              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Students by Status Chart */}
                <StudentsByStatusChart
                  data={studentsReportData?.by_status || []}
                  loading={studentsReportLoading}
                />
    
                {/* Students by Class Chart */}
                <StudentsByClassChart
                  data={studentsReportData?.by_class || []}
                  loading={studentsReportLoading}
                />
              </div>
    
              {/* Growth Trend Chart */}
              {studentsReportData?.growth && studentsReportData.growth.length > 0 && (
                <StudentsGrowthChart
                  data={studentsReportData.growth}
                  loading={studentsReportLoading}
                />
              )}
            </div>
  );
}
