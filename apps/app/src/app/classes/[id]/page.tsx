"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import { createPortal } from "react-dom";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useClassDetails, useClassStudents, useClassAssignments, useClassSchedules, usePauseStudent, useResumeStudent, useStudentClasses } from "@/hooks/use-api";
import { useAuthContext } from "@/contexts/auth-context";
import { canManageClass, isStudent } from "@/lib/authz";
import { useStudentId } from "@/hooks/use-student-id";
import { formatCurrency } from "@/lib/format-currency";
import { formatPercentage } from "@/lib/format-number";
import { getObjId, idsEqual } from "@/lib/id-utils";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import Tooltip from "@/components/Common/Tooltip";
import AssignmentCard from "@/components/Assignments/AssignmentCard";
import {
  ArrowLeftIcon,
  PlusIcon,
  UserGroupIcon,
  DocumentTextIcon,
  CalendarIcon,
  ChartBarIcon,
  TrashIcon,
  UserIcon,
  AcademicCapIcon,
  BookOpenIcon,
  EyeIcon,
  PencilIcon,
  CurrencyDollarIcon,
  PauseIcon,
  PlayIcon,
  PhoneIcon,
  EnvelopeIcon,
  ArrowPathIcon
} from "@heroicons/react/24/outline";
import ConfirmDeleteDialog from '@/components/Common/ConfirmDeleteDialog';
import PaymentRequestsList from '@/components/PaymentRequests/PaymentRequestsList';
import PaymentRequestDetail from '@/components/PaymentRequests/PaymentRequestDetail';
import PausedStudentBanner from "@/components/Students/PausedStudentBanner";
import { useNotification } from "@/hooks/use-notification";
import { useLockContext } from "@/contexts/lock-context";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";
import { Skeleton } from "@/components/ui/skeleton";
import { ClassStudentCard } from "@/components/Classes/ClassStudentCard";
import { StatsCardSkeleton } from "@/components/ui/loading";
import { tableStyles } from "@/components/Common/tableStyles";
import { useGoBack } from "@/hooks/use-go-back";
import { Tabs, TabPanel } from "@/components/Common/Tabs";
import RichTextDisplay from "@/components/Common/RichTextDisplay";
import UserInfoBox from "@/components/User/UserInfoBox";

function ClassDetailsContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const classId = params.id as string;
  const handleGoBack = useGoBack('/classes');
  const [activeTab, setActiveTab] = useState("overview");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { success: notifySuccess, error: notifyError } = useNotification();
  const { user } = useAuthContext();
  const { studentId } = useStudentId();
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const { renderError } = useErrorDisplay("Chi tiết lớp học");
  const { mutate: pauseStudentMutation, loading: pausingStudent } = usePauseStudent();
  const { mutate: resumeStudentMutation, loading: resumingStudent } = useResumeStudent();
  const [studentAction, setStudentAction] = useState<{ type: 'pause' | 'resume'; student: any } | null>(null);
  const [pauseReason, setPauseReason] = useState('');
  const [actionBanner, setActionBanner] = useState<{ enrollment?: any; studentName?: string } | null>(null);
  const [optimisticEnrollment, setOptimisticEnrollment] = useState<Record<string, { isPaused: boolean; statusLabel?: string; pauseReason?: string }>>({});

  // Payment Requests state
  const [paymentRequestView, setPaymentRequestView] = useState<"list" | "detail">("list");
  const [selectedPaymentRequestId, setSelectedPaymentRequestId] = useState<string | null>(null);

  // Handle query params to set active tab
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'students', 'assignments', 'schedule', 'payments', 'tutor'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleOpenPauseDialog = (student: any) => {
    setStudentAction({ type: 'pause', student });
    setPauseReason(student?.enrollment?.pause_reason || '');
  };

  const handleOpenResumeDialog = (student: any) => {
    setStudentAction({ type: 'resume', student });
    setPauseReason('');
  };

  const handleCloseStudentAction = () => {
    setStudentAction(null);
    setPauseReason('');
  };

  const handleConfirmStudentAction = async () => {
    if (!studentAction) return;
    const targetStudentId = getObjId(studentAction.student);
    const studentId = targetStudentId;
    const studentKey = studentId;
    setActionBanner(null);

    let result;
    if (studentAction.type === 'pause') {
      result = await pauseStudentMutation({
        classId,
        studentId,
        reason: pauseReason.trim() ? pauseReason.trim() : undefined,
      });
    } else {
      result = await resumeStudentMutation({
        classId,
        studentId,
      });
    }

    if (result?.success) {
      if (studentAction.type === 'pause') {
        setOptimisticEnrollment((prev) => ({
          ...prev,
          [studentKey]: {
            isPaused: true,
            statusLabel: result.data?.enrollment?.status_label || 'Học viên đang tạm dừng lớp học này.',
            pauseReason: result.data?.enrollment?.pause_reason || pauseReason || undefined,
          },
        }));
      } else {
        setOptimisticEnrollment((prev) => {
          const next = { ...prev };
          next[studentKey] = {
            isPaused: false,
            statusLabel: result.data?.enrollment?.status_label || 'Đang học',
            pauseReason: undefined,
          };
          return next;
        });
      }

      notifySuccess(
        studentAction.type === 'pause' ? 'Đã tạm dừng học viên' : 'Đã kích hoạt lại học viên',
        `${studentAction.student.name} ${studentAction.type === 'pause' ? 'sẽ được ẩn khỏi các thao tác giảng dạy trong lớp.' : 'đã sẵn sàng tham gia lại lớp học.'}`
      );
      handleCloseStudentAction();
      refetchStudents?.();
    } else if (result?.code === 'STUDENT_PAUSED') {
      setActionBanner({
        enrollment: result.data?.enrollment,
        studentName: studentAction.student.name,
      });
      notifyError('Không thể thực hiện', result.message || 'Học viên đang trong trạng thái tạm dừng.');
    } else if (result) {
      // Lỗi do thiếu quyền (FEATURE_NOT_AVAILABLE): đóng dialog, không hiển thị toast trùng lặp.
      if (result.code === 'FEATURE_NOT_AVAILABLE') {
        handleCloseStudentAction();
        return;
      }
      notifyError('Không thể thực hiện', result.message || 'Đã xảy ra lỗi không mong muốn.');
    }
  };

  // Helper function to mask email for privacy
  const maskEmail = (email: string): string => {
    if (!email) return "Chưa có email";
    const [localPart, domain] = email.split('@');
    if (!domain) return email;

    // Show first 2 characters and mask the rest
    const maskedLocal = localPart.length > 2
      ? `${localPart.substring(0, 2)}${'*'.repeat(Math.min(localPart.length - 2, 5))}`
      : '***';

    return `${maskedLocal}@${domain}`;
  };

  // Check if student is the current user
  const isCurrentUser = (student: any): boolean => {
    return idsEqual(student.user_id, user);
  };

  // Get email display based on user role
  const getEmailDisplay = (student: any): string => {
    if (!student.email) return "Chưa có email";

    // If user is not a student, show full email
    if (!isStudent(user)) {
      return student.email;
    }

    // If user is student and this is their own profile, show full email
    if (isCurrentUser(student)) {
      return student.email;
    }

    // If user is student and this is another student, mask email
    return maskEmail(student.email);
  };

  const isStudentUser = isStudent(user);
  const { data: classDetails, loading: classLoading, error: classError, permissions: classPermissions } = useClassDetails(classId);
  const { data: students, statistics: studentsStats, loading: studentsLoading, refetch: refetchStudents, permissions: studentsPermissions } = useClassStudents(classId);
  const shouldLoadStudentClasses = isStudentUser && !!studentId;
  const { classes: myStudentClasses } = useStudentClasses(studentId || '0', undefined, { enabled: shouldLoadStudentClasses });

  // Use permissions from API response, fallback to canManageClass if not available (for backward compatibility)
  const canViewClass = classPermissions?.can_view ?? true; // Default true cho view
  const canManageClassFromApi = classPermissions?.can_manage ?? false;
  const canManageStudents = studentsPermissions?.can_manage ?? false;
  const currentUserId = getObjId(user);
  const currentStudentEnrollment = useMemo(() => {
    if (!isStudentUser) return null;

    if (students && students.length > 0 && studentId) {
      const targetStudent = students.find((student: any) => {
        const studentIdValue = getObjId(student);
        const matchesId = studentIdValue && idsEqual(studentIdValue, studentId);
        const matchesUser = idsEqual(student.user_id, currentUserId);
        return matchesId || matchesUser;
      });
      if (targetStudent?.enrollment) {
        return targetStudent.enrollment;
      }
    }

    if (myStudentClasses && myStudentClasses.length > 0) {
      const targetClass = myStudentClasses.find((cls: any) => {
        const classIdentifier = getObjId(cls) || cls.class_id || cls.classId || getObjId(cls.class) || cls.pivot?.class_id;
        return classIdentifier && idsEqual(classIdentifier, classId);
      });
      return targetClass?.enrollment || targetClass?.pivot || null;
    }

    return null;
  }, [isStudentUser, students, studentId, currentUserId, myStudentClasses, classId]);
  const isCurrentStudentPaused = isStudentUser && !!currentStudentEnrollment?.is_paused;
  useEffect(() => {
    if (!students || !students.length || Object.keys(optimisticEnrollment).length === 0) {
      return;
    }
    setOptimisticEnrollment((prev) => {
      let changed = false;
      const next = { ...prev };
      students.forEach((student: any) => {
        const studentIdValue = getObjId(student);
        const key = String(studentIdValue);
        const optimistic = next[key];
        if (!optimistic) return;
        const actualPaused = !!student.enrollment?.is_paused;
        if (actualPaused === optimistic.isPaused) {
          delete next[key];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [students, optimisticEnrollment]);
  const { data: assignments, loading: assignmentsLoading, permissions: assignmentsPermissions } = useClassAssignments(classId);
  const { data: classSchedules, statistics: schedulesStats, loading: schedulesLoading, error: schedulesError, permissions: schedulesPermissions } = useClassSchedules(classId);

  // Use permissions from API response, fallback to canManageClass if not available (for backward compatibility)
  const canManageAssignments = assignmentsPermissions?.can_manage ?? false;
  const canManageSchedules = schedulesPermissions?.can_manage ?? false;

  // In tutor-only system, all tutors manage their own classes

  // Kiểm tra lock và plan feature trước để ưu tiên hiển thị lock content
  if (actionsLocked || planFeatureMessage) {
    return renderError();
  }

  // Render content immediately, show skeleton loading for individual sections
  if (classError && !classLoading) {
    return renderError(classError);
  }

  // Check view permission - chỉ block khi không có quyền xem
  if (!classLoading && classDetails && classPermissions !== undefined && !canViewClass) {
    return renderError(undefined, undefined, false);
  }

  // Filter tabs based on user role - students should not see "Học phí" tab
  const tabs = [
    { id: "overview", label: "Tổng quan", icon: ChartBarIcon },
    { id: "students", label: "Học viên", icon: UserGroupIcon },
    { id: "assignments", label: "Bài tập", icon: DocumentTextIcon },
    { id: "schedule", label: "Lịch học", icon: CalendarIcon },
    ...(isStudent(user)
      ? [{ id: "tutor", label: "Giáo viên", icon: AcademicCapIcon }]
      : [{ id: "payments", label: "Học phí", icon: CurrencyDollarIcon }]
    ),
  ];

  return (
    <div className="space-y-6">
      {studentAction && (
        <StudentPauseResumeDialog
          action={studentAction}
          onClose={handleCloseStudentAction}
          onConfirm={handleConfirmStudentAction}
          loading={studentAction.type === 'pause' ? pausingStudent : resumingStudent}
          reason={pauseReason}
          onReasonChange={setPauseReason}
        />
      )}
      <ConfirmDeleteDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          // Xóa lớp học hiện được xử lý tại màn danh sách, nên dialog này tạm thời không thực thi hành động.
        }}
        loading={false}
        message="Bạn có chắc chắn muốn xóa lớp học này? Hành động không thể hoàn tác."
      />
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
            {classLoading || !classDetails ? (
              <div className="space-y-1">
                <Skeleton className="h-6 sm:h-7 w-48 rounded" />
                <Skeleton className="h-3 sm:h-4 w-64 rounded" />
              </div>
            ) : (
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate" title={classDetails.name}>
                  {classDetails.name}
                </h1>
                {classDetails.description && (
                  <div className="text-sm text-dark-4 dark:text-dark-6 mt-0.5 line-clamp-1">
                    <RichTextDisplay content={classDetails.description} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {(canManageClassFromApi || canManageClass(user)) && (
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto mt-2 lg:mt-0">
            {canManageClassFromApi && (
              <div className="flex items-center gap-2 flex-grow sm:flex-grow-0">
                <ButtonLink
                  href={`/classes/${classId}/edit`}
                  variant="outline"
                  size="sm"
                  icon={<PencilIcon />}
                  className="flex-1 sm:flex-initial"
                >
                  Chỉnh sửa
                </ButtonLink>
                <Button
                  onClick={() => setConfirmDelete(true)}
                  variant="danger"
                  size="sm"
                  icon={<TrashIcon />}
                  className="flex-1 sm:flex-initial"
                >
                  Xóa
                </Button>
              </div>
            )}
            {(canManageClassFromApi || canManageClass(user)) && (
              <ButtonLink
                href={`/classes/${classId}/gradebook`}
                variant="outline"
                size="sm"
                icon={<AcademicCapIcon />}
                className="flex-1 sm:flex-initial"
              >
                Sổ điểm
              </ButtonLink>
            )}
            {(canManageStudents || canManageClass(user)) && (
              <ButtonLink
                href={`/classes/${classId}/students/add`}
                variant="primary"
                size="sm"
                icon={<PlusIcon />}
                className="w-full sm:w-auto"
              >
                Thêm học viên
              </ButtonLink>
            )}
          </div>
        )}
      </div>

      {isStudentUser && isCurrentStudentPaused && (
        <PausedStudentBanner
          enrollment={currentStudentEnrollment}
          studentName={user?.name}
          className={classDetails?.name}
          description="Bạn đang tạm dừng lớp này nên chỉ có thể xem thông tin. Liên hệ giáo viên để mở lại nếu cần tiếp tục học."
        />
      )}

      {/* Stats Cards - Hidden for students */}
      {!isStudentUser && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {classLoading ? (
            <>
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
            </>
          ) : (
            <>
              <div className="rounded-lg bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-800">
                <div className="flex items-center">
                  <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                    <UserGroupIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Tất cả</p>
                    <p className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                      {studentsStats?.count ?? students?.length ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-800">
                <div className="flex items-center">
                  <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                    <DocumentTextIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Bài tập</p>
                    <p className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                      {assignments?.length || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-800">
                <div className="flex items-center">
                  <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                    <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary-light" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Buổi học</p>
                    <p className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                      {classDetails?.sessions_count || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-800">
                <div className="flex items-center">
                  <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                    <ChartBarIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Điểm danh</p>
                    <p className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                      {formatPercentage(classDetails?.attendance_rate)}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab Content */}
      <TabPanel activeTab={activeTab} tabId="overview">
        <div className="space-y-4 sm:space-y-6">
          <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
              Thông tin lớp học
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Tên lớp học
                </label>
                {classLoading || !classDetails ? (
                  <Skeleton className="h-5 w-48 rounded" />
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <AcademicCapIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div className="flex flex-col">
                      <p className="text-gray-900 dark:text-white font-medium">{classDetails.name}</p>
                      {classDetails.class_code && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">#{classDetails.class_code}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {classDetails?.subject && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Môn học
                  </label>
                  {classLoading || !classDetails ? (
                    <Skeleton className="h-5 w-32 rounded" />
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <BookOpenIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                      </div>
                      <p className="text-gray-900 dark:text-white font-medium">{classDetails.subject}</p>
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Giáo viên
                </label>
                {classLoading || !classDetails ? (
                  <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                ) : classDetails.tutor ? (
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <UserIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    </div>
                    <p className="text-gray-900 dark:text-white font-medium">
                      {classDetails.tutor.name}
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-900 dark:text-white">Chưa phân công</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Trạng thái
                </label>
                {classLoading || !classDetails ? (
                  <Skeleton className="h-6 w-20 rounded-full" />
                ) : (
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${classDetails.status === 'active'
                    ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                    : 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]'
                    }`}>
                    {classDetails.status === 'active' ? (isStudentUser ? 'Đang học' : 'Đang dạy') : 'Tạm dừng'}
                  </span>
                )}
              </div>
              {classDetails?.start_date && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Ngày bắt đầu
                  </label>
                  {classLoading || !classDetails ? (
                    <Skeleton className="h-5 w-32 rounded" />
                  ) : (
                    <p className="text-gray-900 dark:text-white">
                      {new Date(classDetails.start_date).toLocaleDateString('vi-VN')}
                    </p>
                  )}
                </div>
              )}
              {classDetails?.end_date && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Ngày kết thúc
                  </label>
                  {classLoading || !classDetails ? (
                    <Skeleton className="h-5 w-32 rounded" />
                  ) : (
                    <p className="text-gray-900 dark:text-white">
                      {new Date(classDetails.end_date).toLocaleDateString('vi-VN')}
                    </p>
                  )}
                </div>
              )}
              {classDetails?.max_students && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Số lượng tối đa
                  </label>
                  {classLoading || !classDetails ? (
                    <div className="h-5 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                  ) : (
                    <p className="text-gray-900 dark:text-white">
                      {classDetails.max_students} học viên
                      {classDetails.available_slots !== undefined && (
                        <span className="text-gray-500 dark:text-gray-400 ml-2">
                          ({classDetails.available_slots} chỗ trống)
                        </span>
                      )}
                    </p>
                  )}
                </div>
              )}
              {classDetails?.tuition_fee && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Học phí
                  </label>
                  {classLoading || !classDetails ? (
                    <Skeleton className="h-5 w-32 rounded" />
                  ) : (
                    <p className="text-gray-900 dark:text-white">
                      {classDetails.tuition_fee_formatted || formatCurrency(classDetails.tuition_fee)}
                    </p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Ngày tạo
                </label>
                {classLoading || !classDetails ? (
                  <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                ) : (
                  <p className="text-gray-900 dark:text-white">
                    {new Date(classDetails.created_at).toLocaleDateString('vi-VN')}
                  </p>
                )}
              </div>
              {classDetails?.schedule && (() => {
                // Parse schedule JSON string
                let scheduleData: any = null;
                try {
                  scheduleData = typeof classDetails.schedule === 'string'
                    ? JSON.parse(classDetails.schedule)
                    : classDetails.schedule;
                } catch {
                  scheduleData = classDetails.schedule;
                }

                // Format schedule display
                const formatSchedule = (schedule: any) => {
                  if (!schedule) return 'Chưa có lịch học';

                  // Map a day to its Vietnamese label. The data may store days as JS getDay()
                  // NUMBERS (0=Sun..6=Sat — the current class.schedule.days format, e.g. [2,5]) OR
                  // as string codes/names. Coerce safely so a number never crashes on .toLowerCase().
                  const numDayMap: { [key: number]: string } = {
                    0: 'Chủ nhật', 1: 'Thứ 2', 2: 'Thứ 3', 3: 'Thứ 4',
                    4: 'Thứ 5', 5: 'Thứ 6', 6: 'Thứ 7',
                  };
                  const codeDayMap: { [key: string]: string } = {
                    mon: 'Thứ 2', monday: 'Thứ 2',
                    tue: 'Thứ 3', tuesday: 'Thứ 3',
                    wed: 'Thứ 4', wednesday: 'Thứ 4',
                    thu: 'Thứ 5', thursday: 'Thứ 5',
                    fri: 'Thứ 6', friday: 'Thứ 6',
                    sat: 'Thứ 7', saturday: 'Thứ 7',
                    sun: 'Chủ nhật', sunday: 'Chủ nhật',
                  };
                  const dayLabel = (day: unknown): string => {
                    if (typeof day === 'number' && numDayMap[day] !== undefined) return numDayMap[day];
                    const s = String(day).trim().toLowerCase();
                    if (/^\d+$/.test(s) && numDayMap[Number(s)] !== undefined) return numDayMap[Number(s)];
                    return codeDayMap[s] || String(day);
                  };

                  const parts: string[] = [];

                  // Format days
                  if (schedule.days && Array.isArray(schedule.days) && schedule.days.length > 0) {
                    const dayNames = schedule.days.map(dayLabel).join(', ');
                    parts.push(dayNames);
                  }

                  // Format time
                  if (schedule.time) {
                    parts.push(schedule.time);
                  }

                  return parts.length > 0 ? parts.join(' - ') : 'Chưa có lịch học';
                };

                return (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Lịch học
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {formatSchedule(scheduleData)}
                    </p>
                  </div>
                );
              })()}
              {(!classLoading && classDetails?.description) && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Mô tả
                  </label>
                  <div className="text-gray-900 dark:text-white">
                    <RichTextDisplay content={classDetails.description} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="students">
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
              Danh sách học viên ({studentsStats?.count ?? students?.length ?? 0})
              {studentsStats && (
                <span className="block sm:inline text-sm font-normal text-gray-500 dark:text-gray-400 sm:ml-2 mt-1 sm:mt-0">
                  ({studentsStats.active_count} đang học
                  {typeof studentsStats.paused_count === "number" && ` • ${studentsStats.paused_count} tạm dừng`}
                  {studentsStats.max_students && ` / ${studentsStats.max_students} tối đa`})
                </span>
              )}
            </h3>
            {(canManageStudents || canManageClass(user)) && (
              <ButtonLink
                href={`/classes/${classId}/students/add`}
                variant="primary"
                size="sm"
                icon={<PlusIcon />}
              >
                Thêm học viên
              </ButtonLink>
            )}
          </div>

          {actionBanner?.enrollment && (
            <PausedStudentBanner
              enrollment={actionBanner.enrollment}
              studentName={actionBanner.studentName}
              className={classDetails?.name}
            />
          )}

          {studentsLoading ? (
            <div className="rounded-lg bg-white dark:bg-gray-800">
              <div className="overflow-x-auto">
                <div className="p-4 sm:p-6">
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center gap-4 animate-pulse">
                        <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                          <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                        </div>
                        <div className="h-6 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
                        <div className="h-8 w-8 rounded bg-gray-200 dark:bg-gray-700" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : students && students.length > 0 ? (
            <div className={tableStyles.wrapper}>
              {/* Mobile Card View */}
              <div className="block lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
                {students.map((student: any) => {
                  const studentId = getObjId(student);
                  const studentIdString = studentId;
                  const studentKey = studentIdString;
                  const enrollment = student.enrollment || {};
                  const optimistic = optimisticEnrollment[studentKey];
                  return (
                    <ClassStudentCard
                      key={studentIdString}
                      student={student}
                      enrollment={enrollment}
                      optimisticEnrollment={optimistic}
                      user={user ?? undefined}
                      isStudentUser={isStudentUser}
                      canManageStudents={canManageStudents}
                      canManageClass={canManageClass(user)}
                      onPauseClick={handleOpenPauseDialog}
                      onResumeClick={handleOpenResumeDialog}
                    />
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-visible">
                <table className={tableStyles.table}>
                  <thead className={tableStyles.thead}>
                    <tr>
                      <th className={tableStyles.headerCellBase}>
                        Học viên
                      </th>
                      <th className={tableStyles.headerCellBase}>
                        Trạng thái
                      </th>
                      <th className={tableStyles.headerCellBase}>
                        Điểm danh
                      </th>
                      {!isStudent(user) && (
                        <th className={`${tableStyles.headerCellBase} text-right`}>
                          Thao tác
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className={tableStyles.body}>
                    {students.map((student: any) => {
                      const studentId = getObjId(student);
                      const studentIdString = studentId;
                      const studentKey = studentIdString;
                      const enrollment = student.enrollment || {};
                      const optimistic = optimisticEnrollment[studentKey];
                      const isPaused = optimistic ? optimistic.isPaused : !!enrollment.is_paused;
                      const pauseReason = optimistic?.pauseReason ?? enrollment.pause_reason;
                      // Chỉ hiển thị trạng thái tạm dừng nếu user không phải học viên hoặc đây là chính họ
                      const shouldShowPausedStatus = !isStudentUser || isCurrentUser(student);
                      return (
                        <tr key={studentIdString} className={tableStyles.row}>
                          <td className={tableStyles.cell}>
                            <UserInfoBox
                              name={student.name}
                              email={getEmailDisplay(student)}
                              emailVerified={student.email_verified || false}
                              avatar={student.avatar}
                              studentCode={student.student_code}
                              size="sm"
                              layout="horizontal"
                            />
                          </td>

                          <td className={tableStyles.cellStatus}>
                            {isPaused && shouldShowPausedStatus ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                                  Tạm dừng học
                                </span>
                                {pauseReason && (
                                  <p className="text-xs text-amber-600 dark:text-amber-300 break-words">
                                    {pauseReason}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                Đang học
                              </span>
                            )}
                          </td>
                          <td className={tableStyles.cellStatus}>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-pastel text-primary">
                              {formatPercentage(student.attendance_rate)}
                            </span>
                          </td>
                          {!isStudent(user) && (
                            <td className={tableStyles.cellActions}>
                              <div className="flex items-center justify-end gap-2">
                                {(canManageStudents || canManageClass(user)) && (
                                  <Tooltip label={isPaused ? "Mở lại học viên" : "Tạm dừng học viên"}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        isPaused ? handleOpenResumeDialog(student) : handleOpenPauseDialog(student)
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
                                )}
                                <Tooltip label="Xem hồ sơ">
                                  <Link
                                    href={`/students/${getObjId(student)}`}
                                    className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                                    aria-label="Xem hồ sơ"
                                  >
                                    <EyeIcon className="h-4 w-4" />
                                  </Link>
                                </Tooltip>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-white p-8 text-center dark:bg-gray-800">
              <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <UserGroupIcon className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">
                Chưa có học viên nào
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Thêm học viên vào lớp học này để bắt đầu
              </p>
              {(canManageStudents || canManageClass(user)) && (
                <ButtonLink
                  href={`/classes/${classId}/students/add`}
                  variant="primary"
                  size="sm"
                  icon={<PlusIcon />}
                >
                  Thêm học viên đầu tiên
                </ButtonLink>
              )}
            </div>
          )}
        </div>
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="assignments">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
              Bài tập ({assignments?.length || 0})
            </h3>
            {(canManageAssignments || canManageClass(user)) && (
              <ButtonLink
                href={`/assignments/create?class_id=${classId}`}
                variant="primary"
                size="sm"
                icon={<PlusIcon />}
              >
                Tạo bài tập
              </ButtonLink>
            )}
          </div>

          {assignmentsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                  <div className="space-y-4">
                    <div className="h-6 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="h-8 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : assignments && assignments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {assignments.map((assignment: any) => {
                const assignmentIdString = getObjId(assignment);
                return (
                  <AssignmentCard
                    key={assignmentIdString}
                    assignment={assignment}
                    user={user}
                    students={students}
                    studentEnrollment={currentStudentEnrollment}
                  />
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg bg-white p-8 text-center dark:bg-gray-800">
              <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <DocumentTextIcon className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">
                Chưa có bài tập nào
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Tạo bài tập đầu tiên cho lớp học này
              </p>
              {(canManageAssignments || canManageClass(user)) && (
                <ButtonLink
                  href={`/assignments/create?class_id=${classId}`}
                  variant="primary"
                  size="sm"
                  icon={<PlusIcon />}
                >
                  Tạo bài tập đầu tiên
                </ButtonLink>
              )}
            </div>
          )}
        </div>
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="schedule">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
              Lịch học
            </h3>
            {(canManageSchedules || canManageClass(user)) && (
              <ButtonLink
                href={`/schedules/create?class_id=${classId}`}
                variant="primary"
                size="sm"
                icon={<PlusIcon />}
              >
                Tạo lịch học
              </ButtonLink>
            )}
          </div>

          {schedulesStats && (
            <div className="rounded-lg bg-white p-4 dark:bg-gray-800">
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Lịch học: </span>
                  <span className="font-medium text-gray-900 dark:text-white">{schedulesStats.total_count || 0}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Đang dạy: </span>
                  <span className="font-medium text-gray-900 dark:text-white">{schedulesStats.active_count || 0}</span>
                </div>
              </div>
            </div>
          )}

          {schedulesError && !schedulesLoading ? (
            <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              <h4 className="font-medium mb-2">Lỗi tải lịch học</h4>
              <p>{schedulesError}</p>
            </div>
          ) : schedulesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-lg bg-white p-6 dark:bg-gray-800 animate-pulse">
                  <div className="space-y-4">
                    <div className="h-5 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-8 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                </div>
              ))}
            </div>
          ) : classSchedules && classSchedules.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {classSchedules.map((schedule: any) => {
                const scheduleIdString = getObjId(schedule);
                return (
                  <ScheduleCard
                    key={scheduleIdString}
                    schedule={schedule}
                    user={user}
                    studentEnrollment={currentStudentEnrollment}
                    canManageSchedules={canManageSchedules}
                  />
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg bg-white p-8 text-center dark:bg-gray-800">
              <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <CalendarIcon className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">Chưa có lịch học</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">Tạo lịch học cho lớp học này</p>
              {(canManageSchedules || canManageClass(user)) && (
                <ButtonLink
                  href={`/schedules/create?class_id=${classId}`}
                  variant="primary"
                  size="sm"
                  icon={<PlusIcon />}
                >
                  Tạo lịch học
                </ButtonLink>
              )}
            </div>
          )}
        </div>
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="payments">
        <div className="space-y-6">
          {paymentRequestView === "list" && (
            <PaymentRequestsList
              classId={classId}
              onViewClick={(id: string | number) => {
                setSelectedPaymentRequestId(getObjId(id));
                setPaymentRequestView("detail");
              }}
            />
          )}

          {paymentRequestView === "detail" && selectedPaymentRequestId && (
            <PaymentRequestDetail
              requestId={selectedPaymentRequestId}
              onBack={() => {
                setPaymentRequestView("list");
                setSelectedPaymentRequestId(null);
              }}
            />
          )}
        </div>
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="tutor">
        <div className="space-y-6">
          {classLoading || !classDetails ? (
            <div className="rounded-lg bg-white dark:bg-gray-800">
              <div className="p-6">
                <div className="space-y-4 animate-pulse">
                  <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 rounded-full bg-gray-200 dark:bg-gray-700" />
                    <div className="space-y-2 flex-1">
                      <div className="h-6 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                      <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-700" />
                    </div>
                  </div>
                  <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>
            </div>
          ) : classDetails.tutor ? (
            <div className="rounded-lg bg-white dark:bg-gray-800">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                  Thông tin giáo viên
                </h3>

                <div className="space-y-6">
                  {/* Tutor Header */}
                  <div className="flex items-start gap-4 pb-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="h-20 w-20 rounded-full bg-primary-pastel dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                      {classDetails.tutor.avatar || classDetails.tutor.avatar_url ? (
                        <img
                          src={classDetails.tutor.avatar || classDetails.tutor.avatar_url}
                          alt={classDetails.tutor.name}
                          className="h-20 w-20 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl font-bold text-primary dark:text-primary-light">
                          {classDetails.tutor.name?.charAt(0)?.toUpperCase() || 'T'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                        {classDetails.tutor.name}
                      </h4>
                      {classDetails.tutor.email && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                          <EnvelopeIcon className="h-4 w-4" />
                          {classDetails.tutor.email}
                        </p>
                      )}
                      {classDetails.tutor.phone && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2 mt-1">
                          <PhoneIcon className="h-4 w-4" />
                          {classDetails.tutor.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Tutor Bio/Description */}
                  {(classDetails.tutor.bio || classDetails.tutor.description || classDetails.tutor.about) && (
                    <div>
                      <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        Giới thiệu
                      </h5>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
                        {classDetails.tutor.bio || classDetails.tutor.description || classDetails.tutor.about}
                      </p>
                    </div>
                  )}

                  {/* Tutor Specialties/Subjects */}
                  {classDetails.tutor.specialties && (
                    <div>
                      <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        Chuyên môn
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray(classDetails.tutor.specialties) ? (
                          classDetails.tutor.specialties.map((specialty: string, index: number) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-pastel text-primary dark:bg-primary/20 dark:text-primary-light"
                            >
                              {specialty}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {classDetails.tutor.specialties}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tutor Experience */}
                  {classDetails.tutor.experience && (
                    <div>
                      <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        Kinh nghiệm
                      </h5>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {classDetails.tutor.experience}
                      </p>
                    </div>
                  )}

                  {/* Tutor Education */}
                  {classDetails.tutor.education && (
                    <div>
                      <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        Học vấn
                      </h5>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {classDetails.tutor.education}
                      </p>
                    </div>
                  )}

                  {/* Additional Info */}
                  {(!classDetails.tutor.bio && !classDetails.tutor.description && !classDetails.tutor.about &&
                    !classDetails.tutor.specialties && !classDetails.tutor.experience && !classDetails.tutor.education) && (
                      <div className="text-center py-8">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Chưa có thông tin chi tiết về giáo viên
                        </p>
                      </div>
                    )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-white p-8 text-center dark:bg-gray-800">
              <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <UserIcon className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Chưa có giáo viên
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Lớp học này chưa được phân công giáo viên
              </p>
            </div>
          )}
        </div>
      </TabPanel>
    </div>
  );
}

// Schedule card component for class detail page
function ScheduleCard({
  schedule,
  user,
  studentEnrollment,
  canManageSchedules,
}: {
  schedule: any;
  user: any;
  studentEnrollment?: any;
  canManageSchedules?: boolean;
}) {
  const isStudentUser = isStudent(user);
  const isStudentPaused = isStudentUser && !!studentEnrollment?.is_paused;

  // Format recurring days để dễ đọc hơn
  const formatRecurringDays = (days: string | any[]) => {
    if (!days) return null;
    const dayMap: { [key: string]: string } = {
      'mon': 'Thứ 2',
      'tue': 'Thứ 3',
      'wed': 'Thứ 4',
      'thu': 'Thứ 5',
      'fri': 'Thứ 6',
      'sat': 'Thứ 7',
      'sun': 'Chủ nhật',
      'monday': 'Thứ 2',
      'tuesday': 'Thứ 3',
      'wednesday': 'Thứ 4',
      'thursday': 'Thứ 5',
      'friday': 'Thứ 6',
      'saturday': 'Thứ 7',
      'sunday': 'Chủ nhật',
    };

    // Helper để convert day value thành string và normalize
    const normalizeDay = (d: any): string => {
      if (typeof d === 'string') {
        return d.toLowerCase().trim();
      }
      if (typeof d === 'number') {
        // Nếu là số (0-6), map sang day code
        const numToDay: { [key: number]: string } = {
          0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat'
        };
        return numToDay[d] || String(d);
      }
      return String(d).toLowerCase().trim();
    };

    if (typeof days === 'string') {
      try {
        const parsed = JSON.parse(days);
        if (Array.isArray(parsed)) {
          return parsed
            .map((d: any) => {
              const normalized = normalizeDay(d);
              return dayMap[normalized] || normalized;
            })
            .filter(Boolean)
            .join(', ');
        }
        return String(days);
      } catch {
        if (days.includes(',')) {
          return days.split(',').map(d => {
            const normalized = normalizeDay(d.trim());
            return dayMap[normalized] || normalized;
          }).filter(Boolean).join(', ');
        }
        return String(days);
      }
    }
    if (Array.isArray(days)) {
      return days
        .map((d: any) => {
          const normalized = normalizeDay(d);
          return dayMap[normalized] || normalized;
        })
        .filter(Boolean)
        .join(', ');
    }
    return String(days);
  };

  const recurringDaysFormatted = schedule.recurring_days
    ? formatRecurringDays(schedule.recurring_days)
    : schedule.day_name || (schedule.day_of_week ? `Thứ ${schedule.day_of_week}` : null);

  return (
    <div className="flex flex-col rounded-lg bg-white p-4 sm:p-6 transition-shadow dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {schedule.name || 'Lịch học'}
          </h3>
        </div>
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap shrink-0 ${schedule.status === 'upcoming'
          ? 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]'
          : schedule.status === 'in_progress'
            ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
            : schedule.status === 'paused'
              ? 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]'
              : schedule.status === 'completed'
                ? 'bg-[var(--status-badge-completed)] text-[var(--status-badge-completed-text)]'
                : 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]'
          }`}>
          {schedule.status_label ||
            (schedule.status === 'upcoming' ? 'Sắp bắt đầu' :
              schedule.status === 'in_progress' ? 'Đang diễn ra' :
                schedule.status === 'paused' ? 'Tạm dừng' :
                  schedule.status === 'completed' ? 'Đã hoàn thành' :
                    schedule.is_active ? 'Đang dạy' : 'Tạm dừng')}
        </span>
      </div>

      {/* Main Info */}
      <div className="space-y-3 mb-4">
        {/* Thời gian */}
        {schedule.start_time && schedule.end_time && (
          <div className="grid grid-cols-[90px_1fr] items-baseline gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Thời gian:</span>
            <span className="font-medium text-gray-900 dark:text-white break-words">
              {schedule.time_range || `${schedule.start_time} - ${schedule.end_time}`}
              {schedule.duration && (
                <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">
                  ({schedule.duration} phút)
                </span>
              )}
            </span>
          </div>
        )}

        {/* Ngày học */}
        {recurringDaysFormatted && (
          <div className="grid grid-cols-[90px_1fr] items-baseline gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Ngày học:</span>
            <span className="font-medium text-gray-900 dark:text-white break-words">
              {recurringDaysFormatted}
            </span>
          </div>
        )}

        {/* Chế độ */}
        {schedule.default_mode && (
          <div className="grid grid-cols-[90px_1fr] items-baseline gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Chế độ:</span>
            <span className="font-medium text-gray-900 dark:text-white break-words">
              {schedule.default_mode === 'online' ? 'Trực tuyến' : schedule.default_mode === 'offline' ? 'Trực tiếp' : schedule.default_mode}
              {schedule.default_mode === 'online' && schedule.online_platform && ` (${schedule.online_platform})`}
            </span>
          </div>
        )}

        {/* Địa điểm */}
        {(schedule.room || schedule.location) && (
          <div className="grid grid-cols-[90px_1fr] items-baseline gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Địa điểm:</span>
            <span className="font-medium text-gray-900 dark:text-white break-words">
              {schedule.room || schedule.location}
            </span>
          </div>
        )}

        {/* Thời hạn - chỉ hiển thị cho giáo viên */}
        {!isStudentUser && (schedule.start_date || schedule.end_date) && (
          <div className="grid grid-cols-[90px_1fr] items-baseline gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Thời hạn:</span>
            <span className="font-medium text-gray-900 dark:text-white break-words">
              {schedule.start_date && new Date(schedule.start_date).toLocaleDateString('vi-VN')}
              {schedule.start_date && schedule.end_date && ' - '}
              {schedule.end_date && new Date(schedule.end_date).toLocaleDateString('vi-VN')}
            </span>
          </div>
        )}

        {/* Loại lặp lại - chỉ hiển thị cho giáo viên */}
        {!isStudentUser && schedule.recurring_type && schedule.recurring_type !== 'once' && (
          <div className="grid grid-cols-[90px_1fr] items-baseline gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Lặp lại:</span>
            <span className="font-medium text-gray-900 dark:text-white break-words">
              {schedule.recurring_type === 'daily' ? 'Hàng ngày' :
                schedule.recurring_type === 'weekly' ? 'Hàng tuần' :
                  schedule.recurring_type === 'monthly' ? 'Hàng tháng' :
                    schedule.recurring_type}
            </span>
          </div>
        )}

        {/* Số buổi học - hiển thị cho học viên nếu có */}
        {isStudentUser && schedule.sessions_count !== undefined && (
          <div className="grid grid-cols-[90px_1fr] items-baseline gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Số buổi học:</span>
            <span className="font-medium text-gray-900 dark:text-white break-words">
              {schedule.sessions_count || 0} buổi
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-auto flex items-center gap-2 pt-4">
        {(() => {
          const scheduleId = getObjId(schedule);
          const scheduleIdString = scheduleId;

          if (isStudentUser && isStudentPaused) {
            return (
              <Button variant="secondary" size="sm" className="flex-1" disabled>
                Tạm dừng
              </Button>
            );
          }

          return (
            <>
              <ButtonLink
                href={`/schedules/${scheduleIdString}`}
                variant="outline"
                size="sm"
                icon={<EyeIcon />}
                className="flex-1"
              >
                Xem buổi học
              </ButtonLink>
              {(canManageSchedules || canManageClass(user)) && (
                <Tooltip label="Chỉnh sửa lịch">
                  <ButtonLink
                    href={`/schedules/${scheduleIdString}/edit`}
                    variant="outline"
                    size="sm"
                    icon={<PencilIcon />}
                    aria-label="Chỉnh sửa lịch"
                  >
                    <span className="sr-only">Chỉnh sửa</span>
                  </ButtonLink>
                </Tooltip>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}

interface StudentPauseResumeDialogProps {
  action: { type: 'pause' | 'resume'; student: any };
  loading: boolean;
  reason: string;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

function StudentPauseResumeDialog({
  action,
  loading,
  reason,
  onReasonChange,
  onClose,
  onConfirm,
}: StudentPauseResumeDialogProps) {
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow || "";
      document.documentElement.style.overflow = previousHtmlOverflow || "";
    };
  }, []);

  const isPause = action.type === 'pause';

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="student-pause-resume-title">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white p-5 sm:p-6 shadow-lg dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          <span id="student-pause-resume-title">
            {isPause ? 'Tạm dừng học viên' : 'Mở lại học viên'}
          </span>
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          {isPause
            ? `Học viên ${action.student.name} sẽ bị tạm dừng trong lớp này.`
            : `Học viên ${action.student.name} sẽ được tham gia lại lớp học.`}
        </p>

        {isPause && (
          <div className="space-y-2 mb-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Lý do (tuỳ chọn)
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              rows={3}
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Nhập lý do tạm dừng (ví dụ: nghỉ 2 tuần, lý do cá nhân, ...)"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Lý do giúp giáo viên khác và phụ huynh nắm được tình trạng học viên.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            disabled={loading}
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 dark:bg-red-500 dark:hover:bg-red-600"
          >
            {loading && (
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
            )}
            {isPause ? 'Xác nhận tạm dừng' : 'Mở lại'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default function ClassDetailsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
      </div>
    }>
      <ClassDetailsContent />
    </Suspense>
  );
}
