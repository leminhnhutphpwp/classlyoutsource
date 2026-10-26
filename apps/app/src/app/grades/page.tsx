"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGrades, useDeleteGrade, useClasses } from "@/hooks/use-api";
import { useAuthContext } from "@/contexts/auth-context";
import { EyeIcon, AcademicCapIcon, ChartBarIcon, UserGroupIcon, PencilIcon, TrashIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Tooltip from "@/components/Common/Tooltip";
import { useAuthorization, isStudent } from "@/lib/authz";
import GradesAccessGuard from "@/components/GradesAccessGuard";

import ConfirmDeleteDialog from "@/components/Common/ConfirmDeleteDialog";
import SelectInput from "@/components/FormElements/SelectInput";
import SearchInput from "@/components/FormElements/SearchInput";
import ButtonLink from "@/components/Common/ButtonLink";
import Button from "@/components/Common/Button";
import Pagination from "@/components/Common/Pagination";
import { useListPage } from "@/hooks/use-list-page";
import { useLockContext } from "@/contexts/lock-context";
import ErrorDisplay, { useErrorDisplay } from "@/components/Common/ErrorDisplay";
import { formatScoreWithPercentage } from "@/lib/format-score";
import { GradeListCard } from "@/components/Grades/GradeListCard";
import { tableStyles } from "@/components/Common/tableStyles";
import { ListSkeleton, StatsCardSkeleton } from "@/components/ui/loading";
import { getObjId, idsEqual } from "@/lib/id-utils";
import UserInfoBox from "@/components/User/UserInfoBox";
import { useParentBlockGuard } from "@/hooks/use-role-guard";

export default function GradesPage() {
  const { isBlocked: isBlockedByRole } = useParentBlockGuard();
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const router = useRouter();
  const { user } = useAuthContext();
  const { can } = useAuthorization();
  const isStudentUser = isStudent(user);
  const { renderError } = useErrorDisplay(isStudentUser ? "Điểm số của tôi" : "Quản lý điểm số");

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
    filterKeys: ["class_id", "search"],
    filterDefaults: {
      class_id: "all",
      search: "",
    },
  });

  // Extract individual filters for easier access
  const classFilter = filters.class_id || "all";
  const searchQuery = filters.search || "";

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

  const { data: grades, loading, error, refetch, meta: gradesMeta, permissions } = useGrades(actionsLocked ? undefined : apiFilters);
  const { data: classes, loading: classesLoading } = useClasses(undefined, !actionsLocked); // Fetch all classes for filter dropdown
  const deleteGradeMutation = useDeleteGrade();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  // Track if page was auto-reset to avoid scroll jump
  const isAutoResettingRef = useRef(false);

  // Auto-reset to page 1 if current page exceeds last page (e.g., when filter changes)
  useEffect(() => {
    if (gradesMeta && gradesMeta.last_page && currentPage > gradesMeta.last_page) {
      isAutoResettingRef.current = true;
      setCurrentPage(1);
      // Reset flag after a short delay
      setTimeout(() => {
        isAutoResettingRef.current = false;
      }, 100);
    }
  }, [gradesMeta, currentPage, setCurrentPage]);

  // Scroll to top when page changes (only if not auto-resetting)
  useEffect(() => {
    if (!isAutoResettingRef.current) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage]);

  // Get unique classes for filter dropdown from all classes (not from filtered grades)
  // Get unique classes for filter dropdown from all classes (not from filtered grades)
  const uniqueClassOptions = classes
    ? classes.map((cls: any) => ({
      id: getObjId(cls),
      name: cls.name,
    }))
    : [];

  const averageGrade = grades && grades.length > 0
    ? grades.reduce((sum: number, g: any) => sum + (g.percentage || 0), 0) / grades.length
    : 0;

  // Helpers for bulk selection (desktop only)
  const canDeleteGrade = useCallback(
    (grade: any) =>
      can("delete", "grade") || idsEqual(grade.tutor_id, user) || user?.role === "super_admin",
    [can, user]
  );

  const apiFiltersKey = JSON.stringify(apiFilters);
  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentPage, apiFiltersKey]);

  const allIdsOnPage: string[] = useMemo(
    () => (grades || []).filter((g: any) => canDeleteGrade(g)).map((g: any) => getObjId(g)),
    [grades, canDeleteGrade]
  );

  const selectedCount = selectedIds.size;
  const allSelectedOnPage =
    allIdsOnPage.length > 0 && allIdsOnPage.every((id) => selectedIds.has(id));

  const toggleSelect = (id: string, grade: any) => {
    if (!canDeleteGrade(grade)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelectedOnPage) {
        allIdsOnPage.forEach((id) => next.delete(id));
      } else {
        allIdsOnPage.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  if (error && !loading) {
    return <ErrorDisplay error={error} title={isStudentUser ? "Điểm số của tôi" : "Quản lý điểm số"} onRetry={() => refetch()} />;
  }

  // Use permissions from API response
  const canView = permissions?.can_view ?? true; // Default true cho view
  const canManage = permissions?.can_manage ?? false;

  if (actionsLocked || planFeatureMessage) {
    return renderError();
  }

  // Check view permission - chỉ block khi không có quyền xem
  if (!loading && permissions !== undefined && !canView) {
    return renderError(undefined, undefined, false);
  }

  // Parent không dùng trang quản lý điểm — vào thẳng Family portal.
  if (isBlockedByRole) {
    return null;
  }

  return (
    <GradesAccessGuard>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white">
              {isStudentUser ? 'Điểm số của tôi' : 'Quản lý điểm số'}
            </h1>
            <p className="text-dark-4 dark:text-dark-6 mt-1">
              {isStudentUser ? 'Xem kết quả học tập và nhận xét từ giáo viên' : 'Xem và quản lý điểm số của học viên'}
            </p>
          </div>

          {!isStudentUser && (
            <ButtonLink
              href="/grades/create"
              icon={<PlusIcon />}
              size="sm"
              disabled={!can("create", "grade")}
            >
              Tạo điểm số mới
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
                      <AcademicCapIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                    <div className="ml-3 sm:ml-4">
                      <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Tổng điểm</p>
                      <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                        {(gradesMeta as any)?.statistics?.total ?? grades?.length ?? 0}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                  <div className="flex items-center">
                    <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                      <ChartBarIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                    <div className="ml-3 sm:ml-4">
                      <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Trung bình</p>
                      <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                        {(() => {
                          const avg = (gradesMeta as any)?.statistics?.average_percentage ?? averageGrade;
                          return Number(avg.toFixed(1));
                        })()}%
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
                      <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Học viên</p>
                      <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                        {(gradesMeta as any)?.statistics?.unique_students ?? new Set(grades?.map((g: any) => g.student_id)).size ?? 0}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                  <div className="flex items-center">
                    <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                      <AcademicCapIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                    <div className="ml-3 sm:ml-4">
                      <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Lớp học</p>
                      <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                        {(gradesMeta as any)?.statistics?.unique_classes ?? uniqueClassOptions.length ?? 0}
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 relative">
            <SearchInput
              label="Tìm kiếm"
              name="search"
              placeholder={loading ? "Đang tải..." : "Tìm kiếm điểm số..."}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onSearch={handleSearch}
              disabled={loading}
            />
            <SelectInput
              label="Lớp học"
              name="class"
              value={classFilter}
              onChange={(e) => updateFilter("class_id", e.target.value)}
              disabled={classesLoading || loading}
              options={[
                { label: "Tất cả lớp học", value: "all" },
                ...uniqueClassOptions.map((opt: any) => ({
                  label: opt.name,
                  value: getObjId(opt),
                })),
              ]}
              placeholder={classesLoading || loading ? "Đang tải..." : "Chọn lớp học"}
            />

            {(searchQuery || classFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchInput("");
                  resetFilters();
                }}
                className="absolute -top-3 right-0 text-xs font-medium text-red-500 hover:text-red-700 bg-white dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-100 dark:border-gray-700"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        </div>
        {/* Grades Table */}
        {loading ? (
          <ListSkeleton count={5} showAvatar={true} />
        ) : !grades || grades.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center dark:bg-gray-800">
            <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <AcademicCapIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchQuery || classFilter !== "all" ? "Không tìm thấy điểm số" : "Chưa có điểm số nào"}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {searchQuery || classFilter !== "all"
                ? "Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc"
                : "Điểm số sẽ hiển thị ở đây khi có bài tập được chấm điểm"
              }
            </p>
            {!searchQuery && classFilter === "all" && !isStudentUser && (
              <ButtonLink
                href="/grades/create"
                icon={<PlusIcon />}
                size="sm"
                disabled={!can("create", "grade")}
              >
                Tạo điểm số đầu tiên
              </ButtonLink>
            )}
          </div>
        ) : (
          <div className={tableStyles.wrapper}>
            {/* Mobile Card View */}
            <div className="block lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {(grades || []).map((grade: any) => (
                <GradeListCard
                  key={getObjId(grade)}
                  grade={grade}
                  canManage={can("update", "grade")}
                  canDelete={
                    can("delete", "grade") ||
                    idsEqual(grade.tutor_id, user) ||
                    user?.role === "super_admin"
                  }
                  onDelete={(id) => setConfirmDeleteId(String(id))}
                />
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              {canManage && selectedCount > 0 && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 text-xs sm:text-sm">
                  <div className="text-gray-600 dark:text-gray-300">
                    Đã chọn <span className="font-semibold">{selectedCount}</span> điểm
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
                      loading={deleteGradeMutation.loading}
                      icon={<TrashIcon className="h-4 w-4" />}
                    >
                      Xóa đã chọn
                    </Button>
                  </div>
                </div>
              )}
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
                          disabled={!can("delete", "grade")}
                        />
                      </th>
                    )}
                    <th className={`${tableStyles.headerCellBase} min-w-[200px]`}>
                      Học viên
                    </th>
                    <th className={`${tableStyles.headerCellBase} min-w-[200px]`}>
                      Bài tập/Điểm
                    </th>
                    <th className={`${tableStyles.headerCellBase} hidden md:table-cell min-w-[200px]`}>
                      Thông tin
                    </th>
                    <th className={`${tableStyles.headerCellBase} text-right min-w-[120px]`}>
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className={tableStyles.body}>
                  {(grades || []).map((grade: any) => {
                    const gradeId = getObjId(grade);
                    const scoreData = formatScoreWithPercentage(grade.score || grade.grade, grade.max_score || grade.max_points);
                    const percentage = grade.percentage !== null && grade.percentage !== undefined
                      ? Number(grade.percentage.toFixed(1))
                      : Number(scoreData.percentage.toFixed(1));
                    const canDeleteThis = canDeleteGrade(grade);
                    const isSelected = selectedIds.has(gradeId);
                    return (
                      <tr
                        key={gradeId}
                        className={`${tableStyles.row} ${isSelected ? tableStyles.rowSelected : ""}`}
                      >
                        {!isStudentUser && (
                          <td className="px-4 py-4 align-middle">
                            <input
                              type="checkbox"
                              className={tableStyles.checkbox}
                              checked={isSelected}
                              onChange={() => toggleSelect(gradeId, grade)}
                              disabled={!canDeleteThis}
                            />
                          </td>
                        )}
                        <td className={tableStyles.cell}>
                          <UserInfoBox
                            name={grade.student?.name || "Không rõ"}
                            email={grade.student?.email}
                            avatar={grade.student?.avatar}
                            emailVerified={grade.student?.email_verified}
                            studentCode={grade.student?.student_code}
                            size="sm"
                            layout="horizontal"
                          />
                        </td>
                        <td className={tableStyles.cell}>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {grade.title || grade.assignment?.title || grade.grade_type?.name || "Điểm tổng hợp"}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm font-semibold text-primary dark:text-primary-400">
                                {scoreData.score}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                ({percentage}%
                                {grade.grade_letter && ` - ${grade.grade_letter}`})
                              </span>
                            </div>
                            {grade.is_passing !== undefined && (
                              <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium ${grade.is_passing
                                ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                                : 'bg-[var(--status-badge-error)] text-[var(--status-badge-error-text)]'
                                }`}>
                                {grade.is_passing ? 'Đạt' : 'Không đạt'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={`${tableStyles.cell} hidden md:table-cell`}>
                          <div className="space-y-1 text-sm">
                            <div className="text-gray-900 dark:text-white font-medium">
                              <span className="text-gray-500 dark:text-gray-400">Lớp: </span>
                              {grade.class?.name || "N/A"}
                            </div>
                            {grade.grade_type && (
                              <div className="text-gray-900 dark:text-white">
                                <span className="text-gray-500 dark:text-gray-400">Loại: </span>
                                {grade.grade_type.name}
                              </div>
                            )}
                            <div className="text-gray-900 dark:text-white">
                              <span className="text-gray-500 dark:text-gray-400">Ngày: </span>
                              {grade.grade_date
                                ? new Date(grade.grade_date).toLocaleDateString('vi-VN')
                                : grade.created_at
                                  ? new Date(grade.created_at).toLocaleDateString('vi-VN')
                                  : 'N/A'}
                            </div>
                            {grade.semester && (
                              <div className="text-gray-900 dark:text-white">
                                <span className="text-gray-500 dark:text-gray-400">Học kỳ: </span>
                                {grade.semester}
                              </div>
                            )}
                            {(grade.comments || grade.notes) && (
                              <div className="text-gray-600 dark:text-gray-300 truncate max-w-xs" title={grade.comments || grade.notes}>
                                <span className="text-gray-500 dark:text-gray-400">Ghi chú: </span>
                                {grade.comments || grade.notes}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className={tableStyles.cellActions}>
                          <div className="flex items-center gap-2">
                            <Tooltip label="Xem điểm số">
                              <Link
                                href={`/grades/${gradeId}`}
                                className="text-primary hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300"
                                aria-label="Xem điểm số"
                              >
                                <EyeIcon className="h-4 w-4" />
                              </Link>
                            </Tooltip>
                            {!isStudentUser && (
                              <>
                                <Tooltip label="Chỉnh sửa">
                                  <ButtonLink
                                    href={`/grades/${gradeId}/edit`}
                                    variant="ghost"
                                    className="!p-0 h-auto text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-transparent"
                                    aria-label="Chỉnh sửa"
                                    disabled={!can("update", "grade")}
                                  >
                                    <PencilIcon className="h-4 w-4" />
                                  </ButtonLink>
                                </Tooltip>

                                <Tooltip label="Xóa">
                                  <Button
                                    onClick={() => setConfirmDeleteId(gradeId)}
                                    variant="ghost"
                                    className="!p-0 h-auto text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-transparent"
                                    aria-label="Xóa"
                                    disabled={!canDeleteThis}
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

        {/* Delete Confirmation Dialog */}
        <ConfirmDeleteDialog
          open={confirmDeleteId !== null}
          onClose={() => {
            setConfirmDeleteId(null);
            setDeleteError(null);
          }}
          onConfirm={async () => {
            if (!confirmDeleteId) return;

            setDeleteError(null);
            const result = await deleteGradeMutation.mutate(confirmDeleteId.toString());
            if (result.success) {
              setConfirmDeleteId(null);
              // Refresh the page to update the list
              router.refresh();
            } else {
              setDeleteError(result.message || deleteGradeMutation.error || "Không thể xóa điểm số");
            }
          }}
          message={
            deleteError
              ? `Lỗi: ${deleteError}`
              : `Bạn có chắc chắn muốn xóa điểm số "${grades?.find((g: any) => getObjId(g) === confirmDeleteId)?.title || grades?.find((g: any) => getObjId(g) === confirmDeleteId)?.assignment?.title || 'Này'}? Hành động này không thể hoàn tác.`
          }
          loading={deleteGradeMutation.loading}
        />

        {/* Bulk delete confirmation (desktop) */}
        <ConfirmDeleteDialog
          open={bulkConfirmOpen && selectedCount > 0}
          onClose={() => setBulkConfirmOpen(false)}
          onConfirm={async () => {
            const ids = Array.from(selectedIds);
            for (const id of ids) {
              await deleteGradeMutation.mutate(String(id));
            }
            setBulkConfirmOpen(false);
            setSelectedIds(new Set());
            router.refresh();
          }}
          message={`Bạn có chắc chắn muốn xóa ${selectedCount} điểm đã chọn? Hành động này không thể hoàn tác.`}
          loading={deleteGradeMutation.loading}
        />

        {/* Error Display */}
        {deleteError && confirmDeleteId === null && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {deleteError}
          </div>
        )}

        {/* Pagination - chỉ hiển thị khi có dữ liệu */}
        {grades && grades.length > 0 && (
          <Pagination
            meta={gradesMeta}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            itemLabel="điểm số"
            className="mt-6"
          />
        )}
      </div>
    </GradesAccessGuard>
  );
}

