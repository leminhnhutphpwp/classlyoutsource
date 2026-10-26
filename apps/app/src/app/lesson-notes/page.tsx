"use client";
import { useEffect, useMemo, useState } from "react";
import { useLessonNotes, useClasses, useDeleteLessonNote } from "@/hooks/use-api";
import { PlusIcon, DocumentTextIcon, CalendarIcon, StarIcon } from "@heroicons/react/24/outline";
import { useAuthorization } from "@/lib/authz";
import SelectInput from "@/components/FormElements/SelectInput";
import SearchInput from "@/components/FormElements/SearchInput";
import DateInput from "@/components/FormElements/DateInput";
import ButtonLink from "@/components/Common/ButtonLink";
import Pagination from "@/components/Common/Pagination";
import { useListPage } from "@/hooks/use-list-page";
import { useLockContext } from "@/contexts/lock-context";
import { LessonNoteCard } from "@/components/LessonNotes/LessonNoteCard";
import ConfirmDeleteDialog from "@/components/Common/ConfirmDeleteDialog";
import { tableStyles } from "@/components/Common/tableStyles";
import Link from "next/link";
import { EyeIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import Tooltip from "@/components/Common/Tooltip";
import Button from "@/components/Common/Button";
import { getObjId } from "@/lib/id-utils";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";
export default function LessonNotesPage() {
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const { renderError } = useErrorDisplay("Quản lý ghi chú bài học");
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
    defaultPerPage: 12,
    filterKeys: ["class_id", "search", "date_from", "date_to"],
    filterDefaults: {
      class_id: "all",
      search: "",
      date_from: "",
      date_to: "",
    },
  });

  // Extract individual filters for easier access
  const classFilter = filters.class_id || "all";
  const searchQuery = filters.search || "";
  const dateFromFilter = filters.date_from || "";
  const dateToFilter = filters.date_to || "";

  // Local state for search input (not triggering API call immediately)
  const [searchInput, setSearchInput] = useState(searchQuery);

  // Sync searchInput with searchQuery when filter changes externally
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  const handleSearch = () => {
    updateFilter("search", searchInput);
  };

  const [confirmNoteId, setConfirmNoteId] = useState<string | null>(null);
  const { data: notes, loading, error, meta: notesMeta, permissions, refetch } = useLessonNotes(actionsLocked ? undefined : apiFilters);
  const { mutate: deleteNote, loading: deleting } = useDeleteLessonNote();
  // Fetch all classes for filter dropdown (not filtered)
  const { data: allClasses } = useClasses(actionsLocked ? undefined : { per_page: 1000 }, !actionsLocked);
  useAuthorization();

  // Use permissions from API response, fallback to false if not available
  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // Get unique classes from all classes (not from filtered notes)
  const uniqueClasses = useMemo(() => {
    if (!allClasses) return [];
    return allClasses
      .filter((cls: any) => getObjId(cls) && cls.name)
      .map((cls: any) => ({ id: getObjId(cls), name: cls.name }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [allClasses]);

  // Kiểm tra lock và plan feature trước để ưu tiên hiển thị lock content
  if (actionsLocked || planFeatureMessage) return renderError();

  // Use permissions from API response
  const canView = permissions?.can_view ?? true; // Default true cho view
  const canManage = permissions?.can_manage ?? false;

  // Check view permission - chỉ block khi không có quyền xem
  if (!loading && permissions !== undefined && !canView) return renderError(undefined, undefined, false);

  if (error && !loading) {
    return renderError(error, () => refetch());
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <ConfirmDeleteDialog
        open={!!confirmNoteId}
        onClose={() => setConfirmNoteId(null)}
        onConfirm={async () => {
          if (!confirmNoteId) return;
          const res = await deleteNote(confirmNoteId);
          if (res.success) {
            setConfirmNoteId(null);
            refetch();
          }
        }}
        loading={deleting}
        message="Bạn có chắc chắn muốn xóa ghi chú này? Hành động không thể hoàn tác."
      />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white">Quản lý ghi chú bài học</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1">
            Xem và quản lý ghi chú bài học của các lớp
          </p>
        </div>

        <ButtonLink
          href="/lesson-notes/create"
          icon={<PlusIcon />}
          size="sm"
          disabled={!canManage}
        >
          Tạo ghi chú mới
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
                  <DocumentTextIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
                <div className="ml-3 md:ml-4">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Tất cả">Tất cả</p>
                  <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                    {(notesMeta as any)?.statistics?.total ?? notes?.length ?? 0}
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
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Tháng này">Tháng này</p>
                  <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                    {(notesMeta as any)?.statistics?.this_month ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                  <StarIcon className="h-5 w-5 md:h-6 md:w-6 text-primary-light" />
                </div>
                <div className="ml-3 md:ml-4">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Trung bình">Trung bình</p>
                  <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                    {(() => {
                      const avg = (notesMeta as any)?.statistics?.average_rating ?? 0;
                      return avg % 1 === 0 ? avg.toString() : avg.toFixed(1);
                    })()}
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
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Lớp học">Lớp học</p>
                  <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                    {(notesMeta as any)?.statistics?.unique_classes ?? uniqueClasses.length}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Search and Filters */}
      <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 relative">
          <SearchInput
            label="Tìm kiếm"
            name="search"
            placeholder={loading ? "Đang tải..." : "Tìm kiếm..."}
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
            disabled={loading}
            options={[
              { label: "Tất cả lớp học", value: "all" },
              ...uniqueClasses.map((classItem: any) => ({
                label: classItem.name,
                value: getObjId(classItem),
              })),
            ]}
            placeholder={loading ? "Đang tải..." : "Chọn lớp học"}
          />
          <DateInput
            label="Từ ngày"
            name="date_from"
            value={dateFromFilter}
            onChange={(e) => updateFilter("date_from", e.target.value)}
            disabled={loading}
            placeholder="Chọn ngày bắt đầu"
          />
          <DateInput
            label="Đến ngày"
            name="date_to"
            value={dateToFilter}
            onChange={(e) => updateFilter("date_to", e.target.value)}
            disabled={loading}
            placeholder="Chọn ngày kết thúc"
          />

          {(searchQuery || classFilter !== "all" || dateFromFilter || dateToFilter) && (
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

      {/* Notes List */}
      <div className={tableStyles.wrapper}>
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
        ) : !notes || notes.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <DocumentTextIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchQuery || classFilter !== "all" ? "Không tìm thấy ghi chú" : "Chưa có ghi chú nào"}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {searchQuery || classFilter !== "all"
                ? "Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc"
                : "Bắt đầu bằng cách tạo ghi chú bài học đầu tiên"
              }
            </p>
            {!searchQuery && classFilter === "all" && (
              <ButtonLink
                href="/lesson-notes/create"
                icon={<PlusIcon />}
                size="sm"
                disabled={!canManage}
              >
                Tạo ghi chú đầu tiên
              </ButtonLink>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="lg:hidden space-y-4 p-4">
              {(notes || []).map((note: any) => {
                const noteId = getObjId(note);
                return (
                  <LessonNoteCard
                    key={noteId}
                    note={note}
                    canManage={canManage}
                    onDelete={() => setConfirmNoteId(String(noteId))}
                  />
                );
              })}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden lg:block">
              <div className={tableStyles.tableContainer}>
                <table className={tableStyles.table}>
                  <thead className={tableStyles.thead}>
                    <tr>
                      <th className={tableStyles.headerCellBase}>
                        Ngày học
                      </th>
                      <th className={tableStyles.headerCellBase}>
                        Lớp học
                      </th>
                      <th className={tableStyles.headerCellBase}>
                        Ghi chú học viên
                      </th>
                      <th className={tableStyles.headerCellBase}>
                        Đánh giá
                      </th>
                      <th className={`${tableStyles.headerCellBase} text-right`}>
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className={tableStyles.body}>
                    {(notes || []).map((note: any) => {
                      const noteId = getObjId(note);
                      return (
                        <tr
                          key={noteId}
                          className={tableStyles.row}
                        >
                          <td className={tableStyles.cell}>
                            <Link
                              href={`/lesson-notes/${noteId}`}
                              className="font-medium text-gray-900 hover:text-primary dark:text-white dark:hover:text-primary"
                            >
                              {note.lesson_date
                                ? new Date(note.lesson_date).toLocaleDateString("vi-VN")
                                : "N/A"
                              }
                            </Link>
                          </td>
                          <td className={tableStyles.cell}>
                            <span className="text-gray-600 dark:text-gray-300">
                              {note.class?.name || "N/A"}
                            </span>
                          </td>
                          <td className={tableStyles.cell}>
                            {note.student_notes_count > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                {note.student_notes_count} học viên
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className={tableStyles.cell}>
                            {note.rating ? (
                              <div className="flex items-center">
                                <StarIcon className="h-4 w-4 text-primary-light" />
                                <span className="ml-1 text-gray-900 dark:text-white">
                                  {note.rating_stars || note.rating}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className={tableStyles.cellActions}>
                            <div className="flex items-center justify-end gap-2">
                              <Tooltip label="Xem ghi chú">
                                <ButtonLink
                                  href={`/lesson-notes/${noteId}`}
                                  variant="ghost"
                                  size="sm"
                                  icon={<EyeIcon />}
                                  aria-label="Xem ghi chú"
                                >
                                  <span className="sr-only">Xem ghi chú</span>
                                </ButtonLink>
                              </Tooltip>
                              {canManage ? (
                                <>
                                  <Tooltip label="Chỉnh sửa">
                                    <ButtonLink
                                      href={`/lesson-notes/${noteId}/edit`}
                                      variant="ghost"
                                      size="sm"
                                      icon={<PencilIcon />}
                                      aria-label="Chỉnh sửa"
                                    >
                                      <span className="sr-only">Chỉnh sửa</span>
                                    </ButtonLink>
                                  </Tooltip>
                                  <Tooltip label="Xóa">
                                    <Button
                                      onClick={() => setConfirmNoteId(String(noteId))}
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
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Pagination - chỉ hiển thị khi có dữ liệu */}
      {notes && notes.length > 0 && (
        <Pagination
          meta={notesMeta}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          itemLabel="ghi chú bài học"
          className="mt-6"
        />
      )}
    </div>
  );
}

