"use client";
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import {
  useScheduleSession,
  useCompleteScheduleSession,
  useCancelScheduleSession,
  useStudentClasses,
  useApi
} from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { apiClient } from "@/lib/api-client";
import { REPORT_CACHE_TTL } from "@/config/cache";
import { useStudentId } from "@/hooks/use-student-id";
import { useAuthContext } from "@/contexts/auth-context";
import { canManageClass, isStudent } from "@/lib/authz";
import { useToast } from "@/contexts/toast-context";
import Button from "@/components/Common/Button";
import ErrorDisplay from "@/components/Common/ErrorDisplay";
import { formatSchedule } from "@/lib/format-schedule";
import { formatSessionTitle } from "@/lib/format-session";
import { getObjId, idsEqual } from "@/lib/id-utils";
import ButtonLink from "@/components/Common/ButtonLink";
import PausedStudentBanner from "@/components/Students/PausedStudentBanner";
import {
  ArrowLeftIcon,
  PencilIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowTopRightOnSquareIcon,
  QrCodeIcon
} from "@heroicons/react/24/outline";

export default function ScheduleSessionDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthContext();
  const id = params.id as string;
  const isStudentUser = isStudent(user);
  const { studentId } = useStudentId();

  const { data: session, loading, error, refetch } = useScheduleSession(id);
  const { addToast } = useToast();
  const completeMutation = useCompleteScheduleSession();
  const cancelMutation = useCancelScheduleSession();

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  const scheduleId = useMemo(() => session?.schedule_id || session?.scheduleId, [session]);

  const { data: schedule, loading: scheduleLoading } = useApi(
    () => apiClient.getSchedule(String(scheduleId!)),
    [scheduleId],
    true,
    isStudentUser && !!scheduleId && String(scheduleId) !== "undefined",
    {
      cacheKey: `schedule:${scheduleId}`,
      ttl: REPORT_CACHE_TTL,
      strategy: 'stale-while-revalidate',
    }
  );

  const sessionClassId = useMemo(() => {
    if (!session) return "";
    return String(
      session.class_id ||
      (session.class && getObjId(session.class)) ||
      session.classId ||
      schedule?.class_id ||
      (schedule?.class && getObjId(schedule.class)) ||
      session.schedule?.class_id ||
      (session.schedule?.class && getObjId(session.schedule.class)) ||
      ""
    );
  }, [session, schedule]);

  const shouldLoadStudentClasses = isStudentUser && !!studentId;
  const { classes: studentClasses, loading: studentClassesLoading } = useStudentClasses(
    studentId || '0',
    undefined,
    { enabled: shouldLoadStudentClasses }
  );

  const pausedEnrollment = useMemo(() => {
    if (!isStudentUser || !sessionClassId) return null;
    if (shouldLoadStudentClasses && studentClassesLoading) return null;
    if (!studentClasses?.length) return null;
    if (isStudentUser && scheduleLoading && !sessionClassId) return null;

    const targetClass = studentClasses.find((cls: { id?: number; class_id?: number; classId?: number; class?: { id: number }; pivot?: { class_id: number } }) => {
      const identifier = getObjId(cls) || cls.class_id || cls.classId || getObjId(cls.class) || cls.pivot?.class_id;
      return identifier && idsEqual(identifier, sessionClassId);
    });

    return targetClass?.enrollment || targetClass?.pivot || null;
  }, [isStudentUser, shouldLoadStudentClasses, studentClassesLoading, sessionClassId, studentClasses, scheduleLoading]);

  const isStudentPaused = isStudentUser && !!pausedEnrollment?.is_paused;

  useEffect(() => {
    const anyDialogOpen = showCancelConfirm || showCompleteConfirm;
    if (!anyDialogOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow || "";
      document.documentElement.style.overflow = previousHtmlOverflow || "";
    };
  }, [showCancelConfirm, showCompleteConfirm]);

  // Use browser history navigation
  const handleGoBack = useGoBack('/schedules');

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <Button
          onClick={() => {
            if (typeof window !== 'undefined' && window.history.length > 1) {
              router.back();
            } else {
              router.push('/schedules');
            }
          }}
          variant="outline"
          size="sm"
          icon={<ArrowLeftIcon />}
        >
          Quay lại
        </Button>

        <ErrorDisplay error={error} title="Chi tiết buổi học" onRetry={() => refetch()} />
      </div>
    );
  }

  const sessionDate = session?.session_date ? new Date(session.session_date) : null;
  const dateStr = sessionDate
    ? sessionDate.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
    : '-';
  const timeStr = session?.start_time && session?.end_time ? `${session.start_time} - ${session.end_time}` : '-';
  const isOnline = session?.mode === 'online';

  // Status configuration
  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; badgeClass: string }> = {
      scheduled: { label: 'Đã lên lịch', badgeClass: 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]' },
      ongoing: { label: 'Đang diễn ra', badgeClass: 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]' },
      completed: { label: 'Đã hoàn thành', badgeClass: 'bg-[var(--status-badge-completed)] text-[var(--status-badge-completed-text)]' },
      cancelled: { label: 'Đã hủy', badgeClass: 'bg-[var(--status-badge-error)] text-[var(--status-badge-error-text)]' },
      postponed: { label: 'Hoãn lại', badgeClass: 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]' },
    };
    return configs[status] || configs.scheduled;
  };

  const statusConfig = session ? getStatusConfig(session.status || 'scheduled') : null;

  // Handlers
  const handleCompleteConfirmed = async () => {
    if (!session || actionLoading) return;

    setActionLoading("complete");
    try {
      const response = await completeMutation.mutate(id);

      if (response?.success) {
        addToast({
          title: "Thành công",
          message: response.message || "Đã đánh dấu buổi học hoàn thành",
          type: "success",
        });
        refetch();
      } else {
        addToast({
          title: "Lỗi",
          message: response?.message || "Không thể đánh dấu hoàn thành",
          type: "error",
        });
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      addToast({
        title: "Lỗi",
        message: error?.message || "Có lỗi xảy ra",
        type: "error",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelConfirmed = async () => {
    if (!session || actionLoading) return;

    setActionLoading("cancel");
    try {
      const response = await cancelMutation.mutate(id);

      if (response?.success) {
        addToast({
          title: "Thành công",
          message: response.message || "Đã hủy buổi học",
          type: "success",
        });
        refetch();
      } else {
        addToast({
          title: "Lỗi",
          message: response?.message || "Không thể hủy buổi học",
          type: "error",
        });
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      addToast({
        title: "Lỗi",
        message: error?.message || "Có lỗi xảy ra",
        type: "error",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const canComplete = session && !session.is_completed && session.status !== 'cancelled';
  const canCancel = session && !session.is_completed && session.status !== 'cancelled';

  const cancelDialog =
    showCancelConfirm ? (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-[1px] p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg dark:bg-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Xác nhận hủy buổi học
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
            Bạn có chắc chắn muốn hủy buổi học này? Hành động này không thể hoàn tác.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCancelConfirm(false)}
              disabled={actionLoading === "cancel"}
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setShowCancelConfirm(false);
                void handleCancelConfirmed();
              }}
              loading={actionLoading === "cancel"}
            >
              Xác nhận hủy
            </Button>
          </div>
        </div>
      </div>
    ) : null;

  const completeDialog =
    showCompleteConfirm ? (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-[1px] p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg dark:bg-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Xác nhận hoàn thành buổi học
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
            Bạn có chắc chắn muốn đánh dấu buổi học này là đã hoàn thành?
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCompleteConfirm(false)}
              disabled={actionLoading === "complete"}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setShowCompleteConfirm(false);
                void handleCompleteConfirmed();
              }}
              loading={actionLoading === "complete"}
            >
              Xác nhận
            </Button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Render confirm dialogs via portal */}
      {cancelDialog && createPortal(cancelDialog, document.body)}
      {completeDialog && createPortal(completeDialog, document.body)}

      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between xl:gap-6">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            onClick={handleGoBack}
            variant="outline"
            size="sm"
            icon={<ArrowLeftIcon />}
            className="flex-shrink-0"
          >
            Quay lại
          </Button>

          <div className="min-w-0 flex-1">
            {loading || !session ? (
              <div className="animate-pulse space-y-1">
                <div className="h-6 sm:h-7 w-48 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700 mt-1" />
              </div>
            ) : (
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate" title={formatSessionTitle(session)}>
                  {formatSessionTitle(session)}
                </h1>
                <p className="text-sm text-dark-4 dark:text-dark-6 mt-0.5 truncate">{dateStr} • {timeStr}</p>
              </div>
            )}
          </div>
        </div>

        {!loading && session && canManageClass(user) && (
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto mt-2 xl:mt-0">
            {session.status !== 'cancelled' && !session.is_completed && (
              <ButtonLink
                href={`/schedule-sessions/${id}/attendance`}
                variant="primary"
                size="sm"
                icon={<QrCodeIcon className="h-5 w-5" />}
                className="flex-1 sm:flex-initial justify-center"
              >
                Hiển thị QR điểm danh
              </ButtonLink>
            )}
            {canComplete && (
              <Button
                onClick={() => setShowCompleteConfirm(true)}
                loading={actionLoading === "complete"}
                variant="primary"
                size="sm"
                icon={<CheckCircleIcon className="h-5 w-5" />}
                className="flex-1 sm:flex-initial justify-center"
              >
                Hoàn thành
              </Button>
            )}
            {canCancel && (
              <Button
                onClick={() => setShowCancelConfirm(true)}
                loading={actionLoading === "cancel"}
                variant="danger"
                size="sm"
                icon={<XCircleIcon className="h-5 w-5" />}
                className="flex-1 sm:flex-initial justify-center"
              >
                Hủy buổi học
              </Button>
            )}
            <ButtonLink
              href={`/schedule-sessions/${id}/edit`}
              variant="outline"
              size="sm"
              icon={<PencilIcon />}
              className="flex-1 sm:flex-initial justify-center"
            >
              Chỉnh sửa
            </ButtonLink>
          </div>
        )}
      </div>

      {/* Paused Student Banner - hiển thị khi học viên bị paused */}
      {isStudentPaused && pausedEnrollment && (
        <PausedStudentBanner
          enrollment={pausedEnrollment}
          studentName={user?.name}
          className={session?.class?.name || session?.schedule?.class?.name || schedule?.class?.name || schedule?.class_name}
          description="Bạn đang tạm dừng lớp học này nên chỉ có thể xem thông tin. Liên hệ giáo viên để mở lại nếu cần tiếp tục học."
        />
      )}

      {/* Card: Thông tin chung */}
      <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
        {loading || !session ? (
          <div className="animate-pulse space-y-3">
            <div className="h-5 w-40 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-10 rounded bg-gray-200 dark:bg-gray-700" />
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="grid grid-cols-[100px_1fr] items-baseline gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Lớp học:</label>
              <p className="text-sm text-gray-900 dark:text-white break-words">{session.class?.name || 'N/A'}</p>
            </div>
            <div className="grid grid-cols-[100px_1fr] items-baseline gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Lịch học:</label>
              <p className="text-sm text-gray-900 dark:text-white break-words">
                {formatSchedule(session.schedule)}
              </p>
            </div>
            <div className="grid grid-cols-[100px_1fr] items-baseline gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Ngày học:</label>
              <p className="text-sm text-gray-900 dark:text-white break-words">{dateStr}</p>
            </div>
            <div className="grid grid-cols-[100px_1fr] items-baseline gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Khung giờ:</label>
              <p className="text-sm text-gray-900 dark:text-white break-words">{timeStr}</p>
            </div>
            <div className="grid grid-cols-[100px_1fr] items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Chế độ:</label>
              <div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${isOnline
                  ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                  : 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]'
                  }`}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-[100px_1fr] items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Trạng thái:</label>
              <div>
                {statusConfig && (
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.badgeClass}`}>
                    {statusConfig.label}
                    {session.is_manually_completed && (
                      <CheckCircleIcon className="h-3 w-3" />
                    )}
                    {session.is_auto_completed && (
                      <ClockIcon className="h-3 w-3" />
                    )}
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-[100px_1fr] items-baseline gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tuần học:</label>
              <p className="text-sm text-gray-900 dark:text-white">{session.week_number ? `Tuần ${session.week_number}` : 'N/A'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Card: Thông tin hoàn thành */}
      {session && session.is_completed && (
        <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Thông tin hoàn thành
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {session.completed_at && (
              <div className="grid grid-cols-[100px_1fr] items-baseline gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Thời điểm:</label>
                <p className="text-sm text-gray-900 dark:text-white break-words">
                  {new Date(session.completed_at).toLocaleString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            )}
            {session.is_manually_completed && session.completed_by && (
              <div className="grid grid-cols-[100px_1fr] items-baseline gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Bởi:</label>
                <p className="text-sm text-gray-900 dark:text-white break-words">
                  {session.completed_by.name || session.completed_by.email || 'N/A'}
                </p>
              </div>
            )}
            {session.is_auto_completed && (
              <div className="grid grid-cols-[100px_1fr] items-baseline gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Loại:</label>
                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5 break-words">
                  <ClockIcon className="h-4 w-4 shrink-0" />
                  Tự động hoàn thành
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Card: Chi tiết Online/Offline */}
      {session && (
        <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isOnline ? 'Cấu hình Online' : 'Cấu hình Offline'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {isOnline ? 'Thông tin buổi học trực tuyến' : 'Thông tin buổi học trực tiếp'}
            </p>
          </div>

          {isOnline ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {session.online_platform && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-700/30">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Nền tảng</label>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {session.online_platform === 'google_meet' ? 'Google Meet' :
                      session.online_platform === 'zoom' ? 'Zoom' :
                        session.online_platform === 'microsoft_teams' ? 'Microsoft Teams' :
                          session.online_platform}
                  </p>
                </div>
              )}
              {session.online_meeting_url && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-700/30 md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Link meeting</label>
                  <a
                    href={session.online_meeting_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 break-all hover:underline inline-flex items-center gap-1"
                  >
                    {session.online_meeting_url}
                    <ArrowTopRightOnSquareIcon className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              )}
              {session.online_meeting_id && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-700/30">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Meeting ID</label>
                  <p className="text-sm font-medium text-gray-900 dark:text-white break-words">{session.online_meeting_id}</p>
                </div>
              )}
              {session.online_meeting_password && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-700/30">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Password</label>
                  <p className="text-sm font-medium text-gray-900 dark:text-white break-words">{session.online_meeting_password}</p>
                </div>
              )}
              {!session.online_platform && !session.online_meeting_url && !session.online_meeting_id && (
                <div className="md:col-span-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">Dùng giá trị mặc định từ lịch học</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {session.room && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-700/30">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Phòng học</label>
                  <p className="text-sm font-medium text-gray-900 dark:text-white break-words">{session.room}</p>
                </div>
              )}
              {session.location && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-700/30">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Địa điểm</label>
                  <p className="text-sm font-medium text-gray-900 dark:text-white break-words">{session.location}</p>
                </div>
              )}
              {session.notes && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-700/30 md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Ghi chú</label>
                  <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-words">{session.notes}</p>
                </div>
              )}
              {!session.room && !session.location && !session.notes && (
                <div className="md:col-span-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">Dùng giá trị mặc định từ lịch học</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

