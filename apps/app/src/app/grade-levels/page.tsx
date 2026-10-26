"use client";
import { useEffect, useMemo, useState } from "react";
import { useGradeLevels, useDeleteGradeLevel } from "@/hooks/use-api";
import { useTutorGuard } from "@/hooks/use-role-guard";
import { PlusIcon, PencilIcon, TrashIcon, AcademicCapIcon, CheckCircleIcon, XCircleIcon, FunnelIcon, XMarkIcon } from "@heroicons/react/24/outline";
import RichTextDisplay from "@/components/Common/RichTextDisplay";
import ConfirmDeleteDialog from "@/components/Common/ConfirmDeleteDialog";
import { useAuthorization } from "@/lib/authz";
import SelectInput from "@/components/FormElements/SelectInput";
import SearchInput from "@/components/FormElements/SearchInput";
import ButtonLink from "@/components/Common/ButtonLink";
import Button from "@/components/Common/Button";
import { useListPage } from "@/hooks/use-list-page";
import Pagination from "@/components/Common/Pagination";
import { useLockContext } from "@/contexts/lock-context";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";
import Tooltip from "@/components/Common/Tooltip";
import { tableStyles } from "@/components/Common/tableStyles";
import { getObjId } from "@/lib/id-utils";
export default function GradeLevelsPage() {
  const { isBlocked } = useTutorGuard();
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const { can } = useAuthorization();
  const { renderError } = useErrorDisplay("Quản lý khối lớp");

  // Use combined hook for filters (synchronized with URL)
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
    filterKeys: ["search", "status"],
    filterDefaults: {
      search: "",
      status: "all",
    },
  });

  // Extract individual filters for easier access
  const searchQuery = filters.search || "";
  const statusFilter = filters.status || "all";

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

  const gradeLevelFilters = useMemo(() => {
    const nextFilters = { ...apiFilters };
    if (statusFilter === "active") {
      nextFilters.is_active = true;
    } else if (statusFilter === "inactive") {
      nextFilters.is_active = false;
    }
    delete nextFilters.status;
    return nextFilters;
  }, [apiFilters, statusFilter]);

  const shouldFetchData = !actionsLocked && !planFeatureMessage;
  const { data: gradeLevels, loading, error, refetch, meta: gradeLevelsMeta } = useGradeLevels(shouldFetchData ? gradeLevelFilters : undefined, { enabled: shouldFetchData });
  const { mutate: deleteGradeLevel, loading: deleting } = useDeleteGradeLevel();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPage]);

  // Memoize the list so its identity is stable across renders when data is unchanged
  // (Array.isArray fallback would otherwise create a fresh [] every render)
  const gradeLevelsList = useMemo(() => (Array.isArray(gradeLevels) ? gradeLevels : []), [gradeLevels]);
  const activeCount = gradeLevelsList.filter((l: any) => l.is_active).length;
  const inactiveCount = gradeLevelsList.filter((l: any) => !l.is_active).length;
  const totalCount = gradeLevelsMeta?.total ?? gradeLevelsList.length;

  // Stable serialized key for filter-change detection (avoids complex expr in deps)
  const gradeLevelsFilterKey = JSON.stringify(gradeLevelFilters);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentPage, gradeLevelsFilterKey]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allIdsOnPage: string[] = useMemo(
    () => gradeLevelsList.map((l: any) => getObjId(l)),
    [gradeLevelsList]
  );
  const allSelectedOnPage =
    allIdsOnPage.length > 0 && allIdsOnPage.every((id) => selectedIds.has(id));

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

  const selectedCount = selectedIds.size;

  // Kiểm tra lock trước để ưu tiên hiển thị lock content
  if (actionsLocked || planFeatureMessage) {
    return renderError();
  }

  if (error && !loading) {
    return renderError(error, () => refetch());
  }

  if (isBlocked) {
    return null;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <ConfirmDeleteDialog
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={async () => {
          if (!confirmDeleteId) return;
          const res = await deleteGradeLevel(confirmDeleteId.toString());
          if (res.success) {
            setConfirmDeleteId(null);
            refetch();
          }
        }}
        loading={deleting}
        message="Bạn có chắc chắn muốn xóa cấp độ này? Hành động không thể hoàn tác. Nếu cấp độ này đang được sử dụng trong tài liệu học tập, bạn sẽ không thể xóa."
      />

      {/* Bulk delete confirm */}
      <ConfirmDeleteDialog
        open={bulkConfirmOpen && selectedCount > 0}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={async () => {
          const ids = Array.from(selectedIds);
          for (const id of ids) {
            await deleteGradeLevel(String(id));
          }
          setBulkConfirmOpen(false);
          setSelectedIds(new Set());
          refetch();
        }}
        loading={deleting}
        message={`Bạn có chắc chắn muốn xóa ${selectedCount} cấp độ đã chọn? Hành động không thể hoàn tác.`}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white">Quản lý cấp độ/Khối</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1">
            Quản lý các cấp độ/khối học trong hệ thống
          </p>
        </div>

        <ButtonLink
          href="/grade-levels/create"
          icon={<PlusIcon />}
          size="sm"
          disabled={!can("create", "grade_level")}
        >
          Tạo cấp độ mới
        </ButtonLink>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800 animate-pulse">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-lg bg-gray-200 dark:bg-gray-700" />
                <div className="ml-3 md:ml-4 flex-1 space-y-2">
                  <div className="h-4 w-20 md:w-24 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-6 md:h-8 w-12 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>
            </div>
          ))
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
                    {totalCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                  <CheckCircleIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
                <div className="ml-3 md:ml-4">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Đang dùng">Đang dùng</p>
                  <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                    {activeCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                  <XCircleIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
                <div className="ml-3 md:ml-4">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Không dùng">Không dùng</p>
                  <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                    {inactiveCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                  <FunnelIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
                <div className="ml-3 md:ml-4">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Đang hiển thị">Đang hiển thị</p>
                  <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                    {gradeLevelsList.length}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-lg bg-white p-4 dark:bg-gray-800">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 relative">
          <SearchInput
            label="Tìm kiếm"
            name="search"
            placeholder="Tìm kiếm theo tên, mã, mô tả..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={handleSearch}
          />
          <SelectInput
            label="Trạng thái"
            name="status"
            value={statusFilter}
            onChange={(e) => updateFilter("status", e.target.value)}
            options={[
              { label: "Tất cả trạng thái", value: "all" },
              { label: "Đang dùng", value: "active" },
              { label: "Không dùng", value: "inactive" },
            ]}
          />
          {(searchQuery || statusFilter !== "all") && (
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

      {/* Table */}
      <div className={tableStyles.wrapper}>
        {loading ? (
          <div className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              ))}
            </div>
          </div>
        ) : gradeLevelsList.length === 0 ? (
          <div className="p-12 text-center">
            <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Không có cấp độ</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchQuery || statusFilter !== "all"
                ? "Không tìm thấy cấp độ phù hợp với bộ lọc"
                : "Bắt đầu bằng cách tạo cấp độ mới"}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {gradeLevelsList.map((level: any) => {
                const levelId = getObjId(level);
                return (
                  <div key={levelId} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {level.name}
                          </h3>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${level.is_active
                            ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                            : 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]'
                            }`}>
                            {level.is_active ? 'Đang dùng' : 'Không dùng'}
                          </span>
                        </div>
                        <div className="space-y-1.5 mb-3">
                          {level.code && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              <span className="font-medium">Mã:</span> {level.code}
                            </div>
                          )}
                          {level.order !== undefined && level.order !== null && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              <span className="font-medium">Thứ tự:</span> {level.order || 0}
                            </div>
                          )}
                          {level.description && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                              <span className="font-medium">Mô tả:</span> <RichTextDisplay content={level.description} />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Tooltip label="Chỉnh sửa cấp độ">
                            <ButtonLink
                              href={`/grade-levels/${levelId}/edit`}
                              variant="ghost"
                              size="sm"
                              icon={<PencilIcon />}
                              aria-label="Chỉnh sửa cấp độ"
                              disabled={!can("update", "grade_level")}
                            >
                              <span className="sr-only">Chỉnh sửa</span>
                            </ButtonLink>
                          </Tooltip>
                          <Tooltip label="Xóa cấp độ">
                            <Button
                              onClick={() => setConfirmDeleteId(levelId)}
                              variant="ghost"
                              size="sm"
                              icon={<TrashIcon />}
                              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              aria-label="Xóa cấp độ"
                              disabled={!can("delete", "grade_level")}
                            >
                              <span className="sr-only">Xóa</span>
                            </Button>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              {selectedCount > 0 && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 text-xs sm:text-sm">
                  <div className="text-gray-600 dark:text-gray-300">
                    Đã chọn <span className="font-semibold">{selectedCount}</span> cấp độ
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
                      disabled={!can("delete", "grade_level")}
                    >
                      Xóa đã chọn
                    </Button>
                  </div>
                </div>
              )}
              <table className={`${tableStyles.table} min-w-[700px]`}>
                <thead className={tableStyles.thead}>
                  <tr>
                    <th className={tableStyles.headerCheckboxCell}>
                      <input
                        type="checkbox"
                        className={tableStyles.checkbox}
                        checked={allSelectedOnPage}
                        onChange={toggleSelectAllOnPage}
                        disabled={!can("delete", "grade_level")}
                      />
                    </th>
                    <th className={tableStyles.headerCellBase}>
                      Tên cấp độ/Khối
                    </th>
                    <th className={tableStyles.headerCellBase}>
                      Mã
                    </th>
                    <th className={tableStyles.headerCellBase}>
                      Thứ tự
                    </th>
                    <th className={tableStyles.headerCellBase}>
                      Trạng thái
                    </th>
                    <th className={`${tableStyles.headerCellBase} text-right`}>
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className={tableStyles.body}>
                  {gradeLevelsList.map((level: any) => {
                    const levelId = getObjId(level);
                    return (
                      <tr
                        key={levelId}
                        className={`${tableStyles.row} ${selectedIds.has(levelId) ? tableStyles.rowSelected : ""}`}
                      >
                        <td className="px-4 py-4 align-middle">
                          <input
                            type="checkbox"
                            className={tableStyles.checkbox}
                            checked={selectedIds.has(levelId)}
                            onChange={() => toggleSelect(levelId)}
                            disabled={!can("delete", "grade_level")}
                          />
                        </td>
                        <td className={tableStyles.cell}>
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {level.name}
                              </div>
                              {level.description && (
                                <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                                  <RichTextDisplay content={level.description} />
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900 dark:text-white">
                            {level.code || "-"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900 dark:text-white">
                            {level.order || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${level.is_active
                            ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                            : 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]'
                            }`}>
                            {level.is_active ? 'Đang dùng' : 'Không dùng'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative overflow-visible">
                          <div className="flex items-center justify-end gap-2">
                            <Tooltip label="Chỉnh sửa cấp độ">
                              <ButtonLink
                                href={`/grade-levels/${levelId}/edit`}
                                variant="ghost"
                                size="sm"
                                icon={<PencilIcon />}
                                aria-label="Chỉnh sửa cấp độ"
                                disabled={!can("update", "grade_level")}
                              >
                                <span className="sr-only">Chỉnh sửa</span>
                              </ButtonLink>
                            </Tooltip>
                            <Tooltip label="Xóa cấp độ">
                              <Button
                                onClick={() => setConfirmDeleteId(levelId)}
                                variant="ghost"
                                size="sm"
                                icon={<TrashIcon />}
                                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                aria-label="Xóa cấp độ"
                                disabled={!can("delete", "grade_level")}
                              >
                                <span className="sr-only">Xóa</span>
                              </Button>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <Pagination
        meta={gradeLevelsMeta}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        itemLabel="cấp độ"
        className="mt-6"
      />
    </div>
  );
}

