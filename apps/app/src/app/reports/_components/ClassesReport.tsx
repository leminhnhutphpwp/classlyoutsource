"use client";
import Link from "next/link";
import Tooltip from "@/components/Common/Tooltip";
import LoadingSkeleton from "./loading-skeleton";
import EmptyState from "./empty-state";
import TopList from "./top-list";
import { ClassesByStatusChart, TopClassesByStudentsChart } from "./charts";
import type { BuildDetailUrl, ReportFilters } from "./report-types";
import {
  AcademicCapIcon,
  ArrowTrendingUpIcon,
  ChartBarIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

interface ClassesReportProps {
  classesReportLoading: boolean;
  buildDetailUrl: BuildDetailUrl;
  activeFilters: ReportFilters;
  classesReportData: any;
}

export default function ClassesReport({
  classesReportLoading,
  buildDetailUrl,
  activeFilters,
  classesReportData,
}: ClassesReportProps) {
  return (
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {classesReportLoading ? (
                  <LoadingSkeleton count={3} />
                ) : classesReportData ? (
                  <>
                    <div className="relative rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                      <div className="absolute top-2 right-2">
                        <Tooltip label="Xem báo cáo">
                          <Link
                            href={buildDetailUrl("/classes", activeFilters.statusClasses !== "all" ? { status: activeFilters.statusClasses } : undefined, false)}
                            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <ArrowRightIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          </Link>
                        </Tooltip>
                      </div>
                      <div className="flex items-center">
                        <div className="p-2 bg-primary-100 dark:bg-primary/20 rounded-lg">
                          <AcademicCapIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Lớp học</p>
                          <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                            {classesReportData.summary?.total_classes ?? classesReportData.total_classes ?? 0}
                          </p>
                        </div>
                      </div>
                    </div>
    
                    <div className="relative rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                      <div className="absolute top-2 right-2">
                        <Tooltip label="Xem báo cáo">
                          <Link
                            href={buildDetailUrl("/classes", activeFilters.statusClasses !== "all" ? { status: activeFilters.statusClasses } : undefined, false)}
                            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <ArrowRightIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          </Link>
                        </Tooltip>
                      </div>
                      <div className="flex items-center">
                        <div className="p-2 bg-primary-100 dark:bg-primary/20 rounded-lg">
                          <ArrowTrendingUpIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Lớp mới</p>
                          <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                            {classesReportData.summary?.new_classes_in_period ?? classesReportData.new_classes ?? 0}
                          </p>
                        </div>
                      </div>
                    </div>
    
                    <div className="relative rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                      <div className="absolute top-2 right-2">
                        <Tooltip label="Xem báo cáo">
                          <Link
                            href={buildDetailUrl("/classes", { status: "active" }, false)}
                            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <ArrowRightIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          </Link>
                        </Tooltip>
                      </div>
                      <div className="flex items-center">
                        <div className="p-2 bg-primary-100 dark:bg-primary/20 rounded-lg">
                          <ChartBarIcon className="h-6 w-6 text-primary-600 dark:text-primary-300" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Hoạt động</p>
                          <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                            {classesReportData.summary?.active_classes ?? classesReportData.active_classes ?? 0}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    icon={<AcademicCapIcon className="h-12 w-12" />}
                    message="Không có dữ liệu lớp học"
                  />
                )}
              </div>
    
              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Classes by Status Chart */}
                <ClassesByStatusChart
                  data={classesReportData?.by_status}
                  loading={classesReportLoading}
                />
    
                {/* Top Classes by Students Chart */}
                <TopClassesByStudentsChart
                  data={classesReportData?.top_classes_by_students || []}
                  loading={classesReportLoading}
                />
              </div>
    
    
              {/* Top Classes by Performance */}
              {classesReportLoading ? (
                <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Top lớp học hiệu suất cao nhất</h3>
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700 animate-pulse">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-600" />
                          <div>
                            <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-600 mb-2" />
                            <div className="h-3 w-40 rounded bg-gray-200 dark:bg-gray-600" />
                          </div>
                        </div>
                        <div>
                          <div className="h-6 w-12 rounded bg-gray-200 dark:bg-gray-600 mb-1" />
                          <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-600" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : classesReportData && classesReportData.top_classes_by_performance && Array.isArray(classesReportData.top_classes_by_performance) && classesReportData.top_classes_by_performance.length > 0 && (
                <TopList
                  title="Top lớp học hiệu suất cao nhất"
                  items={classesReportData.top_classes_by_performance.map((classItem: any) => ({
                    id: classItem.class_id,
                    name: classItem.class_name || 'Không tên',
                    subtitle: `${classItem.present_count || 0} có mặt / ${classItem.total_attendance || 0} tổng`,
                    value: classItem.attendance_rate ? `${Math.round(classItem.attendance_rate)}%` : '0%',
                    valueLabel: 'Tỷ lệ đi học',
                  }))}
                  rankColor="bg-primary-100 dark:bg-primary/20 text-primary-600 dark:text-primary-300"
                />
              )}
            </div>
  );
}
