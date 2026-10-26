"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import ProtectedRoute from "@/components/Auth/ProtectedRoute";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { useStudentId } from "@/hooks/use-student-id";
import { useLockContext } from "@/contexts/lock-context";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";
import { useThemeColors } from "@/hooks/use-theme";
import {
  useStudentClasses,
  useStudentAssignments,
  useStudentAttendance,
  useStudentGrades,
  useStudentStatistics
} from "@/hooks/use-api";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Tooltip from "@/components/Common/Tooltip";
import {
  ChartBarIcon,
  AcademicCapIcon,
  CalendarIcon,
  DocumentTextIcon,
  UserGroupIcon,
  FunnelIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import Pagination from "@/components/Common/Pagination";
import { formatScore, formatAverageGrade } from "@/lib/format-score";
import { formatPercentage } from "@/lib/format-number";
import DateRangePicker from "@/components/FormElements/DateRangePicker";
import SelectInput from "@/components/FormElements/SelectInput";
import { Tabs, TabPanel } from "@/components/Common/Tabs";
import { CardSkeleton, ChartSkeleton, ListSkeleton } from "@/components/ui/loading";
import { getObjId } from "@/lib/id-utils";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type StudentReportFilters = {
  dateRange: { start: string; end: string } | null;
  statusClasses: string;
  statusAssignments: string;
  classId: string;
};

function getCurrentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: firstDay.toISOString().split("T")[0],
    end: lastDay.toISOString().split("T")[0],
  };
}

export default function MyReportsPage() {
  // Only allow students to access this page
  const { isBlocked } = useRoleGuard({
    allowedRoles: ['student'],
    redirectTo: '/403',
  });

  const { actionsLocked, planFeatureMessage } = useLockContext();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { studentId, loading: studentIdLoading } = useStudentId();
  const [activeTab, setActiveTab] = useState("overview");
  const [showFilters, setShowFilters] = useState(false);
  const { renderError } = useErrorDisplay("Tiến độ học tập");

  // Helper to parse filters from URL
  const parseFiltersFromUrl = useCallback((): StudentReportFilters => {
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const dateRange = dateFrom && dateTo ? { start: dateFrom, end: dateTo } : getCurrentMonthRange();

    return {
      dateRange,
      statusClasses: searchParams.get("status_classes") || "all",
      statusAssignments: searchParams.get("status_assignments") || "all",
      classId: searchParams.get("class_id") || "all",
    };
  }, [searchParams]);

  const defaultFilters: StudentReportFilters = useMemo(
    () => ({
      dateRange: getCurrentMonthRange(),
      statusClasses: "all",
      statusAssignments: "all",
      classId: "all",
    }),
    []
  );
  const [activeFilters, setActiveFilters] = useState<StudentReportFilters>(parseFiltersFromUrl);
  const [tempFilters, setTempFilters] = useState<StudentReportFilters>(parseFiltersFromUrl);

  // Sync activeFilters with URL when URL changes
  useEffect(() => {
    const urlFilters = parseFiltersFromUrl();
    setActiveFilters(urlFilters);
  }, [searchParams, parseFiltersFromUrl]);

  // Helper to update URL with filters
  const updateUrlWithFilters = useCallback((filters: StudentReportFilters) => {
    const params = new URLSearchParams();

    if (filters.dateRange) {
      params.set("date_from", filters.dateRange.start);
      params.set("date_to", filters.dateRange.end);
    }

    if (filters.statusClasses !== "all") {
      params.set("status_classes", filters.statusClasses);
    }
    if (filters.statusAssignments !== "all") {
      params.set("status_assignments", filters.statusAssignments);
    }
    if (filters.classId !== "all") {
      params.set("class_id", filters.classId);
    }

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [router, pathname]);

  // Pagination state for each tab
  const [classesPage, setClassesPage] = useState(1);
  const [assignmentsPage, setAssignmentsPage] = useState(1);
  const [attendancePage, setAttendancePage] = useState(1);
  const [gradesPage, setGradesPage] = useState(1);
  const [perPage] = useState(15);

  // Sync temp filters when opening the filter panel
  useEffect(() => {
    if (showFilters) {
      setTempFilters(activeFilters);
    }
  }, [showFilters, activeFilters]);

  const hasActiveFilters = useMemo(() => {
    const { dateRange, statusClasses, statusAssignments, classId } = activeFilters;
    return Boolean(
      dateRange ||
      statusClasses !== "all" ||
      statusAssignments !== "all" ||
      classId !== "all"
    );
  }, [activeFilters]);

  const handleApplyFilters = () => {
    setActiveFilters(tempFilters);
    updateUrlWithFilters(tempFilters);
    setShowFilters(false);
    setClassesPage(1);
    setAssignmentsPage(1);
    setAttendancePage(1);
    setGradesPage(1);
  };

  const handleResetFilters = () => {
    setTempFilters(defaultFilters);
    setActiveFilters(defaultFilters);
    updateUrlWithFilters(defaultFilters);
    setShowFilters(false);
    setClassesPage(1);
    setAssignmentsPage(1);
    setAttendancePage(1);
    setGradesPage(1);
  };

  const dateFrom = activeFilters.dateRange?.start;
  const dateTo = activeFilters.dateRange?.end;

  const classesOptions = useMemo(
    () => ({
      page: classesPage,
      per_page: perPage,
      ...(activeFilters.statusClasses !== "all" && { status: activeFilters.statusClasses }),
      ...(dateFrom && dateTo ? { date_from: dateFrom, date_to: dateTo } : {}),
    }),
    [classesPage, perPage, activeFilters.statusClasses, dateFrom, dateTo]
  );

  const assignmentsOptions = useMemo(
    () => ({
      page: assignmentsPage,
      per_page: perPage,
      ...(activeFilters.statusAssignments !== "all" && { status: activeFilters.statusAssignments }),
      ...(activeFilters.classId !== "all" && { class_id: activeFilters.classId }),
      ...(dateFrom && dateTo ? { date_from: dateFrom, date_to: dateTo } : {}),
    }),
    [assignmentsPage, perPage, activeFilters.statusAssignments, activeFilters.classId, dateFrom, dateTo]
  );

  const attendanceOptions = useMemo(
    () => ({
      page: attendancePage,
      per_page: perPage,
      ...(activeFilters.classId !== "all" && { class_id: activeFilters.classId }),
      ...(dateFrom && dateTo ? { date_from: dateFrom, date_to: dateTo } : {}),
    }),
    [attendancePage, perPage, activeFilters.classId, dateFrom, dateTo]
  );

  const gradesOptions = useMemo(
    () => ({
      page: gradesPage,
      per_page: perPage,
      ...(activeFilters.classId !== "all" && { class_id: activeFilters.classId }),
      ...(dateFrom && dateTo ? { date_from: dateFrom, date_to: dateTo } : {}),
    }),
    [gradesPage, perPage, activeFilters.classId, dateFrom, dateTo]
  );

  const statisticsFilters = useMemo(
    () => ({
      ...(activeFilters.classId !== "all" && { class_id: activeFilters.classId }),
      ...(dateFrom && dateTo ? { date_from: dateFrom, date_to: dateTo } : {}),
    }),
    [activeFilters.classId, dateFrom, dateTo]
  );

  // Check lock và plan feature trước để tránh gọi API không cần thiết
  const shouldFetchData = !actionsLocked && !planFeatureMessage && !!studentId && studentId !== '0';

  // Fetch all classes for dropdown (no pagination, no filters)
  const { data: allClassesData } = useStudentClasses(
    shouldFetchData ? studentId : '0',
    { per_page: 1000 }, // Get all classes for dropdown
    { enabled: shouldFetchData }
  );

  // Extract classes array from response
  const allClasses = useMemo(() => {
    if (!allClassesData) return [];
    if (Array.isArray(allClassesData)) return allClassesData;
    if (allClassesData?.data && Array.isArray(allClassesData.data)) return allClassesData.data;
    return [];
  }, [allClassesData]);

  // Fetch data for all tabs with pagination - only when not locked
  const { classes, loading: classesLoading, statistics: classesStatistics } = useStudentClasses(
    shouldFetchData ? studentId : '0',
    classesOptions,
    { enabled: shouldFetchData }
  );
  const { assignments, loading: assignmentsLoading, statistics: assignmentsStatistics } = useStudentAssignments(
    shouldFetchData ? studentId : '0',
    assignmentsOptions,
    { enabled: shouldFetchData }
  );
  const { attendance, loading: attendanceLoading, statistics: attendanceStatistics } = useStudentAttendance(
    shouldFetchData ? studentId : '0',
    attendanceOptions,
    { enabled: shouldFetchData }
  );
  const { grades, loading: gradesLoading, statistics: gradesStatistics } = useStudentGrades(
    shouldFetchData ? studentId : '0',
    gradesOptions,
    { enabled: shouldFetchData }
  );
  const { loading: statisticsLoading } = useStudentStatistics(
    shouldFetchData ? studentId : '0',
    statisticsFilters,
    { enabled: shouldFetchData }
  );

  // Reset pagination when switching tabs
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setClassesPage(1);
    setAssignmentsPage(1);
    setAttendancePage(1);
    setGradesPage(1);
  };

  // Only show full page loading for initial studentId loading, not for statistics loading (filter changes)
  const initialLoading = studentIdLoading;

  // Block access if not student
  if (isBlocked) {
    return null;
  }

  // Kiểm tra lock trước để ưu tiên hiển thị lock content
  if (actionsLocked || planFeatureMessage) {
    return (
      <ProtectedRoute>
        {renderError()}
      </ProtectedRoute>
    );
  }

  const tabs = [
    { id: "overview", label: "Tổng quan", icon: ChartBarIcon },
    { id: "classes", label: "Lớp học", icon: UserGroupIcon },
    { id: "assignments", label: "Bài tập", icon: DocumentTextIcon },
    { id: "attendance", label: "Điểm danh", icon: CalendarIcon },
    { id: "grades", label: "Điểm số", icon: AcademicCapIcon },
  ];

  // Only show full page skeleton for initial load (studentId loading), not for filter changes
  if (initialLoading) {
    return (
      <ProtectedRoute>
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="h-8 w-60 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-4 w-72 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>

          <div className="flex gap-3 overflow-x-auto">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={`tab-skeleton-${index}`}
                className="h-10 w-32 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"
              />
            ))}
          </div>

          <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
            <div className="space-y-4 animate-pulse">
              <div className="h-6 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`metric-skeleton-${index}`}
                    className="h-28 rounded-lg bg-gray-100 dark:bg-gray-700/50"
                  />
                ))}
              </div>
              <div className="h-64 w-full rounded-lg bg-gray-100 dark:bg-gray-700/50" />
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!studentId) {
    return (
      <ProtectedRoute>
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-6 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
          Không tìm thấy thông tin học viên
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6 overflow-visible">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tiến độ học tập</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Theo dõi tiến độ và kết quả học tập của bạn
            </p>
          </div>

          {/* Filters toggle + actions (desktop nằm cùng hàng title) */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${showFilters || hasActiveFilters
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
                    activeFilters.statusClasses !== "all",
                    activeFilters.statusAssignments !== "all",
                    activeFilters.classId !== "all",
                  ].filter(Boolean).length}
                </span>
              )}
            </button>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Khôi phục
              </button>
            )}
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
                aria-label="Đóng bộ lọc"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Date Range */}
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

              {/* Class filter (cho assignments/attendance/grades) */}
              {(activeTab === "assignments" || activeTab === "attendance" || activeTab === "grades") && (
                <SelectInput
                  label="Lớp học"
                  name="classId"
                  value={tempFilters.classId}
                  onChange={(e) => setTempFilters({ ...tempFilters, classId: e.target.value })}
                  options={[
                    { label: "Tất cả", value: "all" },
                    ...allClasses.map((cls: any) => ({
                      label: cls.name || `Lớp ${getObjId(cls)}`,
                      value: getObjId(cls),
                    })),
                  ]}
                  placeholder="Chọn lớp học"
                  disabled={classesLoading}
                />
              )}

              {/* Class status (classes tab) */}
              {activeTab === "classes" && (
                <SelectInput
                  label="Trạng thái lớp"
                  name="statusClasses"
                  value={tempFilters.statusClasses}
                  onChange={(e) => setTempFilters({ ...tempFilters, statusClasses: e.target.value })}
                  options={[
                    { label: "Tất cả", value: "all" },
                    { label: "Đang dạy", value: "active" },
                    { label: "Tạm dừng", value: "inactive" },
                    { label: "Đã hoàn thành", value: "completed" },
                  ]}
                  placeholder="Chọn trạng thái"
                />
              )}

              {/* Assignment status (assignments tab) */}
              {activeTab === "assignments" && (
                <SelectInput
                  label="Trạng thái bài tập"
                  name="statusAssignments"
                  value={tempFilters.statusAssignments}
                  onChange={(e) => setTempFilters({ ...tempFilters, statusAssignments: e.target.value })}
                  options={[
                    { label: "Tất cả", value: "all" },
                    { label: "Đang giao", value: "published" },
                    { label: "Sắp giao", value: "draft" },
                    { label: "Đã kết thúc", value: "closed" },
                  ]}
                  placeholder="Chọn trạng thái"
                />
              )}
            </div>

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
        <Tabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />

        {/* Tab Content */}
        <TabPanel activeTab={activeTab} tabId="overview">
          <OverviewTab
            classesStatistics={classesStatistics}
            assignmentsStatistics={assignmentsStatistics}
            attendanceStatistics={attendanceStatistics}
            gradesStatistics={gradesStatistics}
            loading={statisticsLoading || classesLoading || assignmentsLoading || attendanceLoading || gradesLoading}
          />
        </TabPanel>

        <TabPanel activeTab={activeTab} tabId="classes">
          <ClassesTab
            classes={classes}
            loading={classesLoading}
            statistics={classesStatistics}
          />
        </TabPanel>

        <TabPanel activeTab={activeTab} tabId="assignments">
          <AssignmentsTab
            assignments={assignments}
            loading={assignmentsLoading}
            statistics={assignmentsStatistics}
          />
        </TabPanel>

        <TabPanel activeTab={activeTab} tabId="attendance">
          <AttendanceTab
            attendance={attendance}
            loading={attendanceLoading}
            statistics={attendanceStatistics}
          />
        </TabPanel>

        <TabPanel activeTab={activeTab} tabId="grades">
          <GradesTab
            grades={grades}
            loading={gradesLoading}
            statistics={gradesStatistics}
          />
        </TabPanel>
      </div>
    </ProtectedRoute>
  );
}

// Overview Tab Component
function OverviewTab({
  classesStatistics,
  assignmentsStatistics,
  attendanceStatistics,
  gradesStatistics,
  loading = false
}: any) {
  const theme = useThemeColors();
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  // Helper để đọc CSS variable thành HEX color (cho ApexCharts)
  const getCSSColor = (varName: string, fallback: string) => {
    if (typeof window === 'undefined') return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return value || fallback;
  };

  // Đọc màu từ CSS variables để đảm bảo luôn khớp với theme
  const primaryColor = useMemo(() => {
    const cssColor = getCSSColor('--color-primary', theme.primary);
    return cssColor || theme.primary;
  }, [theme.primary]);

  const primaryLightColor = useMemo(() => {
    const cssColor = getCSSColor('--color-primary-light', theme.primaryLight);
    return cssColor || theme.primaryLight;
  }, [theme.primaryLight]);

  const primaryDarkColor = useMemo(() => {
    const cssColor = getCSSColor('--color-primary-dark', theme.primaryDark);
    return cssColor || theme.primaryDark;
  }, [theme.primaryDark]);

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        {loading ? (
          <>
            {Array.from({ length: 4 }).map((_, index) => (
              <CardSkeleton key={index} showAvatar={true} lines={1} />
            ))}
          </>
        ) : (
          <>
            <div className="relative rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
              <div className="absolute top-2 right-2 z-10">
                <Tooltip label="Xem danh sách lớp học">
                  <Link
                    href="/classes"
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
                <div className="ml-4 flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Lớp học</p>
                  <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                    {classesStatistics?.total_count || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="relative rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
              <div className="absolute top-2 right-2">
                <Tooltip label="Xem bài tập cần làm">
                  <Link
                    href="/assignments"
                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <ArrowRightIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  </Link>
                </Tooltip>
              </div>
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 dark:bg-primary/20 rounded-lg">
                  <DocumentTextIcon className="h-6 w-6 text-primary-600 dark:text-primary-300" />
                </div>
                <div className="ml-4 flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Bài tập</p>
                  <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                    {assignmentsStatistics?.total_count || 0}
                  </p>
                </div>
              </div>
              {assignmentsStatistics?.pending_submissions_count > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 block sm:hidden">
                  {assignmentsStatistics.pending_submissions_count} chưa nộp
                </p>
              )}
              {assignmentsStatistics?.pending_submissions_count > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 hidden sm:block">
                  {assignmentsStatistics.pending_submissions_count} chưa nộp
                </p>
              )}
            </div>

            <div className="relative rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
              <div className="absolute top-2 right-2">
                <Tooltip label="Xem lịch sử điểm danh">
                  <Link
                    href="/attendance"
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
                <div className="ml-4 flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tỷ lệ điểm danh</p>
                  <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                    {formatPercentage(attendanceStatistics?.attendance_rate)}
                  </p>
                </div>
              </div>
              {attendanceStatistics?.total_records > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 block sm:hidden">
                  {attendanceStatistics.present_count || 0} / {attendanceStatistics.total_records}
                </p>
              )}
              {attendanceStatistics?.total_records > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 hidden sm:block">
                  {attendanceStatistics.present_count || 0} / {attendanceStatistics.total_records}
                </p>
              )}
            </div>

            <div className="relative rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
              <div className="absolute top-2 right-2">
                <Tooltip label="Xem kết quả học tập">
                  <Link
                    href="/grades"
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
                <div className="ml-4 flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Điểm trung bình</p>
                  <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                    {formatAverageGrade(gradesStatistics?.average_score)}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Attendance Chart */}
        {loading ? (
          <ChartSkeleton height={300} showTitle={true} title="Tỷ lệ điểm danh" />
        ) : attendanceStatistics ? (
          <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Tỷ lệ điểm danh</h3>
            <Chart
              options={{
                chart: { type: 'donut' },
                labels: ['Có mặt', 'Vắng mặt', 'Muộn', 'Có phép'],
                colors: [primaryColor, primaryColor, primaryLightColor, '#6b7280'],
                legend: { position: 'bottom', labels: { colors: primaryDarkColor } },
                dataLabels: {
                  enabled: false,
                },
                tooltip: {
                  theme: isDarkMode ? 'dark' : 'light',
                  y: {
                    formatter: function (val: number, opts: any) {
                      try {
                        if (!opts || !opts.w || !opts.w.globals) {
                          return `${val}`;
                        }
                        const globals = opts.w.globals;
                        const seriesTotals = globals.seriesTotals || [];
                        const total = seriesTotals.reduce((a: number, b: number) => a + b, 0);
                        const percentage = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
                        const labels = globals.labels || [];
                        const label = labels[opts.seriesIndex] || 'N/A';
                        return `${label}: ${val} (${percentage}%)`;
                      } catch {
                        return `${val}`;
                      }
                    }
                  }
                },
              }}
              series={[
                attendanceStatistics.present_count || 0,
                attendanceStatistics.absent_count || 0,
                attendanceStatistics.late_count || 0,
                attendanceStatistics.excused_count || 0,
              ]}
              type="donut"
              height={300}
            />
          </div>
        ) : null}

        {/* Grades Distribution Chart */}
        {loading ? (
          <ChartSkeleton height={300} showTitle={true} title="Phân bố điểm số" />
        ) : gradesStatistics && gradesStatistics.grade_distribution ? (
          <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Phân bố điểm số</h3>
            <Chart
              options={{
                chart: { type: 'bar', toolbar: { show: false } },
                xaxis: { categories: ['A', 'B', 'C', 'D', 'F'] },
                colors: [primaryColor],
                dataLabels: { enabled: true },
                plotOptions: { bar: { borderRadius: 4 } },
              }}
              series={[{
                name: 'Số bài',
                data: [
                  gradesStatistics.grade_distribution.A || 0,
                  gradesStatistics.grade_distribution.B || 0,
                  gradesStatistics.grade_distribution.C || 0,
                  gradesStatistics.grade_distribution.D || 0,
                  gradesStatistics.grade_distribution.F || 0,
                ],
              }]}
              type="bar"
              height={300}
            />
          </div>
        ) : null}

        {/* Assignments Status Chart */}
        {loading ? (
          <ChartSkeleton height={300} showTitle={true} title="Trạng thái bài tập" />
        ) : assignmentsStatistics ? (
          <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Trạng thái bài tập</h3>
            <Chart
              options={{
                chart: { type: 'donut' },
                labels: ['Đã nộp', 'Chưa nộp'],
                colors: [primaryColor, primaryLightColor],
                legend: { position: 'bottom', labels: { colors: primaryDarkColor } },
                dataLabels: {
                  enabled: false,
                },
                tooltip: {
                  theme: isDarkMode ? 'dark' : 'light',
                  y: {
                    formatter: function (val: number, opts: any) {
                      try {
                        if (!opts || !opts.w || !opts.w.globals) {
                          return `${val}`;
                        }
                        const globals = opts.w.globals;
                        const seriesTotals = globals.seriesTotals || [];
                        const total = seriesTotals.reduce((a: number, b: number) => a + b, 0);
                        const percentage = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
                        const labels = globals.labels || [];
                        const label = labels[opts.seriesIndex] || 'N/A';
                        return `${label}: ${val} (${percentage}%)`;
                      } catch {
                        return `${val}`;
                      }
                    }
                  }
                },
              }}
              series={[
                (assignmentsStatistics.total_count || 0) - (assignmentsStatistics.pending_submissions_count || 0),
                assignmentsStatistics.pending_submissions_count || 0,
              ]}
              type="donut"
              height={300}
            />
          </div>
        ) : null}

        {/* Performance Summary */}
        {loading ? (
          <ChartSkeleton height={300} showTitle={true} title="Tóm tắt hiệu suất" />
        ) : (
          <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Tóm tắt hiệu suất</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Trung bình</span>
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatAverageGrade(gradesStatistics?.average_score)} / 10
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Tỷ lệ điểm danh</span>
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatPercentage(attendanceStatistics?.attendance_rate)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Tỷ lệ nộp bài</span>
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  {assignmentsStatistics?.total_count
                    ? formatPercentage(((assignmentsStatistics.total_count - (assignmentsStatistics.pending_submissions_count || 0)) / assignmentsStatistics.total_count) * 100)
                    : '0%'}
                </span>
              </div>
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tổng số lớp học</span>
                  <span className="text-lg font-bold text-primary">
                    {classesStatistics?.total_count || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Classes Tab Component
function ClassesTab({ classes, loading, meta, currentPage, onPageChange }: any) {
  const theme = useThemeColors();
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  // Helper để đọc CSS variable thành HEX color (cho ApexCharts)
  const getCSSColor = (varName: string, fallback: string) => {
    if (typeof window === 'undefined') return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return value || fallback;
  };

  // Đọc màu từ CSS variables để đảm bảo luôn khớp với theme
  const primaryColor = useMemo(() => {
    const cssColor = getCSSColor('--color-primary', theme.primary);
    return cssColor || theme.primary;
  }, [theme.primary]);

  const primaryLightColor = useMemo(() => {
    const cssColor = getCSSColor('--color-primary-light', theme.primaryLight);
    return cssColor || theme.primaryLight;
  }, [theme.primaryLight]);

  const primaryDarkColor = useMemo(() => {
    const cssColor = getCSSColor('--color-primary-dark', theme.primaryDark);
    return cssColor || theme.primaryDark;
  }, [theme.primaryDark]);

  if (loading) {
    return (
      <div className="space-y-6">
        <ChartSkeleton height={300} showTitle={true} title="Phân bố lớp học theo môn" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-32 rounded-lg bg-gray-100 dark:bg-gray-700/50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!classes || classes.length === 0) {
    return (
      <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Lớp học
        </h3>
        <div className="h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-center">
            <UserGroupIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Không có dữ liệu để hiển thị biểu đồ lớp học</p>
          </div>
        </div>
      </div>
    );
  }

  // Group by subject for pie chart
  const subjectCount = classes.reduce((acc: any, classItem: any) => {
    const subjectName = classItem.subject?.name || 'Chưa phân loại';
    acc[subjectName] = (acc[subjectName] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Chart Section */}
      {Object.keys(subjectCount).length > 0 && (
        <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Phân bố lớp học theo môn</h3>
          <Chart
            options={{
              chart: { type: 'donut' },
              labels: Object.keys(subjectCount),
              colors: [primaryColor, primaryColor, primaryLightColor, primaryColor, primaryLightColor, primaryLightColor],
              legend: { position: 'bottom', labels: { colors: primaryDarkColor } },
              dataLabels: {
                enabled: false,
              },
              tooltip: {
                theme: isDarkMode ? 'dark' : 'light',
                y: {
                  formatter: (val: number, opts: any) => {
                    try {
                      if (!opts || !opts.w || !opts.w.globals) {
                        return `${val}`;
                      }
                      const globals = opts.w.globals;
                      const seriesTotals = globals.seriesTotals || [];
                      const total = seriesTotals.reduce((a: number, b: number) => a + b, 0);
                      const percentage = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
                      const labels = globals.labels || [];
                      const label = labels[opts.seriesIndex] || 'N/A';
                      return `${label}: ${val} (${percentage}%)`;
                    } catch {
                      return `${val}`;
                    }
                  }
                }
              },
            }}
            series={Object.values(subjectCount) as number[]}
            type="donut"
            height={300}
          />
        </div>
      )}

      {/* Classes Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
        {classes.map((classItem: any) => (
          <div key={getObjId(classItem)} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white">{classItem.name}</h3>
            {classItem.subject && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Môn: {classItem.subject.name}
              </p>
            )}
            {(classItem.tutor || classItem.tutor) && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Giáo viên: {(classItem.tutor || classItem.tutor)?.name}
              </p>
            )}
            {classItem.enrollment && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Tham gia: {new Date(classItem.enrollment.enrolled_at).toLocaleDateString('vi-VN')}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {meta && (
        <div className="mt-6">
          <Pagination
            meta={meta}
            currentPage={currentPage}
            onPageChange={onPageChange}
            itemLabel="lớp học"
          />
        </div>
      )}
    </div>
  );
}

// Assignments Tab Component
function AssignmentsTab({ assignments, loading, meta, currentPage, onPageChange }: any) {
  const theme = useThemeColors();
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  // Helper để đọc CSS variable thành HEX color (cho ApexCharts)
  const getCSSColor = (varName: string, fallback: string) => {
    if (typeof window === 'undefined') return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return value || fallback;
  };

  // Đọc màu từ CSS variables để đảm bảo luôn khớp với theme
  const primaryColor = useMemo(() => {
    const cssColor = getCSSColor('--color-primary', theme.primary);
    return cssColor || theme.primary;
  }, [theme.primary]);

  const primaryLightColor = useMemo(() => {
    const cssColor = getCSSColor('--color-primary-light', theme.primaryLight);
    return cssColor || theme.primaryLight;
  }, [theme.primaryLight]);

  const primaryDarkColor = useMemo(() => {
    const cssColor = getCSSColor('--color-primary-dark', theme.primaryDark);
    return cssColor || theme.primaryDark;
  }, [theme.primaryDark]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartSkeleton height={280} showTitle={true} title="Phân bố trạng thái" />
          <ChartSkeleton height={280} showTitle={true} title="Bài tập theo lớp học" />
        </div>
        <ListSkeleton count={5} />
      </div>
    );
  }

  if (!assignments || assignments.length === 0) {
    return (
      <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Bài tập
        </h3>
        <div className="h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-center">
            <ChartBarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Không có dữ liệu để hiển thị biểu đồ bài tập</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate statistics for charts
  const submittedCount = assignments.filter((a: any) => a.my_submission).length;
  const notSubmittedCount = assignments.length - submittedCount;

  // Group by class for bar chart
  const classStats = assignments.reduce((acc: any, assignment: any) => {
    const className = assignment.class?.name || 'Chưa phân loại';
    if (!acc[className]) {
      acc[className] = { total: 0, submitted: 0, graded: 0 };
    }
    acc[className].total++;
    if (assignment.my_submission) acc[className].submitted++;
    if (assignment.my_submission?.score !== null && assignment.my_submission?.score !== undefined) {
      acc[className].graded++;
    }
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Status Distribution Pie Chart */}
        <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Phân bố trạng thái</h3>
          <Chart
            options={{
              chart: { type: 'donut' },
              labels: ['Đã nộp', 'Chưa nộp'],
              colors: [primaryColor, primaryLightColor],
              legend: { position: 'bottom', labels: { colors: primaryDarkColor } },
              dataLabels: {
                enabled: false,
              },
              tooltip: {
                theme: isDarkMode ? 'dark' : 'light',
                y: {
                  formatter: (val: number, opts: any) => {
                    try {
                      if (!opts || !opts.w || !opts.w.globals) {
                        return `${val}`;
                      }
                      const globals = opts.w.globals;
                      const seriesTotals = globals.seriesTotals || [];
                      const total = seriesTotals.reduce((a: number, b: number) => a + b, 0);
                      const percentage = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
                      const labels = globals.labels || [];
                      const label = labels[opts.seriesIndex] || 'N/A';
                      return `${label}: ${val} (${percentage}%)`;
                    } catch {
                      return `${val}`;
                    }
                  }
                }
              },
            }}
            series={[submittedCount, notSubmittedCount]}
            type="donut"
            height={280}
          />
        </div>

        {/* Assignments by Class Bar Chart */}
        <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Bài tập theo lớp học</h3>
          <Chart
            options={{
              chart: { type: 'bar', toolbar: { show: false } },
              xaxis: { categories: Object.keys(classStats) },
              colors: [primaryColor, primaryColor],
              dataLabels: { enabled: true },
              plotOptions: { bar: { borderRadius: 4, horizontal: false } },
              legend: { position: 'top', labels: { colors: primaryDarkColor } },
            }}
            series={[
              { name: 'Tổng số', data: Object.values(classStats).map((s: any) => s.total) },
              { name: 'Đã nộp', data: Object.values(classStats).map((s: any) => s.submitted) },
            ]}
            type="bar"
            height={280}
          />
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-x-auto rounded-lg bg-white dark:bg-gray-800">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Bài tập
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Lớp học
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Hạn nộp
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Trạng thái
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Điểm
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
            {assignments.map((assignment: any) => (
              <tr key={getObjId(assignment)} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-gray-900 dark:text-white">
                  {assignment.title}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                  {assignment.class?.name || 'N/A'}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                  {assignment.due_date
                    ? new Date(assignment.due_date).toLocaleDateString('vi-VN')
                    : 'N/A'}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm">
                  {assignment.my_submission ? (
                    <span className="inline-flex items-center rounded-full bg-[var(--status-badge-completed)] text-[var(--status-badge-completed-text)] px-2.5 py-0.5 text-xs font-medium">
                      Đã nộp
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)] px-2.5 py-0.5 text-xs font-medium">
                      Chưa nộp
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-gray-900 dark:text-white">
                  {formatScore(assignment.my_submission?.score, assignment.max_score)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && (
        <div className="mt-6">
          <Pagination
            meta={meta}
            currentPage={currentPage}
            onPageChange={onPageChange}
            itemLabel="bài tập"
          />
        </div>
      )}
    </div>
  );
}

// Attendance Tab Component
function AttendanceTab({ attendance, loading, statistics, meta, currentPage, onPageChange }: any) {
  const theme = useThemeColors();
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  // Helper để đọc CSS variable thành HEX color (cho ApexCharts)
  const getCSSColor = (varName: string, fallback: string) => {
    if (typeof window === 'undefined') return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return value || fallback;
  };

  // Đọc màu từ CSS variables để đảm bảo luôn khớp với theme
  const primaryColor = useMemo(() => {
    const cssColor = getCSSColor('--color-primary', theme.primary);
    return cssColor || theme.primary;
  }, [theme.primary]);

  const primaryLightColor = useMemo(() => {
    const cssColor = getCSSColor('--color-primary-light', theme.primaryLight);
    return cssColor || theme.primaryLight;
  }, [theme.primaryLight]);

  const primaryDarkColor = useMemo(() => {
    const cssColor = getCSSColor('--color-primary-dark', theme.primaryDark);
    return cssColor || theme.primaryDark;
  }, [theme.primaryDark]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartSkeleton height={280} showTitle={true} title="Tỷ lệ điểm danh" />
          <ChartSkeleton height={280} showTitle={true} title="Xu hướng điểm danh theo tháng" />
        </div>
        <ListSkeleton count={5} />
      </div>
    );
  }

  if (!attendance || attendance.length === 0) {
    return (
      <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Điểm danh
        </h3>
        <div className="h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-center">
            <ChartBarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Không có dữ liệu để hiển thị biểu đồ</p>
          </div>
        </div>
      </div>
    );
  }

  // Helper functions for date/time formatting
  const formatDate = (dateValue: any) => {
    if (!dateValue) return 'N/A';
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString('vi-VN');
    } catch {
      return 'N/A';
    }
  };

  const formatTime = (timeValue: any) => {
    if (!timeValue) return '-';
    try {
      const date = new Date(timeValue);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '-';
    }
  };

  // Calculate attendance by month for line chart
  const monthlyData = attendance.reduce((acc: any, record: any) => {
    if (!record.date) return acc;
    try {
      const date = new Date(record.date);
      if (isNaN(date.getTime())) return acc;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!acc[monthKey]) {
        acc[monthKey] = { present: 0, absent: 0, late: 0, excused: 0 };
      }
      if (record.status === 'present') acc[monthKey].present++;
      else if (record.status === 'absent') acc[monthKey].absent++;
      else if (record.status === 'late') acc[monthKey].late++;
      else acc[monthKey].excused++;
      return acc;
    } catch {
      return acc;
    }
  }, {});

  const sortedMonths = Object.keys(monthlyData).sort();
  const monthlyPresent = sortedMonths.map(m => monthlyData[m].present);
  const monthlyAbsent = sortedMonths.map(m => monthlyData[m].absent);

  return (
    <div className="space-y-6">
      {/* Charts Section */}
      {statistics && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Attendance Rate Donut Chart */}
          <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Tỷ lệ điểm danh</h3>
            <Chart
              options={{
                chart: { type: 'donut' },
                labels: ['Có mặt', 'Vắng mặt', 'Muộn', 'Có phép'],
                colors: [primaryColor, primaryColor, primaryLightColor, primaryDarkColor],
                legend: { position: 'bottom', labels: { colors: primaryDarkColor } },
                dataLabels: {
                  enabled: false,
                },
                tooltip: {
                  theme: isDarkMode ? 'dark' : 'light',
                  y: {
                    formatter: function (val: number, opts: any) {
                      try {
                        if (!opts || !opts.w || !opts.w.globals) {
                          return `${val}`;
                        }
                        const globals = opts.w.globals;
                        const seriesTotals = globals.seriesTotals || [];
                        const total = seriesTotals.reduce((a: number, b: number) => a + b, 0);
                        const percentage = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
                        const labels = globals.labels || [];
                        const label = labels[opts.seriesIndex] || 'N/A';
                        return `${label}: ${val} (${percentage}%)`;
                      } catch {
                        return `${val}`;
                      }
                    }
                  }
                },
                xaxis: {
                  labels: {
                    style: {
                      colors: isDarkMode ? '#9CA3AF' : '#6B7280',
                    },
                  },
                },
                yaxis: {
                  labels: {
                    style: {
                      colors: isDarkMode ? '#9CA3AF' : '#6B7280',
                    },
                  },
                },
              }}
              series={[
                statistics.present_count || 0,
                statistics.absent_count || 0,
                statistics.late_count || 0,
                statistics.excused_count || 0,
              ]}
              type="donut"
              height={280}
            />
          </div>

          {/* Monthly Trend Line Chart */}
          {sortedMonths.length > 0 && (
            <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Xu hướng điểm danh theo tháng</h3>
              <Chart
                options={{
                  chart: { type: 'line', toolbar: { show: false } },
                  xaxis: {
                    categories: sortedMonths.map(m => {
                      const [year, month] = m.split('-');
                      return `Tháng ${month}/${year}`;
                    })
                  },
                  colors: [primaryColor, primaryColor],
                  stroke: { curve: 'smooth', width: 3 },
                  markers: { size: 5 },
                  legend: { position: 'top', labels: { colors: primaryDarkColor } },
                }}
                series={[
                  { name: 'Có mặt', data: monthlyPresent },
                  { name: 'Vắng mặt', data: monthlyAbsent },
                ]}
                type="line"
                height={280}
              />
            </div>
          )}
        </div>
      )}

      {/* Table Section */}
      <div className="overflow-x-auto rounded-lg bg-white dark:bg-gray-800">
        <table className="w-full min-w-[800px]">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Ngày
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Lớp học
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Trạng thái
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Giờ vào
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
            {attendance.map((record: any) => (
              <tr key={getObjId(record)} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-900 dark:text-white">
                  {formatDate(record.date)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                  {record.class?.name || 'N/A'}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${record.status === 'present'
                      ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                      : record.status === 'absent'
                        ? 'bg-[var(--status-badge-error)] text-[var(--status-badge-error-text)]'
                        : record.status === 'late'
                          ? 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]'
                          : record.status === 'excused'
                            ? 'bg-[var(--status-badge-completed)] text-[var(--status-badge-completed-text)]'
                            : 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]'
                      }`}
                  >
                    {record.status === 'present' ? 'Có mặt' :
                      record.status === 'absent' ? 'Vắng mặt' :
                        record.status === 'late' ? 'Muộn' :
                          record.status === 'excused' ? 'Có phép' : 'N/A'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                  {formatTime(record.check_in_time)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && (
        <div className="mt-6">
          <Pagination
            meta={meta}
            currentPage={currentPage}
            onPageChange={onPageChange}
            itemLabel="bản ghi điểm danh"
          />
        </div>
      )}
    </div>
  );
}

// Grades Tab Component
function GradesTab({ grades, loading, statistics, meta, currentPage, onPageChange }: any) {
  const theme = useThemeColors();
  const [_isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  // Helper để đọc CSS variable thành HEX color (cho ApexCharts)
  const getCSSColor = (varName: string, fallback: string) => {
    if (typeof window === 'undefined') return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return value || fallback;
  };

  // Đọc màu từ CSS variables để đảm bảo luôn khớp với theme
  const primaryColor = useMemo(() => {
    const cssColor = getCSSColor('--color-primary', theme.primary);
    return cssColor || theme.primary;
  }, [theme.primary]);

  const _primaryLightColor = useMemo(() => {
    const cssColor = getCSSColor('--color-primary-light', theme.primaryLight);
    return cssColor || theme.primaryLight;
  }, [theme.primaryLight]);

  const _primaryDarkColor = useMemo(() => {
    const cssColor = getCSSColor('--color-primary-dark', theme.primaryDark);
    return cssColor || theme.primaryDark;
  }, [theme.primaryDark]);

  if (loading) {
    return (
      <div className="space-y-6">
        <ChartSkeleton height={280} showTitle={true} title="Phân bố điểm số" />
        <ChartSkeleton height={280} showTitle={true} title="Điểm trung bình theo lớp" />
        <ListSkeleton count={5} />
      </div>
    );
  }

  if (!grades || grades.length === 0) {
    return (
      <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Điểm số
        </h3>
        <div className="h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-center">
            <ChartBarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Không có dữ liệu để hiển thị biểu đồ điểm số</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate grade distribution
  const gradeDistribution = grades.reduce((acc: any, grade: any) => {
    if (grade.score === null || grade.score === undefined || !grade.max_score) return acc;
    const percentage = (grade.score / grade.max_score) * 100;
    let letterGrade = 'F';
    if (percentage >= 90) letterGrade = 'A';
    else if (percentage >= 80) letterGrade = 'B';
    else if (percentage >= 70) letterGrade = 'C';
    else if (percentage >= 60) letterGrade = 'D';

    acc[letterGrade] = (acc[letterGrade] || 0) + 1;
    return acc;
  }, { A: 0, B: 0, C: 0, D: 0, F: 0 });

  // Calculate scores by class
  const classScores = grades.reduce((acc: any, grade: any) => {
    const className = grade.class?.name || 'Chưa phân loại';
    if (!acc[className]) {
      acc[className] = { scores: [], count: 0 };
    }
    if (grade.score !== null && grade.score !== undefined && grade.max_score) {
      const percentage = (grade.score / grade.max_score) * 100;
      acc[className].scores.push(percentage);
      acc[className].count++;
    }
    return acc;
  }, {});

  // Calculate average by class
  const classAverages = Object.keys(classScores).map(className => {
    const scores = classScores[className].scores;
    const avg = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;
    return { className, average: avg };
  });

  return (
    <div className="space-y-6">
      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Grade Distribution Bar Chart */}
        {statistics?.grade_distribution && (
          <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Phân bố điểm số</h3>
            <Chart
              options={{
                chart: { type: 'bar', toolbar: { show: false } },
                xaxis: { categories: ['A', 'B', 'C', 'D', 'F'] },
                colors: [primaryColor],
                dataLabels: { enabled: true },
                plotOptions: { bar: { borderRadius: 4 } },
              }}
              series={[{
                name: 'Số bài',
                data: [
                  statistics.grade_distribution.A || gradeDistribution.A || 0,
                  statistics.grade_distribution.B || gradeDistribution.B || 0,
                  statistics.grade_distribution.C || gradeDistribution.C || 0,
                  statistics.grade_distribution.D || gradeDistribution.D || 0,
                  statistics.grade_distribution.F || gradeDistribution.F || 0,
                ],
              }]}
              type="bar"
              height={280}
            />
          </div>
        )}
      </div>

      {/* Average Score by Class Bar Chart - Full Width */}
      {classAverages.length > 0 && (
        <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Điểm trung bình theo lớp</h3>
          <Chart
            options={{
              chart: { type: 'bar', toolbar: { show: false } },
              xaxis: { categories: classAverages.map(c => c.className) },
              colors: [primaryColor],
              dataLabels: {
                enabled: true,
                formatter: (val: number) => `${val.toFixed(1)}%`,
                style: {
                  fontSize: '12px',
                  fontWeight: 600,
                  colors: ['#ffffff'],
                },
              },
              plotOptions: { bar: { borderRadius: 4, horizontal: false } },
              yaxis: {
                max: 100,
                title: { text: 'Điểm (%)' },
                labels: {
                  formatter: (val: number) => `${val.toFixed(0)}%`
                }
              },
              tooltip: {
                y: {
                  formatter: (val: number) => `Điểm TB: ${val.toFixed(1)}%`
                }
              },
            }}
            series={[{
              name: 'Điểm TB',
              data: classAverages.map(c => c.average),
            }]}
            type="bar"
            height={280}
          />
        </div>
      )}

      {/* Table Section */}
      <div className="overflow-x-auto rounded-lg bg-white dark:bg-gray-800">
        <table className="w-full min-w-[800px]">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Bài tập
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Lớp học
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Điểm
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Loại điểm
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Ngày chấm
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
            {grades.map((grade: any) => (
              <tr key={getObjId(grade)} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-gray-900 dark:text-white">
                  {grade.assignment?.title || grade.title || grade.assignment_title || 'N/A'}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                  {grade.class?.name || 'N/A'}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-gray-900 dark:text-white">
                  {formatScore(grade.score, grade.max_score)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                  {grade.grade_type?.name || 'N/A'}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                  {grade.graded_at
                    ? new Date(grade.graded_at).toLocaleDateString('vi-VN')
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && (
        <div className="mt-6">
          <Pagination
            meta={meta}
            currentPage={currentPage}
            onPageChange={onPageChange}
            itemLabel="bài tập đã chấm"
          />
        </div>
      )}
    </div>
  );
}

