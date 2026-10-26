"use client";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useReportCard } from "@/hooks/use-api";
import { useStudentGuard } from "@/hooks/use-role-guard";
import { useGoBack } from "@/hooks/use-go-back";
import { formatScore, formatAverageGrade } from "@/lib/format-score";
import Button from "@/components/Common/Button";
import { ArrowLeftIcon, PrinterIcon } from "@heroicons/react/24/outline";

type ReportGrade = {
  _id: string;
  title: string;
  score: number;
  max_score: number;
  percentage?: number;
  comments?: string | null;
  grade_date?: string | null;
};
type ReportGradeType = {
  _id: string | null;
  name: string;
  weight?: number;
  average_percentage?: number | null;
  grades: ReportGrade[];
};

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("vi-VN");
}

export default function ReportCardPage() {
  const params = useParams();
  const classId = params.id as string;
  const studentId = params.studentId as string;
  const { isBlocked } = useStudentGuard();
  const handleGoBack = useGoBack(`/classes/${classId}/gradebook`);

  const { data, loading, error, refetch } = useReportCard(classId, studentId);

  const gradeTypes: ReportGradeType[] = useMemo(() => data?.grade_types || [], [data]);
  const attendance = data?.attendance;

  if (isBlocked) {
    return null;
  }

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Print-only stylesheet: hide the app chrome (sidebar/nav) and everything
          outside the report card, so a clean "phiếu điểm" is what actually prints. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .report-card-print, .report-card-print * { visibility: visible !important; }
          .report-card-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
            box-shadow: none !important;
          }
          .no-print { display: none !important; }
          @page { margin: 16mm; }
        }
      `}</style>

      {/* Toolbar (not printed) */}
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          onClick={handleGoBack}
          variant="outline"
          size="sm"
          icon={<ArrowLeftIcon />}
          lockAware={false}
        >
          Quay lại
        </Button>
        <Button
          onClick={handlePrint}
          variant="primary"
          size="sm"
          icon={<PrinterIcon />}
          disabled={loading || !!error || !data}
          lockAware={false}
        >
          In học bạ
        </Button>
      </div>

      {error && !loading ? (
        <div className="no-print rounded-lg bg-red-50 border border-red-200 p-6 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          <h3 className="font-medium mb-2">Không thể tải học bạ</h3>
          <p>{error}</p>
          <div className="mt-4">
            <Button onClick={() => refetch()} variant="outline" size="sm" lockAware={false}>
              Thử lại
            </Button>
          </div>
        </div>
      ) : loading || !data ? (
        <div className="rounded-lg bg-white p-6 dark:bg-gray-800 space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="report-card-print rounded-lg bg-white p-6 sm:p-8 dark:bg-gray-800 print:text-black">
          {/* Report header */}
          <div className="text-center border-b border-gray-200 dark:border-gray-700 pb-5 mb-6 print:border-gray-400">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white print:text-black">
              PHIẾU ĐIỂM
            </h1>
            {data.class?.name && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 print:text-black">
                Lớp: {data.class.name}
                {data.class?.subject ? ` — ${data.class.subject}` : ""}
              </p>
            )}
          </div>

          {/* Student + summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 print:text-black">Học viên</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white print:text-black">
                {data.student?.name}
              </p>
              {data.student?.student_code && (
                <p className="text-xs text-gray-500 dark:text-gray-400 print:text-black">
                  Mã HV: {data.student.student_code}
                </p>
              )}
            </div>
            <div className="sm:text-right">
              <p className="text-sm text-gray-500 dark:text-gray-400 print:text-black">
                Điểm trung bình có trọng số
              </p>
              <p className="text-2xl font-bold text-primary print:text-black">
                {data.weighted_average_percentage !== null &&
                data.weighted_average_percentage !== undefined
                  ? `${formatAverageGrade(data.weighted_average_percentage)}%`
                  : "—"}
              </p>
            </div>
          </div>

          {/* Grades by type */}
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3 print:text-black">
            Kết quả học tập
          </h2>
          {gradeTypes.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 print:text-black">
              Chưa có điểm nào được ghi nhận.
            </p>
          ) : (
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full border border-gray-200 dark:border-gray-700 print:border-gray-400">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 print:bg-gray-100">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 print:text-black border-b border-gray-200 dark:border-gray-700">
                      Loại điểm
                    </th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 print:text-black border-b border-gray-200 dark:border-gray-700">
                      Hệ số
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 print:text-black border-b border-gray-200 dark:border-gray-700">
                      Các điểm thành phần
                    </th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 print:text-black border-b border-gray-200 dark:border-gray-700">
                      TB loại
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gradeTypes.map((gt, idx) => (
                    <tr
                      key={gt._id ?? `type-${idx}`}
                      className="border-b border-gray-100 dark:border-gray-700 print:border-gray-300"
                    >
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-white print:text-black align-top">
                        {gt.name}
                      </td>
                      <td className="px-3 py-2 text-sm text-center text-gray-700 dark:text-gray-300 print:text-black align-top">
                        {gt.weight ?? 1}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 print:text-black align-top">
                        <div className="flex flex-wrap gap-1.5">
                          {gt.grades.length === 0 ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            gt.grades.map((g) => (
                              <span
                                key={g._id}
                                className="inline-flex items-center rounded bg-gray-100 dark:bg-gray-700 print:bg-gray-100 px-2 py-0.5 text-xs"
                                title={
                                  [g.title, formatDate(g.grade_date), g.comments]
                                    .filter(Boolean)
                                    .join(" • ")
                                }
                              >
                                {formatScore(g.score, g.max_score)}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm text-center font-semibold text-gray-900 dark:text-white print:text-black align-top">
                        {gt.average_percentage !== null && gt.average_percentage !== undefined
                          ? `${formatAverageGrade(gt.average_percentage)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Attendance summary */}
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3 print:text-black">
            Chuyên cần
          </h2>
          {attendance ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Tổng buổi", value: attendance.total },
                { label: "Có mặt", value: attendance.present },
                { label: "Đi muộn", value: attendance.late },
                { label: "Vắng", value: attendance.absent },
                { label: "Có phép", value: attendance.excused },
                {
                  label: "Tỷ lệ",
                  value:
                    attendance.attendance_rate !== null && attendance.attendance_rate !== undefined
                      ? `${formatAverageGrade(attendance.attendance_rate)}%`
                      : "—",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 print:border-gray-300 p-3 text-center"
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400 print:text-black">
                    {item.label}
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white print:text-black">
                    {item.value ?? 0}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 print:text-black">
              Chưa có dữ liệu chuyên cần.
            </p>
          )}

          <p className="hidden print:block text-right text-xs text-gray-500 mt-8">
            Ngày in: {new Date().toLocaleDateString("vi-VN")}
          </p>
        </div>
      )}
    </div>
  );
}
