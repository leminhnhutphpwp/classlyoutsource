"use client";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useClassDetails, useClassStudents, useStudents } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { apiClient } from "@/lib/api-client";
import type { Student } from "@/lib/api-config";
import Button from "@/components/Common/Button";
import { ArrowLeftIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useNotification } from "@/hooks/use-notification";
import { ListSkeleton } from "@/components/ui/loading";
import { getObjId } from "@/lib/id-utils";

export default function AddStudentsToClassPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.id as string;
  const handleGoBack = useGoBack(`/classes/${classId}`);
  const { data: classDetails, loading: classLoading } = useClassDetails(classId);
  const { data: enrolledStudents, statistics: studentsStats, loading: enrolledStudentsLoading } = useClassStudents(classId);
  const { data: students, loading: studentsLoading } = useStudents();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingEnroll, setLoadingEnroll] = useState(false);
  const [search, setSearch] = useState("");
  const { success: showSuccess, error: showError } = useNotification();

  // Single-tenant: no plan-based cap on students per class.
  const currentActiveCount = studentsStats?.active_count || classDetails?.active_student_count || 0;

  // Lấy danh sách ID học viên đã đăng ký từ API riêng
  const enrolledIds = useMemo<string[]>(() => (
    (enrolledStudents || []).map((s: Student) => getObjId(s))
  ), [enrolledStudents]);

  // Filter students: exclude enrolled ones and apply search
  const availableStudents: Student[] = useMemo(() => {
    const all = ((students as unknown as Student[]) || []);

    // Deduplicate students by ID to prevent duplicate key errors using getObjId
    const uniqueAll = Array.from(new Map(all.map(s => {
      const id = getObjId(s);
      return [id, s];
    })).values());

    if (!search.trim()) return uniqueAll;

    const q = search.toLowerCase().trim();
    return uniqueAll.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.email || "").toLowerCase().includes(q)
    );
  }, [students, search]);

  const selectableCount = useMemo(() => {
    return availableStudents.filter(s => !enrolledIds.includes(getObjId(s))).length;
  }, [availableStudents, enrolledIds]);

  const isDisabled = (id: string) => enrolledIds.includes(id);
  const isChecked = (id: string) => selectedIds.includes(id);

  const handleToggle = (id: string) => {
    if (isDisabled(id)) return; // không cho chọn nếu đã trong lớp
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    const selectable = availableStudents
      .filter(s => !enrolledIds.includes(getObjId(s)))
      .map(s => getObjId(s));
    setSelectedIds(selectable);
  };

  const handleClear = () => setSelectedIds([]);

  const handleEnroll = async () => {
    if (selectedIds.length === 0) return;

    setLoadingEnroll(true);
    try {
      // Enroll all students in parallel for better performance
      await Promise.all(
        selectedIds.map(studentId => apiClient.enrollStudent(classId, studentId))
      );
      showSuccess("Ghi danh thành công", `Đã thêm ${selectedIds.length} học viên vào lớp`);
      setSelectedIds([]);
      setTimeout(() => router.push(`/classes/${classId}`), 1000);
    } catch (e: any) {
      showError("Ghi danh thất bại", e?.message || "Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setLoadingEnroll(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Button
          onClick={handleGoBack}
          variant="outline"
          size="sm"
          icon={<ArrowLeftIcon />}
          className="w-full sm:w-auto"
        >
          Quay lại
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Ghi danh học viên</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1">Lớp: {classDetails?.name || "..."}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-4">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm học viên theo tên hoặc email..."
            className="w-full h-[41px] rounded-lg border border-gray-300 bg-transparent px-4 pr-12 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-primary"
          />
          <MagnifyingGlassIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={selectableCount === 0}
          >
            Chọn tất cả khả dụng ({selectableCount})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={selectedIds.length === 0}
          >
            Bỏ chọn
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleEnroll}
            disabled={loadingEnroll || selectedIds.length === 0}
            className="ml-auto"
          >
            {loadingEnroll ? "Đang ghi danh..." : `Ghi danh (${selectedIds.length})`}
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="rounded-lg bg-white dark:bg-gray-800">
        {classLoading || studentsLoading || enrolledStudentsLoading ? (
          <div className="p-4 md:p-6">
            <ListSkeleton
              count={8}
              showAvatar={true}
              itemClassName="bg-transparent dark:bg-transparent p-0 shadow-none rounded-none"
            />
          </div>
        ) : (
          <div className="p-4 md:p-6">
            {availableStudents.length > 0 ? (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {availableStudents.map((st: Student) => {
                  const studentId = getObjId(st);
                  return (
                    <li
                      key={studentId}
                      className="flex items-center p-4 gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                      onClick={() => handleToggle(studentId)}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked(studentId)}
                        onChange={() => handleToggle(studentId)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={isDisabled(studentId)}
                        className="h-5 w-5 rounded-md border-gray-300 text-white cursor-pointer focus:outline-none focus:ring-0 focus:ring-offset-0 checked:bg-primary checked:border-transparent flex-shrink-0 self-center disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                      <div className="h-9 w-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {st.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold text-gray-900 dark:text-white break-words">
                            {st.name}
                          </div>
                          {isDisabled(studentId) ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 whitespace-nowrap bg-primary-pastel text-primary">
                              Đã ghi danh
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 whitespace-nowrap bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]">
                              Chưa ghi danh
                            </span>
                          )}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400 text-sm break-all">
                          {st.email || "Chưa có email"}
                        </div>
                        {st.phone && (
                          <div className="text-gray-600 dark:text-gray-400 text-sm break-words flex items-center gap-1.5 mt-1">
                            <svg
                              className="h-4 w-4 shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.5 4.5a1 1 0 01-.502 1.236l-2.398 1.2a11.042 11.042 0 005.516 5.516l1.2-2.398a1 1 0 011.236-.502l4.5 1.5a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                              />
                            </svg>
                            <span className="truncate">{st.phone}</span>
                          </div>
                        )}
                        {(Array.isArray(st.classes) && st.classes.length > 0) && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {st.classes.slice(0, 2).map((cls: any) => {
                              const status = cls?.enrollment?.status || "active";
                              const colorClass =
                                status === "active"
                                  ? "bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]"
                                  : status === "completed"
                                    ? "bg-[var(--status-badge-completed)] text-[var(--status-badge-completed-text)]"
                                    : status === "dropped"
                                      ? "bg-[var(--status-badge-error)] text-[var(--status-badge-error-text)]"
                                      : "bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]";
                              return (
                                <span
                                  key={getObjId(cls) || cls.name}
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium truncate ${colorClass}`}
                                  title={cls.name}
                                >
                                  {cls.name}
                                </span>
                              );
                            })}
                            {st.classes.length > 2 && (
                              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                +{st.classes.length - 2} lớp
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400 mb-2">
                  {search.trim()
                    ? "Không tìm thấy học viên phù hợp"
                    : "Chưa có học viên nào trong hệ thống"}
                </p>
                {search.trim() && (
                  <button
                    onClick={() => setSearch("")}
                    className="text-sm text-primary hover:underline mt-2"
                  >
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            )}

            {/* Show enrolled students count and limit */}
            <div className="px-4 md:px-6 py-3 bg-primary-pastel/20 dark:bg-primary/10 border-t border-primary/20 dark:border-primary/30">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                <span className="font-medium">{currentActiveCount}</span> học viên đang học
                {classDetails?.max_students && (
                  <> / {classDetails.max_students} tối đa</>
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
