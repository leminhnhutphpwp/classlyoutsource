"use client";
import { EyeIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import Tooltip from "@/components/Common/Tooltip";
import ButtonLink from "@/components/Common/ButtonLink";
import Button from "@/components/Common/Button";
import { formatScoreWithPercentage } from "@/lib/format-score";
import { getObjId } from "@/lib/id-utils";

interface GradeData {
  id: string;
  student?: {
    name: string;
  };
  class?: {
    name: string;
  };
  title?: string;
  assignment?: {
    title: string;
  };
  grade_type?: {
    name: string;
  };
  score?: number | string;
  grade?: number | string;
  max_score?: number;
  max_points?: number;
  percentage?: number;
  grade_letter?: string;
  is_passing?: boolean;
  grade_date?: string;
  created_at?: string;
  semester?: string;
  comments?: string;
  notes?: string;
  tutor_id?: string;
}

interface GradeListCardProps {
  grade: GradeData;
  canManage?: boolean;
  canDelete?: boolean;
  onDelete?: (id: string) => void;
  className?: string;
}

export function GradeListCard({
  grade,
  canManage = false,
  canDelete = false,
  onDelete,
  className = "",
}: GradeListCardProps) {
  const scoreData = formatScoreWithPercentage(
    grade.score || grade.grade,
    grade.max_score || grade.max_points
  );
  const percentage =
    grade.percentage !== null && grade.percentage !== undefined
      ? grade.percentage.toFixed(1)
      : scoreData.percentage.toFixed(1);

  return (
    <div
      className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-medium text-gray-700 dark:text-gray-300">
              {grade.student?.name?.charAt(0)?.toUpperCase() || "?"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="mb-2">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {grade.student?.name || "N/A"}
              </h3>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                {grade.class?.name || "N/A"}
              </div>
            </div>
            <div className="space-y-1.5">
              <div>
                <div className="text-xs font-medium text-gray-900 dark:text-white truncate">
                  {grade.title ||
                    grade.assignment?.title ||
                    grade.grade_type?.name ||
                    "Điểm tổng hợp"}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-sm font-semibold text-primary dark:text-primary-400">
                    {scoreData.score}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({percentage}%
                    {grade.grade_letter && ` - ${grade.grade_letter}`})
                  </span>
                  {grade.is_passing !== undefined && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${grade.is_passing
                        ? "bg-primary-pastel text-primary"
                        : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                        }`}
                    >
                      {grade.is_passing ? "Đạt" : "Không đạt"}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-1 sm:gap-0">
                {grade.grade_type && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium">Loại:</span> {grade.grade_type.name}
                  </div>
                )}
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-medium">Ngày:</span>{" "}
                  {grade.grade_date
                    ? new Date(grade.grade_date).toLocaleDateString("vi-VN")
                    : grade.created_at
                      ? new Date(grade.created_at).toLocaleDateString("vi-VN")
                      : "N/A"}
                </div>
                {grade.semester && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium">Học kỳ:</span> {grade.semester}
                  </div>
                )}
                {(grade.comments || grade.notes) && (
                  <div className={`text-xs text-gray-500 dark:text-gray-400 ${grade.semester ? '' : 'col-span-2 sm:col-span-1'}`}>
                    <span className="font-medium">Ghi chú:</span>{" "}
                    {grade.comments || grade.notes}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-1.5 flex-shrink-0">
          <Tooltip label="Xem điểm số">
            <ButtonLink
              href={`/grades/${getObjId(grade)}`}
              variant="ghost"
              className="!p-1.5 !h-auto text-primary hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Xem điểm số"
            >
              <EyeIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </ButtonLink>
          </Tooltip>
          <Tooltip label="Chỉnh sửa">
            <ButtonLink
              href={`/grades/${getObjId(grade)}/edit`}
              variant="ghost"
              className="!p-1.5 !h-auto text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Chỉnh sửa"
              disabled={!canManage}
            >
              <PencilIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </ButtonLink>
          </Tooltip>
          <Tooltip label="Xóa">
            <Button
              onClick={() => onDelete && onDelete(getObjId(grade))}
              variant="ghost"
              className="!p-1.5 !h-auto text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Xóa"
              disabled={!canDelete}
            >
              <TrashIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

