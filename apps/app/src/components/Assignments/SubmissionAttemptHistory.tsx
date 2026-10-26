"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowTopRightOnSquareIcon,
  ClockIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { formatScore } from "@/lib/format-score";

/**
 * Attempt-history card for the assignment page (wireframe P5 mục 07 "Tra cứu kết quả cũ",
 * adapted to Classly's logged-in context): every attempt this student made, newest first,
 * with score / status / view-review links. Data rides the existing
 * `/submissions/assignment/{id}/history` endpoint — no new backend surface.
 */
export default function SubmissionAttemptHistory({
  submissions,
  loading,
}: {
  /** Unused today; kept so call sites can pass the assignment context explicitly. */
  assignmentId?: string;
  submissions: Array<{
    id: string;
    attempt_number?: number | null;
    status: string;
    score?: number | null;
    submitted_at?: string | null;
    graded_at?: string | null;
    created_at?: string | null;
    feedback?: string | null;
  }>;
  loading: boolean;
}) {
  const attempts = useMemo(
    () =>
      [...submissions].sort((a, b) => {
        const timeA = new Date(a.submitted_at || a.created_at || 0).getTime();
        const timeB = new Date(b.submitted_at || b.created_at || 0).getTime();
        return timeB - timeA;
      }),
    [submissions]
  );

  const statusBadge = (status: string): { label: string; className: string } => {
    switch (status) {
      case "graded":
        return {
          label: "Đã chấm",
          className: "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400",
        };
      case "pending":
        return {
          label: "Chờ chấm",
          className: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
        };
      case "returned":
        return {
          label: "Đã trả bài",
          className: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
        };
      default:
        return {
          label: "Đã nộp",
          className: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
        };
    }
  };

  const formatDate = (value?: string | null): string => {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return value;
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải lịch sử làm bài...</p>
      </div>
    );
  }

  if (attempts.length === 0) {
    return null; // nothing submitted yet — the submit card already handles the empty state
  }

  return (
    <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Lịch sử làm bài ({attempts.length} lần)
        </h3>
        <ClockIcon className="h-5 w-5 text-gray-300 dark:text-gray-600" />
      </div>

      <div className="space-y-2.5">
        {attempts.map((attempt, index) => {
          const badge = statusBadge(attempt.status);
          const isLatest = index === 0;
          return (
            <div
              key={attempt.id}
              className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                isLatest
                  ? "border-primary/40 bg-primary/5"
                  : "border-gray-200 bg-gray-50/60 dark:border-gray-700 dark:bg-gray-800/60"
              }`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {/* Attempt number disc */}
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white dark:bg-gray-100 dark:text-gray-900">
                  {attempt.attempt_number ?? attempts.length - index}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                    Lần {attempt.attempt_number ?? attempts.length - index}
                    {isLatest && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        Mới nhất
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                    Nộp lúc {formatDate(attempt.submitted_at || attempt.created_at)}
                  </p>
                </div>
              </div>

              <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}>
                {badge.label}
              </span>

              <span className="flex-shrink-0 text-sm font-bold text-gray-900 dark:text-white">
                {attempt.status === "graded" ? formatScore(attempt.score) : "—"}
              </span>

              <Link
                href={`/submissions/${attempt.id}`}
                className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <DocumentTextIcon className="h-4 w-4" />
                Xem bài
              </Link>
            </div>
          );
        })}
      </div>

      {attempts.some((attempt) => attempt.feedback) && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          Nhận xét của giáo viên nằm trong từng lần làm bài.
        </p>
      )}
    </div>
  );
}
