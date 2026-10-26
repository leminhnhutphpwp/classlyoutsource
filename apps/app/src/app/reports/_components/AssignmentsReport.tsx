"use client";
import SummaryCard from "./summary-card";
import EmptyState from "./empty-state";
import LoadingSkeleton from "./loading-skeleton";
import { AssignmentsByStatusChart, AssignmentsByGradeChart, GradeStatsChart } from "./charts";
import type { BuildDetailUrl, ReportFilters } from "./report-types";
import {
  ClipboardDocumentListIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";

interface AssignmentsReportProps {
  assignmentsReportLoading: boolean;
  buildDetailUrl: BuildDetailUrl;
  activeFilters: ReportFilters;
  assignmentsReportData: any;
}

export default function AssignmentsReport({
  assignmentsReportLoading,
  buildDetailUrl,
  activeFilters,
  assignmentsReportData,
}: AssignmentsReportProps) {
  return (
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {assignmentsReportLoading ? (
                  <LoadingSkeleton count={3} />
                ) : assignmentsReportData ? (
                  <>
                    <SummaryCard
                      icon={<ClipboardDocumentListIcon className="h-6 w-6" />}
                      label="Bài tập"
                      value={assignmentsReportData.total_assignments || 0}
                      iconBgColor="bg-primary-100 dark:bg-primary/20"
                      href={buildDetailUrl("/assignments", activeFilters.statusAssignments !== "all" ? { status: activeFilters.statusAssignments } : undefined, false)}
                    />
                    <SummaryCard
                      icon={<ChartBarIcon className="h-6 w-6" />}
                      label="Tỷ lệ nộp"
                      value={assignmentsReportData.submission_rate ? `${Math.round(assignmentsReportData.submission_rate)}%` : '0%'}
                      iconBgColor="bg-primary-100 dark:bg-primary/20"
                      iconTextColor="text-primary-600 dark:text-primary-300"
                      href={buildDetailUrl("/assignments", activeFilters.statusAssignments !== "all" ? { status: activeFilters.statusAssignments } : undefined, false)}
                    />
                    <SummaryCard
                      icon={<CurrencyDollarIcon className="h-6 w-6" />}
                      label="Điểm trung bình"
                      value={assignmentsReportData.average_grade ? Math.round(assignmentsReportData.average_grade) : 0}
                      iconBgColor="bg-primary-100 dark:bg-primary/20"
                      iconTextColor="text-primary-600 dark:text-primary-300"
                      href="/grades"
                    />
                  </>
                ) : (
                  <EmptyState
                    icon={<ClipboardDocumentListIcon className="h-12 w-12" />}
                    message="Không có dữ liệu bài tập"
                  />
                )}
              </div>
    
              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Assignments by Status Chart */}
                <AssignmentsByStatusChart
                  data={assignmentsReportData?.by_status || []}
                  loading={assignmentsReportLoading}
                />
    
                {/* Assignments by Grade Chart */}
                <AssignmentsByGradeChart
                  data={assignmentsReportData?.by_grade || []}
                  loading={assignmentsReportLoading}
                />
              </div>
    
              {/* Grade Stats Chart */}
              {assignmentsReportData?.grade_stats && (
                <GradeStatsChart
                  data={assignmentsReportData.grade_stats}
                  loading={assignmentsReportLoading}
                />
              )}
            </div>
  );
}
