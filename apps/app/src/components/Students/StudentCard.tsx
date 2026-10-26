"use client";

import { memo } from "react";
import { EyeIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import Tooltip from "@/components/Common/Tooltip";
import { useAuthorization } from "@/lib/authz";
import ButtonLink from "@/components/Common/ButtonLink";
import Button from "@/components/Common/Button";
import UserInfoBox from "@/components/User/UserInfoBox";
import { getObjId } from "@/lib/id-utils";

type StudentStatus = "active" | "inactive";
type EnrollmentStatus = "active" | "inactive" | "completed" | "dropped";

interface UserLock {
  status: string;
  type: "login" | "actions" | "all";
}

interface ClassItem {
  id: string;
  name: string;
  enrollment?: {
    status: EnrollmentStatus;
    is_paused?: boolean;
  };
}

interface StudentData {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  email_verified?: boolean;
  parent_name?: string;
  student_code?: string;
  status: StudentStatus;
  classes?: ClassItem[];
  user_locks?: UserLock[];
  is_locked?: boolean;
}

interface StudentCardProps {
  student: StudentData;
  onViewClick?: (id: string) => void;
  onEditClick?: (id: string) => void;
  onDeleteClick?: (id: string) => void;
  showActions?: boolean;
  className?: string;
}

const getLockInfo = (student: StudentData) => {
  const activeLock = Array.isArray(student.user_locks)
    ? student.user_locks.find((lock: UserLock) => lock.status === "active")
    : null;
  const isLoginLocked = Boolean(student.is_locked || activeLock);
  const lockLabel =
    activeLock?.type === "actions"
      ? "Khóa thao tác"
      : activeLock?.type === "all"
        ? "Khóa đăng nhập"
        : "Khóa đăng nhập";

  return { isLoginLocked, lockLabel };
};

const getPausedClasses = (classes?: ClassItem[]) => {
  if (!Array.isArray(classes) || classes.length === 0) return [];
  return classes.filter((cls: ClassItem) => cls?.enrollment?.is_paused);
};

const getEnrollmentStatusColor = (status: EnrollmentStatus): string => {
  const statusColors: Record<EnrollmentStatus, string> = {
    active: "bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]",
    inactive: "bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]",
    completed: "bg-[var(--status-badge-completed)] text-[var(--status-badge-completed-text)]",
    dropped: "bg-[var(--status-badge-error)] text-[var(--status-badge-error-text)]",
  };
  return statusColors[status] || "bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]";
};

function StudentCardComponent({
  student,
  onViewClick,
  onEditClick,
  onDeleteClick,
  showActions = true,
  className = "",
}: StudentCardProps) {
  const { can } = useAuthorization();
  const { isLoginLocked, lockLabel } = getLockInfo(student);
  const pausedClasses = getPausedClasses(student.classes);
  const studentId = getObjId(student);

  const handleView = () => {
    if (onViewClick) {
      onViewClick(studentId);
    }
  };

  const handleEdit = () => {
    if (onEditClick) {
      onEditClick(studentId);
    }
  };

  const handleDelete = () => {
    if (onDeleteClick) {
      onDeleteClick(studentId);
    }
  };

  return (
    <div
      className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 last:border-b-0 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <UserInfoBox
            name={student.name}
            email={student.email || ""}
            emailVerified={student.email_verified || false}
            phone={student.phone}
            avatar={student.avatar}
            studentCode={student.student_code}
            size="sm"
            layout="horizontal"
          />

          <div className="mt-2 pl-11 sm:pl-[52px]">
            {/* Badges & Status */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2">
              {/* Nếu học viên chỉ có 1 lớp và lớp đó bị tạm dừng, chỉ hiển thị "lớp tạm dừng" */}
              {pausedClasses.length > 0 && student.classes && student.classes.length === pausedClasses.length ? (
                <span
                  className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] sm:text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                  title={`Đang tạm dừng tại: ${pausedClasses
                    .map((cls: ClassItem) => cls?.name || `Lớp #${getObjId(cls)}`)
                    .join(", ")}`}
                >
                  {pausedClasses.length} lớp đang nghỉ
                </span>
              ) : (
                <>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap ${student.status === "active"
                      ? "bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]"
                      : "bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]"
                      }`}
                  >
                    {student.status === "active" ? "Đang học" : "Đang nghỉ"}
                  </span>
                  {pausedClasses.length > 0 && (
                    <span
                      className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] sm:text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                      title={`Đang tạm dừng tại: ${pausedClasses
                        .map((cls: ClassItem) => cls?.name || `Lớp #${getObjId(cls)}`)
                        .join(", ")}`}
                    >
                      {pausedClasses.length} lớp đang nghỉ
                    </span>
                  )}
                </>
              )}
              {isLoginLocked && (
                <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] sm:text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  {lockLabel}
                </span>
              )}
            </div>

            {/* Parent Info */}
            {student.parent_name && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                <span className="font-medium">Phụ huynh:</span> {student.parent_name}
              </div>
            )}

            {/* Classes List */}
            {student.classes && Array.isArray(student.classes) && student.classes.length > 0 && (
              <div className="flex flex-wrap gap-1 sm:gap-1.5">
                {student.classes.slice(0, 3).map((classItem: ClassItem) => {
                  const enrollment = classItem.enrollment;
                  const enrollmentStatus = enrollment?.status || "active";
                  const colorClass = getEnrollmentStatusColor(enrollmentStatus);
                  return (
                    <span
                      key={getObjId(classItem) || `class-${classItem.name}`}
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-medium truncate max-w-[140px] ${colorClass}`}
                    >
                      {classItem.name || "Lớp không tên"}
                    </span>
                  );
                })}
                {student.classes.length > 3 && (
                  <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 flex items-center">
                    +{student.classes.length - 3} lớp
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        {showActions && (
          <div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-1.5 flex-shrink-0">
            {onViewClick ? (
              <Tooltip label="Xem hồ sơ">
                <Button
                  onClick={handleView}
                  variant="ghost"
                  className="!p-1.5 !h-auto text-primary hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Xem hồ sơ"
                >
                  <EyeIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </Tooltip>
            ) : (
              <Tooltip label="Xem hồ sơ">
                <ButtonLink
                  href={`/students/${studentId}`}
                  variant="ghost"
                  className="!p-1.5 !h-auto text-primary hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Xem hồ sơ"
                >
                  <EyeIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                </ButtonLink>
              </Tooltip>
            )}
            {onEditClick ? (
              <Tooltip label="Chỉnh sửa">
                <Button
                  onClick={handleEdit}
                  variant="ghost"
                  className="!p-1.5 !h-auto text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Chỉnh sửa"
                  disabled={!can("update", "student")}
                >
                  <PencilIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </Tooltip>
            ) : (
              <Tooltip label="Chỉnh sửa">
                <ButtonLink
                  href={`/students/${studentId}/edit`}
                  variant="ghost"
                  className="!p-1.5 !h-auto text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Chỉnh sửa"
                  disabled={!can("update", "student")}
                >
                  <PencilIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                </ButtonLink>
              </Tooltip>
            )}
            <Tooltip label="Xóa học viên">
              <Button
                onClick={handleDelete}
                variant="ghost"
                className="!p-1.5 !h-auto text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                aria-label="Xóa học viên"
                disabled={!can("delete", "student")}
              >
                <TrashIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
}

export const StudentCard = memo(StudentCardComponent);
