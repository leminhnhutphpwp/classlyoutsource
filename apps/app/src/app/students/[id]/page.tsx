"use client";
import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import { useStudentDetails, useStudentClasses, useStudentAssignments, useStudentAttendance, useStudentGrades, useStudentRecentActivity, useStudentStatistics, useLockStudent, useUnlockStudent, useResetStudentPassword } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import Tooltip from "@/components/Common/Tooltip";
import {
  ArrowLeftIcon,
  PlusIcon,
  UserGroupIcon,
  DocumentTextIcon,
  CalendarIcon,
  ChartBarIcon,
  AcademicCapIcon,
  TrashIcon,
  LockClosedIcon,
  LockOpenIcon,
  PencilIcon,
  EyeIcon,
  SparklesIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";
import ConfirmDeleteDialog from '@/components/Common/ConfirmDeleteDialog';
import { useAuthorization } from "@/lib/authz";
import { hasCapability } from "@/lib/permissions-utils";
import { useAuthContext } from "@/contexts/auth-context";
import LockStudentDialog from "@/components/Students/LockStudentDialog";
import LockStatusBadge from "@/components/Students/LockStatusBadge";
import { useToast } from "@/contexts/toast-context";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import Pagination from "@/components/Common/Pagination";
import AssignmentCard from "@/components/Assignments/AssignmentCard";
import { useLockContext } from "@/contexts/lock-context";
import { formatPercentage } from "@/lib/format-number";
import { formatAverageGrade } from "@/lib/format-score";
import { useStudentGuard } from "@/hooks/use-role-guard";
import { formatScore } from "@/lib/format-score";
import { ClassCard } from "@/components/Classes/ClassCard";
import { AttendanceCard } from "@/components/Attendance/AttendanceCard";
import { GradeCard } from "@/components/Grades/GradeCard";
import { CardSkeleton, GridSkeleton, ListSkeleton, PageSkeleton } from "@/components/ui/loading";
import { Tabs, TabPanel } from "@/components/Common/Tabs";
import { getObjId } from "@/lib/id-utils";
import ErrorDisplay, { useErrorDisplay } from "@/components/Common/ErrorDisplay";

export default function StudentDetailsPage() {
  const { isBlocked } = useStudentGuard(); // Block students from accessing this page
  const params = useParams();
  const studentId = params.id as string;
  useAuthorization();
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const { renderError } = useErrorDisplay("Chi tiết học viên");

  // Check lock và plan feature trước để tránh gọi API không cần thiết.
  // isBlocked (student cố truy cập trang tutor) cũng chặn fetch — tránh gọi API
  // thừa trước khi guard điều hướng đi. Early-return cho isBlocked nằm sau tất cả
  // hook (bên dưới) để giữ thứ tự hook ổn định giữa các render.
  const shouldFetchData = !actionsLocked && !planFeatureMessage && !isBlocked;
  const [activeTab, setActiveTab] = useState("overview");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const CLASSES_PER_PAGE = 12;
  const ASSIGNMENTS_PER_PAGE = 12;
  const ATTENDANCE_PER_PAGE = 12;
  const GRADES_PER_PAGE = 12;
  const [classesPage, setClassesPage] = useState(1);
  const [assignmentsPage, setAssignmentsPage] = useState(1);
  const [attendancePage, setAttendancePage] = useState(1);
  const [gradesPage, setGradesPage] = useState(1);

  const { user } = useAuthContext();
  const { addToast } = useToast();
  const lockStudentMutation = useLockStudent();
  const unlockStudentMutation = useUnlockStudent();
  const { mutate: resetStudentPassword, loading: resettingPassword } = useResetStudentPassword();

  // Check capability user_lock.use
  const canLockStudent = hasCapability(user, 'user_lock.use');

  // Reset activity page when switching to overview tab
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "overview") {
      setActivityPage(1);
    }
    if (tab === "classes") {
      setClassesPage(1);
    }
    if (tab === "assignments") {
      setAssignmentsPage(1);
    }
    if (tab === "attendance") {
      setAttendancePage(1);
    }
    if (tab === "grades") {
      setGradesPage(1);
    }
  };

  // Use browser history navigation
  const handleGoBack = useGoBack('/students');

  // Handle lock student
  const handleLockStudent = async (lockData: {
    type: 'login' | 'actions' | 'all';
    reason?: string;
    start_at?: string;
    end_at?: string;
  }) => {
    try {
      const result = await lockStudentMutation.mutate(studentId, lockData);
      if (result.success) {
        addToast({
          title: isTutor ? "Khóa đăng nhập thành công" : "Khóa tài khoản thành công",
          message: isTutor
            ? "Đã khóa đăng nhập của học viên thành công. Học viên sẽ không thể đăng nhập vào hệ thống."
            : "Tài khoản học viên đã được khóa thành công.",
          type: "success",
        });
        setShowLockDialog(false);
        refetchStudentDetails();
      } else {
        addToast({
          title: "Lỗi",
          message: result.message || (isTutor ? "Không thể khóa đăng nhập của học viên." : "Không thể khóa tài khoản học viên."),
          type: "error",
        });
      }
    } catch (error: any) {
      const errorCode = error?.response?.data?.code;
      let errorMessage = isTutor
        ? "Đã xảy ra lỗi khi khóa đăng nhập của học viên."
        : "Đã xảy ra lỗi khi khóa tài khoản học viên.";

      if (errorCode === 'FEATURE_NOT_AVAILABLE') {
        errorMessage = "Bạn không có quyền thực hiện thao tác này.";
      } else if (errorCode === 'ALREADY_LOCKED') {
        errorMessage = isTutor
          ? "Học viên này đã bị khóa đăng nhập. Vui lòng mở khóa trước khi khóa lại."
          : "Học viên này đã bị khóa. Vui lòng mở khóa trước khi khóa lại.";
      } else if (errorCode === 'UNAUTHORIZED') {
        errorMessage = "Bạn không có quyền thực hiện thao tác này.";
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      addToast({
        title: "Lỗi",
        message: errorMessage,
        type: "error",
      });
    }
  };

  // Handle unlock student
  const handleUnlockStudent = async () => {
    try {
      const result = await unlockStudentMutation.mutate(studentId);
      if (result.success) {
        addToast({
          title: isTutor ? "Mở khóa đăng nhập thành công" : "Mở khóa tài khoản thành công",
          message: isTutor
            ? "Đã mở khóa đăng nhập của học viên thành công. Học viên có thể đăng nhập lại vào hệ thống."
            : "Tài khoản học viên đã được mở khóa thành công.",
          type: "success",
        });
        refetchStudentDetails();
      } else {
        addToast({
          title: "Lỗi",
          message: result.message || (isTutor ? "Không thể mở khóa đăng nhập của học viên." : "Không thể mở khóa tài khoản học viên."),
          type: "error",
        });
      }
    } catch (error: any) {
      const errorCode = error?.response?.data?.code;
      let errorMessage = isTutor
        ? "Đã xảy ra lỗi khi mở khóa đăng nhập của học viên."
        : "Đã xảy ra lỗi khi mở khóa tài khoản học viên.";

      if (errorCode === 'FEATURE_NOT_AVAILABLE') {
        errorMessage = "Bạn không có quyền thực hiện thao tác này.";
      } else if (errorCode === 'NOT_LOCKED') {
        errorMessage = isTutor
          ? "Học viên này không bị khóa đăng nhập."
          : "Học viên này không bị khóa.";
      } else if (errorCode === 'UNAUTHORIZED') {
        errorMessage = "Bạn không có quyền thực hiện thao tác này.";
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      addToast({
        title: "Lỗi",
        message: errorMessage,
        type: "error",
      });
    }
  };

  const openResetPassword = () => {
    setResetError(null);
    setResetPassword("");
    setResetPasswordConfirm("");
    setResetPasswordModal({
      open: true,
      studentId,
      name: studentDetails?.name || null,
    });
  };

  const handleResetPassword = async () => {
    if (!resetPasswordModal.studentId) return;
    setResetError(null);
    const result = await resetStudentPassword({
      id: resetPasswordModal.studentId,
      password: resetPassword,
      password_confirmation: resetPasswordConfirm,
    });
    if (result?.success) {
      addToast({
        title: "Thành công",
        message: "Đổi mật khẩu thành công",
        type: "success",
      });
      setResetPasswordModal({ open: false, studentId: null, name: null });
      setResetPassword("");
      setResetPasswordConfirm("");
    } else if (result?.errors && typeof result.errors === "object") {
      const firstError = Object.values(result.errors as Record<string, string[]>)[0]?.[0];
      setResetError(firstError || result.message || "Không thể đổi mật khẩu");
    } else {
      setResetError(result?.message || "Không thể đổi mật khẩu");
    }
  };

  const { data: studentDetails, loading: studentLoading, error: studentError, permissions, refetch: refetchStudentDetails } = useStudentDetails(studentId, shouldFetchData);

  // Use permissions from API response
  const canView = permissions?.can_view ?? true; // Default true cho view
  const canManage = permissions?.can_manage ?? false;

  // Check if student is locked (from student data, not user data)
  const isStudentLocked = studentDetails?.is_locked || false;
  const userLocks = studentDetails?.user_locks || [];

  // Check if current user is tutor (not admin)
  const isTutor = user?.role === 'tutor' && !user?.roles?.includes('admin') && !user?.roles?.includes('super_admin');

  // Reset password modal state
  const [resetPasswordModal, setResetPasswordModal] = useState<{ open: boolean; studentId: string | null; name: string | null }>({
    open: false,
    studentId: null,
    name: null,
  });
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetPasswordConfirm, setShowResetPasswordConfirm] = useState(false);
  const [isResetPortalReady, setIsResetPortalReady] = useState(false);

  useEffect(() => {
    setIsResetPortalReady(true);
  }, []);

  // Load data conditionally based on active tab to optimize performance
  const shouldLoadClasses = shouldFetchData && (activeTab === "classes" || activeTab === "overview");
  const shouldLoadAssignments = shouldFetchData && (activeTab === "assignments" || activeTab === "overview");
  const shouldLoadAttendance = shouldFetchData && (activeTab === "attendance" || activeTab === "overview");
  const shouldLoadGrades = shouldFetchData && (activeTab === "grades" || activeTab === "overview");
  const shouldLoadActivities = shouldFetchData && activeTab === "overview";
  const shouldLoadStatistics = shouldFetchData && activeTab === "overview";

  // Memoize options objects to ensure stable references for dependency tracking
  const classesOptions = useMemo(
    () => ({ page: classesPage, per_page: CLASSES_PER_PAGE }),
    [classesPage, CLASSES_PER_PAGE]
  );
  const assignmentsOptions = useMemo(
    () => ({ page: assignmentsPage, per_page: ASSIGNMENTS_PER_PAGE }),
    [assignmentsPage, ASSIGNMENTS_PER_PAGE]
  );
  const attendanceOptions = useMemo(
    () => ({ page: attendancePage, per_page: ATTENDANCE_PER_PAGE }),
    [attendancePage, ATTENDANCE_PER_PAGE]
  );
  const gradesOptions = useMemo(
    () => ({ page: gradesPage, per_page: GRADES_PER_PAGE }),
    [gradesPage, GRADES_PER_PAGE]
  );

  const {
    classes,
    loading: classesLoading,
    statistics: classesStatistics,
    permissions: classesPermissions,
    meta: classesMeta,
  } = useStudentClasses(
    studentId,
    classesOptions,
    { enabled: shouldLoadClasses }
  );

  const {
    assignments: studentAssignments,
    loading: assignmentsLoading,
    statistics: assignmentsStatistics,
    meta: assignmentsMeta,
  } = useStudentAssignments(
    studentId,
    assignmentsOptions,
    { enabled: shouldLoadAssignments }
  );
  const {
    attendance: studentAttendance,
    loading: attendanceLoading,
    statistics: attendanceStatistics,
    meta: attendanceMeta,
  } = useStudentAttendance(
    studentId,
    attendanceOptions,
    { enabled: shouldLoadAttendance }
  );
  const {
    grades: studentGrades,
    loading: gradesLoading,
    statistics: gradesStatistics,
    meta: gradesMeta,
  } = useStudentGrades(
    studentId,
    gradesOptions,
    { enabled: shouldLoadGrades }
  );
  const classesTotal = classesMeta?.total ?? classes?.length ?? 0;
  const assignmentsTotal = assignmentsMeta?.total ?? studentAssignments?.length ?? 0;
  const attendanceTotal = attendanceMeta?.total ?? studentAttendance?.length ?? 0;
  const gradesTotal = gradesMeta?.total ?? studentGrades?.length ?? 0;
  const classesCurrentPage = classesMeta?.current_page ?? classesPage;
  const assignmentsCurrentPage = assignmentsMeta?.current_page ?? assignmentsPage;
  const attendanceCurrentPage = attendanceMeta?.current_page ?? attendancePage;
  const gradesCurrentPage = gradesMeta?.current_page ?? gradesPage;
  const showClassesPagination = (classesMeta?.total ?? 0) > 0;
  const showAssignmentsPagination = (assignmentsMeta?.total ?? 0) > 0;
  const showAttendancePagination = (attendanceMeta?.total ?? 0) > 0;
  const showGradesPagination = (gradesMeta?.total ?? 0) > 0;
  const { activities: recentActivities, loading: activitiesLoading, pagination: activitiesPagination } = useStudentRecentActivity(studentId, { per_page: 10, page: activityPage }, { enabled: shouldLoadActivities });
  const { data: statistics } = useStudentStatistics(studentId, undefined, { enabled: shouldLoadStatistics });

  const generateRandomPassword = () => {
    const length = 12;
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const digits = "0123456789";
    const symbols = "!@#$%^&*()-_=+[]{};:,.?";
    const all = upper + lower + digits + symbols;
    const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
    let pwd = pick(upper) + pick(lower) + pick(digits) + pick(symbols);
    for (let i = pwd.length; i < length; i++) {
      pwd += all[Math.floor(Math.random() * all.length)];
    }
    pwd = pwd
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
    setResetPassword(pwd);
    setResetPasswordConfirm(pwd);
  };

  // Block students - this page is for tutors only (after all hooks to keep
  // hook order stable across renders; useStudentGuard handles the redirect)
  if (isBlocked) {
    return null;
  }

  if (studentLoading) {
    return <PageSkeleton showHeader={true} showFilters={false} showContent={true} />;
  }

  if (studentError && !studentLoading) {
    return <ErrorDisplay error={studentError} title="Lỗi tải dữ liệu học viên" onRetry={() => refetchStudentDetails()} />;
  }

  const tabs = [
    { id: "overview", label: "Tổng quan", icon: ChartBarIcon },
    { id: "classes", label: "Lớp học", icon: UserGroupIcon },
    { id: "assignments", label: "Bài tập", icon: DocumentTextIcon },
    { id: "attendance", label: "Điểm danh", icon: CalendarIcon },
    { id: "grades", label: "Điểm số", icon: AcademicCapIcon },
  ];

  // Check lock và plan feature trước để ưu tiên hiển thị lock content
  if (actionsLocked || planFeatureMessage) {
    return renderError();
  }

  // Check view permission - chỉ block khi không có quyền xem
  if (!studentLoading && studentDetails && permissions !== undefined && !canView) {
    return renderError(undefined, undefined, false);
  }

  // Check permissions for classes tab - check can_view thay vì can_manage
  const canViewClasses = classesPermissions?.can_view ?? true; // Default true cho view
  if (shouldLoadClasses && !classesLoading && classesPermissions !== undefined && !canViewClasses && activeTab === "classes") {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Button
            onClick={handleGoBack}
            variant="outline"
            size="sm"
            icon={<ArrowLeftIcon />}
          >
            Quay lại
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">{studentDetails.name}</h1>
          </div>
        </div>

        {/* Tabs */}
        <Tabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />

        {renderError(undefined, undefined, false)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConfirmDeleteDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          // Xóa học viên hiện được xử lý tại màn danh sách, nên dialog này tạm thời không thực thi hành động.
        }}
        loading={false}
        message="Bạn có chắc chắn muốn xóa học viên này? Hành động không thể hoàn tác."
      />
      <LockStudentDialog
        open={showLockDialog}
        onClose={() => setShowLockDialog(false)}
        onConfirm={handleLockStudent}
        studentName={studentDetails?.name}
        loading={lockStudentMutation.loading}
        isTutor={isTutor}
      />
      {/* Reset password modal */}
      {isResetPortalReady && resetPasswordModal.open &&
        createPortal(
          <div className="fixed inset-0 flex items-center justify-center z-[1000] bg-black/50 backdrop-blur-[1px] px-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Đổi mật khẩu</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Học viên: {resetPasswordModal.name || resetPasswordModal.studentId}
              </p>
              {resetError && (
                <div className="mb-3 rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200">
                  {resetError}
                </div>
              )}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Mật khẩu mới</label>
                  <div className="relative">
                    <input
                      type={showResetPassword ? "text" : "password"}
                      name="reset_password"
                      placeholder="Tối thiểu 8 ký tự"
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      required
                    />
                    <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                      <button
                        type="button"
                        className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
                        onClick={() => setShowResetPassword((v) => !v)}
                        aria-label={showResetPassword ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
                      >
                        {showResetPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        className="p-1 text-amber-600 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-200"
                        onClick={generateRandomPassword}
                        aria-label="Tạo mật khẩu ngẫu nhiên"
                      >
                        <SparklesIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Nhập lại mật khẩu</label>
                  <div className="relative">
                    <input
                      type={showResetPasswordConfirm ? "text" : "password"}
                      name="reset_password_confirmation"
                      placeholder="Nhập lại mật khẩu"
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      value={resetPasswordConfirm}
                      onChange={(e) => setResetPasswordConfirm(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-2 flex items-center p-1 text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
                      onClick={() => setShowResetPasswordConfirm((v) => !v)}
                      aria-label={showResetPasswordConfirm ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
                    >
                      {showResetPasswordConfirm ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-end gap-3">
                <button
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
                  onClick={() => setResetPasswordModal({ open: false, studentId: null, name: null })}
                  disabled={resettingPassword}
                  type="button"
                >
                  Hủy
                </button>
                <button
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
                  onClick={handleResetPassword}
                  disabled={resettingPassword}
                  type="button"
                >
                  {resettingPassword ? "Đang đổi..." : "Đổi mật khẩu"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      }
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Button
          onClick={handleGoBack}
          variant="outline"
          size="sm"
          icon={<ArrowLeftIcon />}
          className="w-full sm:w-auto justify-center"
        >
          Quay lại
        </Button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
              <span className="text-xl sm:text-2xl font-bold text-gray-700 dark:text-gray-300">
                {studentDetails.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">{studentDetails.name}</h1>
              <p className="text-sm sm:text-base text-dark-4 dark:text-dark-6 mt-1 line-clamp-2 sm:line-clamp-1">
                {studentDetails.email || "Chưa có email"} • {studentDetails.phone || "Chưa có SĐT"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:justify-end w-full sm:w-auto">
          {canManage && (
            <>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <ButtonLink
                  href={`/students/${studentId}/edit`}
                  variant="outline"
                  size="sm"
                  icon={<PencilIcon />}
                  className="flex-1 sm:flex-initial justify-center"
                >
                  Chỉnh sửa
                </ButtonLink>
                <Button
                  onClick={() => setConfirmDelete(true)}
                  variant="danger"
                  size="sm"
                  icon={<TrashIcon />}
                  className="flex-1 sm:flex-initial justify-center"
                >
                  Xóa
                </Button>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto sm:justify-end">
                <Tooltip label="Ghi danh lớp học" className="flex-1 sm:flex-initial">
                  <ButtonLink
                    href={`/students/${studentId}/enroll`}
                    variant="primary"
                    size="sm"
                    icon={<PlusIcon />}
                    className="w-full sm:w-auto justify-center"
                  >
                    <span className="sm:hidden">Ghi danh</span>
                    <span className="hidden sm:inline">Ghi danh lớp học</span>
                    <span className="sr-only sm:hidden">Ghi danh lớp học</span>
                  </ButtonLink>
                </Tooltip>
                <Tooltip label="Đổi mật khẩu" className="flex-1 sm:flex-initial">
                  <Button
                    onClick={openResetPassword}
                    variant="outline"
                    size="sm"
                    icon={<SparklesIcon />}
                    className="w-full sm:w-auto justify-center"
                  >
                    <span className="sm:hidden">Đổi mật khẩu</span>
                    <span className="hidden sm:inline">Đổi mật khẩu</span>
                    <span className="sr-only sm:hidden">Đổi mật khẩu</span>
                  </Button>
                </Tooltip>
              </div>
            </>
          )}
          {canLockStudent && (
            <div className="flex items-center gap-2 sm:justify-end w-full sm:w-auto">
              {isStudentLocked ? (
                <Tooltip label={isTutor ? 'Mở khóa đăng nhập' : 'Mở khóa'}>
                  <Button
                    onClick={handleUnlockStudent}
                    variant="outline"
                    size="sm"
                    icon={<LockOpenIcon />}
                    loading={unlockStudentMutation.loading}
                    className="w-full sm:w-auto justify-center"
                  >
                    <span className="sm:hidden">{isTutor ? 'Mở khóa đăng nhập' : 'Mở khóa'}</span>
                    <span className="sr-only sm:hidden">{isTutor ? 'Mở khóa đăng nhập' : 'Mở khóa'}</span>
                  </Button>
                </Tooltip>
              ) : (
                <Tooltip label={isTutor ? 'Khóa đăng nhập' : 'Khóa tài khoản'}>
                  <Button
                    onClick={() => setShowLockDialog(true)}
                    variant="outline"
                    size="sm"
                    icon={<LockClosedIcon />}
                    className="w-full sm:w-auto justify-center"
                  >
                    <span className="sm:hidden">{isTutor ? 'Khóa đăng nhập' : 'Khóa tài khoản'}</span>
                    <span className="sr-only sm:hidden">{isTutor ? 'Khóa đăng nhập' : 'Khóa tài khoản'}</span>
                  </Button>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
          <div className="flex items-center">
            <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
              <UserGroupIcon className="h-6 w-6 text-primary" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Lớp học</p>
              <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                {classes?.length || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
          <div className="flex items-center">
            <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
              <CalendarIcon className="h-6 w-6 text-primary" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Điểm danh</p>
              <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                {formatPercentage(statistics?.attendance_rate)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
          <div className="flex items-center">
            <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
              <DocumentTextIcon className="h-6 w-6 text-primary-light" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Bài tập</p>
              <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                {statistics?.assignments_completed || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
          <div className="flex items-center">
            <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
              <AcademicCapIcon className="h-6 w-6 text-primary" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {statistics?.average_grade_scale === 'ielts'
                  ? 'Band trung bình'
                  : statistics?.average_grade_scale === 'toeic'
                    ? 'Điểm TOEIC trung bình'
                    : 'Trung bình'}
              </p>
              <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                {formatAverageGrade(statistics?.average_grade)}
                {/* Kèm điểm tối đa để con số có ngữ cảnh: "6.5 / 9" thay vì "309.17" trần trụi. */}
                {statistics?.average_grade_max ? (
                  <span className="ml-1 text-base font-normal text-gray-400 dark:text-gray-500">
                    / {statistics.average_grade_max}
                  </span>
                ) : null}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Lock Status Badge */}
      {isStudentLocked && userLocks.length > 0 && (
        <LockStatusBadge
          userLocks={userLocks}
          className="mb-4"
        />
      )}

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />

      {/* Tab Content */}
      <TabPanel activeTab={activeTab} tabId="overview">
        <div className="space-y-4 sm:space-y-6">
          <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
              Thông tin học viên
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Họ và tên
                </label>
                <p className="text-gray-900 dark:text-white">{studentDetails.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Email
                </label>
                <p className="text-gray-900 dark:text-white">
                  {studentDetails.email || "Chưa có email"}
                </p>
              </div>
              {studentDetails.student_code && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Mã học viên
                  </label>
                  <p className="text-gray-900 dark:text-white font-medium">#{studentDetails.student_code}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Số điện thoại
                </label>
                <p className="text-gray-900 dark:text-white">
                  {studentDetails.phone || "Chưa có số điện thoại"}
                </p>
              </div>
              {studentDetails.parent_name && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Phụ huynh
                  </label>
                  <p className="text-gray-900 dark:text-white">{studentDetails.parent_name}</p>
                </div>
              )}
              {studentDetails.birth_date && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Ngày sinh
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(studentDetails.birth_date).toLocaleDateString('vi-VN')}
                    {studentDetails.age && ` (${studentDetails.age} tuổi)`}
                  </p>
                </div>
              )}
              {studentDetails.gender && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Giới tính
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {studentDetails.gender === 'male' ? 'Nam' : studentDetails.gender === 'female' ? 'Nữ' : studentDetails.gender}
                  </p>
                </div>
              )}
              {studentDetails.address && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Địa chỉ
                  </label>
                  <p className="text-gray-900 dark:text-white">{studentDetails.address}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Trạng thái
                </label>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${studentDetails.status === 'active'
                  ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                  : 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]'
                  }`}>
                  {studentDetails.status === 'active' ? 'Đang học' : 'Đang nghỉ'}
                </span>
              </div>
              {studentDetails.notes && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Ghi chú
                  </label>
                  <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{studentDetails.notes}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Ngày tạo
                </label>
                <p className="text-gray-900 dark:text-white">
                  {new Date(studentDetails.created_at).toLocaleDateString('vi-VN')}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Cập nhật cuối
                </label>
                <p className="text-gray-900 dark:text-white">
                  {new Date(studentDetails.updated_at).toLocaleDateString('vi-VN')}
                </p>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Hoạt động gần đây
                {activitiesPagination && (
                  <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({activitiesPagination.total || recentActivities?.length || 0})
                  </span>
                )}
              </h3>
            </div>

            {activitiesLoading ? (
              <ListSkeleton count={5} showAvatar={true} />
            ) : recentActivities && recentActivities.length > 0 ? (
              <div className="space-y-4">
                {recentActivities.map((activity: any, index: number) => {
                  // Get icon and color based on activity type
                  const getActivityIcon = () => {
                    switch (activity.type) {
                      case 'attendance':
                        return activity.status === 'present' ? '✓' : activity.status === 'absent' ? '✗' : activity.status === 'late' ? '⏰' : '?';
                      case 'submission':
                        return '📝';
                      case 'grade':
                        return '🎓';
                      case 'enrollment':
                        return '👥';
                      case 'assignment':
                        return '📋';
                      default:
                        return '•';
                    }
                  };

                  const getActivityColor = () => {
                    switch (activity.type) {
                      case 'attendance':
                        return activity.status === 'present'
                          ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                          : activity.status === 'absent'
                            ? 'bg-[var(--status-badge-error)] text-[var(--status-badge-error-text)]'
                            : activity.status === 'late'
                              ? 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]'
                              : activity.status === 'excused'
                                ? 'bg-[var(--status-badge-completed)] text-[var(--status-badge-completed-text)]'
                                : 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]';
                      case 'submission':
                        return 'bg-[var(--status-badge-completed)] text-[var(--status-badge-completed-text)]';
                      case 'grade':
                        return 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]';
                      case 'enrollment':
                        return 'bg-[var(--status-badge-completed)] text-[var(--status-badge-completed-text)]';
                      case 'assignment':
                        return 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]';
                      default:
                        return 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]';
                    }
                  };

                  // Format date relative
                  const formatDate = (dateString: string) => {
                    const date = new Date(dateString);
                    const now = new Date();
                    const diffTime = now.getTime() - date.getTime();
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays === 0) return 'Hôm nay';
                    if (diffDays === 1) return 'Hôm qua';
                    if (diffDays < 7) return `${diffDays} ngày trước`;
                    if (diffDays < 30) return `${Math.floor(diffDays / 7)} tuần trước`;
                    return date.toLocaleDateString('vi-VN');
                  };

                  return (
                    <div key={`${activity.type}-${getObjId(activity)}-${index}`} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <div className={`h-8 w-8 ${getActivityColor()} rounded-full flex items-center justify-center flex-shrink-0`}>
                        <span className="text-xs font-semibold">{getActivityIcon()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {activity.title || activity.description}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>{formatDate(activity.date)}</span>
                          {activity.class && (
                            <span>• {activity.class.name}</span>
                          )}
                          {activity.status && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${activity.status === 'graded' ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]' :
                              activity.status === 'pending' ? 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]' :
                                activity.status === 'present' ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]' :
                                  activity.status === 'absent' ? 'bg-[var(--status-badge-error)] text-[var(--status-badge-error-text)]' :
                                    activity.status === 'late' ? 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]' :
                                      activity.status === 'excused' ? 'bg-[var(--status-badge-completed)] text-[var(--status-badge-completed-text)]' :
                                        activity.status === 'published' ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]' :
                                          activity.status === 'submitted' ? 'bg-[var(--status-badge-completed)] text-[var(--status-badge-completed-text)]' :
                                            activity.status === 'active' ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]' :
                                              'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]'
                              }`}>
                              {activity.status === 'graded' ? 'Đã chấm' :
                                activity.status === 'pending' ? 'Đang chờ' :
                                  activity.status === 'present' ? 'Có mặt' :
                                    activity.status === 'absent' ? 'Vắng' :
                                      activity.status === 'late' ? 'Muộn' :
                                        activity.status === 'submitted' ? 'Đã nộp' :
                                          activity.status === 'active' ? 'Đang học' :
                                            activity.status === 'published' && activity.type === 'submission' ? 'Đã nộp' :
                                              activity.status === 'published' ? 'Đang làm' :
                                                activity.status}
                            </span>
                          )}
                          {activity.score !== undefined && activity.score !== null && (
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              Điểm: {formatScore(activity.score, activity.max_score)}
                            </span>
                          )}
                          {activity.is_late && (
                            <span className="text-red-600 dark:text-red-400">Nộp muộn</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>Chưa có hoạt động nào</p>
              </div>
            )}

            {/* Pagination */}
            {activitiesPagination && activitiesPagination.total ? (
              <Pagination
                meta={activitiesPagination}
                currentPage={activityPage}
                onPageChange={(page) => setActivityPage(page)}
                itemLabel="hoạt động"
                className="mt-4"
              />
            ) : null}
          </div>
        </div>
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="classes">
        <div className="space-y-4 sm:space-y-6">
          {/* Statistics */}
          {classesStatistics && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tổng số lớp</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                  {classesStatistics.total_count || 0}
                </p>
              </div>
              <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Đang học</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                  {classesStatistics.active_count || 0}
                </p>
              </div>
              <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800 col-span-2 md:col-span-1">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Phân bổ trạng thái</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {classesStatistics.enrollment_status_counts && Object.entries(classesStatistics.enrollment_status_counts).map(([status, count]: [string, any]) => (
                    <span key={status} className="text-xs text-gray-600 dark:text-gray-400">
                      {status === 'active' ? 'Đang học' : status === 'inactive' ? 'Tạm dừng' : status === 'completed' ? 'Hoàn thành' : 'Đã nghỉ'}: {count}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Lớp học đang tham gia ({classesTotal})
            </h3>
            <ButtonLink
              href={`/students/${studentId}/enroll`}
              variant="primary"
              size="sm"
              icon={<PlusIcon />}
            >
              Ghi danh lớp học
            </ButtonLink>
          </div>

          {classesLoading ? (
            <GridSkeleton
              count={3}
              cols={{ mobile: 1, tablet: 2, desktop: 3 }}
              renderItem={(i) => (
                <CardSkeleton
                  key={i}
                  showAvatar={false}
                  showActions={false}
                  lines={2}
                  className="rounded-lg bg-white p-6 dark:bg-gray-800"
                />
              )}
            />
          ) : classes && classes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {classes.map((cls: any, index: number) => (
                <ClassCard
                  key={getObjId(cls) || index}
                  cls={cls}
                  enrollment={cls.enrollment}
                  showEnrollment={true}
                  showTuition={true}
                  actions={
                    <ButtonLink
                      href={`/classes/${getObjId(cls)}`}
                      variant="outline"
                      size="sm"
                      icon={<EyeIcon />}
                      className="flex-1"
                    >
                      Xem lớp học
                    </ButtonLink>
                  }
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-white p-8 text-center dark:bg-gray-800">
              <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <UserGroupIcon className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Chưa tham gia lớp học nào
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Ghi danh học viên vào lớp học để bắt đầu
              </p>
              <ButtonLink
                href={`/students/${studentId}/enroll`}
                variant="primary"
                size="sm"
                icon={<PlusIcon />}
              >
                Ghi danh lớp học
              </ButtonLink>
            </div>
          )}
          {showClassesPagination && (
            <div className="pt-2">
              <Pagination
                meta={classesMeta}
                currentPage={classesCurrentPage}
                onPageChange={setClassesPage}
                itemLabel="lớp học"
              />
            </div>
          )}
        </div>
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="assignments">
        <div className="space-y-4 sm:space-y-6">
          {/* Statistics */}
          {assignmentsStatistics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tổng số bài tập</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                  {assignmentsStatistics.total_count || 0}
                </p>
              </div>
              <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Đã công bố</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                  {assignmentsStatistics.published_count || 0}
                </p>
              </div>
              <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Đang chờ nộp</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                  {assignmentsStatistics.pending_submissions_count || 0}
                </p>
              </div>
              <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Đã chấm</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                  {assignmentsStatistics.graded_submissions_count || 0}
                </p>
              </div>
            </div>
          )}

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Danh sách bài tập ({assignmentsTotal})
          </h3>

          {assignmentsLoading ? (
            <GridSkeleton
              count={4}
              cols={{ mobile: 1, tablet: 2, desktop: 3 }}
              renderItem={(i) => (
                <CardSkeleton
                  key={i}
                  showAvatar={false}
                  showActions={false}
                  lines={2}
                  className="rounded-lg bg-white p-6 dark:bg-gray-800"
                />
              )}
            />
          ) : studentAssignments && studentAssignments.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {studentAssignments.map((assignment: any) => (
                <AssignmentCard
                  key={getObjId(assignment)}
                  assignment={assignment}
                  user={user}
                  showClassName
                  showEdit={false}
                  showDelete={false}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-white p-8 text-center dark:bg-gray-800">
              <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <DocumentTextIcon className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Chưa có bài tập nào
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Học viên chưa có bài tập từ các lớp đã đăng ký
              </p>
            </div>
          )}
          {showAssignmentsPagination && (
            <div className="pt-2">
              <Pagination
                meta={assignmentsMeta}
                currentPage={assignmentsCurrentPage}
                onPageChange={setAssignmentsPage}
                itemLabel="bài tập"
              />
            </div>
          )}
        </div>
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="attendance">
        <div className="space-y-4 sm:space-y-6">
          {/* Statistics */}
          {attendanceStatistics && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
              <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tổng số buổi</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                  {attendanceStatistics.total_count || 0}
                </p>
              </div>
              <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Có mặt</p>
                <p className="text-xl sm:text-2xl font-semibold text-primary mt-1">
                  {attendanceStatistics.present_count || 0}
                </p>
              </div>
              <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Vắng</p>
                <p className="text-xl sm:text-2xl font-semibold text-red-600 dark:text-red-400 mt-1">
                  {attendanceStatistics.absent_count || 0}
                </p>
              </div>
              <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Đi muộn</p>
                <p className="text-xl sm:text-2xl font-semibold text-primary-light mt-1">
                  {attendanceStatistics.late_count || 0}
                </p>
              </div>
              <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800 col-span-2 md:col-span-1">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tỷ lệ có mặt</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                  {formatPercentage(attendanceStatistics.attendance_rate)}
                </p>
              </div>
            </div>
          )}

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Lịch sử điểm danh ({attendanceTotal})
          </h3>

          {attendanceLoading ? (
            <ListSkeleton count={5} showAvatar={true} />
          ) : studentAttendance && studentAttendance.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {studentAttendance.map((record: any) => (
                <AttendanceCard key={getObjId(record)} record={record} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-white p-8 text-center dark:bg-gray-800">
              <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <CalendarIcon className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Chưa có lịch sử điểm danh
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Lịch sử điểm danh sẽ hiển thị ở đây khi học viên được điểm danh
              </p>
            </div>
          )}
          {showAttendancePagination && (
            <div className="pt-2">
              <Pagination
                meta={attendanceMeta}
                currentPage={attendanceCurrentPage}
                onPageChange={setAttendancePage}
                itemLabel="buổi điểm danh"
              />
            </div>
          )}
        </div>
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="grades">
        <div className="space-y-4 sm:space-y-6">
          {/* Statistics */}
          {gradesStatistics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tổng số điểm</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                  {gradesStatistics.total_count || 0}
                </p>
              </div>
              <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Điểm trung bình</p>
                <p className="text-xl sm:text-2xl font-semibold text-primary mt-1">
                  {formatAverageGrade(gradesStatistics.average_score)}
                </p>
              </div>
              <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Điểm cao nhất</p>
                <p className="text-xl sm:text-2xl font-semibold text-primary mt-1">
                  {formatAverageGrade(gradesStatistics.max_score)}
                </p>
              </div>
              <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Điểm thấp nhất</p>
                <p className="text-xl sm:text-2xl font-semibold text-red-600 dark:text-red-400 mt-1">
                  {formatAverageGrade(gradesStatistics.min_score)}
                </p>
              </div>
            </div>
          )}

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Lịch sử điểm số ({gradesTotal})
          </h3>

          {gradesLoading ? (
            <ListSkeleton count={5} showAvatar={true} />
          ) : studentGrades && studentGrades.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {studentGrades.map((grade: any) => (
                <GradeCard key={getObjId(grade)} grade={grade} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-white p-8 text-center dark:bg-gray-800">
              <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <AcademicCapIcon className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Chưa có điểm số
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Điểm số sẽ hiển thị ở đây khi có bài tập được chấm điểm
              </p>
            </div>
          )}
          {showGradesPagination && (
            <div className="pt-2">
              <Pagination
                meta={gradesMeta}
                currentPage={gradesCurrentPage}
                onPageChange={setGradesPage}
                itemLabel="điểm số"
              />
            </div>
          )}
        </div>
      </TabPanel>
    </div>
  );
}
