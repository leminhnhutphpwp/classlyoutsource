"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useGradebook, useBulkStoreGrades } from "@/hooks/use-api";
import { useStudentGuard } from "@/hooks/use-role-guard";
import { useGoBack } from "@/hooks/use-go-back";
import { useNotification } from "@/hooks/use-notification";
import { extractErrorMessage } from "@/lib/api-error-utils";
import { formatAverageGrade } from "@/lib/format-score";
import Button from "@/components/Common/Button";
import { tableStyles } from "@/components/Common/tableStyles";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  AcademicCapIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

type GradeTypeColumn = { _id: string; name: string; code?: string | null; weight?: number };
type CellGrade = { _id: string; title: string; score: number; max_score: number; percentage?: number };
type StudentRow = {
  _id: string;
  name: string;
  student_code?: string | null;
  cells?: Record<string, { average_percentage?: number; grades?: CellGrade[] }>;
  weighted_average_percentage?: number | null;
};

const cellKey = (studentId: string, gradeTypeId: string) => `${studentId}::${gradeTypeId}`;

function buildInitial(students: StudentRow[], gradeTypes: GradeTypeColumn[]) {
  const values: Record<string, string> = {};
  const maxes: Record<string, number> = {};
  students.forEach((student) => {
    gradeTypes.forEach((gt) => {
      const cell = student.cells?.[gt._id];
      const grade = cell?.grades?.[0];
      const key = cellKey(student._id, gt._id);
      values[key] = grade ? String(grade.score) : "";
      maxes[key] = grade && grade.max_score ? Number(grade.max_score) : 100;
    });
  });
  return { values, maxes };
}

export default function GradebookPage() {
  const params = useParams();
  const classId = params.id as string;
  const { isBlocked } = useStudentGuard();
  const handleGoBack = useGoBack(`/classes/${classId}`);
  const { success, error: showError } = useNotification();

  const { data, loading, error, refetch } = useGradebook(classId);
  const { mutate: bulkStore, loading: saving } = useBulkStoreGrades();

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [originals, setOriginals] = useState<Record<string, string>>({});
  const [maxMap, setMaxMap] = useState<Record<string, number>>({});
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});

  const gradeTypes: GradeTypeColumn[] = useMemo(() => data?.grade_types || [], [data]);
  const students: StudentRow[] = useMemo(() => data?.students || [], [data]);

  // Dirty = any editable cell differs from the last-synced server value.
  const dirtyKeys = useMemo(
    () => Object.keys(edits).filter((key) => edits[key] !== (originals[key] ?? "")),
    [edits, originals]
  );
  const isDirty = dirtyKeys.length > 0;
  const dirtyRef = useRef(false);
  dirtyRef.current = isDirty;

  // Re-sync local state from the server whenever fresh data arrives — but never
  // clobber unsaved edits during a background revalidation.
  useEffect(() => {
    if (!data) return;
    if (dirtyRef.current) return;
    const { values, maxes } = buildInitial(students, gradeTypes);
    setEdits(values);
    setOriginals(values);
    setMaxMap(maxes);
    setCellErrors({});
  }, [data, students, gradeTypes]);

  const handleCellChange = (key: string, value: string) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
    if (cellErrors[key]) {
      setCellErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleSaveAll = async () => {
    // Validate every changed, non-empty cell before sending (backend is all-or-nothing too).
    const errors: Record<string, string> = {};
    const payloadGrades: Array<{
      student_id: string;
      grade_type_id: string;
      score: number;
      max_score: number;
    }> = [];

    dirtyKeys.forEach((key) => {
      const raw = edits[key];
      // Clearing a score can't be represented by the bulk upsert (no delete) — skip it.
      if (raw === "" || raw === null || raw === undefined) return;
      const score = Number(raw);
      const max = maxMap[key] ?? 100;
      if (!Number.isFinite(score) || score < 0) {
        errors[key] = "Điểm không hợp lệ";
        return;
      }
      if (score > max) {
        errors[key] = `Vượt quá ${max}`;
        return;
      }
      const [studentId, gradeTypeId] = key.split("::");
      payloadGrades.push({ student_id: studentId, grade_type_id: gradeTypeId, score, max_score: max });
    });

    if (Object.keys(errors).length > 0) {
      setCellErrors(errors);
      showError("Một số ô điểm không hợp lệ. Vui lòng kiểm tra lại.");
      return;
    }

    if (payloadGrades.length === 0) {
      showError("Không có điểm hợp lệ để lưu.");
      return;
    }

    const result = await bulkStore({ class_id: classId, grades: payloadGrades });

    if (result.success) {
      success(
        "Đã lưu bảng điểm",
        `Cập nhật ${result.data?.updated ?? 0} • Thêm mới ${result.data?.created ?? 0}`
      );
      // Snapshot current edits as the new baseline so the grid is no longer dirty,
      // then pull fresh data (recomputed weighted averages) from the server.
      setOriginals({ ...edits });
      setCellErrors({});
      refetch();
    } else {
      showError(extractErrorMessage(result, "Không thể lưu bảng điểm"));
    }
  };

  if (isBlocked) {
    return null;
  }

  const className = data?.class?.name;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            onClick={handleGoBack}
            variant="outline"
            size="sm"
            icon={<ArrowLeftIcon />}
            lockAware={false}
            className="flex-shrink-0"
          >
            Quay lại
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">
              Sổ điểm{className ? ` — ${className}` : ""}
            </h1>
            <p className="text-dark-4 dark:text-dark-6 mt-1 text-sm">
              Nhập điểm theo lưới rồi bấm &quot;Lưu tất cả&quot;. Cột cuối là điểm trung bình có trọng số.
            </p>
          </div>
        </div>

        <Button
          onClick={handleSaveAll}
          variant="primary"
          size="sm"
          icon={<CheckCircleIcon />}
          loading={saving}
          disabled={!isDirty || saving}
          className="w-full lg:w-auto justify-center"
        >
          Lưu tất cả{isDirty ? ` (${dirtyKeys.length})` : ""}
        </Button>
      </div>

      {error && !loading ? (
        <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          <h3 className="font-medium mb-2">Không thể tải sổ điểm</h3>
          <p>{error}</p>
          <div className="mt-4">
            <Button onClick={() => refetch()} variant="outline" size="sm" lockAware={false}>
              Thử lại
            </Button>
          </div>
        </div>
      ) : loading ? (
        <div className={tableStyles.wrapper}>
          <div className="p-6 space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : students.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center dark:bg-gray-800">
          <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Lớp chưa có học viên</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Thêm học viên vào lớp để bắt đầu nhập điểm.
          </p>
        </div>
      ) : gradeTypes.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center dark:bg-gray-800">
          <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Chưa có loại điểm</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Chưa có điểm nào được chấm trong lớp này. Cột điểm sẽ xuất hiện khi có loại điểm được sử dụng.
          </p>
        </div>
      ) : (
        <div className={tableStyles.wrapper}>
          {/* Horizontal scroll on mobile; the student-name column stays sticky. */}
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className={tableStyles.thead}>
                <tr>
                  <th
                    className={`${tableStyles.headerCellBase} sticky left-0 z-20 bg-gray-50 dark:bg-gray-900 min-w-[200px]`}
                  >
                    Học viên
                  </th>
                  {gradeTypes.map((gt) => (
                    <th
                      key={gt._id}
                      className={`${tableStyles.headerCellBase} text-center min-w-[110px]`}
                    >
                      <div className="flex flex-col items-center">
                        <span className="truncate max-w-[140px]" title={gt.name}>
                          {gt.name}
                        </span>
                        <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500">
                          Hệ số {gt.weight ?? 1}
                        </span>
                      </div>
                    </th>
                  ))}
                  <th className={`${tableStyles.headerCellBase} text-center min-w-[120px]`}>
                    TB có trọng số
                  </th>
                  <th className={`${tableStyles.headerCellBase} text-center min-w-[90px]`}>
                    Học bạ
                  </th>
                </tr>
              </thead>
              <tbody className={tableStyles.body}>
                {students.map((student) => (
                  <tr key={student._id} className={tableStyles.row}>
                    <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 px-4 py-3 align-middle border-b border-gray-100 dark:border-gray-700">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[180px]">
                        {student.name}
                      </div>
                      {student.student_code && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {student.student_code}
                        </div>
                      )}
                    </td>
                    {gradeTypes.map((gt) => {
                      const key = cellKey(student._id, gt._id);
                      const value = edits[key] ?? "";
                      const max = maxMap[key] ?? 100;
                      const cellError = cellErrors[key];
                      return (
                        <td key={gt._id} className="px-2 py-2 text-center align-middle border-b border-gray-100 dark:border-gray-700">
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max={max}
                            step="0.1"
                            value={value}
                            onChange={(e) => handleCellChange(key, e.target.value)}
                            aria-label={`${student.name} - ${gt.name}`}
                            className={`w-16 rounded-md border px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 dark:bg-gray-700 dark:text-white ${
                              cellError
                                ? "border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-400"
                                : "border-gray-300 focus:border-primary focus:ring-primary dark:border-gray-600"
                            }`}
                          />
                          <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                            {cellError ? (
                              <span className="text-red-500">{cellError}</span>
                            ) : (
                              `/ ${max}`
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center align-middle border-b border-gray-100 dark:border-gray-700">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-pastel text-primary">
                        {student.weighted_average_percentage !== null &&
                        student.weighted_average_percentage !== undefined
                          ? `${formatAverageGrade(student.weighted_average_percentage)}%`
                          : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center align-middle border-b border-gray-100 dark:border-gray-700">
                      <Link
                        href={`/classes/${classId}/students/${student._id}/report-card`}
                        className="inline-flex items-center text-primary hover:text-primary-600 dark:text-primary-300"
                        aria-label={`Học bạ của ${student.name}`}
                      >
                        <DocumentTextIcon className="h-5 w-5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
