"use client";
import { useEffect, useState, useMemo } from "react";
import { useSchedules, useDeleteSchedule, useClasses, useStudentClasses } from "@/hooks/use-api";
import { useStudentId } from "@/hooks/use-student-id";
import { useAuthContext } from "@/contexts/auth-context";
import { isStudent, useAuthorization } from "@/lib/authz";
import { PlusIcon, CalendarIcon, ClockIcon, PlayIcon } from "@heroicons/react/24/outline";
import ButtonLink from "@/components/Common/ButtonLink";
import SelectInput from "@/components/FormElements/SelectInput";
import SearchInput from "@/components/FormElements/SearchInput";
import ConfirmDeleteDialog from "@/components/Common/ConfirmDeleteDialog";
import Pagination from "@/components/Common/Pagination";
import { useListPage } from "@/hooks/use-list-page";
import { useLockContext } from "@/contexts/lock-context";
import ErrorDisplay, { useErrorDisplay } from "@/components/Common/ErrorDisplay";
import { ScheduleListCard } from "@/components/Schedules/ScheduleListCard";
import { CardSkeleton, GridSkeleton, StatsCardSkeleton } from "@/components/ui/loading";
import { getObjId } from "@/lib/id-utils";
export default function SchedulesPage() {
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const { user } = useAuthContext();
  const isStudentUser = isStudent(user);
  const { studentId } = useStudentId();
  const { can } = useAuthorization();
  const { renderError } = useErrorDisplay(isStudentUser ? "Lịch học của tôi" : "Quản lý lịch học");

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
    filterKeys: ["status", "class_id", "mode", "search"],
    filterDefaults: {
      status: "all",
      class_id: "all",
      mode: "all",
      search: "",
    },
  });

  // Extract individual filters for easier access
  const statusFilter = filters.status || "all";
  const classFilter = filters.class_id || "all";
  const modeFilter = filters.mode || "all";
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


  const { data: schedules, loading, error, refetch, meta: schedulesMeta } = useSchedules(actionsLocked ? undefined : apiFilters);
  const { data: classes, loading: classesLoading } = useClasses(undefined, !actionsLocked);
  const { mutate: deleteSchedule, loading: deleting } = useDeleteSchedule();
  const [confirmScheduleId, setConfirmScheduleId] = useState<string | null>(null);

  // Check enrollment status for students - filter out schedules from paused classes
  const shouldLoadStudentClasses = isStudentUser && !!studentId && !actionsLocked;
  const { classes: studentClasses } = useStudentClasses(
    shouldLoadStudentClasses ? studentId : '0'
  );

  // Build a map of paused class IDs for quick lookup
  const pausedClassIds = useMemo(() => {
    if (!shouldLoadStudentClasses || !studentClasses) {
      return new Set<string>();
    }
    const ids = new Set<string>();
    studentClasses.forEach((cls: any) => {
      if (cls?.enrollment?.is_paused) {
        const identifier = getObjId(cls);
        if (identifier) {
          ids.add(String(identifier));
        }
      }
    });
    return ids;
  }, [shouldLoadStudentClasses, studentClasses]);

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // Filter out schedules from paused classes for students
  const schedulesList = useMemo(() => {
    const allSchedules = Array.isArray(schedules?.data)
      ? schedules.data
      : Array.isArray(schedules)
        ? schedules
        : [];

    // For students, filter out schedules from paused classes
    if (isStudentUser && pausedClassIds.size > 0) {
      return allSchedules.filter((schedule: any) => {
        const scheduleClassId = getObjId(schedule.class_id || schedule.class || schedule.classId);
        return !scheduleClassId || !pausedClassIds.has(String(scheduleClassId));
      });
    }

    return allSchedules;
  }, [schedules, isStudentUser, pausedClassIds]);

  if (error && !loading) {
    return <ErrorDisplay error={error} title={isStudentUser ? "Lịch học của tôi" : "Quản lý lịch học"} onRetry={() => refetch()} />;
  }

  if (actionsLocked || planFeatureMessage) {
    return renderError();
  }

  return (
    <div className="space-y-6">
      <ConfirmDeleteDialog
        open={!!confirmScheduleId}
        onClose={() => setConfirmScheduleId(null)}
        onConfirm={async () => {
          if (!confirmScheduleId) return;
          const res = await deleteSchedule(confirmScheduleId);
          if (res.success) {
            setConfirmScheduleId(null);
            refetch();
          }
        }}
        loading={deleting}
        message="Bạn có chắc chắn muốn xóa lịch học này? Hành động không thể hoàn tác."
      />
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">
            {isStudentUser ? 'Lịch học của tôi' : 'Quản lý lịch học'}
          </h1>
          <p className="text-sm sm:text-base text-dark-4 dark:text-dark-6 mt-1 truncate">
            {isStudentUser ? 'Xem lịch học và buổi học của các lớp bạn tham gia' : 'Quản lý lịch học và buổi học của các lớp'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch lg:items-center gap-2">
          <ButtonLink
            href="/calendar"
            variant="outline"
            size="sm"
            icon={<CalendarIcon />}
            className="w-full sm:w-auto lg:w-auto justify-center"
          >
            Xem dạng lịch
          </ButtonLink>
          {!isStudentUser && (
            <ButtonLink
              href="/schedules/create"
              variant="primary"
              size="sm"
              icon={<PlusIcon />}
              className="w-full sm:w-auto lg:w-auto justify-center"
              disabled={!can("create", "schedule")}
            >
              Tạo lịch học mới
            </ButtonLink>
          )}
        </div>
      </div>


      {/* Stats - Hidden for students */}
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
                    <CalendarIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                  </div>
                  <div className="ml-3 md:ml-4">
                    <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Tất cả">Tất cả</p>
                    <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                      {(schedulesMeta as any)?.statistics?.total ?? schedulesMeta?.total ?? schedulesList.length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
                <div className="flex items-center">
                  <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                    <PlayIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                  </div>
                  <div className="ml-3 md:ml-4">
                    <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title={isStudentUser ? "Đang học" : "Đang dạy"}>
                      {isStudentUser ? "Đang học" : "Đang dạy"}
                    </p>
                    <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                      {(schedulesMeta as any)?.statistics?.in_progress ?? 0}
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
                    <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Sắp bắt đầu">Sắp bắt đầu</p>
                    <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                      {(schedulesMeta as any)?.statistics?.upcoming ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
                <div className="flex items-center">
                  <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                    <CalendarIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                  </div>
                  <div className="ml-3 md:ml-4">
                    <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Hoàn thành">Hoàn thành</p>
                    <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                      {(schedulesMeta as any)?.statistics?.completed ?? 0}
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 relative">
          <SearchInput
            label="Tìm kiếm"
            name="search"
            placeholder={loading ? "Đang tải..." : "Tìm kiếm lịch học..."}
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
            disabled={classesLoading || loading}
            options={[
              { value: "all", label: "Tất cả trạng thái" },
              { value: "upcoming", label: "Sắp bắt đầu" },
              { value: "in_progress", label: "Đang diễn ra" },
              { value: "paused", label: "Tạm dừng" },
              { value: "completed", label: "Đã hoàn thành" },
            ]}
            placeholder={classesLoading || loading ? "Đang tải..." : "Chọn trạng thái"}
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
          <SelectInput
            label="Chế độ học"
            name="mode"
            value={modeFilter}
            onChange={(e) => updateFilter("mode", e.target.value)}
            disabled={classesLoading || loading}
            options={[
              { value: "all", label: "Tất cả chế độ" },
              { value: "offline", label: "Trực tiếp (Offline)" },
              { value: "online", label: "Trực tuyến (Online)" },
            ]}
            placeholder={classesLoading || loading ? "Đang tải..." : "Chọn chế độ học"}
          />

          {(searchQuery || statusFilter !== "all" || classFilter !== "all" || modeFilter !== "all") && (
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

      {/* Schedules Grid */}
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
              className="rounded-lg bg-white p-4 dark:bg-gray-800 md:p-6"
            />
          )}
        />
      ) : schedulesList.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center dark:bg-gray-800">
          <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
            <CalendarIcon className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {searchQuery || statusFilter !== "all" ? "Không tìm thấy lịch học" : "Chưa có lịch học nào"}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {searchQuery || statusFilter !== "all"
              ? "Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc"
              : "Bắt đầu bằng cách tạo lịch học đầu tiên"
            }
          </p>
          {!searchQuery && statusFilter === "all" && !isStudentUser && (
            <ButtonLink
              href="/schedules/create"
              variant="primary"
              size="sm"
              icon={<PlusIcon />}
              disabled={!can("create", "schedule")}
            >
              Tạo lịch học đầu tiên
            </ButtonLink>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
          {schedulesList.map((schedule: any) => {
            const scheduleIdString = getObjId(schedule);
            return (
              <ScheduleListCard
                key={scheduleIdString}
                schedule={schedule}
                canManage={can("update", "schedule")}
                onDelete={(id) => setConfirmScheduleId(String(id))}
              />
            );
          })}
        </div>
      )}

      {/* Pagination - chỉ hiển thị khi có dữ liệu */}
      {schedulesList.length > 0 && (
        <Pagination
          meta={schedulesMeta}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          itemLabel="lịch học"
          className="mt-6"
        />
      )}
    </div>
  );
}
