"use client";

import { memo } from "react";
import { AcademicCapIcon } from "@heroicons/react/24/outline";
import { formatScore } from "@/lib/format-score";

interface GradeData {
  id: string | number;
  title?: string;
  assignment?: {
    title: string;
  };
  grade_type?: {
    name: string;
  };
  semester?: string;
  class?: {
    name: string;
  };
  grade_date?: string;
  tutor?: {
    name: string;
  };
  score?: number | string;
  grade?: number | string;
  max_score?: number;
  max_points?: number;
  percentage?: number;
  grade_letter?: string;
  is_passing?: boolean;
  comments?: string;
  notes?: string;
}

interface GradeCardProps {
  grade: GradeData;
  className?: string;
}

const getPercentageColor = (pct: number): string => {
  if (pct >= 90) return "text-primary";
  if (pct >= 80) return "text-primary";
  if (pct >= 70) return "text-primary-light";
  if (pct >= 60) return "text-primary-light";
  return "text-red-600 dark:text-red-400";
};

function GradeCardComponent({ grade, className = "" }: GradeCardProps) {
  const score = grade.score || grade.grade || 0;
  const maxScore = grade.max_score || grade.max_points || 100;
  const percentage =
    grade.percentage ||
    (score && maxScore
      ? (parseFloat(score.toString()) / parseFloat(maxScore.toString())) * 100
      : 0);
  const percentageValue = parseFloat(percentage.toString()).toFixed(1);
  const colorClass = getPercentageColor(parseFloat(percentageValue));

  return (
    <div
      className={`rounded-lg bg-white p-5 border border-gray-100 transition-all dark:bg-gray-800 dark:border-gray-700 ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-full flex-shrink-0 bg-primary-pastel/40">
            <AcademicCapIcon className={`h-6 w-6 ${colorClass}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                {grade.title ||
                  grade.assignment?.title ||
                  grade.grade_type?.name ||
                  "Điểm tổng hợp"}
              </h4>
              {grade.grade_type && (
                <span className="rounded-full px-3 py-1 text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                  {grade.grade_type.name}
                </span>
              )}
              {grade.semester && (
                <span className="rounded-full px-3 py-1 text-xs font-medium bg-primary-pastel/40 text-primary">
                  {grade.semester}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm mb-2">
              {grade.class && (
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 dark:text-gray-400">Lớp:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {grade.class.name}
                  </span>
                </div>
              )}
              {grade.grade_date && (
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 dark:text-gray-400">Ngày:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {new Date(grade.grade_date).toLocaleDateString("vi-VN")}
                  </span>
                </div>
              )}
              {(grade.tutor) && (
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 dark:text-gray-400">GV:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {(grade.tutor)?.name}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Điểm:</span>
                <span className={`text-lg font-bold ${colorClass}`}>
                  {formatScore(grade.score || grade.grade, grade.max_score || grade.max_points)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Tỷ lệ:</span>
                <span className={`text-lg font-semibold ${colorClass}`}>
                  {grade.percentage
                    ? grade.percentage.toFixed(1)
                    : percentageValue}
                  %
                  {grade.grade_letter && ` (${grade.grade_letter})`}
                </span>
              </div>
              {grade.is_passing !== undefined && (
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${grade.is_passing
                    ? "bg-primary-pastel text-primary"
                    : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                    }`}
                >
                  {grade.is_passing ? "Đạt" : "Không đạt"}
                </span>
              )}
            </div>
            {(grade.comments || grade.notes) && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium text-gray-600 dark:text-gray-400">
                    Ghi chú:{" "}
                  </span>
                  {grade.comments || grade.notes}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const GradeCard = memo(GradeCardComponent);
