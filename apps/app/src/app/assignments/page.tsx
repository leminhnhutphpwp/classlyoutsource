"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAssignments, useDeleteAssignment, useClasses } from "@/hooks/use-api";
import { useAuthContext } from "@/contexts/auth-context";
import { isStudent, useAuthorization } from "@/lib/authz";
import ConfirmDeleteDialog from "@/components/Common/ConfirmDeleteDialog";
import AssignmentCard from "@/components/Assignments/AssignmentCard";
import { PlusIcon, DocumentTextIcon, ClockIcon } from "@heroicons/react/24/outline";
import SelectInput from "@/components/FormElements/SelectInput";
import SearchInput from "@/components/FormElements/SearchInput";
import ButtonLink from "@/components/Common/ButtonLink";
import Pagination from "@/components/Common/Pagination";
import { useListPage } from "@/hooks/use-list-page";
import { useLockContext } from "@/contexts/lock-context";
import { StatsCardSkeleton } from "@/components/ui/loading";
import { getObjId } from "@/lib/id-utils";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";
import { useParentBlockGuard } from "@/hooks/use-role-guard";

export default function AssignmentsPage() {
  useParentBlockGuard();
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const router = useRouter();
  const { user } = useAuthContext();
  const isStudentUser = isStudent(user);
  const { can } = useAuthorization();
  const { renderError } = useErrorDisplay(isStudentUser ? "Bài tập của tôi" : "Quản lý bài tập");

  // Use combined hook for pagination and filters
  const {
    currentPage,
    perPage,
    setCurrentPage,
    filters,
    updateFilter,
    resetFilters,
    apiFilters,
  } = useListPage({
    defaultPage: 1,
    defaultPerPage: 12,
    filterKeys: ["status", "class_id", "search"],
    filterDefaults: {
      status: "all",
      class_id: "all",
      search: "",
    },
  });

  // Extract individual filters for easier access
  const statusFilter = filters.status || "all";
  const classFilter = filters.class_id || "all";
  const searchQuery = filters.search || "";

  // Local state for search input (not triggering API call immediately)
  const [searchInput, setSearchInput] = useState(searchQuery);

  // Sync searchInput with searchQuery when filter changes externally
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  const handleSearch = () => {
    updateFilter("search", searchInput);
  };


  // Gọi API với đầy đủ filters & pagination từ URL
  const { data: assignments, loading, error, refetch, meta: assignmentsMeta, permissions } = useAssignments(actionsLocked ? undefined : apiFilters);
  const { data: classes, loading: classesLoading } = useClasses(undefined, !actionsLocked);

  // Use permissions from API response
  const canView = permissions?.can_view ?? true; // Default true cho view
  const deleteAssignmentMutation = useDeleteAssignment();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // Kiểm tra lock và plan feature trước để ưu tiên hiển thị lock content
  if (actionsLocked || planFeatureMessage) {
    return renderError();
  }

  // Check view permission - chỉ block khi không có quyền xem
  if (!loading && permissions !== undefined && !canView) {
    return renderError(undefined, undefined, false);
  }

  if (error && !loading) {
    return renderError(error, () => refetch());
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white">
            {isStudentUser ? 'Bài tập của tôi' : 'Quản lý bài tập'}
          </h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1">
            {isStudentUser ? 'Xem danh sách các bài tập của bạn' : 'Quản lý tất cả các bài tập trong hệ thống'}
          </p>
        </div>

        {!isStudentUser && (
          <ButtonLink
            href="/assignments/create"
            icon={<PlusIcon />}
            size="sm"
            disabled={!can("create", "assignment")}
          >
            Tạo bài tập mới
          </ButtonLink>
        )}
      </div>

      {/* Stats - Only for Teachers */}
      {!isStudentUser && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
          {loading ? (
            <>
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
            </>
          ) : (
            <>
              <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
                <div className="flex items-center">
                  <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                    <DocumentTextIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                  </div>
                  <div className="ml-3 md:ml-4">
                    <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Tất cả">Tất cả</p>
                    <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                      {(assignmentsMeta as any)?.statistics?.total ?? assignmentsMeta?.total ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
                <div className="flex items-center">
                  <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                    <DocumentTextIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                  </div>
                  <div className="ml-3 md:ml-4">
                    <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Đang giao">Đang giao</p>
                    <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                      {(assignmentsMeta as any)?.statistics?.published ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
                <div className="flex items-center">
                  <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                    <DocumentTextIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                  </div>
                  <div className="ml-3 md:ml-4">
                    <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Sắp giao">Sắp giao</p>
                    <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                      {(assignmentsMeta as any)?.statistics?.draft ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
                <div className="flex items-center">
                  <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                    <ClockIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                  </div>
                  <div className="ml-3 md:ml-4">
                    <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Đã kết thúc">Đã kết thúc</p>
                    <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                      {(assignmentsMeta as any)?.statistics?.closed ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Search and Filters */}
      <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative">
          <div className="md:col-span-1">
            <SearchInput
              label="Tìm kiếm"
              name="search"
              placeholder={loading ? "Đang tải..." : "Tìm kiếm bài tập..."}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onSearch={handleSearch}
              disabled={loading}
            />
          </div>
          <div className="md:col-span-1">
            <SelectInput
              label="Trạng thái"
              name="status"
              value={statusFilter}
              onChange={(e) => updateFilter("status", e.target.value)}
              disabled={loading}
              options={[
                { label: "Tất cả trạng thái", value: "all" },
                { label: isStudentUser ? "Đang làm" : "Đang giao", value: "published" },
                ...(isStudentUser
                  ? [{ label: "Đã kết thúc", value: "closed" }]
                  : [
                    { label: "Sắp giao", value: "draft" },
                    { label: "Đã kết thúc", value: "closed" }
                  ]
                ),
              ]}
              placeholder={loading ? "Đang tải..." : "Chọn trạng thái"}
            />
          </div>
          <div className="md:col-span-1">
            <SelectInput
              label="Lớp học"
              name="class"
              value={classFilter}
              onChange={(e) => updateFilter("class_id", e.target.value)}
              disabled={classesLoading || loading}
              options={[
                { label: "Tất cả lớp học", value: "all" },
                ...(classes?.map((cls: any) => ({
                  label: cls.name,
                  value: getObjId(cls),
                })) || []),
              ]}
              placeholder={classesLoading || loading ? "Đang tải..." : "Chọn lớp học"}
            />
          </div>

          {(searchQuery || statusFilter !== "all" || classFilter !== "all") && (
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

      {/* Assignments Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800 animate-pulse">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                  <div className="h-6 w-20 rounded-full bg-gray-200 dark:bg-gray-700" />
                </div>
                <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                  <div className="flex justify-between">
                    <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <div className="h-9 flex-1 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-9 w-9 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-9 w-9 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !assignments || assignments.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center dark:bg-gray-800">
          <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
            <DocumentTextIcon className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {searchQuery || statusFilter !== "all" || classFilter !== "all" ? "Không tìm thấy bài tập" : "Chưa có bài tập nào"}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {searchQuery || statusFilter !== "all" || classFilter !== "all"
              ? "Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc"
              : isStudentUser
                ? "Hiện chưa có bài tập nào dành cho bạn"
                : "Bắt đầu bằng cách tạo bài tập đầu tiên"
            }
          </p>
          {!searchQuery && statusFilter === "all" && classFilter === "all" && !isStudentUser && (
            <ButtonLink
              href="/assignments/create"
              icon={<PlusIcon />}
              size="sm"
              disabled={!can("create", "assignment")}
            >
              Tạo bài tập đầu tiên
            </ButtonLink>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
          {assignments.map((assignment: any) => (
            <AssignmentCard
              key={getObjId(assignment)}
              assignment={assignment}
              user={user}
              showClassName={true}
              showEdit={true}
              showDelete={true}
              onDelete={() => setConfirmDeleteId(getObjId(assignment))}
            />
          ))}
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
          const result = await deleteAssignmentMutation.mutate(confirmDeleteId.toString());
          if (result.success) {
            setConfirmDeleteId(null);
            // Refresh the page to update the list
            router.refresh();
          } else {
            setDeleteError(result.message || "Không thể xóa bài tập");
          }
        }}
        loading={deleteAssignmentMutation.loading}
        message="Bạn có chắc chắn muốn xóa bài tập này? Hành động này không thể hoàn tác."
      />

      {deleteError && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          {deleteError}
        </p>
      )}

      {/* Pagination */}
      {assignmentsMeta && (assignmentsMeta.total ?? 0) > perPage && (
        <Pagination
          meta={assignmentsMeta}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          itemLabel="bài tập"
        />
      )}
    </div>
  );
}
