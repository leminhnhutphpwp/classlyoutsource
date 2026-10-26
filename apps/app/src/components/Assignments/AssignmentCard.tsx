"use client";
import { memo } from "react";
import { EyeIcon, CheckCircleIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useLatestSubmission } from "@/hooks/use-api";
import { isStudent, useAuthorization } from "@/lib/authz";
import RichTextDisplay from "@/components/Common/RichTextDisplay";
import ButtonLink from "@/components/Common/ButtonLink";
import Button from "@/components/Common/Button";
import Tooltip from "@/components/Common/Tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { getObjId } from "@/lib/id-utils";

interface AssignmentCardProps {
  assignment: any;
  user: any;
  studentEnrollment?: any;
  students?: any[];
  showClassName?: boolean;
  showEdit?: boolean;
  showDelete?: boolean;
  onDelete?: () => void;
}

function AssignmentCardComponent({
  assignment,
  user,
  studentEnrollment,
  students,
  showClassName = false,
  showEdit = false,
  showDelete = false,
  onDelete,
}: AssignmentCardProps) {
  const isStudentUser = isStudent(user);
  const { can } = useAuthorization();

  // For student enrollment status
  const derivedEnrollment =
    studentEnrollment ||
    assignment.class?.enrollment ||
    assignment.enrollment ||
    assignment.classroom?.enrollment ||
    assignment.student_enrollment;
  const isStudentPaused = isStudentUser && !!derivedEnrollment?.is_paused;

  // Fetch latest submission for students (only if not paused)
  const assignmentId = getObjId(assignment);
  const assignmentIdString = String(assignmentId);
  const { data: latestSubmission, loading: submissionLoading } = useLatestSubmission(
    assignmentIdString,
    isStudentUser && !isStudentPaused
  );

  return (
    <div className="flex flex-col rounded-lg bg-white p-4 sm:p-6 transition-shadow dark:bg-gray-800 overflow-hidden">
      <div className="mb-4">
        <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2 break-words" title={assignment.title}>
          {assignment.title}
        </h4>
        {showClassName && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Lớp: {assignment.class?.name || "Chưa phân lớp"}
            </p>
            {!isStudentUser && (
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap shrink-0 ${assignment.status === 'published'
                ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                : 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]'
                }`}>
                {assignment.status === 'published' ? 'Đang giao' : 'Sắp giao'}
              </span>
            )}
          </div>
        )}
      </div>

      {assignment.description && (
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
          <RichTextDisplay content={assignment.description} />
        </div>
      )}

      <div className="space-y-3 mb-4">
        <div className="grid grid-cols-[100px_1fr] items-baseline gap-2 text-sm">
          <span className="text-gray-500 dark:text-gray-400">Hạn nộp:</span>
          <span className="font-medium text-gray-900 dark:text-white break-words">
            {new Date(assignment.due_date).toLocaleDateString('vi-VN')}
          </span>
        </div>

        {/* Show different info for students vs tutors */}
        {isStudentUser ? (
          <StudentSubmissionStatus
            latestSubmission={latestSubmission}
            loading={submissionLoading}
            isPaused={isStudentPaused}
            enrollment={derivedEnrollment}
          />
        ) : (
          <>
            {/* Tutor view: Show class statistics */}
            <div className="grid grid-cols-[100px_1fr] items-baseline gap-2 text-sm">
              <span className="text-gray-500 dark:text-gray-400">Đã nộp:</span>
              <span className="font-medium text-gray-900 dark:text-white break-words">
                {assignment.submissions_count || 0}
                {students?.length && ` / ${students.length}`}
                {assignment.graded_submissions_count !== undefined && assignment.graded_submissions_count > 0 && (
                  <span className="ml-2 text-xs text-primary">
                    ({assignment.graded_submissions_count} đã chấm)
                  </span>
                )}
                {assignment.pending_submissions_count !== undefined && assignment.pending_submissions_count > 0 && (
                  <span className="ml-2 text-xs text-primary-light">
                    ({assignment.pending_submissions_count} chờ chấm)
                  </span>
                )}
              </span>
            </div>
            {/* Tutor view: Show status badge if not showing in header */}
            {!showClassName && (
              <div className="grid grid-cols-[100px_1fr] items-center gap-2 text-sm">
                <span className="text-gray-500 dark:text-gray-400">Trạng thái:</span>
                <div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${assignment.status === 'published'
                    ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                    : 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]'
                    }`}>
                    {assignment.status === 'published' ? 'Đang giao' : 'Sắp giao'}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {assignment.max_score && (
          <div className="grid grid-cols-[100px_1fr] items-baseline gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Điểm tối đa:</span>
            <span className="font-medium text-gray-900 dark:text-white break-words">
              {assignment.max_score} điểm
            </span>
          </div>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        {isStudentUser ? (
          <ButtonLink
            href={`/assignments/${assignmentIdString}`}
            variant="outline"
            size="sm"
            icon={<EyeIcon />}
            className="flex-1 min-w-[120px]"
          >
            Xem bài tập
          </ButtonLink>
        ) : (
          <>
            <ButtonLink
              href={`/assignments/${assignmentIdString}`}
              variant="outline"
              size="sm"
              icon={<EyeIcon />}
              className="flex-1 min-w-[120px]"
            >
              Xem bài tập
            </ButtonLink>
            <div className="flex items-center gap-2 shrink-0">
              {showEdit && (
                <Tooltip label="Chỉnh sửa">
                  <ButtonLink
                    href={`/assignments/${assignmentIdString}/edit`}
                    variant="outline"
                    size="sm"
                    icon={<PencilIcon />}
                    className="flex-shrink-0"
                    aria-label="Chỉnh sửa"
                    disabled={!can("update", "assignment")}
                  >
                    <span className="sr-only">Chỉnh sửa</span>
                  </ButtonLink>
                </Tooltip>
              )}
              {showDelete && onDelete && (
                <Tooltip label="Xóa bài tập">
                  <Button
                    onClick={onDelete}
                    variant="danger"
                    size="sm"
                    icon={<TrashIcon />}
                    className="flex-shrink-0"
                    aria-label="Xóa bài tập"
                    disabled={!can("delete", "assignment")}
                  >
                    <span className="sr-only">Xóa</span>
                  </Button>
                </Tooltip>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StudentSubmissionStatus({
  latestSubmission,
  loading,
  isPaused,
  enrollment,
}: {
  latestSubmission: any;
  loading: boolean;
  isPaused: boolean;
  enrollment: any;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-[100px_1fr] items-center gap-2 text-sm">
        <span className="text-gray-500 dark:text-gray-400">Trạng thái:</span>
        <Skeleton className="h-4 w-20 rounded" />
      </div>
    );
  }

  if (isPaused) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-[100px_1fr] items-baseline gap-2 text-sm">
          <span className="text-gray-500 dark:text-gray-400">Trạng thái:</span>
          <div>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              Tạm dừng học
            </span>
          </div>
        </div>
        {enrollment?.pause_reason && (
          <div className="grid grid-cols-[100px_1fr] items-baseline gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Lý do:</span>
            <span className="break-words">{enrollment.pause_reason}</span>
          </div>
        )}
      </div>
    );
  }

  if (!latestSubmission) {
    return (
      <div className="grid grid-cols-[100px_1fr] items-baseline gap-2 text-sm">
        <span className="text-gray-500 dark:text-gray-400">Trạng thái:</span>
        <div>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
            Chưa nộp
          </span>
        </div>
      </div>
    );
  }

  const attemptsInfo = latestSubmission.attempts_info;
  const status = latestSubmission.status;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[100px_1fr] items-baseline gap-2 text-sm">
        <span className="text-gray-500 dark:text-gray-400">Trạng thái:</span>
        <div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${status === 'graded'
            ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
            : status === 'submitted' || status === 'pending'
              ? 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]'
              : 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]'
            }`}>
            {status === 'graded' && <CheckCircleIcon className="h-3 w-3" />}
            {status === 'graded' ? 'Đã chấm' : status === 'submitted' || status === 'pending' ? 'Đã nộp' : 'Chưa nộp'}
          </span>
        </div>
      </div>
      {attemptsInfo && (
        <div className="grid grid-cols-[100px_1fr] items-baseline gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>Số lần nộp:</span>
          <span className="font-medium text-gray-700 dark:text-gray-300 break-words">
            {attemptsInfo.unlimited
              ? `${attemptsInfo.current} lần (Không giới hạn)`
              : `${attemptsInfo.current}/${attemptsInfo.max} lần`
            }
            {!attemptsInfo.unlimited && attemptsInfo.remaining !== null && (
              <span className="ml-1 text-gray-500 dark:text-gray-400">
                (Còn {attemptsInfo.remaining} lần)
              </span>
            )}
          </span>
        </div>
      )}
      {status === 'graded' && latestSubmission.score !== null && (
        <div className="grid grid-cols-[100px_1fr] items-baseline gap-2 text-xs">
          <span className="text-gray-500 dark:text-gray-400">Điểm:</span>
          <span className="font-semibold text-primary break-words">
            {Number(parseFloat(latestSubmission.score).toFixed(1))}
            {latestSubmission.max_score && (
              <span className="text-gray-500 dark:text-gray-400 ml-1">
                / {Number(parseFloat(latestSubmission.max_score.toString()).toFixed(1))}
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

const AssignmentCard = memo(AssignmentCardComponent);
export default AssignmentCard;

