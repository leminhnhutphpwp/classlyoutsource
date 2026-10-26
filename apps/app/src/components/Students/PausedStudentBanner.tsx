"use client";

import { PauseCircleIcon } from "@heroicons/react/24/outline";
import { useMemo } from "react";

interface PausedEnrollment {
  status_label?: string;
  pause_reason?: string;
  paused_at?: string;
  is_paused?: boolean;
}

interface PausedStudentBannerProps {
  enrollment?: PausedEnrollment | null;
  studentName?: string;
  className?: string;
  description?: string;
}

export default function PausedStudentBanner({
  enrollment,
  studentName,
  className,
  description,
}: PausedStudentBannerProps) {
  const formattedDate = useMemo(() => {
    if (!enrollment?.paused_at) return null;
    const date = new Date(enrollment.paused_at);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString("vi-VN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }, [enrollment?.paused_at]);

  if (!enrollment || (!enrollment.is_paused && !enrollment.pause_reason && !enrollment.status_label)) {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
      <div className="flex items-start gap-3">
        <PauseCircleIcon className="h-8 w-8 text-amber-500 dark:text-amber-300 flex-shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold">
            {studentName ? `${studentName} đang tạm dừng học` : "Học viên đang tạm dừng học"}
            {className && <span> trong lớp {className}</span>}
          </p>
          <p className="text-sm">{enrollment.status_label || "Học viên sẽ tạm ngừng mọi hoạt động liên quan đến lớp học cho tới khi được kích hoạt lại."}</p>
          {enrollment.pause_reason && (
            <p className="text-sm">
              <span className="font-medium">Lý do:</span> {enrollment.pause_reason}
            </p>
          )}
          {formattedDate && (
            <p className="text-xs text-amber-700 dark:text-amber-200/80">
              Từ: {formattedDate}
            </p>
          )}
          {description && (
            <p className="text-xs text-amber-700 dark:text-amber-200/80">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

