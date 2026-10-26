"use client";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useStudentDetails, useStudentClasses, useClasses } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { apiClient } from "@/lib/api-client";
import type { ClassRoom } from "@/lib/api-config";
import Button from "@/components/Common/Button";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useNotification } from "@/hooks/use-notification";
import { getObjId } from "@/lib/id-utils";

export default function EnrollStudentPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;
  const { data: studentDetails, loading: studentLoading } = useStudentDetails(studentId);
  const { classes: enrolledClasses, loading: enrolledClassesLoading } = useStudentClasses(studentId);
  const { data: classes, loading: classesLoading } = useClasses();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingEnroll, setLoadingEnroll] = useState(false);
  const [search, setSearch] = useState("");
  const { success: showSuccess, error: showError } = useNotification();

  // Lấy danh sách ID lớp đã đăng ký
  const enrolledClassIds = useMemo<string[]>(() => (
    (enrolledClasses || []).map((cls: any) => getObjId(cls))
  ), [enrolledClasses]);

  const list: ClassRoom[] = useMemo(() => {
    const all = ((classes as unknown as ClassRoom[]) || []);
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter(cls =>
      cls.name?.toLowerCase().includes(q) ||
      (cls as any).subject?.toLowerCase().includes(q) ||
      cls.tutor?.name?.toLowerCase().includes(q)
    );
  }, [classes, search]);

  const isDisabled = (id: string) => enrolledClassIds.includes(id);
  const isChecked = (id: string) => selectedIds.includes(id);

  const handleToggle = (id: string) => {
    if (isDisabled(id)) return;
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    const selectable = list.filter(cls => !isDisabled(getObjId(cls))).map(getObjId);
    setSelectedIds(selectable);
  };

  const handleClear = () => setSelectedIds([]);

  const handleEnroll = async () => {
    if (selectedIds.length === 0) return;
    setLoadingEnroll(true);
    try {
      const errors: string[] = [];
      for (const classId of selectedIds) {
        const response = await apiClient.enrollStudent(classId, studentId);
        if (!response.success) {
          // Extract error message from API response
          let errorMsg = response.message || "Có lỗi xảy ra khi ghi danh vào lớp học này.";

          if (response.errors && typeof response.errors === 'object') {
            const errorMessages: string[] = [];
            for (const [, messages] of Object.entries(response.errors)) {
              if (Array.isArray(messages)) {
                errorMessages.push(...messages);
              } else if (typeof messages === 'string') {
                errorMessages.push(messages);
              }
            }
            if (errorMessages.length > 0) {
              errorMsg = errorMessages.join('. ');
            }
          }
          errors.push(errorMsg);
        }
      }

      if (errors.length > 0) {
        showError("Ghi danh thất bại", errors.join(" "));
      } else {
        showSuccess("Ghi danh thành công", `Đã ghi danh vào ${selectedIds.length} lớp học`);
        setSelectedIds([]);
        setTimeout(() => router.push(`/students/${studentId}`), 700);
      }
    } catch (e: any) {
      const errorMessage = e?.message || e?.response?.message || "Có lỗi xảy ra, vui lòng thử lại hoặc kiểm tra kết nối.";
      showError("Ghi danh thất bại", errorMessage);
    } finally {
      setLoadingEnroll(false);
    }
  };

  const handleGoBack = useGoBack(`/students/${studentId}`);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button
            onClick={handleGoBack}
            variant="outline"
            size="sm"
            icon={<ArrowLeftIcon />}
            className="w-full sm:w-auto justify-center"
          >
            Quay lại
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">
              Ghi danh học viên
            </h1>
            <p className="text-sm sm:text-base text-dark-4 dark:text-dark-6 mt-1 truncate">
              Học viên: {studentDetails?.name || "..."}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm lớp học theo tên, môn học hoặc giáo viên..."
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
          />
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
          <Button
            onClick={handleEnroll}
            disabled={loadingEnroll || selectedIds.length === 0}
            loading={loadingEnroll}
            size="sm"
            className="w-full sm:w-auto justify-center"
          >
            Ghi danh ({selectedIds.length})
          </Button>
          <div className="flex w-full sm:w-auto gap-2">
            <Button
              onClick={handleSelectAll}
              variant="outline"
              size="sm"
              className="flex-1 justify-center"
            >
              Chọn tất cả khả dụng
            </Button>
            <Button
              onClick={handleClear}
              variant="outline"
              size="sm"
              className="flex-1 justify-center border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/60 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              Bỏ chọn
            </Button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="rounded-lg bg-white dark:bg-gray-800">
        {studentLoading || classesLoading || enrolledClassesLoading ? (
          <div className="p-4 md:p-6">
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {[...Array(8)].map((_, i) => (
                <li key={i} className="flex items-center py-4 gap-3 animate-pulse">
                  <div className="h-5 w-5 rounded border border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1 min-w-0">
                    <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-700 mb-2" />
                    <div className="h-3 w-64 rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                  <div className="h-5 w-20 rounded-full bg-gray-200 dark:bg-gray-700" />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="p-4 md:p-6">
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {list.map((cls: ClassRoom) => {
                const clsIdString = getObjId(cls);
                const clsAny = cls as any;
                const disabled = isDisabled(clsIdString);
                const isFull = clsAny.is_full || (clsAny.max_students && clsAny.students_count && clsAny.students_count >= clsAny.max_students);

                return (
                  <li key={clsIdString} className="flex items-center py-4 gap-3">
                    <input
                      type="checkbox"
                      checked={isChecked(clsIdString)}
                      onChange={() => handleToggle(clsIdString)}
                      disabled={disabled || isFull}
                      className="h-5 w-5 rounded border-gray-300 text-primary disabled:opacity-40"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-medium text-gray-900 dark:text-white truncate">{cls.name}</div>
                        {isFull && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                            Đầy
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                        {clsAny.subject && (
                          <span>Môn: {clsAny.subject}</span>
                        )}
                        {cls.tutor && (
                          <span>GV: {cls.tutor.name}</span>
                        )}
                        {clsAny.max_students && (
                          <span>
                            Học viên: {clsAny.students_count || 0} / {clsAny.max_students}
                          </span>
                        )}
                      </div>
                    </div>
                    {disabled ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-pastel text-primary whitespace-nowrap">
                        Đã ghi danh
                      </span>
                    ) : isFull ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 whitespace-nowrap">
                        Lớp đầy
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500 whitespace-nowrap">Chưa ghi danh</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {list.length === 0 && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-10">
                Không có lớp học phù hợp
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

