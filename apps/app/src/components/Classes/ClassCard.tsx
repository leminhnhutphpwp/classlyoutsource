"use client";

import { ReactNode, memo } from "react";
import RichTextDisplay from "@/components/Common/RichTextDisplay";
import { useAuthContext } from "@/contexts/auth-context";
import { isStudent } from "@/lib/authz";

type ClassStatus = "active" | "inactive";
type EnrollmentStatus = "active" | "inactive" | "completed" | "dropped";

interface ClassCardProps {
  cls: any;
  enrollment?: any;
  showEnrollment?: boolean;
  showTuition?: boolean;
  actions?: ReactNode;
  className?: string;
}

// Status badge sử dụng CSS variables từ theme
const statusBadge = (status: ClassStatus) =>
  status === "active"
    ? "bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]"
    : "bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]";

const enrollmentBadge: Record<EnrollmentStatus, string> = {
  active: "bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]",
  inactive: "bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]",
  completed: "bg-[var(--status-badge-completed)] text-[var(--status-badge-completed-text)]",
  dropped: "bg-[var(--status-badge-error)] text-[var(--status-badge-error-text)]",
};

const enrollmentLabel: Record<EnrollmentStatus, string> = {
  active: "Đang học",
  inactive: "Tạm dừng",
  completed: "Hoàn thành",
  dropped: "Đã nghỉ",
};

function ClassCardComponent({
  cls,
  enrollment,
  showEnrollment = false,
  actions,
  className = "",
}: ClassCardProps) {
  const { user } = useAuthContext();
  const isStudentUser = isStudent(user);

  const enrollmentStatus: EnrollmentStatus = enrollment?.status || "active";
  const enrollmentDate =
    enrollment?.enrolled_at &&
    new Date(enrollment.enrolled_at).toLocaleDateString("vi-VN");

  const studentsCount = cls.students_count ?? cls.active_student_count ?? 0;
  const maxStudents = cls.max_students;

  return (
    <div
      className={`flex flex-col rounded-lg bg-white p-6 transition-shadow dark:bg-gray-800 relative overflow-hidden ${className}`}
    >
      <div className="mb-3">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2 mb-2">
          {cls.name}
          {cls.class_code && (
            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
              #{cls.class_code}
            </span>
          )}
        </h4>
        {cls.description && (
          <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
            <RichTextDisplay content={cls.description} />
          </div>
        )}
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Trạng thái:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusBadge(
                cls.status === "active" ? "active" : "inactive"
              )}`}
            >
              {cls.status === "active"
                ? (isStudentUser ? "Đang học" : "Đang dạy")
                : "Tạm dừng"
              }
            </span>
          </span>
        </div>
        {cls.subject && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Môn học:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {cls.subject}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Học viên:</span>
          <span className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <span>
              {studentsCount}
              {maxStudents ? ` / ${maxStudents}` : ""}
            </span>
            {cls.is_full && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--status-badge-full)] text-[var(--status-badge-full-text)]">
                Đầy
              </span>
            )}
          </span>
        </div>
        {cls.end_date && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Ngày kết thúc:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {new Date(cls.end_date).toLocaleDateString('vi-VN')}
            </span>
          </div>
        )}
        {showEnrollment && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              Trạng thái ghi danh:
            </span>
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${enrollmentBadge[enrollmentStatus] ||
                "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400"
                }`}
            >
              {enrollmentLabel[enrollmentStatus] || enrollmentStatus}
            </span>
          </div>
        )}
        {showEnrollment && enrollmentDate && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Ngày ghi danh:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {enrollmentDate}
            </span>
          </div>
        )}
      </div>

      {actions ? (
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          {actions}
        </div>
      ) : (
        <div className="mt-auto pt-2" />
      )}
    </div>
  );
}

export const ClassCard = memo(ClassCardComponent);
