"use client";

import Link from "next/link";
import { memo } from "react";
import { EyeIcon, PauseIcon, PlayIcon, PhoneIcon } from "@heroicons/react/24/outline";
import Tooltip from "@/components/Common/Tooltip";
import { formatPercentage } from "@/lib/format-number";
import { getObjId, idsEqual } from "@/lib/id-utils";

interface EnrollmentData {
  is_paused?: boolean;
  status_label?: string;
  pause_reason?: string;
}

interface OptimisticEnrollment {
  isPaused: boolean;
  statusLabel?: string;
  pauseReason?: string;
}

interface StudentData {
  id: string | number;
  user_id?: string | number;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  attendance_rate?: number;
}

interface UserData {
  id?: string | number;
}

interface ClassStudentCardProps {
  student: StudentData;
  enrollment?: EnrollmentData;
  optimisticEnrollment?: OptimisticEnrollment;
  user?: UserData;
  isStudentUser?: boolean;
  canManageStudents?: boolean;
  canManageClass?: boolean;
  onPauseClick?: (student: StudentData) => void;
  onResumeClick?: (student: StudentData) => void;
  className?: string;
}

const maskEmail = (email: string): string => {
  if (!email) return "Chưa có email";
  const [localPart, domain] = email.split("@");
  if (!domain) return email;

  // Show first 2 characters and mask the rest
  const maskedLocal =
    localPart.length > 2
      ? `${localPart.substring(0, 2)}${"*".repeat(Math.min(localPart.length - 2, 5))}`
      : "***";

  return `${maskedLocal}@${domain}`;
};

const getEmailDisplay = (
  student: StudentData,
  user?: UserData,
  isStudentUser?: boolean
): string => {
  if (!student.email) return "Chưa có email";

  // If user is not a student, show full email
  if (!isStudentUser) {
    return student.email;
  }

  // If user is student and this is their own profile, show full email
  if (user && idsEqual(student.user_id, user)) {
    return student.email;
  }

  // If user is student and this is another student, mask email
  return maskEmail(student.email);
};

const isCurrentUser = (student: StudentData, user?: UserData): boolean => {
  return idsEqual(student.user_id, user);
};

function ClassStudentCardComponent({
  student,
  enrollment = {},
  optimisticEnrollment,
  user,
  isStudentUser = false,
  canManageStudents = false,
  canManageClass = false,
  onPauseClick,
  onResumeClick,
  className = "",
}: ClassStudentCardProps) {
  const isPaused = optimisticEnrollment
    ? optimisticEnrollment.isPaused
    : !!enrollment.is_paused;
  const statusLabel =
    optimisticEnrollment?.statusLabel ?? enrollment.status_label;
  const pauseReason =
    optimisticEnrollment?.pauseReason ?? enrollment.pause_reason;
  const shouldShowPausedStatus =
    !isStudentUser || isCurrentUser(student, user);

  const emailDisplay = getEmailDisplay(student, user, isStudentUser);
  const showActions = !isStudentUser && (canManageStudents || canManageClass);
  const attendanceValue = typeof student.attendance_rate === "number" ? Math.max(0, Math.min(100, student.attendance_rate)) : 0;

  return (
    <div
      className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="h-14 w-14 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-medium text-gray-700 dark:text-gray-300">
              {student.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                  {student.name}
                </h3>
              </div>
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 whitespace-nowrap ${isPaused && shouldShowPausedStatus
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200"
                  : "bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]"
                  }`}
                title={statusLabel || (isPaused ? "Tạm dừng học" : "Đang học")}
              >
                {statusLabel || (isPaused ? "Tạm dừng học" : "Đang học")}
              </span>
            </div>
            <div className="space-y-1.5 mb-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1.5">
                <svg
                  className="h-3.5 w-3.5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <span className="truncate">{emailDisplay}</span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1.5">
                <PhoneIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{student.phone || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-gray-500 dark:text-gray-400">Điểm danh</div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary-pastel text-primary">
                    {formatPercentage(attendanceValue)}
                  </span>
                  <div className="h-1.5 w-24 rounded bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-1.5 rounded bg-primary"
                      style={{ width: `${attendanceValue}%` }}
                    />
                  </div>
                </div>
              </div>
              {isPaused && shouldShowPausedStatus && (
                <>
                  <p className="text-xs text-amber-600 dark:text-amber-200">
                    {statusLabel || "Học viên đang tạm dừng lớp học này."}
                  </p>
                  {pauseReason && (
                    <p className="text-xs text-amber-600 dark:text-amber-200/80">
                      Lý do: {pauseReason}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        {showActions && (
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <Tooltip label={isPaused ? "Mở lại học viên" : "Tạm dừng học viên"}>
              <button
                type="button"
                onClick={() =>
                  isPaused
                    ? onResumeClick?.(student)
                    : onPauseClick?.(student)
                }
                className="inline-flex items-center text-primary hover:text-primary-600 dark:text-primary-300 dark:hover:text-primary-200"
                aria-label={isPaused ? "Mở lại học viên" : "Tạm dừng học viên"}
              >
                {isPaused ? (
                  <PlayIcon className="h-4 w-4" />
                ) : (
                  <PauseIcon className="h-4 w-4" />
                )}
              </button>
            </Tooltip>
            <Tooltip label="Xem hồ sơ học viên">
              <Link
                href={`/students/${getObjId(student)}`}
                className="inline-flex items-center text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                aria-label="Xem hồ sơ học viên"
              >
                <EyeIcon className="h-4 w-4" />
              </Link>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
}

export const ClassStudentCard = memo(ClassStudentCardComponent);
