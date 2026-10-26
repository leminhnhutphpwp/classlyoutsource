"use client";
import React, { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSchedule, useScheduleSessions, useStudentClasses } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { useStudentId } from "@/hooks/use-student-id";
import { apiClient } from "@/lib/api-client";
import { useAuthContext } from "@/contexts/auth-context";
import { canManageClass, isStudent } from "@/lib/authz";
import { useLockContext } from "@/contexts/lock-context";
import { ListSkeleton } from "@/components/ui/loading";
import { Skeleton } from "@/components/ui/skeleton";
import PausedStudentBanner from "@/components/Students/PausedStudentBanner";
import {
  ArrowLeftIcon,
  PencilIcon,
  CalendarIcon,
  ClockIcon,
  PlusIcon,
  CheckCircleIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import Tooltip from "@/components/Common/Tooltip";
import ConfirmGenerateSessionsDialog from "@/components/Common/ConfirmGenerateSessionsDialog";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import { formatSchedule } from "@/lib/format-schedule";
import { getObjId, idsEqual } from "@/lib/id-utils";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";

export default function ScheduleDetailsPage() {
  const params = useParams();
  const { user } = useAuthContext();
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const id = params.id as string;
  const isStudentUser = isStudent(user);
  const { studentId } = useStudentId();
  const { renderError } = useErrorDisplay("Chi tiết lịch học");

  // Use browser history navigation - simpler and more reliable
  const handleGoBack = useGoBack('/schedules');

  const { data: schedule, loading, error, refetch: refetchSchedule, permissions } = useSchedule(id);
  const sessionsHook = useScheduleSessions(id);
  const { data: sessionsData, loading: sessionsLoading, error: sessionsError, refetch: refetchSessions } = sessionsHook;

  // Use permissions from API response
  const canView = permissions?.can_view ?? true; // Default true cho view
  const canManage = permissions?.can_manage ?? false;

  // Check enrollment status for students
  const scheduleClassId = useMemo(() => {
    if (!schedule) return "";
    const candidates = [
      schedule.class_id,
      getObjId(schedule.class),
      schedule.classId,
    ];
    const found = candidates.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
    return found ? String(found) : "";
  }, [schedule]);

  const shouldLoadStudentClasses = isStudentUser && !!studentId && !actionsLocked;
  const { classes: studentClasses } = useStudentClasses(
    shouldLoadStudentClasses ? studentId : '0',
    undefined,
    { enabled: shouldLoadStudentClasses, shouldRedirectOnAuth: false }
  );

  const pausedEnrollment = useMemo(() => {
    if (!shouldLoadStudentClasses || !scheduleClassId || !studentClasses || studentClasses.length === 0) {
      return null;
    }
    const targetClass = studentClasses.find((cls: any) => {
      const identifier =
        getObjId(cls) ||
        cls.class_id ||
        cls.classId ||
        getObjId(cls.class) ||
        cls.pivot?.class_id;
      return identifier && idsEqual(identifier, scheduleClassId);
    });
    return targetClass?.enrollment || targetClass?.pivot || null;
  }, [shouldLoadStudentClasses, scheduleClassId, studentClasses]);

  const isStudentPaused = shouldLoadStudentClasses && !!pausedEnrollment?.is_paused;

  // State for generating sessions
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null);

  // Handle open generate dialog
  const handleOpenGenerateDialog = () => {
    setShowGenerateDialog(true);
    setGenerateError(null);
    setGenerateSuccess(null);
  };

  // Handle close generate dialog
  const handleCloseGenerateDialog = () => {
    if (!generating) {
      setShowGenerateDialog(false);
    }
  };

  // Handle confirm generate sessions
  const handleConfirmGenerateSessions = async () => {
    if (!id) return;

    setGenerating(true);
    setGenerateError(null);
    setGenerateSuccess(null);

    try {
      const response = await apiClient.generateScheduleSessions(id);

      if (response.success) {
        const count = response.data?.sessions_created || 0;
        setGenerateSuccess(`Đã tạo thành công ${count} buổi học mới`);
        setShowGenerateDialog(false);

        // Refresh sessions data
        setTimeout(() => {
          refetchSessions();
          setGenerateSuccess(null);
        }, 2000);
      } else {
        setGenerateError(response.message || 'Không thể tạo buổi học');
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi tạo buổi học');
    } finally {
      setGenerating(false);
    }
  };

  // Extract data from new API structure: { schedule, statistics, weeks, sessions }
  const extractedData = React.useMemo(() => {
    if (!sessionsData) {
      return { weeks: [], statistics: null, sessions: [] };
    }

    // New API structure
    if (sessionsData.weeks && Array.isArray(sessionsData.weeks)) {
      // Filter unique weeks and sort by week_number
      // Use combination of week_number and week_start as unique key
      const uniqueWeeksMap = new Map<string, any>();

      sessionsData.weeks.forEach((week: any) => {
        const key = `${week.week_number}-${week.week_start || ''}`;
        // Keep the first occurrence or one with more sessions
        if (!uniqueWeeksMap.has(key) || (week.total_sessions > (uniqueWeeksMap.get(key)?.total_sessions || 0))) {
          uniqueWeeksMap.set(key, week);
        }
      });

      // Convert back to array and sort by week_number
      const uniqueWeeks = Array.from(uniqueWeeksMap.values())
        .sort((a: any, b: any) => {
          // Sort by week_number first
          if (a.week_number !== b.week_number) {
            return a.week_number - b.week_number;
          }
          // If week_number is same, sort by week_start
          if (a.week_start && b.week_start) {
            return new Date(a.week_start).getTime() - new Date(b.week_start).getTime();
          }
          return 0;
        });

      return {
        weeks: uniqueWeeks,
        statistics: sessionsData.statistics || null,
        sessions: sessionsData.sessions || []
      };
    }

    // Backward compatibility: old structure with flat sessions array
    if (Array.isArray(sessionsData)) {
      return { weeks: [], statistics: null, sessions: sessionsData };
    }

    // Old structure: { sessions: [...] }
    if (sessionsData.sessions && Array.isArray(sessionsData.sessions)) {
      return { weeks: [], statistics: null, sessions: sessionsData.sessions };
    }

    return { weeks: [], statistics: null, sessions: [] };
  }, [sessionsData]) as { weeks: any[]; statistics: any; sessions: any[] };

  const { weeks, statistics, sessions } = extractedData;

  // Kiểm tra lock và plan feature trước để ưu tiên hiển thị lock content
  if (actionsLocked || planFeatureMessage) return renderError();

  if (error && !loading) return renderError(error, () => { refetchSchedule(); refetchSessions(); });

  // Check view permission - chỉ block khi không có quyền xem
  if (!loading && schedule && permissions !== undefined && !canView) return renderError(undefined, undefined, false);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
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
            {loading || !schedule ? (
              <div className="space-y-1">
                <Skeleton className="h-6 sm:h-7 w-48 rounded" />
                <Skeleton className="h-3 sm:h-4 w-64 rounded" />
              </div>
            ) : (
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate" title={formatSchedule(schedule)}>
                  {formatSchedule(schedule)}
                </h1>
                {schedule.description && (
                  <p className="text-sm text-dark-4 dark:text-dark-6 mt-0.5 line-clamp-1">{schedule.description}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {!loading && schedule && canManage && (
          <div className="flex items-center gap-2 w-full lg:w-auto mt-2 lg:mt-0">
            <ButtonLink
              href={`/schedules/${id}/edit`}
              variant="outline"
              size="sm"
              icon={<PencilIcon />}
              lockAware={true}
              className="flex-1 sm:flex-initial"
            >
              Chỉnh sửa
            </ButtonLink>
          </div>
        )}
      </div>

      {/* Paused Student Banner */}
      {isStudentPaused && pausedEnrollment && (
        <PausedStudentBanner
          enrollment={pausedEnrollment}
          studentName={user?.name}
          className={schedule?.class?.name}
          description="Bạn đang tạm dừng lớp học này nên chỉ có thể xem thông tin. Liên hệ giáo viên để mở lại nếu cần tiếp tục học."
        />
      )}

      {/* Card: Thông tin chung */}
      <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
        {loading || !schedule ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-40 rounded" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-10 rounded" />
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lớp học</label>
              <p className="text-gray-900 dark:text-white">{schedule.class?.name || schedule.class_name || "Chưa phân lớp"}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Trạng thái</label>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${schedule.status === 'upcoming'
                ? 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]'
                : schedule.status === 'in_progress'
                  ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                  : schedule.status === 'paused'
                    ? 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]'
                    : schedule.status === 'completed'
                      ? 'bg-[var(--status-badge-completed)] text-[var(--status-badge-completed-text)]'
                      : schedule.is_active
                        ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                        : 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]'
                }`}>
                {schedule.status_label ||
                  (schedule.status === 'upcoming' ? 'Sắp bắt đầu' :
                    schedule.status === 'in_progress' ? 'Đang diễn ra' :
                      schedule.status === 'paused' ? 'Tạm dừng' :
                        schedule.status === 'completed' ? 'Đã hoàn thành' :
                          schedule.is_active ? 'Đang dùng' : 'Tạm dừng')}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Thời hạn</label>
              <p className="text-gray-900 dark:text-white">
                {schedule.start_date && new Date(schedule.start_date).toLocaleDateString('vi-VN')}
                {schedule.start_date && schedule.end_date && ' - '}
                {schedule.end_date && new Date(schedule.end_date).toLocaleDateString('vi-VN')}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tần suất</label>
              <p className="text-gray-900 dark:text-white">
                {schedule.recurring_type === 'daily' ? 'Hàng ngày' : schedule.recurring_type === 'weekly' ? 'Hàng tuần' : schedule.recurring_type === 'monthly' ? 'Hàng tháng' : (schedule.frequency || '-')}
              </p>
            </div>
            {(schedule.time_range || (schedule.start_time && schedule.end_time)) && (
              <div className="md:col-span-2">
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <ClockIcon className="h-4 w-4" />
                  <span>
                    {schedule.time_range || `${schedule.start_time} - ${schedule.end_time}`}
                    {schedule.duration && ` (${schedule.duration} phút)`}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card: Giá trị mặc định cho buổi học (Template) - Ẩn cho student */}
      {!isStudentUser && (
        <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
          {loading || !schedule ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-40 rounded" />
              <Skeleton className="h-28 rounded" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Giá trị mặc định cho buổi học (Template)</label>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-pastel/40 text-primary">
                    Template
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Các giá trị này sẽ được sao chép vào buổi học khi tạo tự động. Có thể để trống và thiết lập ở từng buổi học cụ thể.
                </p>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Chế độ học (mặc định)</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-3 rounded-lg border ${schedule.default_mode === 'offline' ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700'}`}>
                    <span className="text-gray-800 dark:text-gray-200">Offline (Trực tiếp tại lớp)</span>
                  </div>
                  <div className={`p-3 rounded-lg border ${schedule.default_mode === 'online' ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700'}`}>
                    <span className="text-gray-800 dark:text-gray-200">Online (Học qua Internet)</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {(schedule.offline || schedule.default_mode === 'offline') && (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 h-full">
                    <h4 className="font-medium mb-3 text-gray-900 dark:text-white">Cấu hình Offline</h4>
                    <div className="grid grid-cols-1 gap-3 text-sm">
                      {(schedule.offline?.room || (schedule as any).room) && <div><span className="text-gray-500 dark:text-gray-400">Phòng học: </span><span className="text-gray-900 dark:text-white">{schedule.offline?.room || (schedule as any).room}</span></div>}
                      {(schedule.offline?.location || (schedule as any).location) && <div><span className="text-gray-500 dark:text-gray-400">Địa điểm: </span><span className="text-gray-900 dark:text-white">{schedule.offline?.location || (schedule as any).location}</span></div>}
                      {(() => { const note = (schedule.offline?.note || (schedule as any).notes) as string | undefined; return note ? <div><span className="text-gray-500 dark:text-gray-400">Ghi chú: </span><span className="text-gray-900 dark:text-white">{note}</span></div> : null; })()}
                    </div>
                  </div>
                )}
                {(schedule.online || schedule.default_mode === 'online') && (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 h-full">
                    <h4 className="font-medium mb-3 text-gray-900 dark:text-white">Cấu hình Online</h4>
                    <div className="grid grid-cols-1 gap-3 text-sm">
                      {(() => {
                        const code = (schedule.online?.platform || (schedule as any).online_platform) as string | undefined;
                        const label = code === 'google_meet' ? 'Google Meet' : code === 'zoom' ? 'Zoom' : code === 'microsoft_teams' ? 'Microsoft Teams' : code === 'other' ? 'Khác' : code;
                        return code ? <div><span className="text-gray-500 dark:text-gray-400">Nền tảng: </span><span className="text-gray-900 dark:text-white">{label}</span></div> : null;
                      })()}
                      {(() => {
                        const link = (schedule.online?.link || (schedule as any).online_meeting_url || (schedule as any).online_link) as string | undefined;
                        return link ? <div><span className="text-gray-500 dark:text-gray-400">Link: </span><span className="text-gray-900 dark:text-white break-all">{link}</span></div> : null;
                      })()}
                      {(schedule.online?.meeting_id || schedule.online_meeting_id) && <div><span className="text-gray-500 dark:text-gray-400">Meeting ID: </span><span className="text-gray-900 dark:text-white">{schedule.online?.meeting_id || schedule.online_meeting_id}</span></div>}
                      {(() => {
                        const pwd = (schedule.online?.password || (schedule as any).online_password || (schedule as any).online_meeting_password) as string | undefined;
                        return pwd ? <div><span className="text-gray-500 dark:text-gray-400">Password: </span><span className="text-gray-900 dark:text-white">{pwd}</span></div> : null;
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Card: Xen kẽ theo tuần - Ẩn cho student */}
      {!isStudentUser && (() => {
        const isAlternating = !loading && (schedule && (((schedule as any).is_alternating) || ((schedule as any).alternate_by_week)));
        return isAlternating;
      })() && (
          <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Pattern xen kẽ theo tuần</h4>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {(((schedule as any).alternating_pattern) || (schedule as any).alternate_weeks || []).map((w: any, i: number) => (
                <div key={i} className="py-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Tuần {i + 1}</div>
                  <div className="text-sm">
                    {w.mode === 'online' ? 'Online (Học qua Internet)' : 'Offline (Trực tiếp tại lớp)'}
                  </div>
                  <div />
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Card: Buổi học */}
      <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800 mb-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Danh sách buổi học</h4>
          </div>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
            {statistics && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span><strong className="text-gray-700 dark:text-gray-300">{statistics.total_weeks}</strong> tuần học</span>
                <span><strong className="text-gray-700 dark:text-gray-300">{statistics.total_sessions}</strong> buổi học</span>
                {statistics.average_sessions_per_week && (
                  <span className="text-gray-400">
                    Trung bình: <strong className="text-gray-600 dark:text-gray-300">{statistics.average_sessions_per_week.toFixed(1)}</strong> buổi/tuần
                  </span>
                )}
              </div>
            )}
            {canManageClass(user) && (
              <Button
                onClick={handleOpenGenerateDialog}
                disabled={loading || !schedule}
                loading={generating}
                variant="primary"
                size="sm"
                icon={<PlusIcon className="h-4 w-4" />}
              >
                Tạo buổi học
              </Button>
            )}
          </div>
        </div>

        {/* Success/Error Messages */}
        {generateSuccess && (
          <div className="mb-4 rounded-lg bg-primary-pastel/40 border border-primary/30 p-3 text-sm text-primary">
            {generateSuccess}
          </div>
        )}
        {generateError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {generateError}
          </div>
        )}

        {!isStudentUser && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Đây là buổi học <strong>CỤ THỂ</strong> có thể chỉnh sửa độc lập
          </p>
        )}

        {sessionsLoading ? (
          <ListSkeleton count={3} showAvatar={false} />
        ) : sessionsError ? (
          <div className="text-sm text-red-500 dark:text-red-400">
            Lỗi tải danh sách buổi học: {sessionsError}
          </div>
        ) : weeks.length > 0 ? (
          <div className="space-y-6">
            {weeks.map((week: any, weekIndex: number) => {
              const weekStartDate = week.week_start ? new Date(week.week_start) : null;
              const weekEndDate = week.week_end ? new Date(week.week_end) : null;
              const weekDateRange = weekStartDate && weekEndDate
                ? `${weekStartDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} - ${weekEndDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
                : weekStartDate
                  ? weekStartDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                  : null;

              return (
                <div key={`week-index-${weekIndex}`} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-5">
                  {/* Week Header */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-semibold">
                        {week.week_number}
                      </div>
                      <div>
                        <h5 className="text-sm font-semibold text-gray-900 dark:text-white">
                          Tuần {week.week_number}
                        </h5>
                        {weekDateRange && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {weekDateRange}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{week.total_sessions}</span> buổi học
                    </div>
                  </div>

                  {/* Sessions Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {week.sessions && week.sessions.map((session: any, sessionIdx: number) => {
                      const sessionDate = session.session_date
                        ? new Date(session.session_date)
                        : session.date
                          ? new Date(session.date)
                          : null;
                      const dateStr = sessionDate
                        ? sessionDate.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
                        : '-';
                      const timeStr = session.time_range || (session.start_time && session.end_time ? `${session.start_time} - ${session.end_time}` : '-');
                      const isOnline = session.mode === 'online';

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
                      const statusConfig = getStatusConfig(session.status || 'scheduled');

                      return (
                        <div
                          key={`week-${weekIndex}-session-${getObjId(session) || sessionIdx}`}
                          className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 transition-shadow bg-white dark:bg-gray-800"
                        >
                          {/* Session Header */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <ClockIcon className="h-4 w-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  Buổi {sessionIdx + 1}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400 capitalize">{dateStr}</p>
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">{timeStr}</p>
                              {/* Status Badge */}
                              <div className="mt-1.5">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusConfig.badgeClass}`}>
                                  {statusConfig.label}
                                  {session.is_manually_completed && (
                                    <CheckCircleIcon className="h-3 w-3" />
                                  )}
                                  {session.is_auto_completed && (
                                    <ClockIcon className="h-3 w-3" />
                                  )}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${isOnline
                                ? 'bg-[var(--status-badge-online)] text-[var(--status-badge-online-text)]'
                                : 'bg-[var(--status-badge-offline)] text-[var(--status-badge-offline-text)]'
                                }`}>
                                {isOnline ? 'Online' : 'Offline'}
                              </span>
                            </div>
                          </div>

                          {/* Session Details */}
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 mb-3">
                            {isOnline ? (
                              <div className="space-y-1.5">
                                {session.online_platform && (
                                  <div className="text-xs">
                                    <span className="text-gray-500 dark:text-gray-400">Nền tảng: </span>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                      {session.online_platform === 'google_meet' ? 'Google Meet' :
                                        session.online_platform === 'zoom' ? 'Zoom' :
                                          session.online_platform === 'microsoft_teams' ? 'Microsoft Teams' :
                                            session.online_platform}
                                    </span>
                                  </div>
                                )}
                                {session.online_meeting_url && (
                                  <div className="text-xs">
                                    <span className="text-gray-500 dark:text-gray-400">Link: </span>
                                    <a
                                      href={session.online_meeting_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline truncate block max-w-full"
                                    >
                                      {session.online_meeting_url}
                                    </a>
                                  </div>
                                )}
                                {session.online_meeting_id && (
                                  <div className="text-xs">
                                    <span className="text-gray-500 dark:text-gray-400">ID: </span>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">{session.online_meeting_id}</span>
                                  </div>
                                )}
                                {session.online_meeting_password && (
                                  <div className="text-xs">
                                    <span className="text-gray-500 dark:text-gray-400">Password: </span>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">{session.online_meeting_password}</span>
                                  </div>
                                )}
                                {!session.online_platform && !session.online_meeting_url && !session.online_meeting_id && (
                                  <span className="text-xs text-gray-400 italic">Dùng giá trị mặc định</span>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {session.room && (
                                  <div className="text-xs">
                                    <span className="text-gray-500 dark:text-gray-400">Phòng: </span>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">{session.room}</span>
                                  </div>
                                )}
                                {session.location && (
                                  <div className="text-xs">
                                    <span className="text-gray-500 dark:text-gray-400">Địa điểm: </span>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">{session.location}</span>
                                  </div>
                                )}
                                {session.notes && (
                                  <div className="text-xs">
                                    <span className="text-gray-500 dark:text-gray-400">Ghi chú: </span>
                                    <span className="text-gray-700 dark:text-gray-300">{session.notes}</span>
                                  </div>
                                )}
                                {!session.room && !session.location && !session.notes && (
                                  <span className="text-xs text-gray-400 italic">Dùng giá trị mặc định</span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Session Actions */}
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-2">
                            {(() => {
                              const sessionId = getObjId(session);
                              const sessionIdString = String(sessionId);
                              return (
                                <>
                                  <Link href={`/schedule-sessions/${sessionIdString}`} className="flex-1">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      icon={<EyeIcon className="h-4 w-4" />}
                                      className="w-full justify-center"
                                    >
                                      Xem buổi học
                                    </Button>
                                  </Link>
                                  {canManageClass(user) && (
                                    <Link href={`/schedule-sessions/${sessionIdString}/edit`}>
                                      <Tooltip label="Chỉnh sửa">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          icon={<PencilIcon className="h-4 w-4" />}
                                          className="w-10 justify-center px-0"
                                          aria-label="Chỉnh sửa"
                                        >
                                          <span className="sr-only">Chỉnh sửa</span>
                                        </Button>
                                      </Tooltip>
                                    </Link>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : sessions.length > 0 ? (
          // Fallback: Display flat sessions list if weeks data is not available
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Hiển thị {sessions.length} buổi học (chưa được nhóm theo tuần)
          </div>
        ) : (
          <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            Chưa có buổi học được tạo.
          </div>
        )}
      </div>

      {/* Generate Sessions Confirmation Dialog */}
      <ConfirmGenerateSessionsDialog
        open={showGenerateDialog}
        onClose={handleCloseGenerateDialog}
        onConfirm={handleConfirmGenerateSessions}
        loading={generating}
        scheduleName={schedule?.class?.name || schedule?.day_name ? `${schedule.class?.name || ''} - ${schedule.day_name} ${schedule.time_range || ''}`.trim() : undefined}
      />
    </div>
  );
}


