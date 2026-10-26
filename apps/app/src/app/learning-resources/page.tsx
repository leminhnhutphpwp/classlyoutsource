"use client";
import { useState, useEffect, useMemo } from "react";
import { useLearningResources, useDeleteLearningResource } from "@/hooks/use-api";
import { PlusIcon, EyeIcon, PencilIcon, TrashIcon, DocumentArrowUpIcon, LinkIcon, XMarkIcon, PlayIcon } from "@heroicons/react/24/outline";
import RichTextDisplay from "@/components/Common/RichTextDisplay";
import ConfirmDeleteDialog from "@/components/Common/ConfirmDeleteDialog";
import SelectInput from "@/components/FormElements/SelectInput";
import SearchInput from "@/components/FormElements/SearchInput";
import ButtonLink from "@/components/Common/ButtonLink";
import Button from "@/components/Common/Button";
import Pagination from "@/components/Common/Pagination";
import { useListPage } from "@/hooks/use-list-page";
import { useLockContext } from "@/contexts/lock-context";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";
import Tooltip from "@/components/Common/Tooltip";
import { getLearningResourceTypeBadge, getLearningResourceFileSize } from "@/lib/learning-resource-helpers";
import { tableStyles } from "@/components/Common/tableStyles";
import { getObjId } from "@/lib/id-utils";
import { MediaOptimizationUtils } from "@/lib/media-optimization-utils";
import { useParentBlockGuard } from "@/hooks/use-role-guard";

export default function LearningResourcesPage() {
  const { isBlocked: isBlockedByRole } = useParentBlockGuard();
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const { renderError } = useErrorDisplay("Tài liệu học tập");
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
    filterKeys: ["type", "search"],
    filterDefaults: {
      type: "all",
      search: "",
    },
  });

  // Extract individual filters for easier access
  const typeFilter = filters.type || "all";
  const searchQuery = filters.search || "";

  // Local state for search input (not triggering API call immediately)
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  // Sync searchInput with searchQuery when filter changes externally
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  const handleSearch = () => {
    updateFilter("search", searchInput);
  };


  const [confirmResourceId, setConfirmResourceId] = useState<string | null>(null);

  // Luôn giới hạn tài liệu đang hoạt động khi gọi API
  const resourceFilters = useMemo(
    () => ({
      ...apiFilters,
      status: 'active',
    }),
    [apiFilters]
  );

  const { data: resources, loading, error, refetch, meta: resourcesMeta, permissions } = useLearningResources(actionsLocked ? undefined : resourceFilters);
  const { mutate: deleteResource, loading: deleting } = useDeleteLearningResource();
  const resourceFiltersKey = JSON.stringify(resourceFilters);

  // Reset selection when data changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentPage, resourceFiltersKey]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allIdsOnPage: string[] = useMemo(
    () => (resources || []).map((r: any) => getObjId(r)),
    [resources]
  );
  const allSelectedOnPage =
    allIdsOnPage.length > 0 &&
    allIdsOnPage.every((id) => selectedIds.has(id));

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

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // Kiểm tra lock và plan feature trước để ưu tiên hiển thị lock content
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

  // Parent không dùng trang tài liệu học tập — vào thẳng Family portal.
  if (isBlockedByRole) {
    return null;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <ConfirmDeleteDialog
        open={!!confirmResourceId}
        onClose={() => setConfirmResourceId(null)}
        onConfirm={async () => {
          if (!confirmResourceId) return;
          const res = await deleteResource(confirmResourceId);
          if (res.success) {
            setConfirmResourceId(null);
            refetch();
          }
        }}
        loading={deleting}
        message="Bạn có chắc chắn muốn xóa tài liệu này? Hành động không thể hoàn tác."
      />

      {/* Bulk delete confirm */}
      <ConfirmDeleteDialog
        open={bulkConfirmOpen && selectedCount > 0}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={async () => {
          const ids = Array.from(selectedIds);
          for (const id of ids) {
            await deleteResource(String(id));
          }
          setBulkConfirmOpen(false);
          setSelectedIds(new Set());
          refetch();
        }}
        loading={deleting}
        message={`Bạn có chắc chắn muốn xóa ${selectedCount} tài liệu đã chọn? Hành động không thể hoàn tác.`}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white">Quản lý tài liệu</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1">
            Quản lý tất cả tài liệu học tập của bạn
          </p>
        </div>

        {canManage && (
          <ButtonLink
            href="/learning-resources/create"
            icon={<PlusIcon />}
            size="sm"
          >
            Tạo tài liệu mới
          </ButtonLink>
        )}
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
                  <DocumentArrowUpIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
                <div className="ml-3 md:ml-4">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Tất cả">Tất cả</p>
                  <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                    {(resourcesMeta as any)?.statistics?.total ?? resources?.length ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                  <DocumentArrowUpIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
                <div className="ml-3 md:ml-4">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Tài liệu">Tài liệu</p>
                  <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                    {(resourcesMeta as any)?.statistics?.document ?? 0}
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
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Video">Video</p>
                  <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                    {(resourcesMeta as any)?.statistics?.video ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                  <LinkIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
                <div className="ml-3 md:ml-4">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Liên kết">Liên kết</p>
                  <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                    {(resourcesMeta as any)?.statistics?.link ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Search and Filters */}
      <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 relative">
          <SearchInput
            label="Tìm kiếm"
            name="search"
            placeholder={loading ? "Đang tải..." : "Tìm kiếm tài liệu..."}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={handleSearch}
            disabled={loading}
          />
          <SelectInput
            label="Loại tài liệu"
            name="type"
            value={typeFilter}
            onChange={(e) => updateFilter("type", e.target.value)}
            disabled={loading}
            options={[
              { label: "Tất cả loại", value: "all" },
              { label: "Tài liệu", value: "document" },
              { label: "Video", value: "video" },
              { label: "Hình ảnh", value: "image" },
              { label: "Âm thanh", value: "audio" },
              { label: "Liên kết", value: "link" },
              { label: "Khác", value: "other" },
            ]}
            placeholder={loading ? "Đang tải..." : "Chọn loại tài liệu"}
          />

          {(searchQuery || typeFilter !== "all") && (
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

      {/* Resources List */}
      <div className={tableStyles.wrapper}>
        {canManage && selectedCount > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 text-xs sm:text-sm">
            <div className="text-gray-600 dark:text-gray-300">
              Đã chọn <span className="font-semibold">{selectedCount}</span> tài liệu
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
              >
                Xóa đã chọn
              </Button>
            </div>
          </div>
        )}
        {loading ? (
          <div className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="h-12 w-12 rounded-lg bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-3 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                  <div className="h-8 w-20 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              ))}
            </div>
          </div>
        ) : !resources || resources.length === 0 ? (
          <div className="p-12 text-center">
            <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
              Chưa có tài liệu
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {searchQuery || typeFilter !== "all"
                ? "Không tìm thấy tài liệu phù hợp với bộ lọc"
                : "Bắt đầu bằng cách tạo tài liệu mới"}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="lg:hidden space-y-2.5">
              {(resources || []).map((resource: any) => {
                const resourceId = getObjId(resource);
                const isSelected = selectedIds.has(resourceId);
                const typeBadge = getLearningResourceTypeBadge(resource);
                return (
                  <div
                    key={resourceId}
                    className={`rounded-lg border p-4 sm:p-6 transition-colors ${isSelected
                      ? 'border-primary bg-primary-pastel/20 dark:bg-primary/10'
                      : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      {canManage && (
                        <div className="pt-1">
                          <input
                            type="checkbox"
                            className={tableStyles.checkbox}
                            checked={isSelected}
                            onChange={() => toggleSelect(resourceId)}
                          />
                        </div>
                      )}
                      <div className={`flex h-12 w-12 items-center justify-center rounded-lg flex-shrink-0 ${resource.type === 'video'
                        ? 'bg-primary-100 bg-primary-pastel/40'
                        : resource.type === 'document'
                          ? 'bg-primary-100 bg-primary-pastel/40'
                          : 'bg-primary-100'
                        }`}>
                        {resource.type === 'image' && resource.media_files?.length > 0 ? (
                          <div className="relative w-full h-full rounded-lg overflow-hidden">
                            <img
                              src={MediaOptimizationUtils.getOptimizedUrl(resource.media_files[0], 'thumbnail') ||
                                MediaOptimizationUtils.getOptimizedUrl(resource.media_files[0], 'preview')}
                              alt={resource.title}
                              className="w-full h-full object-cover"
                            />
                            {resource.media_files.length > 1 && (
                              <div className="absolute -bottom-0.5 -right-0.5 bg-primary text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">
                                {resource.media_files.length}
                              </div>
                            )}
                          </div>
                        ) : resource.type === 'video' ? (
                          <PlayIcon className="h-6 w-6 text-primary" />
                        ) : resource.external_url ? (
                          <LinkIcon className="h-6 w-6 text-primary" />
                        ) : (
                          <DocumentArrowUpIcon className="h-6 w-6 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 relative">
                        <div className="space-y-2 pr-16">
                          <h3 className="font-medium text-gray-900 dark:text-white text-base sm:text-lg line-clamp-2">
                            {resource.title}
                          </h3>
                          {resource.description && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                              <RichTextDisplay content={resource.description} />
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                            {typeBadge ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${typeBadge.bgColor} ${typeBadge.textColor}`}>
                                {typeBadge.icon}
                                <span>{typeBadge.label}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 bg-primary-pastel/40 text-primary">
                                {resource.type_label || resource.type || 'N/A'}
                              </span>
                            )}
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${resource.status === 'active'
                              ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                              : 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]'
                              }`}>
                              {resource.status === 'active' ? 'Đang dùng' : 'Đã lưu trữ'}
                            </span>
                            {getLearningResourceFileSize(resource) && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {getLearningResourceFileSize(resource)}
                              </span>
                            )}
                            {resource.views !== undefined && resource.views !== null && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {resource.views} lượt xem
                              </span>
                            )}
                            {resource.type === 'image' && resource.media_files?.length > 1 && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {resource.media_files.length} hình ảnh
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-center items-center w-12 gap-0.5">
                          <Tooltip label="Xem tài liệu">
                            <ButtonLink
                              href={`/learning-resources/${resourceId}`}
                              variant="ghost"
                              size="sm"
                              icon={<EyeIcon className="h-4 w-4" />}
                              aria-label="Xem tài liệu"
                              className="!h-8 !w-8 !p-0 !min-w-0 flex items-center justify-center"
                            >
                              <span className="sr-only">Xem tài liệu</span>
                            </ButtonLink>
                          </Tooltip>
                          {canManage && (
                            <>
                              <Tooltip label="Chỉnh sửa">
                                <ButtonLink
                                  href={`/learning-resources/${resourceId}/edit`}
                                  variant="ghost"
                                  size="sm"
                                  icon={<PencilIcon className="h-4 w-4" />}
                                  aria-label="Chỉnh sửa"
                                  className="!h-8 !w-8 !p-0 !min-w-0 flex items-center justify-center"
                                >
                                  <span className="sr-only">Chỉnh sửa</span>
                                </ButtonLink>
                              </Tooltip>
                              <Tooltip label="Xóa">
                                <Button
                                  onClick={() => setConfirmResourceId(resourceId)}
                                  variant="ghost"
                                  size="sm"
                                  icon={<TrashIcon className="h-4 w-4" />}
                                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 !h-8 !w-8 !p-0 !min-w-0 flex items-center justify-center"
                                  aria-label="Xóa"
                                >
                                  <span className="sr-only">Xóa</span>
                                </Button>
                              </Tooltip>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden lg:block">
              <div className={tableStyles.tableContainer}>
                <table className={tableStyles.table}>
                  <thead className={tableStyles.thead}>
                    <tr>
                      {canManage && (
                        <th className={tableStyles.headerCheckboxCell}>
                          <input
                            type="checkbox"
                            className={tableStyles.checkbox}
                            checked={allSelectedOnPage}
                            onChange={toggleSelectAllOnPage}
                          />
                        </th>
                      )}
                      <th className={tableStyles.headerCellBase}>
                        Tài liệu
                      </th>
                      <th className={tableStyles.headerCellBase}>
                        Loại
                      </th>
                      <th className={`${tableStyles.headerCellBase} hidden lg:table-cell`}>
                        Kích thước
                      </th>
                      <th className={`${tableStyles.headerCellBase} hidden lg:table-cell`}>
                        Lượt xem
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
                    {(resources || []).map((resource: any) => {
                      const resourceId = getObjId(resource);
                      const isSelected = selectedIds.has(resourceId);
                      return (
                        <tr
                          key={resourceId}
                          className={`${tableStyles.row} ${isSelected ? tableStyles.rowSelected : ""}`}
                        >
                          {canManage && (
                            <td className="px-4 py-4 align-middle">
                              <input
                                type="checkbox"
                                className={tableStyles.checkbox}
                                checked={isSelected}
                                onChange={() => toggleSelect(resourceId)}
                              />
                            </td>
                          )}
                          <td className={tableStyles.cell}>
                            <div className="flex items-center gap-3">
                              <div className={`flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0 ${resource.type === 'video'
                                ? 'bg-primary-100 bg-primary-pastel/40'
                                : resource.type === 'document'
                                  ? 'bg-primary-100 bg-primary-pastel/40'
                                  : 'bg-primary-100'
                                }`}>
                                {resource.type === 'image' && resource.media_files?.length > 0 ? (
                                  <div className="relative w-full h-full rounded-lg overflow-hidden">
                                    <img
                                      src={MediaOptimizationUtils.getOptimizedUrl(resource.media_files[0], 'thumbnail') ||
                                        MediaOptimizationUtils.getOptimizedUrl(resource.media_files[0], 'preview')}
                                      alt={resource.title}
                                      className="w-full h-full object-cover"
                                    />
                                    {resource.media_files.length > 1 && (
                                      <div className="absolute -bottom-0.5 -right-0.5 bg-primary text-white text-xs rounded-full w-3.5 h-3.5 flex items-center justify-center font-medium">
                                        {resource.media_files.length}
                                      </div>
                                    )}
                                  </div>
                                ) : resource.type === 'video' ? (
                                  <PlayIcon className="h-5 w-5 text-primary" />
                                ) : resource.external_url ? (
                                  <LinkIcon className="h-5 w-5 text-primary" />
                                ) : (
                                  <DocumentArrowUpIcon className="h-5 w-5 text-primary" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-gray-900 dark:text-white">
                                  {resource.title}
                                </div>
                                {resource.description && (
                                  <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mt-1">
                                    <RichTextDisplay content={resource.description} />
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {(() => {
                              const typeBadge = getLearningResourceTypeBadge(resource);
                              if (!typeBadge) {
                                return (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 bg-primary-pastel/40 text-primary">
                                    {resource.type_label || resource.type || 'N/A'}
                                  </span>
                                );
                              }
                              return (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium ${typeBadge.bgColor} ${typeBadge.textColor}`}>
                                  {typeBadge.icon}
                                  <span>{typeBadge.label}</span>
                                </span>
                              );
                            })()}
                          </td>
                          <td className={`${tableStyles.cellNumeric} hidden lg:table-cell`}>
                            {getLearningResourceFileSize(resource) || '-'}
                          </td>
                          <td className={`${tableStyles.cellNumeric} hidden lg:table-cell`}>
                            {resource.views || 0}
                          </td>
                          <td className={tableStyles.cellStatus}>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${resource.status === 'active'
                              ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                              : 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]'
                              }`}>
                              {resource.status === 'active' ? 'Đang dùng' : 'Đã lưu trữ'}
                            </span>
                          </td>
                          <td className={tableStyles.cellActions}>
                            <div className="flex items-center justify-end gap-2">
                              <Tooltip label="Xem tài liệu">
                                <ButtonLink
                                  href={`/learning-resources/${resourceId}`}
                                  variant="ghost"
                                  size="sm"
                                  icon={<EyeIcon />}
                                  aria-label="Xem tài liệu"
                                >
                                  <span className="sr-only">Xem tài liệu</span>
                                </ButtonLink>
                              </Tooltip>
                              {canManage && (
                                <>
                                  <Tooltip label="Chỉnh sửa">
                                    <ButtonLink
                                      href={`/learning-resources/${resourceId}/edit`}
                                      variant="ghost"
                                      size="sm"
                                      icon={<PencilIcon />}
                                      aria-label="Chỉnh sửa"
                                    >
                                      <span className="sr-only">Chỉnh sửa</span>
                                    </ButtonLink>
                                  </Tooltip>
                                  <Tooltip label={selectedCount > 0 ? "Xóa tài liệu này" : "Xóa"}>
                                    <Button
                                      onClick={() => setConfirmResourceId(resourceId)}
                                      variant="ghost"
                                      size="sm"
                                      icon={<TrashIcon />}
                                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                      aria-label="Xóa"
                                    >
                                      <span className="sr-only">Xóa</span>
                                    </Button>
                                  </Tooltip>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Pagination - chỉ hiển thị khi có dữ liệu */}
      {resources && resources.length > 0 && (
        <Pagination
          meta={resourcesMeta}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          itemLabel="tài liệu học tập"
          className="mt-6"
        />
      )}
    </div>
  );
}

