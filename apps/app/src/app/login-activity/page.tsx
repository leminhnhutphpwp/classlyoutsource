"use client";

import { useEffect, useMemo } from "react";
import { useAuthorization } from "@/lib/authz";
import { useLoginHistory, useAllStudentsLoginHistory, useStudentLoginHistory, useStudents } from "@/hooks/use-api";
import DateInput from "@/components/FormElements/DateInput";
import SelectInput from "@/components/FormElements/SelectInput";
import Pagination from "@/components/Common/Pagination";
import { useListPage } from "@/hooks/use-list-page";
import { LOGIN_STATUS_OPTIONS } from "@/constants/login-history";
import { LoginHistoryList } from "@/components/LoginHistory/LoginHistoryList";
import { useLockContext } from "@/contexts/lock-context";
import { useTutorGuard } from "@/hooks/use-role-guard";
import { getObjId } from "@/lib/id-utils";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";

export default function LoginActivityPage() {
  const { isBlocked } = useTutorGuard(); // Block students from accessing this page
  const { can, hasRole } = useAuthorization();
  const isStudentUser = hasRole("student");
  const canViewOwn = can("view", "login_activity");
  const canViewStudents = can("view", "student_login_activity");
  const canView = isStudentUser ? canViewOwn : canViewStudents;
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const { renderError } = useErrorDisplay("Nhật ký truy cập");

  // Use combined hook for pagination and filters (synchronized with URL)
  const {
    currentPage,
    setCurrentPage,
    filters: urlFilters,
    updateFilter,
    resetFilters,
    apiFilters,
  } = useListPage({
    defaultPage: 1,
    defaultPerPage: 10,
    filterKeys: ["status", "from_date", "to_date", "student_id"],
    filterDefaults: {
      status: "all",
      from_date: "",
      to_date: "",
      student_id: "all",
    },
  });

  // Extract individual filters for easier access
  const statusFilter = urlFilters.status || "all";
  const fromDate = urlFilters.from_date || "";
  const toDate = urlFilters.to_date || "";
  const selectedStudentId = urlFilters.student_id || "all";

  // Remove student_id from API filters (handled via endpoint selection)
  const loginHistoryFilters = useMemo(() => {
    const { student_id: _studentId, ...rest } = apiFilters;
    return rest;
  }, [apiFilters]);

  const studentsQuery = useStudents();
  const studentsList = Array.isArray(studentsQuery.data?.data)
    ? studentsQuery.data.data
    : Array.isArray(studentsQuery.data)
      ? studentsQuery.data
      : [];

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  const studentOwnHistoryQuery = useLoginHistory(loginHistoryFilters, {
    enabled: isStudentUser && !actionsLocked,
  });

  const allStudentsHistoryQuery = useAllStudentsLoginHistory(loginHistoryFilters, {
    enabled: !isStudentUser && canView && selectedStudentId === "all" && !actionsLocked,
  });

  const studentHistoryQuery = useStudentLoginHistory(
    selectedStudentId === "all" ? "" : selectedStudentId,
    loginHistoryFilters,
    {
      enabled: !isStudentUser && canView && selectedStudentId !== "all" && !!selectedStudentId && !actionsLocked,
    }
  );

  // Chọn query phù hợp dựa trên role và filter
  const historyQuery = isStudentUser
    ? studentOwnHistoryQuery
    : selectedStudentId === "all"
      ? allStudentsHistoryQuery
      : studentHistoryQuery;

  const allEntries = historyQuery.entries || [];
  const loading = historyQuery.loading || false;
  const meta = historyQuery.meta;
  const permissions = historyQuery.permissions;

  // Client-side filtering for status (for better performance, no API call needed)
  const entries = allEntries;

  // Check permissions from API response
  const canViewFromApi = permissions?.can_view ?? true; // Default to true if permissions not available

  // Kiểm tra trạng thái khóa từ context hoặc từ error của API
  // - Học viên: luôn có quyền xem lịch sử của chính mình (không cần capability)
  // - Giáo viên: nếu không có capability login_activity.view, API trả về FEATURE_NOT_AVAILABLE
  // Block students - they should use /settings/security for their own login history.
  // Sau tất cả hook để giữ hook order ổn định; useStudentGuard lo phần điều hướng.
  if (isBlocked) {
    return null;
  }

  if (actionsLocked || planFeatureMessage) return renderError();

  // Check permissions after data is loaded
  if (!loading && permissions !== undefined && !canViewFromApi) return renderError(undefined, undefined, false);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateFilter("status", e.target.value);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    updateFilter(name, value);
  };

  const handleStudentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateFilter("student_id", e.target.value);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nhật ký truy cập</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Theo dõi lịch sử đăng nhập của học viên trong lớp.
          </p>
        </div>
      </div>

      <div className="rounded-lg bg-white p-4 dark:bg-gray-800">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4 relative">
          {!isStudentUser && (
            <SelectInput
              label="Chọn học viên"
              name="student_id"
              value={selectedStudentId || "all"}
              onChange={handleStudentChange}
              options={[
                { label: "Tất cả học viên", value: "all" },
                ...studentsList.map((student: any) => ({
                  label: student.name,
                  value: getObjId(student),
                })),
              ]}
            />
          )}
          <SelectInput
            label="Trạng thái"
            name="status"
            value={statusFilter || "all"}
            onChange={handleStatusChange}
            options={LOGIN_STATUS_OPTIONS}
          />
          <DateInput
            label="Từ ngày"
            name="from_date"
            value={fromDate || ""}
            handleChange={handleDateChange}
            placeholder="Chọn ngày bắt đầu"
          />
          <DateInput
            label="Đến ngày"
            name="to_date"
            value={toDate || ""}
            handleChange={handleDateChange}
            placeholder="Chọn ngày kết thúc"
          />

          {(selectedStudentId !== "all" || statusFilter !== "all" || fromDate || toDate) && (
            <button
              onClick={() => {
                resetFilters();
              }}
              className="absolute -top-3 right-0 text-xs font-medium text-red-500 hover:text-red-700 bg-white dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-100 dark:border-gray-700"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      <LoginHistoryList
        entries={entries}
        loading={loading}
        emptyText="Không tìm thấy phiên đăng nhập nào phù hợp."
        hideLocation={true}
      />

      {/* Pagination */}
      <Pagination
        meta={meta}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        itemLabel="phiên đăng nhập"
        className="mt-6"
      />
    </div>
  );
}

