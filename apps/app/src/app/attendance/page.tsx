"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAttendance, useClasses, useStudentClasses } from "@/hooks/use-api";
import { useAuthContext } from "@/contexts/auth-context";
import { isStudent, useAuthorization } from "@/lib/authz";
import { useStudentId } from "@/hooks/use-student-id";
import { PlusIcon, EyeIcon, CalendarIcon, UserGroupIcon, CheckCircleIcon, PencilIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Tooltip from "@/components/Common/Tooltip";
import SelectInput from "@/components/FormElements/SelectInput";
import SearchInput from "@/components/FormElements/SearchInput";
import DateRangePicker from "@/components/FormElements/DateRangePicker";
import ButtonLink from "@/components/Common/ButtonLink";
import Button from "@/components/Common/Button";
import Pagination from "@/components/Common/Pagination";
import { useListPage } from "@/hooks/use-list-page";
import { useLockContext } from "@/contexts/lock-context";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";
import ConfirmDeleteDialog from "@/components/Common/ConfirmDeleteDialog";
import { useDeleteAttendance } from "@/hooks/use-api";
import { tableStyles } from "@/components/Common/tableStyles";
import { ListSkeleton, StatsCardSkeleton } from "@/components/ui/loading";
import { getObjId } from "@/lib/id-utils";
import UserInfoBox from "@/components/User/UserInfoBox";
import { useParentBlockGuard } from "@/hooks/use-role-guard";

export default function AttendancePage() {
  const { isBlocked: isBlockedByRole } = useParentBlockGuard();
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuthContext();
  const isStudentUser = isStudent(user);
  const { renderError } = useErrorDisplay(isStudentUser ? "Điểm danh của tôi" : "Quản lý điểm danh");

  // Use combined hook for pagination and filters
  const {
    currentPage,
    setCurrentPage,
    filters,
    updateFilter,
    resetFilters,
    apiFilters,
  } = useListPage({
    defaultPage: 1,
    defaultPerPage: 10,
    filterKeys: ["class_id", "search", "status", "date_from", "date_to"],
    filterDefaults: {
      class_id: "all",
      search: "",
      status: "all",
      date_from: "",
      date_to: "",
    },
  });

  // Extract individual filters for easier access
  const classFilter = filters.class_id || "all";
  const searchQuery = filters.search || "";
  const statusFilter = filters.status || "all";

  // Date range filter from URL
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(() => {
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    if (dateFrom && dateTo) {
      return { start: dateFrom, end: dateTo };
    }
    return null;
  });

  // Sync dateRange with URL when URL changes
  useEffect(() => {
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    if (dateFrom && dateTo) {
      setDateRange({ start: dateFrom, end: dateTo });
    } else {
      setDateRange(null);
    }
  }, [searchParams]);

  // Helper to create date range filters
  const createDateRangeFilters = useCallback((dateRange: { start: string; end: string } | null) => {
    if (!dateRange) return {};
    return {
      date_from: dateRange.start,
      date_to: dateRange.end,
    };
  }, []);

  // Merge date range into API filters
  const finalApiFilters = useMemo(() => {
    return {
      ...apiFilters,
      ...createDateRangeFilters(dateRange),
    };
  }, [apiFilters, dateRange, createDateRangeFilters]);

  // Separate state for search input (not synced with URL until search is triggered)
  const [searchInput, setSearchInput] = useState(searchQuery);

  // Sync searchInput with searchQuery when filter changes externally
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  // Handle search button click or Enter key
  const handleSearch = () => {
    updateFilter("search", searchInput);
  };

  const { data: attendanceRecords, loading, error, meta: attendanceMeta, permissions, refetch } = useAttendance(actionsLocked ? undefined : finalApiFilters as any);
  const { studentId } = useStudentId();
  const { can } = useAuthorization();
  const { mutate: deleteAttendance, loading: deleting } = useDeleteAttendance();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const attendanceClassesRef = useRef<any[]>([]);

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // For tutors: fetch all classes
  // For students: fetch their enrolled classes or extract from attendance records
  const { data: tutorClasses, loading: tutorClassesLoading } = useClasses(undefined, !isStudentUser && !actionsLocked);
  const { data: studentClassesData, loading: studentClassesLoading } = useStudentClasses(
    actionsLocked ? '0' : (isStudentUser && studentId ? studentId : '0')
  );

  // Keep a stable list of classes extracted from attendance records (for student fallback),
  // so that changing filters (class_id, status, search) không làm mất các option lớp khác.
  useEffect(() => {
    if (!isStudentUser) {
      return;
    }

    // Chỉ update khi có attendanceRecords mới, không xóa khi filter làm rỗng
    if (attendanceRecords && attendanceRecords.length > 0) {
      const existingMap = new Map<string, any>();
      // Giữ lại các lớp đã có
      attendanceClassesRef.current.forEach((cls: any) => {
        const classId = getObjId(cls);
        if (cls && classId) {
          existingMap.set(classId, cls);
        }
      });

      // Thêm các lớp mới từ attendanceRecords
      attendanceRecords.forEach((record: any) => {
        const classInfo = record.class;
        const classId = getObjId(classInfo);
        if (classInfo && classId) {
          existingMap.set(classId, classInfo);
        } else if (record.class_id) {
          existingMap.set(getObjId(record.class_id), {
            id: record.class_id,
            name: record.class?.name || `Lớp ${record.class_id}`,
          });
        }
      });

      attendanceClassesRef.current = Array.from(existingMap.values());
    }
  }, [attendanceRecords, isStudentUser]);

  // Extract classes from student classes data or from attendance records
  // IMPORTANT: studentClasses should NOT depend on attendanceRecords to avoid losing options when filtering
  const studentClasses = useMemo(() => {
    if (!isStudentUser) return [];

    // Priority 1: Try to get from API response (most reliable)
    if (studentClassesData) {
      if (studentClassesData?.classes && Array.isArray(studentClassesData.classes)) {
        return studentClassesData.classes;
      }
      if (studentClassesData?.data?.classes && Array.isArray(studentClassesData.data.classes)) {
        return studentClassesData.data.classes;
      }
      if (Array.isArray(studentClassesData?.data)) {
        return studentClassesData.data;
      }
    }

    // Priority 2: Fallback: use stable class list accumulated from attendance records
    // This ref is updated when attendanceRecords change, but won't be cleared when filter makes records empty
    if (attendanceClassesRef.current.length > 0) {
      return attendanceClassesRef.current;
    }

    return [];
  }, [studentClassesData, isStudentUser]); // Note: NOT depending on attendanceRecords

  // Use appropriate classes based on user role
  const classes = isStudentUser ? studentClasses : tutorClasses;
  const classesLoading = isStudentUser ? studentClassesLoading : tutorClassesLoading;

  // Bulk selection logic
  const selectedCount = selectedIds.size;
  const allSelectedOnPage = attendanceRecords && attendanceRecords.length > 0 &&
    attendanceRecords.every((record: any) => selectedIds.has(getObjId(record)));

  const toggleSelectAllOnPage = () => {
    if (!attendanceRecords) return;
    if (allSelectedOnPage) {
      const newSet = new Set(selectedIds);
      attendanceRecords.forEach((record: any) => newSet.delete(getObjId(record)));
      setSelectedIds(newSet);
    } else {
      const newSet = new Set(selectedIds);
      attendanceRecords.forEach((record: any) => {
        if (canManage) {
          newSet.add(getObjId(record));
        }
      });
      setSelectedIds(newSet);
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // Reset selection when page/filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentPage, classFilter, statusFilter, searchQuery]);

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const idsArray = Array.from(selectedIds);
    for (const id of idsArray) {
      await deleteAttendance(String(id));
    }
    setSelectedIds(new Set());
    setBulkConfirmOpen(false);
    refetch();
  };

  // Kiểm tra lock trước để ưu tiên hiển thị lock content
  if (actionsLocked || planFeatureMessage) {
    return renderError();
  }

  // Use permissions from API response
  const canView = permissions?.can_view ?? true; // Default true cho view
  const canManage = permissions?.can_manage ?? false;

  // Check view permission - chỉ block khi không có quyền xem
  if (!loading && permissions !== undefined && !canView) {
    return renderError(undefined, undefined, false);
  }

  if (error && !loading) {
    return renderError(error, () => refetch());
  }

  // Parent không dùng trang quản lý điểm danh — vào thẳng Family portal.
  if (isBlockedByRole) {
    return null;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <ConfirmDeleteDialog
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={async () => {
          if (!confirmDeleteId) return;
          const res = await deleteAttendance(confirmDeleteId.toString());
          if (res.success) {
            setConfirmDeleteId(null);
            refetch();
          }
        }}
        loading={deleting}
        message="Bạn có chắc chắn muốn xóa bản ghi điểm danh này? Hành động không thể hoàn tác."
      />
      <ConfirmDeleteDialog
        open={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        loading={deleting}
        message={`Bạn có chắc chắn muốn xóa ${selectedCount} bản ghi điểm danh đã chọn? Hành động không thể hoàn tác.`}
      />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white">
            {isStudentUser ? 'Điểm danh của tôi' : 'Quản lý điểm danh'}
          </h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1">
            {isStudentUser ? 'Xem lịch sử điểm danh các lớp bạn tham gia' : 'Quản lý điểm danh của tất cả học viên'}
          </p>
        </div>

        {!isStudentUser && (
          <ButtonLink
            href="/attendance/take"
            icon={<PlusIcon />}
            size="sm"
            disabled={!can("create", "attendance")}
          >
            Điểm danh
          </ButtonLink>
        )}
      </div>

      {/* Stats - Hidden for students */}
      {!isStudentUser && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {loading ? (
            <>
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
            </>
          ) : (
            <>
              <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                <div className="flex items-center">
                  <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                    <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Tất cả</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                      {(attendanceMeta as any)?.statistics?.total ?? attendanceMeta?.total ?? attendanceRecords?.length ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                <div className="flex items-center">
                  <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                    <CheckCircleIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Có mặt</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                      {(attendanceMeta as any)?.statistics?.present ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                <div className="flex items-center">
                  <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                    <UserGroupIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Vắng mặt</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                      {(attendanceMeta as any)?.statistics?.absent ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                <div className="flex items-center">
                  <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                    <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Có mặt</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                      {Math.round((attendanceMeta as any)?.statistics?.attendance_rate ?? 0)}%
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Search and Filters */}
      <div className="rounded-lg bg-white p-4 dark:bg-gray-800">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 relative">
          <SearchInput
            label="Tìm kiếm"
            name="search"
            placeholder="Tìm kiếm điểm danh..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={handleSearch}
            disabled={loading}
          />
          <SelectInput
            label="Trạng thái"
            name="status"
            value={statusFilter}
            onChange={(e) => updateFilter("status", e.target.value)}
            disabled={loading}
            options={[
              { value: "all", label: "Tất cả trạng thái" },
              { value: "present", label: "Có mặt" },
              { value: "absent", label: "Vắng mặt" },
              { value: "late", label: "Đi muộn" },
              { value: "excused", label: "Có phép" },
            ]}
            placeholder={loading ? "Đang tải..." : "Chọn trạng thái"}
          />
          <SelectInput
            label="Lớp học"
            name="class"
            value={classFilter}
            onChange={(e) => updateFilter("class_id", e.target.value)}
            disabled={classesLoading || loading}
            options={[
              { value: "all", label: "Tất cả lớp học" },
              ...(classes || []).map((cls: any) => ({
                value: getObjId(cls),
                label: cls.name,
              })),
            ]}
            placeholder={classesLoading || loading ? "Đang tải..." : "Chọn lớp học"}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Khoảng thời gian
            </label>
            <DateRangePicker
              value={dateRange || undefined}
              onChange={(range) => {
                setDateRange(range || null);
                // Update URL with date range using router to trigger re-render
                const params = new URLSearchParams(searchParams.toString());
                if (range) {
                  params.set("date_from", range.start);
                  params.set("date_to", range.end);
                } else {
                  params.delete("date_from");
                  params.delete("date_to");
                }
                const queryString = params.toString();
                router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
              }}
              className="z-[100]"
            />
          </div>

          {(searchQuery || statusFilter !== "all" || classFilter !== "all" || dateRange) && (
            <button
              onClick={() => {
                setSearchInput("");
                setDateRange(null);
                resetFilters();
              }}
              className="absolute -top-3 right-0 text-xs font-medium text-red-500 hover:text-red-700 bg-white dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-100 dark:border-gray-700"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Attendance Records */}
      {loading ? (
        <ListSkeleton count={5} showAvatar={true} />
      ) : !attendanceRecords || attendanceRecords.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center dark:bg-gray-800">
          <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
            <CalendarIcon className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {searchQuery || statusFilter !== "all" || (!isStudentUser && classFilter !== "all") ? "Không tìm thấy bản ghi điểm danh" : "Chưa có bản ghi điểm danh nào"}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {searchQuery || statusFilter !== "all" || (!isStudentUser && classFilter !== "all")
              ? "Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc"
              : "Bắt đầu bằng cách điểm danh cho lớp học"
            }
          </p>
          {!searchQuery && statusFilter === "all" && (isStudentUser || classFilter === "all") && !isStudentUser && (
            <ButtonLink
              href="/attendance/take"
              icon={<PlusIcon />}
              size="sm"
              disabled={!can("create", "attendance")}
            >
              Điểm danh đầu tiên
            </ButtonLink>
          )}
        </div>
      ) : (
        <div className={tableStyles.wrapper}>

          {/* Bulk Actions Bar */}
          {selectedCount > 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-primary-pastel/20 border-b border-primary/20 dark:bg-primary/10 dark:border-primary/30">
              <div className="text-gray-600 dark:text-gray-300">
                Đã chọn <span className="font-semibold">{selectedCount}</span> bản ghi điểm danh
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                  icon={<XMarkIcon className="h-4 w-4" />}
                >
                  Bỏ chọn
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => setBulkConfirmOpen(true)}
                  loading={deleting}
                  icon={<TrashIcon className="h-4 w-4" />}
                  disabled={!can("delete", "attendance")}
                >
                  Xóa đã chọn
                </Button>
              </div>
            </div>
          )}
          {/* Mobile Card View */}
          <div className="block lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
            {attendanceRecords.map((record: any) => {
              const recordId = getObjId(record);
              return (
                <div key={recordId} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <UserInfoBox
                        name={record.student?.name || "Không rõ"}
                        email={record.student?.email}
                        avatar={record.student?.avatar}
                        emailVerified={record.student?.email_verified}
                        studentCode={record.student?.student_code}
                        size="sm"
                        layout="horizontal"
                      />
                      <div className="mt-2 pl-[52px] space-y-1">
                        <div>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${record.status === 'present'
                            ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                            : record.status === 'late'
                              ? 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]'
                              : record.status === 'excused'
                                ? 'bg-[var(--status-badge-completed)] text-[var(--status-badge-completed-text)]'
                                : 'bg-[var(--status-badge-error)] text-[var(--status-badge-error-text)]'
                            }`}>
                            {record.status === 'present' ? 'Có mặt' :
                              record.status === 'late' ? 'Đi muộn' :
                                record.status === 'excused' ? 'Có phép' : 'Vắng mặt'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          <span className="font-medium">Lớp:</span> {record.class?.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          <span className="font-medium">Ngày:</span> {new Date(record.date).toLocaleDateString('vi-VN')}
                        </div>
                        {record.check_in_time && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            <span className="font-medium">Giờ:</span> {record.check_in_time}
                            {record.check_out_time && ` - ${record.check_out_time}`}
                          </div>
                        )}
                        {record.note && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 max-w-xs break-words">
                            <span className="font-medium">Ghi chú:</span> {record.note}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                      <Tooltip label="Xem điểm danh">
                        <ButtonLink
                          href={`/attendance/${recordId}`}
                          variant="ghost"
                          className="!p-1.5 !h-auto text-primary hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          aria-label="Xem điểm danh"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </ButtonLink>
                      </Tooltip>
                      {!isStudentUser && (
                        <>
                          <Tooltip label="Chỉnh sửa">
                            <ButtonLink
                              href={`/attendance/${recordId}/edit`}
                              variant="ghost"
                              className="!p-1.5 !h-auto text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              aria-label="Chỉnh sửa"
                              disabled={!can("update", "attendance")}
                            >
                              <PencilIcon className="h-4 w-4" />
                            </ButtonLink>
                          </Tooltip>
                          <Tooltip label="Xóa">
                            <Button
                              onClick={() => setConfirmDeleteId(recordId)}
                              variant="ghost"
                              className="!p-1.5 !h-auto text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              aria-label="Xóa"
                              disabled={!can("delete", "attendance")}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </Tooltip>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className={`${tableStyles.table} min-w-[1000px]`}>
              <thead className={tableStyles.thead}>
                <tr>
                  {!isStudentUser && (
                    <th className={tableStyles.headerCheckboxCell}>
                      <input
                        type="checkbox"
                        className={tableStyles.checkbox}
                        checked={allSelectedOnPage}
                        onChange={toggleSelectAllOnPage}
                        disabled={!can("delete", "attendance")}
                      />
                    </th>
                  )}
                  <th className={tableStyles.headerCellBase}>
                    Học viên
                  </th>
                  <th className={tableStyles.headerCellBase}>
                    Lớp học
                  </th>
                  <th className={tableStyles.headerCellBase}>
                    Ngày học
                  </th>
                  <th className={tableStyles.headerCellBase}>
                    Trạng thái
                  </th>
                  <th className={tableStyles.headerCellBase}>
                    Ghi chú
                  </th>
                  <th className={`${tableStyles.headerCellBase} text-right`}>
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className={tableStyles.body}>
                {attendanceRecords.map((record: any) => {
                  const recordId = getObjId(record);
                  return (
                    <tr key={recordId} className={selectedIds.has(recordId) ? tableStyles.rowSelected : tableStyles.row}>
                      {!isStudentUser && (
                        <td className={tableStyles.cellCheckbox}>
                          <input
                            type="checkbox"
                            className={tableStyles.checkbox}
                            checked={selectedIds.has(recordId)}
                            onChange={() => toggleSelect(recordId)}
                            disabled={!can("delete", "attendance")}
                          />
                        </td>
                      )}
                      <td className={tableStyles.cell}>
                        <UserInfoBox
                          name={record.student?.name || "Không rõ"}
                          email={record.student?.email}
                          avatar={record.student?.avatar}
                          emailVerified={record.student?.email_verified}
                          studentCode={record.student?.student_code}
                          size="sm"
                          layout="horizontal"
                        />
                      </td>
                      <td className={tableStyles.cell}>
                        <div className="text-sm text-gray-900 dark:text-white">
                          {record.class?.name}
                        </div>
                      </td>
                      <td className={tableStyles.cell}>
                        <div className="text-sm text-gray-900 dark:text-white">
                          {new Date(record.date).toLocaleDateString('vi-VN')}
                        </div>
                        {record.check_in_time && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {record.check_in_time}
                            {record.check_out_time && ` - ${record.check_out_time}`}
                          </div>
                        )}
                      </td>
                      <td className={tableStyles.cellStatus}>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${record.status === 'present'
                          ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                          : record.status === 'late'
                            ? 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]'
                            : record.status === 'excused'
                              ? 'bg-[var(--status-badge-completed)] text-[var(--status-badge-completed-text)]'
                              : 'bg-[var(--status-badge-error)] text-[var(--status-badge-error-text)]'
                          }`}>
                          {record.status === 'present' ? 'Có mặt' :
                            record.status === 'late' ? 'Đi muộn' :
                              record.status === 'excused' ? 'Có phép' : 'Vắng mặt'}
                        </span>
                      </td>
                      <td className={tableStyles.cell}>
                        <div className="text-sm text-gray-900 dark:text-white max-w-xs truncate">
                          {record.note || "Không có ghi chú"}
                        </div>
                      </td>
                      <td className={tableStyles.cellActions}>
                        <div className="flex items-center justify-end gap-2">
                          <Tooltip label="Xem điểm danh">
                            <ButtonLink
                              href={`/attendance/${recordId}`}
                              variant="ghost"
                              className="!p-0 h-auto text-primary hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-transparent"
                              aria-label="Xem điểm danh"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </ButtonLink>
                          </Tooltip>

                          {!isStudentUser && (
                            <>
                              <Tooltip label="Chỉnh sửa">
                                <ButtonLink
                                  href={`/attendance/${recordId}/edit`}
                                  variant="ghost"
                                  className="!p-0 h-auto text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-transparent"
                                  aria-label="Chỉnh sửa"
                                  disabled={!can("update", "attendance")}
                                >
                                  <PencilIcon className="h-4 w-4" />
                                </ButtonLink>
                              </Tooltip>
                              <Tooltip label="Xóa">
                                <Button
                                  onClick={() => setConfirmDeleteId(recordId)}
                                  variant="ghost"
                                  className="!p-0 h-auto text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-transparent"
                                  aria-label="Xóa"
                                  disabled={!can("delete", "attendance")}
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </Button>
                              </Tooltip>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination - chỉ hiển thị khi có dữ liệu */}
      {attendanceRecords && attendanceRecords.length > 0 && (
        <Pagination
          meta={attendanceMeta}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          itemLabel="bản ghi điểm danh"
          className="mt-6"
        />
      )}
    </div>
  );
}