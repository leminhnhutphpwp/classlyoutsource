"use client";
import { useEffect, useState, useMemo } from "react";
import { useClasses, useDeleteClass, useSubjects } from "@/hooks/use-api";
import { PlusIcon, EyeIcon, PencilIcon, TrashIcon, AcademicCapIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { useAuthorization, isStudent } from "@/lib/authz";
import Tooltip from "@/components/Common/Tooltip";

import ConfirmDeleteDialog from "@/components/Common/ConfirmDeleteDialog";
import SelectInput from "@/components/FormElements/SelectInput";
import SearchInput from "@/components/FormElements/SearchInput";
import ButtonLink from "@/components/Common/ButtonLink";
import Button from "@/components/Common/Button";
import Pagination from "@/components/Common/Pagination";
import { useListPage } from "@/hooks/use-list-page";
import { useAuthContext } from "@/contexts/auth-context";
import { useLockContext } from "@/contexts/lock-context";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";
import { ClassCard } from "@/components/Classes/ClassCard";
import { CardSkeleton, GridSkeleton, StatsCardSkeleton } from "@/components/ui/loading";
import { getObjId } from "@/lib/id-utils";
import { useParentBlockGuard } from "@/hooks/use-role-guard";

export default function ClassesPage() {
  const { isBlocked: isBlockedByRole } = useParentBlockGuard();
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const { user } = useAuthContext();
  const { can } = useAuthorization();
  const { renderError } = useErrorDisplay(isStudent(user) ? "Lớp học của tôi" : "Quản lý lớp học");

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
    filterKeys: ["status", "search", "subject_id"],
    filterDefaults: {
      status: "all",
      search: "",
      subject_id: "all",
    },
  });

  // Extract individual filters for easier access
  const selectedStatus = filters.status || "all";
  const searchQuery = filters.search || "";
  const selectedSubjectId = filters.subject_id || "all";

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
  const { data: classes, loading, error, refetch, meta: classesMeta, permissions } = useClasses(actionsLocked ? undefined : apiFilters, !actionsLocked);
  const { data: subjects, loading: subjectsLoading } = useSubjects(undefined, {
    enabled: !actionsLocked,
  });

  // Extract subjects array from API response (could be direct array or nested in data property)
  const subjectsArray = useMemo(() => {
    if (!subjects) return [];
    if (Array.isArray(subjects)) return subjects;
    if (subjects?.data && Array.isArray(subjects.data)) return subjects.data;
    return [];
  }, [subjects]);

  // Keep a stable list of subjects to avoid losing options when filtering
  // Use useMemo with stable reference to avoid infinite loops
  const stableSubjects = useMemo(() => {
    // Always prioritize current API data
    if (subjectsArray.length > 0) {
      return subjectsArray;
    }
    // Fallback: return empty array (don't use ref to avoid stale data)
    return [];
  }, [subjectsArray]);

  // Use permissions from API response
  // can_view: quyền xem (học viên và giáo viên đều có thể có)
  // can_manage: quyền quản lý (chỉ giáo viên có gói với capability)
  const canView = permissions?.can_view ?? true; // Default true cho view
  const { mutate: deleteClass, loading: deleting } = useDeleteClass();
  const [confirmClassId, setConfirmClassId] = useState<string | null>(null);

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // Kiểm tra lock và plan feature trước để ưu tiên hiển thị lock content
  if (actionsLocked || planFeatureMessage) {
    return renderError();
  }

  // Check view permission - học viên cần can_view để xem, giáo viên cũng cần can_view
  // Chỉ block khi không có quyền xem
  if (!loading && permissions !== undefined && !canView) {
    return renderError(undefined, undefined, false);
  }

  if (error && !loading) {
    return renderError(error, () => refetch());
  }

  // Parent không dùng trang quản lý lớp — vào thẳng Family portal.
  if (isBlockedByRole) {
    return null;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <ConfirmDeleteDialog
        open={!!confirmClassId}
        onClose={() => setConfirmClassId(null)}
        onConfirm={async () => {
          if (!confirmClassId) return;
          const res = await deleteClass(confirmClassId);
          if (res.success) {
            setConfirmClassId(null);
            refetch();
          }
        }}
        loading={deleting}
        message="Bạn có chắc chắn muốn xóa lớp học này? Hành động không thể hoàn tác."
      />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white">
            {isStudent(user) ? 'Lớp học của tôi' : 'Quản lý lớp học'}
          </h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1">
            {isStudent(user) ? 'Xem tất cả các lớp học bạn đang tham gia' : 'Quản lý tất cả các lớp học của bạn'}
          </p>
        </div>

        {!isStudent(user) && (
          <ButtonLink
            href="/classes/create"
            icon={<PlusIcon />}
            size="sm"
            disabled={!can("create", "class::room")}
          >
            Tạo lớp học mới
          </ButtonLink>
        )}
      </div>


      {/* Stats - Hidden for students */}
      {!isStudent(user) && (
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
                    <AcademicCapIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                  </div>
                  <div className="ml-3 md:ml-4">
                    <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Tất cả">Tất cả</p>
                    <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                      {classesMeta?.total ?? classes?.length ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
                <div className="flex items-center">
                  <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                    <AcademicCapIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                  </div>
                  <div className="ml-3 md:ml-4">
                    <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Đang dạy">Đang dạy</p>
                    <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                      {classes?.filter((c: any) => c.status === 'active').length || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
                <div className="flex items-center">
                  <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                    <AcademicCapIcon className="h-5 w-5 md:h-6 md:w-6 text-primary-light" />
                  </div>
                  <div className="ml-3 md:ml-4">
                    <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Tạm dừng">Tạm dừng</p>
                    <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                      {classes?.filter((c: any) => c.status === 'inactive').length || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
                <div className="flex items-center">
                  <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                    <UserGroupIcon className="h-5 w-5 md:h-6 md:w-6 text-primary-light" />
                  </div>
                  <div className="ml-3 md:ml-4">
                    <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Học viên">Học viên</p>
                    <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                      {(classesMeta as any)?.statistics?.total_students ?? 0}
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
          <SearchInput
            label="Tìm kiếm"
            name="search"
            placeholder={loading ? "Đang tải..." : "Tìm kiếm lớp học..."}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={handleSearch}
            disabled={loading}
          />
          <SelectInput
            label="Trạng thái"
            name="status"
            value={selectedStatus}
            onChange={(e) => updateFilter("status", e.target.value)}
            disabled={loading}
            options={[
              { value: "all", label: "Tất cả" },
              { value: "active", label: "Đang dạy" },
              { value: "inactive", label: "Tạm dừng" },
            ]}
            placeholder={loading ? "Đang tải..." : "Chọn trạng thái"}
          />
          {/* Filter môn học - hiển thị cho cả học viên và giáo viên (có can_view) */}
          {canView && (
            <SelectInput
              label="Môn học"
              name="subject_id"
              value={selectedSubjectId}
              onChange={(e) => updateFilter("subject_id", e.target.value)}
              disabled={subjectsLoading || loading}
              options={[
                { value: "all", label: "Tất cả môn học" },
                ...(stableSubjects.map((subject: any) => {
                  const subjectId = getObjId(subject);
                  return {
                    value: subjectId,
                    label: subject.name,
                  };
                }) || []),
              ]}
              placeholder={subjectsLoading || loading ? "Đang tải..." : "Chọn môn học"}
            />
          )}

          {(searchQuery || selectedStatus !== "all" || selectedSubjectId !== "all") && (
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

      {/* Classes Grid */}
      {loading ? (
        <GridSkeleton
          count={6}
          cols={{ mobile: 1, tablet: 2, desktop: 3 }}
          renderItem={(i) => (
            <CardSkeleton
              key={i}
              showAvatar={false}
              showActions={true}
              lines={3}
              className="rounded-lg bg-white p-6 dark:bg-gray-800"
            />
          )}
        />
      ) : !classes || classes.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center dark:bg-gray-800">
          <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
            <PlusIcon className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {searchQuery ? "Không tìm thấy lớp học" : "Chưa có lớp học nào"}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {searchQuery
              ? "Thử thay đổi từ khóa tìm kiếm"
              : "Bắt đầu bằng cách tạo lớp học đầu tiên của bạn"
            }
          </p>
          {!searchQuery && (
            <ButtonLink
              href="/classes/create"
              icon={<PlusIcon />}
              size="sm"
              disabled={!can("create", "class::room")}
            >
              Tạo lớp học đầu tiên
            </ButtonLink>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
          {classes.map((cls: any, index: number) => {
            const classId = getObjId(cls);
            const classIdString = classId;

            return (
              <ClassCard
                key={classId || index}
                cls={cls}
                enrollment={cls.enrollment}
                showEnrollment={!!cls.enrollment}
                showTuition
                actions={
                  <div className="flex flex-wrap items-center gap-2 w-full">
                    <ButtonLink
                      href={`/classes/${classIdString}`}
                      variant="outline"
                      size="sm"
                      icon={<EyeIcon />}
                      className="flex-1 min-w-[120px]"
                    >
                      Xem lớp học
                    </ButtonLink>
                    {!isStudent(user) && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Tooltip label="Sổ điểm">
                          <ButtonLink
                            href={`/classes/${classIdString}/gradebook`}
                            variant="outline"
                            size="sm"
                            icon={<AcademicCapIcon />}
                            className="flex-shrink-0"
                            aria-label="Sổ điểm"
                          >
                            <span className="sr-only">Sổ điểm</span>
                          </ButtonLink>
                        </Tooltip>
                        <Tooltip label="Chỉnh sửa">
                          <ButtonLink
                            href={`/classes/${classIdString}/edit`}
                            variant="outline"
                            size="sm"
                            icon={<PencilIcon />}
                            className="flex-shrink-0"
                            aria-label="Chỉnh sửa"
                            disabled={!can("update", "class::room")}
                          >
                            <span className="sr-only">Chỉnh sửa</span>
                          </ButtonLink>
                        </Tooltip>
                        <Tooltip label="Xóa lớp học">
                          <Button
                            onClick={() => setConfirmClassId(classIdString)}
                            variant="danger"
                            size="sm"
                            icon={<TrashIcon />}
                            className="flex-shrink-0"
                            aria-label="Xóa lớp học"
                            disabled={!can("delete", "class::room")}
                          >
                            <span className="sr-only">Xóa lớp học</span>
                          </Button>
                        </Tooltip>
                      </div>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      )}

      {/* Pagination - chỉ hiển thị khi có dữ liệu */}
      {classes && classes.length > 0 && (
        <Pagination
          meta={classesMeta}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          itemLabel="lớp học"
          className="mt-6"
        />
      )}
    </div>
  );
}