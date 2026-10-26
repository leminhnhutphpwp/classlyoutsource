"use client";
import Link from "next/link";
import Tooltip from "@/components/Common/Tooltip";
import LoadingSkeleton from "./loading-skeleton";
import {
  StudentGrowthChartComponent,
  ClassPerformanceChartComponent,
  OverviewRevenueTrendChart,
  OverviewMetricsComparisonChart,
} from "./charts";
import type { BuildDetailUrl, ReportFilters } from "./report-types";
import {
  UserGroupIcon,
  AcademicCapIcon,
  CreditCardIcon,
  CalendarIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

interface OverviewReportProps {
  overviewLoading: boolean;
  studentsReportLoading: boolean;
  classesReportLoading: boolean;
  attendanceReportLoading: boolean;
  assignmentsReportLoading: boolean;
  paymentStatisticsLoading: boolean;
  revenueLoading: boolean;
  buildDetailUrl: BuildDetailUrl;
  activeFilters: ReportFilters;
  overviewData: any;
  paymentStatistics: any;
  attendanceReportData: any;
  studentsReportData: any;
  classesReportData: any;
  paymentsReportData: any;
  assignmentsReportData: any;
  revenueDataArray: any[];
}

export default function OverviewReport({
  overviewLoading,
  studentsReportLoading,
  classesReportLoading,
  attendanceReportLoading,
  assignmentsReportLoading,
  paymentStatisticsLoading,
  revenueLoading,
  buildDetailUrl,
  activeFilters,
  overviewData,
  paymentStatistics,
  attendanceReportData,
  studentsReportData,
  classesReportData,
  paymentsReportData,
  assignmentsReportData,
  revenueDataArray,
}: OverviewReportProps) {
  return (
            <div className="space-y-4 sm:space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
                {overviewLoading || studentsReportLoading || classesReportLoading || attendanceReportLoading || assignmentsReportLoading || paymentStatisticsLoading ? (
                  <LoadingSkeleton count={4} />
                ) : (
                  <>
                    <div className="relative rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                      <div className="absolute top-2 right-2">
                        <Tooltip label="Xem danh sách học viên">
                          <Link
                            href={buildDetailUrl("/students", activeFilters.statusStudents !== "all" ? { status: activeFilters.statusStudents } : undefined, false)}
                            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <ArrowRightIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          </Link>
                        </Tooltip>
                      </div>
                      <div className="flex items-center">
                        <div className="p-2 bg-primary-100 dark:bg-primary/20 rounded-lg">
                          <UserGroupIcon className="h-6 w-6 text-primary-600 dark:text-primary-300" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Học viên</p>
                          <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                            {overviewData?.total_students || 0}
                          </p>
                        </div>
                      </div>
                    </div>
    
                    <div className="relative rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                      <div className="absolute top-2 right-2">
                        <Tooltip label="Xem danh sách lớp học">
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
                          <AcademicCapIcon className="h-6 w-6 text-primary-600 dark:text-primary-300" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Lớp học</p>
                          <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                            {overviewData?.total_classes || 0}
                          </p>
                        </div>
                      </div>
                    </div>
    
                    <div className="relative rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                      <div className="absolute top-2 right-2">
                        <Tooltip label="Xem lịch sử thanh toán">
                          <Link
                            href={buildDetailUrl("/payments", {
                              ...(activeFilters.statusPayments !== "all" ? { status: activeFilters.statusPayments } : {}),
                              ...(activeFilters.paymentMethod !== "all" ? { payment_method: activeFilters.paymentMethod } : {})
                            })}
                            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <ArrowRightIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          </Link>
                        </Tooltip>
                      </div>
                      <div className="flex items-center">
                        <div className="p-2 bg-primary-100 dark:bg-primary/20 rounded-lg">
                          <CreditCardIcon className="h-6 w-6 text-primary-600 dark:text-primary-300" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Thanh toán</p>
                          <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                            {paymentStatistics?.total_payments || 0}
                          </p>
                        </div>
                      </div>
                    </div>
    
                    <div className="relative rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                      <div className="absolute top-2 right-2">
                        <Tooltip label="Xem lịch sử điểm danh">
                          <Link
                            href={buildDetailUrl("/attendance")}
                            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <ArrowRightIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          </Link>
                        </Tooltip>
                      </div>
                      <div className="flex items-center">
                        <div className="p-2 bg-primary-100 dark:bg-primary/20 rounded-lg">
                          <CalendarIcon className="h-6 w-6 text-primary-600 dark:text-primary-300" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tỷ lệ học</p>
                          <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                            {attendanceReportData?.summary?.attendance_rate ? `${Math.round(attendanceReportData.summary.attendance_rate)}%` : '0%'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
    
              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Student Growth Chart */}
                <StudentGrowthChartComponent
                  dashboardData={studentsReportData}
                  loading={overviewLoading || studentsReportLoading}
                />
    
                {/* Class Performance Chart */}
                <ClassPerformanceChartComponent
                  dashboardData={classesReportData}
                  loading={overviewLoading || classesReportLoading}
                />
              </div>
    
              {/* Revenue Trend Chart - Full Width */}
              <div className="grid grid-cols-1 gap-4 sm:gap-6">
                <OverviewRevenueTrendChart
                  revenueData={revenueDataArray}
                  paymentsReportData={paymentsReportData}
                  loading={overviewLoading || revenueLoading}
                />
              </div>
    
              {/* Overview Metrics Comparison Chart */}
              <OverviewMetricsComparisonChart
                overviewData={overviewData}
                attendanceRate={attendanceReportData?.summary?.attendance_rate}
                totalAssignments={assignmentsReportData?.total_assignments}
                loading={overviewLoading || attendanceReportLoading || assignmentsReportLoading}
              />
    
            </div>
  );
}
