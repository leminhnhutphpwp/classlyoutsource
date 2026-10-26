"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTutorGuard } from "@/hooks/use-role-guard";
import { useLockContext } from "@/contexts/lock-context";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";
import {
  useReportOverview,
  useRevenueReport,
  usePaymentStatistics,
  usePaymentsReport,
  useAttendanceReport,
  useStudentsReport,
  useClassesReport,
  useAssignmentsReport,
  useClasses
} from "@/hooks/use-api";

import {
  ChartBarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  CalendarIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  FunnelIcon,
  XMarkIcon,
  CreditCardIcon,
  AcademicCapIcon,
  ClipboardDocumentListIcon
} from "@heroicons/react/24/outline";
import DateRangePicker from "@/components/FormElements/DateRangePicker";
import SelectInput from "@/components/FormElements/SelectInput";
import { Tabs, TabPanel } from "@/components/Common/Tabs";
import { getObjId, idsEqual } from "@/lib/id-utils";
import type { ReportFilters } from "./_components/report-types";
import OverviewReport from "./_components/OverviewReport";
import RevenueReport from "./_components/RevenueReport";
import PaymentsReport from "./_components/PaymentsReport";
import AttendanceReport from "./_components/AttendanceReport";
import StudentsReport from "./_components/StudentsReport";
import ClassesReport from "./_components/ClassesReport";
import AssignmentsReport from "./_components/AssignmentsReport";

// Helper function để lấy ngày đầu và cuối tháng hiện tại
function getCurrentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    start: firstDay.toISOString().split('T')[0],
    end: lastDay.toISOString().split('T')[0],
  };
}

export default function ReportsPage() {
  const { isBlocked } = useTutorGuard();
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const { renderError } = useErrorDisplay("Báo cáo");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState("overview");
  const [showFilters, setShowFilters] = useState(false);

  // Helper to parse filters from URL
  const parseFiltersFromUrl = useCallback((): ReportFilters => {
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const dateRange = dateFrom && dateTo ? { start: dateFrom, end: dateTo } : getCurrentMonthRange();

    return {
      dateRange,
      statusPayments: searchParams.get("status_payments") || "all",
      statusStudents: searchParams.get("status_students") || "all",
      statusClasses: searchParams.get("status_classes") || "all",
      statusAssignments: searchParams.get("status_assignments") || "all",
      paymentMethod: searchParams.get("payment_method") || "all",
      classId: searchParams.get("class_id") || "all",
    };
  }, [searchParams]);

  // Active filters - được apply vào API calls, khởi tạo từ URL
  const [activeFilters, setActiveFilters] = useState<ReportFilters>(parseFiltersFromUrl);

  // Temp filters - để người dùng chỉnh sửa trước khi apply
  const [tempFilters, setTempFilters] = useState<ReportFilters>(parseFiltersFromUrl);

  // Sync activeFilters with URL when URL changes
  useEffect(() => {
    const urlFilters = parseFiltersFromUrl();
    setActiveFilters(urlFilters);
  }, [searchParams, parseFiltersFromUrl]);

  // Helper to update URL with filters
  const updateUrlWithFilters = useCallback((filters: ReportFilters) => {
    const params = new URLSearchParams();

    if (filters.dateRange) {
      params.set("date_from", filters.dateRange.start);
      params.set("date_to", filters.dateRange.end);
    }

    if (filters.statusPayments !== "all") {
      params.set("status_payments", filters.statusPayments);
    }
    if (filters.statusStudents !== "all") {
      params.set("status_students", filters.statusStudents);
    }
    if (filters.statusClasses !== "all") {
      params.set("status_classes", filters.statusClasses);
    }
    if (filters.statusAssignments !== "all") {
      params.set("status_assignments", filters.statusAssignments);
    }
    if (filters.paymentMethod !== "all") {
      params.set("payment_method", filters.paymentMethod);
    }
    if (filters.classId !== "all") {
      params.set("class_id", filters.classId);
    }

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [router, pathname]);

  // Fetch classes list for dropdown (must be called before early returns)
  const { data: classesData } = useClasses(undefined, !actionsLocked);
  const classesList = Array.isArray(classesData) ? classesData : [];

  // Map payment method from frontend format to backend format
  const mapPaymentMethod = useCallback((method: string): string => {
    if (method === "all") return "all";
    // Map bank_transfer to bank for Payment model (enum), but keep as is for Invoice (nullable string)
    // For revenue report (Invoice), keep as is since Invoice has nullable string
    // For payment statistics (Payment), map bank_transfer to bank
    return method === "bank_transfer" ? "bank" : method;
  }, []);

  // Helper function to create date range filters
  const createDateRangeFilters = useCallback((dateRange: { start: string; end: string } | null) => {
    if (!dateRange || !dateRange.start || !dateRange.end) return {};
    return {
      date_from: dateRange.start,
      date_to: dateRange.end,
    };
  }, []);

  // Sync tempFilters với activeFilters khi mở filter panel
  useEffect(() => {
    if (showFilters) {
      setTempFilters(activeFilters);
    }
  }, [showFilters, activeFilters]);

  // Prepare stable date filters from primitive range values so report hooks do not
  // refetch just because the containing filter object gets a new identity.
  const dateRangeStart = activeFilters.dateRange?.start;
  const dateRangeEnd = activeFilters.dateRange?.end;
  const activeDateFilters = useMemo(
    () => createDateRangeFilters(
      dateRangeStart && dateRangeEnd
        ? { start: dateRangeStart, end: dateRangeEnd }
        : null
    ),
    [dateRangeStart, dateRangeEnd, createDateRangeFilters]
  );

  const overviewFilters = useMemo(
    () => (Object.keys(activeDateFilters).length > 0 ? activeDateFilters : undefined),
    [activeDateFilters]
  );

  const revenueFilters = useMemo(() => {
    const filters: any = { ...activeDateFilters };
    if (activeFilters.paymentMethod !== "all") {
      filters.payment_method = activeFilters.paymentMethod; // Invoice uses nullable string, can be bank_transfer
    }
    return filters;
  }, [activeDateFilters, activeFilters.paymentMethod]);

  const paymentStatisticsFilters = useMemo(() => ({
    ...activeDateFilters,
    ...(activeFilters.paymentMethod !== "all" && {
      payment_method: mapPaymentMethod(activeFilters.paymentMethod), // Payment uses enum, map bank_transfer to bank
    }),
  }), [activeDateFilters, activeFilters.paymentMethod, mapPaymentMethod]);

  const { data: reportOverviewData, loading: overviewLoading } = useReportOverview(actionsLocked ? undefined : overviewFilters);
  const { data: revenueData, loading: revenueLoading } = useRevenueReport(actionsLocked ? undefined : revenueFilters);
  const { data: paymentStatistics, loading: paymentStatisticsLoading } = usePaymentStatistics(actionsLocked ? undefined : paymentStatisticsFilters);

  // New reports hooks - Memoized filters
  const paymentsReportFilters = useMemo(() => ({
    ...activeDateFilters,
    ...(activeFilters.paymentMethod !== "all" && {
      payment_method: mapPaymentMethod(activeFilters.paymentMethod),
    }),
    ...(activeFilters.statusPayments !== "all" && {
      status: activeFilters.statusPayments,
    }),
  }), [activeDateFilters, activeFilters.paymentMethod, activeFilters.statusPayments, mapPaymentMethod]);

  const attendanceReportFilters = useMemo(() => ({
    ...activeDateFilters,
    ...(activeFilters.classId !== "all" && {
      class_id: activeFilters.classId,
    }),
  }), [activeDateFilters, activeFilters.classId]);

  const studentsReportFilters = useMemo(() => ({
    ...activeDateFilters,
    ...(activeFilters.statusStudents !== "all" && {
      status: activeFilters.statusStudents,
    }),
    ...(activeFilters.classId !== "all" && {
      class_id: activeFilters.classId,
    }),
  }), [activeDateFilters, activeFilters.statusStudents, activeFilters.classId]);

  const classesReportFilters = useMemo(() => ({
    ...activeDateFilters,
    ...(activeFilters.statusClasses !== "all" && {
      status: activeFilters.statusClasses,
    }),
  }), [activeDateFilters, activeFilters.statusClasses]);

  const assignmentsReportFilters = useMemo(() => ({
    ...activeDateFilters,
    ...(activeFilters.statusAssignments !== "all" && {
      status: activeFilters.statusAssignments,
    }),
    ...(activeFilters.classId !== "all" && {
      class_id: activeFilters.classId,
    }),
  }), [activeDateFilters, activeFilters.statusAssignments, activeFilters.classId]);

  const { data: paymentsReportData, loading: paymentsReportLoading } =
    usePaymentsReport(actionsLocked ? undefined : paymentsReportFilters);
  const { data: attendanceReportData, loading: attendanceReportLoading } = useAttendanceReport(actionsLocked ? undefined : attendanceReportFilters);
  const { data: studentsReportData, loading: studentsReportLoading } = useStudentsReport(actionsLocked ? undefined : studentsReportFilters);
  const { data: classesReportData, loading: classesReportLoading } = useClassesReport(actionsLocked ? undefined : classesReportFilters);
  const { data: assignmentsReportData, loading: assignmentsReportLoading } = useAssignmentsReport(actionsLocked ? undefined : assignmentsReportFilters);


  // Overview data from report overview API
  // Note: total_students and total_classes are from students/classes reports (overall stats, not filtered by date)
  // Note: total_revenue is from paymentStatistics API (same as revenue tab) for consistency
  const overviewData = useMemo(() => {
    // Handle different response structures:
    // 1. { data: { summary: {...} } } - nested structure
    // 2. { data: summary } - direct summary
    // 3. { summary: {...} } - direct summary at root
    const summary = reportOverviewData?.summary || reportOverviewData || {};
    const studentsSummary = studentsReportData?.summary || studentsReportData || {};
    const classesSummary = classesReportData?.summary || classesReportData || {};

    return {
      total_students: studentsSummary.total_students || 0, // Overall statistics (not filtered by date)
      total_classes: classesSummary.total_classes || 0, // Overall statistics (not filtered by date)
      total_sessions: summary.total_sessions || 0,
      total_revenue: paymentStatistics?.total_amount || summary.revenue_paid || 0, // Use paymentStatistics for consistency with revenue tab
    };
  }, [reportOverviewData, studentsReportData, classesReportData, paymentStatistics]);

  // Revenue data is already filtered by backend
  // useApi unwraps response.data, so revenueData is already the array
  // API returns: { success: true, data: Array<{ date: string, total: number }> }
  const revenueDataArray = useMemo(() => {
    if (!revenueData) return [];
    // Handle array directly
    if (Array.isArray(revenueData)) {
      return revenueData;
    }
    // Handle object with data property (fallback)
    if (revenueData && typeof revenueData === 'object' && 'data' in revenueData && Array.isArray(revenueData.data)) {
      return revenueData.data;
    }
    return [];
  }, [revenueData]);

  // Attendance: filter top students by selected class (frontend guard)
  const filteredAttendanceTopStudents = useMemo(() => {
    const list = attendanceReportData?.top_students || [];
    if (!activeFilters || activeFilters.classId === 'all') return list;
    return list.filter((item: any) => {
      // Prefer strict match by class_id; fallback to include by class_name if needed
      if (item?.class_id != null) {
        return idsEqual(item.class_id, activeFilters.classId);
      }
      return true;
    });
  }, [attendanceReportData?.top_students, activeFilters]);

  // Helper function to build URL with query params from active filters
  const buildDetailUrl = useCallback((basePath: string, additionalParams?: Record<string, string>, includeDateRange: boolean = true) => {
    const params = new URLSearchParams();

    // Add date range if exists and includeDateRange is true (skip for students, classes, assignments)
    if (includeDateRange && activeFilters.dateRange) {
      params.set('date_from', activeFilters.dateRange.start);
      params.set('date_to', activeFilters.dateRange.end);
    }

    // Add class filter if exists and not 'all'
    if (activeFilters.classId && activeFilters.classId !== 'all') {
      params.set('class_id', activeFilters.classId);
    }

    // Add additional params if provided
    if (additionalParams) {
      Object.entries(additionalParams).forEach(([key, value]) => {
        if (value && value !== 'all') {
          params.set(key, value);
        }
      });
    }

    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  }, [activeFilters]);

  // Calculate revenue stats from backend-filtered revenue data
  const revenueStats = useMemo(() => {
    if (!revenueDataArray || revenueDataArray.length === 0) {
      return {
        monthly_revenue: 0,
        yearly_revenue: 0,
        average_revenue: 0,
      };
    }

    const now = new Date();
    const thisMonth = revenueDataArray.filter((item: any) => {
      if (!item || !item.date) return false;
      const itemDate = new Date(item.date);
      return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
    });

    const thisYear = revenueDataArray.filter((item: any) => {
      if (!item || !item.date) return false;
      const itemDate = new Date(item.date);
      return itemDate.getFullYear() === now.getFullYear();
    });

    const monthly_revenue = thisMonth.reduce((sum: number, item: any) => sum + (item.total || 0), 0);
    const yearly_revenue = thisYear.reduce((sum: number, item: any) => sum + (item.total || 0), 0);
    const average_revenue = revenueDataArray.length > 0
      ? revenueDataArray.reduce((sum: number, item: any) => sum + (item.total || 0), 0) / revenueDataArray.length
      : 0;

    return {
      monthly_revenue,
      yearly_revenue,
      average_revenue,
    };
  }, [revenueDataArray]);


  // Payment statistics is already filtered by backend
  // useApi unwraps response.data, so paymentStatistics is already the data object
  // API response structure: { success: true, data: { by_method: [...], by_status: [...], total_payments, total_amount, ... } }
  const filteredPaymentStatistics = paymentStatistics;

  const tabs = [
    { id: "overview", label: "Tổng quan", icon: ChartBarIcon },
    { id: "revenue", label: "Doanh thu", icon: CurrencyDollarIcon },
    { id: "payments", label: "Thanh toán", icon: CreditCardIcon },
    { id: "attendance", label: "Điểm danh", icon: CalendarIcon },
    { id: "students", label: "Học viên", icon: UserGroupIcon },
    { id: "classes", label: "Lớp học", icon: AcademicCapIcon },
    { id: "assignments", label: "Bài tập", icon: ClipboardDocumentListIcon },
  ];

  const handleResetFilters = useCallback(() => {
    const defaultRange = getCurrentMonthRange();
    const resetFilters = {
      dateRange: defaultRange,
      statusPayments: "all",
      statusStudents: "all",
      statusClasses: "all",
      statusAssignments: "all",
      paymentMethod: "all",
      classId: "all",
    };
    setTempFilters(resetFilters);
    setActiveFilters(resetFilters);
    updateUrlWithFilters(resetFilters);
  }, [updateUrlWithFilters]);

  const handleApplyFilters = useCallback(() => {
    setActiveFilters(tempFilters);
    updateUrlWithFilters(tempFilters);
    setShowFilters(false);
  }, [tempFilters, updateUrlWithFilters]);

  const hasActiveFilters = useMemo(() =>
    activeFilters.dateRange ||
    activeFilters.statusPayments !== "all" ||
    activeFilters.statusStudents !== "all" ||
    activeFilters.statusClasses !== "all" ||
    activeFilters.statusAssignments !== "all" ||
    activeFilters.paymentMethod !== "all" ||
    activeFilters.classId !== "all",
    [activeFilters]
  );


  // Check lock and plan feature first to show lock message
  if (actionsLocked || planFeatureMessage) {
    return renderError();
  }

  // In tutor-only system, no center owner concept
  if (isBlocked) {
    return null;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white">Báo cáo & Phân tích</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1">
            Theo dõi hiệu suất và phân tích dữ liệu của bạn
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 font-medium transition-colors ${showFilters || hasActiveFilters
              ? "border-primary bg-primary/10 text-primary dark:bg-primary/20"
              : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
          >
            <FunnelIcon className="h-4 w-4" />
            Bộ lọc
            {hasActiveFilters && (
              <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-white">
                {[
                  activeFilters.dateRange,
                  activeFilters.statusPayments !== "all",
                  activeFilters.statusStudents !== "all",
                  activeFilters.statusClasses !== "all",
                  activeFilters.statusAssignments !== "all",
                  activeFilters.paymentMethod !== "all",
                  activeFilters.classId !== "all"
                ].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Bộ lọc</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Date Range Filter - Available for most tabs */}
            {(activeTab === "overview" || activeTab === "revenue" || activeTab === "payments" ||
              activeTab === "attendance" || activeTab === "students" || activeTab === "classes" ||
              activeTab === "assignments") && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Khoảng thời gian
                  </label>
                  <DateRangePicker
                    value={tempFilters.dateRange || undefined}
                    onChange={(range) => setTempFilters({ ...tempFilters, dateRange: range })}
                    placeholder="Chọn khoảng thời gian"
                  />
                </div>
              )}

            {/* Status Filter - For Payments, Students, Classes, Assignments tabs */}
            {(activeTab === "payments" || activeTab === "students" || activeTab === "classes" || activeTab === "assignments") && (
              <SelectInput
                label="Trạng thái"
                name={
                  activeTab === "payments" ? "statusPayments" :
                    activeTab === "students" ? "statusStudents" :
                      activeTab === "classes" ? "statusClasses" :
                        activeTab === "assignments" ? "statusAssignments" :
                          "status"
                }
                value={
                  activeTab === "payments" ? tempFilters.statusPayments :
                    activeTab === "students" ? tempFilters.statusStudents :
                      activeTab === "classes" ? tempFilters.statusClasses :
                        activeTab === "assignments" ? tempFilters.statusAssignments :
                          "all"
                }
                onChange={(e) => {
                  const value = e.target.value;
                  if (activeTab === "payments") {
                    setTempFilters({ ...tempFilters, statusPayments: value });
                  } else if (activeTab === "students") {
                    setTempFilters({ ...tempFilters, statusStudents: value });
                  } else if (activeTab === "classes") {
                    setTempFilters({ ...tempFilters, statusClasses: value });
                  } else if (activeTab === "assignments") {
                    setTempFilters({ ...tempFilters, statusAssignments: value });
                  }
                }}
                options={[
                  { value: "all", label: "Tất cả" },
                  ...(activeTab === "payments" ? [
                    { value: "paid", label: "Đã thanh toán" },
                    { value: "pending", label: "Chờ thanh toán" },
                    { value: "failed", label: "Thất bại" },
                    { value: "refunded", label: "Đã hoàn tiền" },
                  ] : []),
                  ...(activeTab === "students" ? [
                    { value: "active", label: "Đang học" },
                    { value: "inactive", label: "Đã nghỉ" },
                    { value: "graduated", label: "Đã tốt nghiệp" },
                  ] : []),
                  ...(activeTab === "classes" ? [
                    { value: "active", label: "Đang dạy" },
                    { value: "inactive", label: "Chưa bắt đầu" },
                    { value: "completed", label: "Đã hoàn thành" },
                  ] : []),
                  ...(activeTab === "assignments" ? [
                    { value: "draft", label: "Sắp giao" },
                    { value: "published", label: "Đang giao" },
                    { value: "closed", label: "Đã kết thúc" },
                  ] : []),
                ]}
              />
            )}

            {/* Payment Method Filter - For Revenue and Payments tabs */}
            {(activeTab === "revenue" || activeTab === "payments") && (
              <SelectInput
                label="Phương thức thanh toán"
                name="paymentMethod"
                value={tempFilters.paymentMethod}
                onChange={(e) => setTempFilters({ ...tempFilters, paymentMethod: e.target.value })}
                options={[
                  { value: "all", label: "Tất cả" },
                  { value: "bank_transfer", label: "Chuyển khoản" },
                  { value: "cash", label: "Tiền mặt" },
                  { value: "other", label: "Khác" },
                ]}
              />
            )}

            {/* Class Filter - For Attendance, Students, Assignments tabs */}
            {(activeTab === "attendance" || activeTab === "students" || activeTab === "assignments") && (
              <SelectInput
                label="Lớp học"
                name="classId"
                value={tempFilters.classId}
                onChange={(e) => setTempFilters({ ...tempFilters, classId: e.target.value })}
                options={[
                  { value: "all", label: "Tất cả lớp" },
                  ...classesList.map((classItem: any) => {
                    const className = classItem.name || classItem.class_name || `Lớp ${getObjId(classItem)}`;
                    return {
                      value: getObjId(classItem),
                      label: className.length > 40 ? `${className.substring(0, 40)}...` : className,
                    };
                  }),
                ]}
              />
            )}
          </div>

          {/* Filter Actions */}
          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Khôi phục
            </button>
            <button
              onClick={handleApplyFilters}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              <MagnifyingGlassIcon className="h-4 w-4" />
              Áp dụng
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab Content */}
      <TabPanel activeTab={activeTab} tabId="overview">
        <OverviewReport
          overviewLoading={overviewLoading}
          studentsReportLoading={studentsReportLoading}
          classesReportLoading={classesReportLoading}
          attendanceReportLoading={attendanceReportLoading}
          assignmentsReportLoading={assignmentsReportLoading}
          paymentStatisticsLoading={paymentStatisticsLoading}
          revenueLoading={revenueLoading}
          buildDetailUrl={buildDetailUrl}
          activeFilters={activeFilters}
          overviewData={overviewData}
          paymentStatistics={paymentStatistics}
          attendanceReportData={attendanceReportData}
          studentsReportData={studentsReportData}
          classesReportData={classesReportData}
          paymentsReportData={paymentsReportData}
          assignmentsReportData={assignmentsReportData}
          revenueDataArray={revenueDataArray}
        />
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="revenue">
        <RevenueReport
          revenueLoading={revenueLoading}
          paymentsReportLoading={paymentsReportLoading}
          paymentStatisticsLoading={paymentStatisticsLoading}
          buildDetailUrl={buildDetailUrl}
          activeFilters={activeFilters}
          overviewData={overviewData}
          paymentsReportData={paymentsReportData}
          filteredPaymentStatistics={filteredPaymentStatistics}
          revenueStats={revenueStats}
          revenueDataArray={revenueDataArray}
        />
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="payments">
        <PaymentsReport
          paymentsReportLoading={paymentsReportLoading}
          buildDetailUrl={buildDetailUrl}
          activeFilters={activeFilters}
          paymentsReportData={paymentsReportData}
        />
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="attendance">
        <AttendanceReport
          attendanceReportLoading={attendanceReportLoading}
          buildDetailUrl={buildDetailUrl}
          attendanceReportData={attendanceReportData}
          filteredAttendanceTopStudents={filteredAttendanceTopStudents}
        />
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="students">
        <StudentsReport
          studentsReportLoading={studentsReportLoading}
          buildDetailUrl={buildDetailUrl}
          activeFilters={activeFilters}
          studentsReportData={studentsReportData}
        />
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="classes">
        <ClassesReport
          classesReportLoading={classesReportLoading}
          buildDetailUrl={buildDetailUrl}
          activeFilters={activeFilters}
          classesReportData={classesReportData}
        />
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="assignments">
        <AssignmentsReport
          assignmentsReportLoading={assignmentsReportLoading}
          buildDetailUrl={buildDetailUrl}
          activeFilters={activeFilters}
          assignmentsReportData={assignmentsReportData}
        />
      </TabPanel>
    </div>
  );
}
