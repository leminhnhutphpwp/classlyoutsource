"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAssignment, useAssignmentSubmissions, useUpdateAssignment, useLatestSubmission, useSubmissionHistory, useAssignmentSkillReport } from "@/hooks/use-api";
import SubmissionAttemptHistory from "@/components/Assignments/SubmissionAttemptHistory";
import AssignmentSkillDashboard from "@/components/Assignments/AssignmentSkillDashboard";
import { createPortal } from "react-dom";
import { useGoBack } from "@/hooks/use-go-back";
import { useNotification } from "@/hooks/use-notification";
import { isStudent } from "@/lib/authz";
import { useAuthContext } from "@/contexts/auth-context";
import LearningResourceSelector from "@/components/FormElements/LearningResourceSelector";
import ResourceCard from "@/components/LearningResources/ResourceCard";
import PausedStudentBanner from "@/components/Students/PausedStudentBanner";
import RichTextDisplay from "@/components/Common/RichTextDisplay";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  DocumentTextIcon,
  CalendarIcon,
  ClockIcon,
  AcademicCapIcon,
  UserIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentArrowUpIcon,
  PaperClipIcon,
  PlusIcon,
  EyeIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import ConfirmDeleteDialog from '@/components/Common/ConfirmDeleteDialog';
import { formatScore } from "@/lib/format-score";
import { getObjId } from "@/lib/id-utils";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";
import { CardSkeleton, GridSkeleton, ListSkeleton, PageSkeleton } from "@/components/ui/loading";
import { Tabs, TabPanel } from "@/components/Common/Tabs";

export default function AssignmentDetailsPage() {
  const params = useParams();
  const assignmentId = params.id as string;
  const [activeTab, setActiveTab] = useState("overview");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAddResourcesModal, setShowAddResourcesModal] = useState(false);
  const [selectedResourceIds, setSelectedResourceIds] = useState<(number | string)[]>([]);
  const { success, error: showError } = useNotification();
  const { renderError } = useErrorDisplay("Chi tiết bài tập");

  // Use browser history navigation
  const handleGoBack = useGoBack('/assignments');

  const { data: assignment, loading, error, refetch, permissions } = useAssignment(assignmentId);
  const { data: submissions, loading: submissionsLoading, permissions: submissionsPermissions } = useAssignmentSubmissions(assignmentId);

  // Use permissions from API response
  const canView = permissions?.can_view ?? true; // Default true cho view
  const canManage = permissions?.can_manage ?? false;
  const { mutate: updateAssignment, loading: updateLoading } = useUpdateAssignment();
  const { user } = useAuthContext();
  const isStudentUser = isStudent(user);
  // Tutor skill dashboard (heatmap per section_type) — quiz assignments only.
  const isQuizAssignment = assignment?.mode === 'quiz';
  const { data: skillReport, loading: skillReportLoading } = useAssignmentSkillReport(
    assignmentId,
    !isStudentUser && isQuizAssignment
  );
  const assignmentEnrollment =
    assignment?.class?.enrollment ||
    assignment?.student_enrollment ||
    assignment?.enrollment ||
    assignment?.classroom?.enrollment;
  const { data: latestSubmission, loading: latestSubmissionLoading } = useLatestSubmission(
    assignmentId,
    isStudentUser && !!assignmentId && !assignmentEnrollment?.is_paused
  );
  // Full attempt list for the student (P5 mục 07: tra cứu kết quả cũ, dạng lịch sử đăng nhập).
  const { data: attemptHistory, loading: attemptHistoryLoading } = useSubmissionHistory(
    assignmentId,
    undefined,
    isStudentUser && !!assignmentId
  );
  const studentEnrollment = assignmentEnrollment || latestSubmission?.class_enrollment;
  const isStudentPaused = isStudentUser && !!studentEnrollment?.is_paused;

  // Disable body scroll when resources modal is open
  useEffect(() => {
    if (!showAddResourcesModal) {
      return;
    }

    // Save current scroll position
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    // Save original styles
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;

    // Disable scroll using position fixed method (more reliable)
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      // Restore original styles
      document.body.style.overflow = previousBodyOverflow || "";
      document.documentElement.style.overflow = previousHtmlOverflow || "";
      document.body.style.position = previousBodyPosition || "";
      document.body.style.top = previousBodyTop || "";
      document.body.style.width = previousBodyWidth || "";

      // Restore scroll position
      window.scrollTo(scrollX, scrollY);
    };
  }, [showAddResourcesModal]);

  // In tutor-only system, all tutors manage their own assignments

  // Initialize selectedResourceIds when opening modal
  const handleOpenAddResourcesModal = () => {
    const currentIds = assignment?.learning_resources?.map((r: any) => getObjId(r)) || [];
    setSelectedResourceIds(currentIds);
    setShowAddResourcesModal(true);
  };

  const handleSaveResources = async () => {
    if (!assignment) return;

    const result = await updateAssignment(assignmentId, {
      learning_resources: selectedResourceIds.length > 0 ? selectedResourceIds : undefined,
    });

    if (result.success) {
      success("Cập nhật tài liệu đính kèm thành công");
      setShowAddResourcesModal(false);
      refetch();
    } else {
      showError(result.message || "Không thể cập nhật tài liệu");
    }
  };

  // Check view permission - chỉ block khi không có quyền xem
  if (!loading && assignment && permissions !== undefined && !canView) {
    return renderError(undefined, undefined, false);
  }

  if (loading) {
    return <PageSkeleton showHeader={true} showFilters={false} showContent={true} />;
  }

  if (error || !assignment) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
        <h3 className="font-medium mb-2">Lỗi tải dữ liệu</h3>
        <p>{error || "Không tìm thấy bài tập"}</p>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Tổng quan", icon: DocumentTextIcon },
    { id: "resources", label: "Tài liệu đính kèm", icon: PaperClipIcon },
    { id: "submissions", label: "Bài nộp", icon: DocumentArrowUpIcon },
  ];

  const getStatusBadge = (status: string, statusLabel?: string) => {
    const label = statusLabel || status;
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]">
            <CheckCircleIcon className="h-4 w-4 mr-1" />
            {isStudentUser ? 'Đang làm' : 'Đang giao'}
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]">
            <XCircleIcon className="h-4 w-4 mr-1" />
            Sắp giao
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]">
            <XCircleIcon className="h-4 w-4 mr-1" />
            Đã kết thúc
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]">
            {label}
          </span>
        );
    }
  };

  return (
    <div className={`space-y-4 sm:space-y-6 ${showAddResourcesModal ? 'overflow-hidden' : ''}`}>
      <ConfirmDeleteDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          // Xóa bài tập hiện được xử lý tại màn danh sách, nên dialog này tạm thời không thực thi hành động.
        }}
        loading={false}
        message="Bạn có chắc chắn muốn xóa bài tập này? Hành động không thể hoàn tác."
      />
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
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
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">{assignment.title}</h1>
          {assignment.description && (
            <div className="mt-1">
              <RichTextDisplay content={assignment.description} className="text-dark-4 dark:text-dark-6" />
            </div>
          )}
        </div>

        {canManage && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <ButtonLink
              href={`/assignments/${assignmentId}/edit`}
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
        )}
      </div>

      {/* Paused Student Banner */}
      {isStudentPaused && studentEnrollment && (
        <PausedStudentBanner
          enrollment={studentEnrollment}
          studentName={user?.name}
          className={assignment.class?.name}
          description="Bạn đang tạm dừng lớp này nên chỉ có thể xem thông tin. Liên hệ giáo viên để mở lại nếu cần tiếp tục học."
        />
      )}

      {/* Stats Boxes - Hidden for students */}
      {!isStudent(user) && (() => {
        const totalSubmissions = submissions?.length || assignment.submissions_count || 0;
        const gradedCount = submissions?.filter((s: any) => s.status === 'graded').length || assignment.graded_submissions_count || 0;
        const pendingCount = submissions?.filter((s: any) => s.status === 'submitted' || s.status === 'pending').length || assignment.pending_submissions_count || 0;
        const scoredSubmissions = submissions?.filter((s: any) => s.score !== null && s.score !== undefined) || [];
        const averageScore = scoredSubmissions.length > 0
          ? (scoredSubmissions.reduce((sum: number, s: any) => sum + parseFloat(s.score || 0), 0) / scoredSubmissions.length).toFixed(1)
          : null;
        const maxScore = assignment.max_score || 100;
        const resourcesCount = assignment.learning_resources?.length || 0;

        return (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
            {loading ? (
              <GridSkeleton
                count={4}
                cols={{ mobile: 2, tablet: 2, desktop: 4 }}
                renderItem={(i) => (
                  <CardSkeleton
                    key={i}
                    showAvatar={false}
                    showActions={false}
                    lines={1}
                    className="rounded-lg bg-white p-4 dark:bg-gray-800 md:p-6"
                  />
                )}
              />
            ) : (
              <>
                <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
                  <div className="flex items-center">
                    <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                      <DocumentArrowUpIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                    </div>
                    <div className="ml-3 md:ml-4">
                      <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Tổng bài nộp">Tổng bài nộp</p>
                      <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                        {totalSubmissions}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
                  <div className="flex items-center">
                    <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                      <CheckCircleIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                    </div>
                    <div className="ml-3 md:ml-4">
                      <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Đã chấm">Đã chấm</p>
                      <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                        {gradedCount}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
                  <div className="flex items-center">
                    <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                      <ClockIcon className="h-5 w-5 md:h-6 md:w-6 text-primary-light" />
                    </div>
                    <div className="ml-3 md:ml-4">
                      <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Chờ chấm">Chờ chấm</p>
                      <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                        {pendingCount}
                      </p>
                    </div>
                  </div>
                </div>

                {averageScore !== null ? (
                  <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
                    <div className="flex items-center">
                      <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                        <AcademicCapIcon className="h-5 w-5 md:h-6 md:w-6 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div className="ml-3 md:ml-4">
                        <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Trung bình">Trung bình</p>
                        <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                          {Number(averageScore)} / {Number(parseFloat(maxScore.toString()).toFixed(0))}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800">
                    <div className="flex items-center">
                      <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                        <PaperClipIcon className="h-5 w-5 md:h-6 md:w-6 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div className="ml-3 md:ml-4">
                        <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Tài liệu đính kèm">Tài liệu đính kèm</p>
                        <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                          {resourcesCount}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab Content */}
      <TabPanel activeTab={activeTab} tabId="overview">
        <div className="space-y-4 sm:space-y-6">
          {/* Assignment Info */}
          <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
              Thông tin bài tập
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Lớp học</p>
                {assignment.class ? (
                  <Link
                    href={`/classes/${getObjId(assignment.class)}`}
                    prefetch={true}
                    className="group flex items-center gap-3 hover:underline transition-all duration-200 hover:opacity-80 cursor-pointer"
                  >
                    <div className="size-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
                      <AcademicCapIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    </div>
                    <p className="text-gray-900 dark:text-white font-medium">{assignment.class.name}</p>
                  </Link>
                ) : (
                  <p className="text-gray-900 dark:text-white">Chưa phân lớp</p>
                )}
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Giáo viên</p>
                {assignment.tutor ? (
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <UserIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    </div>
                    <p className="text-gray-900 dark:text-white font-medium">{assignment.tutor.name}</p>
                  </div>
                ) : (
                  <p className="text-gray-900 dark:text-white">Chưa phân công</p>
                )}
              </div>

              {assignment.assigned_date && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Ngày giao</p>
                  <p className="text-gray-900 dark:text-white flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    {new Date(assignment.assigned_date).toLocaleDateString('vi-VN')}
                  </p>
                </div>
              )}

              {assignment.due_date && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Hạn nộp</p>
                  <div className="flex flex-wrap items-center gap-2 text-gray-900 dark:text-white">
                    <span className="inline-flex items-center gap-2">
                      <ClockIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                      {new Date(assignment.due_date).toLocaleDateString('vi-VN')}
                    </span>
                    {assignment.deadline && (
                      <span className="text-gray-500 dark:text-gray-400">
                        ({new Date(assignment.deadline).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})
                      </span>
                    )}
                  </div>
                </div>
              )}

              {assignment.status && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Trạng thái</p>
                  {getStatusBadge(assignment.status, assignment.status_label)}
                </div>
              )}

              {assignment.max_score !== null && assignment.max_score !== undefined && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Điểm tối đa</p>
                  <p className="text-gray-900 dark:text-white font-semibold">{assignment.max_score} điểm</p>
                </div>
              )}

              {assignment.submissions_count !== undefined && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Số lượt nộp</p>
                  <p className="text-gray-900 dark:text-white font-semibold">
                    {assignment.submissions_count || 0}
                    {assignment.graded_submissions_count !== undefined && assignment.graded_submissions_count > 0 && (
                      <span className="ml-2 text-sm font-normal text-primary">
                        ({assignment.graded_submissions_count} đã chấm)
                      </span>
                    )}
                    {assignment.pending_submissions_count !== undefined && assignment.pending_submissions_count > 0 && (
                      <span className="ml-2 text-sm font-normal text-primary-light">
                        ({assignment.pending_submissions_count} chờ chấm)
                      </span>
                    )}
                  </p>
                </div>
              )}

              {assignment.assignment_type && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Loại bài tập</p>
                  <div>
                    <p className="text-gray-900 dark:text-white font-medium">
                      {assignment.assignment_type?.display_name || assignment.assignment_type?.name || 'N/A'}
                    </p>
                    {assignment.assignment_type?.description && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <RichTextDisplay content={assignment.assignment_type.description} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {assignment.allowed_submission_types && assignment.allowed_submission_types.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Định dạng bài nộp được phép</p>
                  <div className="flex flex-wrap gap-2">
                    {assignment.allowed_submission_types.map((type: string) => {
                      const labels: Record<string, string> = {
                        text: 'Văn bản',
                        file: 'File',
                        document: 'Tài liệu',
                        image: 'Hình ảnh',
                        video: 'Video',
                        audio: 'Ghi âm',
                        link: 'Liên kết',
                        quiz: 'Trắc nghiệm',
                      };
                      const colorMap: Record<string, string> = {
                        text: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-400',
                        file: 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-500/10 dark:border-orange-500/30 dark:text-orange-400',
                        document: 'bg-cyan-50 border-cyan-200 text-cyan-700 dark:bg-cyan-500/10 dark:border-cyan-500/30 dark:text-cyan-400',
                        image: 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-500/10 dark:border-purple-500/30 dark:text-purple-400',
                        video: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-400',
                        audio: 'bg-green-50 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-400',
                        link: 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-500/10 dark:border-indigo-500/30 dark:text-indigo-400',
                        quiz: 'bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-500/10 dark:border-violet-500/30 dark:text-violet-400',
                      };
                      return (
                        <span
                          key={type}
                          className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-semibold ${colorMap[type] || 'bg-gray-100 border-gray-200 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200'}`}
                        >
                          {labels[type] || type}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Cho phép nộp muộn</p>
                <p className={`font-medium ${assignment.allow_late_submission ? 'text-primary' : 'text-red-600 dark:text-red-400'}`}>
                  {assignment.allow_late_submission ? 'Có' : 'Không'}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Ngày tạo</p>
                <p className="text-gray-900 dark:text-white">
                  {new Date(assignment.created_at).toLocaleDateString('vi-VN')}
                </p>
              </div>
            </div>
          </div>

          {/* Instructions */}
          {assignment.instructions && (
            <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Hướng dẫn làm bài
              </h3>
              <div className="prose max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                <RichTextDisplay content={assignment.instructions} />
              </div>
            </div>
          )}

          {/* Description */}
          {assignment.description && (
            <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Mô tả
              </h3>
              <div className="prose max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                <RichTextDisplay content={assignment.description} />
              </div>
            </div>
          )}

          {/* Submit Button for Students */}
          {isStudentUser && !isStudentPaused && (
            <div className="rounded-lg bg-white p-6 dark:bg-gray-800 border-2 border-dashed border-primary/30">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="w-full">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Nộp bài tập
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    {latestSubmissionLoading
                      ? 'Đang tải trạng thái bài nộp...'
                      : assignment.due_date && new Date(assignment.due_date) < new Date()
                        ? assignment.allow_late_submission
                          ? 'Đã quá hạn nộp, nhưng bạn vẫn có thể nộp muộn'
                          : 'Đã quá hạn nộp'
                        : 'Nộp bài tập của bạn trước hạn chót'}
                  </p>
                  {latestSubmissionLoading ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Đang tải dữ liệu bài nộp...
                    </p>
                  ) : (() => {
                    const attemptsInfo = latestSubmission?.attempts_info;

                    if (attemptsInfo) {
                      if (attemptsInfo.unlimited) {
                        return (
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            Đã nộp {attemptsInfo.current} lần (Không giới hạn)
                          </p>
                        );
                      }
                      if (attemptsInfo.limit_reached) {
                        return (
                          <p className="text-sm font-medium text-red-600 dark:text-red-400">
                            ⚠️ Bạn đã đạt giới hạn số lần nộp ({attemptsInfo.max} lần)
                          </p>
                        );
                      }
                      return (
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Số lần nộp: {attemptsInfo.current}/{attemptsInfo.max} (Còn lại: {attemptsInfo.remaining} lần)
                        </p>
                      );
                    }
                    if (latestSubmission) {
                      const currentAttempts = latestSubmission.attempt_number ?? 0;
                      const maxAttempts = assignment.max_attempts;
                      if (maxAttempts !== null && maxAttempts !== undefined) {
                        const remainingAttempts = maxAttempts - currentAttempts;
                        if (remainingAttempts <= 0) {
                          return (
                            <p className="text-sm font-medium text-red-600 dark:text-red-400">
                              ⚠️ Bạn đã đạt giới hạn số lần nộp ({maxAttempts} lần)
                            </p>
                          );
                        }
                        return (
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            Số lần nộp: {currentAttempts}/{maxAttempts} (Còn lại: {remainingAttempts} lần)
                          </p>
                        );
                      }
                      return (
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Đã nộp {currentAttempts} lần
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>
                {(() => {
                  const attemptsInfo = latestSubmission?.attempts_info;
                  const limitReached = attemptsInfo?.limit_reached || false;
                  const isOverdue =
                    assignment.due_date && new Date(assignment.due_date) < new Date();
                  const allowLate = assignment.allow_late_submission;

                  if (latestSubmissionLoading) {
                    return (
                      <Button variant="secondary" size="sm" disabled icon={<DocumentArrowUpIcon />}>
                        Đang tải...
                      </Button>
                    );
                  }

                  if (isStudentPaused) {
                    return null;
                  }

                  // Nếu đã quá hạn và KHÔNG cho phép nộp muộn
                  if (isOverdue && !allowLate) {
                    // Nếu đã có bài nộp thì chỉ cho xem lại bài nộp
                    if (latestSubmission) {
                      return (
                        <ButtonLink
                          href={`/submissions/${getObjId(latestSubmission)}`}
                          variant="outline"
                          size="sm"
                          icon={<EyeIcon />}
                        >
                          Xem bài nộp
                        </ButtonLink>
                      );
                    }
                    // Chưa nộp thì disable hoàn toàn nút nộp
                    return (
                      <Button
                        disabled
                        variant="secondary"
                        size="sm"
                        icon={<DocumentArrowUpIcon />}
                      >
                        Đã quá hạn
                      </Button>
                    );
                  }

                  if (latestSubmission) {
                    if (latestSubmission.status === 'graded') {
                      return (
                        <ButtonLink
                          href={`/submissions/${getObjId(latestSubmission)}`}
                          variant="outline"
                          size="sm"
                          icon={<EyeIcon />}
                        >
                          Xem bài nộp
                        </ButtonLink>
                      );
                    }
                    if (limitReached) {
                      return (
                        <Button
                          disabled
                          variant="secondary"
                          size="sm"
                          icon={<DocumentArrowUpIcon />}
                        >
                          Đã đạt giới hạn
                        </Button>
                      );
                    }
                    return (
                      <ButtonLink
                        href={`/assignments/${assignmentId}/submit`}
                        variant="primary"
                        size="sm"
                        icon={<DocumentArrowUpIcon />}
                      >
                        Nộp lại bài
                      </ButtonLink>
                    );
                  }

                  return (
                    <ButtonLink
                      href={`/assignments/${assignmentId}/submit`}
                      variant="primary"
                      size="sm"
                      icon={<DocumentArrowUpIcon />}
                    >
                      Nộp bài
                    </ButtonLink>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Attempt history (P5 mục 07): mọi lần làm bài + link xem lại bài */}
          {isStudentUser && !isStudentPaused && (
            <SubmissionAttemptHistory
              assignmentId={assignmentId}
              submissions={attemptHistory || []}
              loading={attemptHistoryLoading}
            />
          )}
        </div>
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="resources">
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Tài liệu đính kèm ({assignment.learning_resources?.length || 0})
            </h3>
            {canManage && (
              <Button
                type="button"
                onClick={handleOpenAddResourcesModal}
                variant="primary"
                size="sm"
                icon={<PlusIcon />}
              >
                Thêm tài liệu
              </Button>
            )}
          </div>

          {assignment.learning_resources && assignment.learning_resources.length > 0 ? (
            <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
              <div className="space-y-2.5 sm:space-y-3">
                {/* Sort by order */}
                {[...assignment.learning_resources]
                  .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                  .map((resource: any, index: number) => (
                    <ResourceCard
                      key={getObjId(resource) || index}
                      resource={resource}
                      index={index}
                    />
                  ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-white p-8 text-center dark:bg-gray-800">
              <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mb-4">
                <PaperClipIcon className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Chưa có tài liệu đính kèm
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Bài tập này chưa có tài liệu đính kèm nào
              </p>
              {canManage && (
                <Button
                  type="button"
                  onClick={handleOpenAddResourcesModal}
                  variant="primary"
                  size="sm"
                  icon={<PlusIcon />}
                >
                  Thêm tài liệu đầu tiên
                </Button>
              )}
            </div>
          )}

          {/* Modal for adding/editing resources */}
          {showAddResourcesModal &&
            createPortal(
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                onClick={() => setShowAddResourcesModal(false)}
                role="dialog"
                aria-modal="true"
                aria-labelledby="assignment-resources-modal-title"
              >
                <div
                  className="w-full max-w-xl rounded-xl bg-white shadow-xl dark:bg-gray-800 max-h-[90vh] flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
                    <h3
                      id="assignment-resources-modal-title"
                      className="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                      Quản lý tài liệu đính kèm
                    </h3>
                    <button
                      onClick={() => setShowAddResourcesModal(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6">
                    <LearningResourceSelector
                      value={selectedResourceIds}
                      onChange={(ids) => setSelectedResourceIds(ids)}
                      label="Chọn tài liệu đính kèm"
                      initialResources={assignment?.learning_resources}
                    />
                  </div>

                  <div className="border-t border-gray-200 p-4 dark:border-gray-700 flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      onClick={() => setShowAddResourcesModal(false)}
                      variant="outline"
                      size="sm"
                    >
                      Hủy
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSaveResources}
                      disabled={updateLoading}
                      loading={updateLoading}
                      variant="primary"
                      size="sm"
                    >
                      Lưu thay đổi
                    </Button>
                  </div>
                </div>
              </div>,
              document.body
            )}
        </div>
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="submissions">
        <div className="rounded-lg bg-white dark:bg-gray-800">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isStudentUser ? 'Bài nộp của tôi' : `Danh sách bài nộp (${submissions?.length || 0})`}
            </h3>
          </div>

          {/* Tutor skill dashboard — only for quiz assignments, above the raw submission list */}
          {!isStudentUser && isQuizAssignment && !submissionsLoading && skillReport && !skillReportLoading && (
            <div className="mb-4">
              <AssignmentSkillDashboard report={skillReport} />
            </div>
          )}

          {/* Check permissions for submissions tab */}
          {!submissionsLoading && submissionsPermissions !== undefined && !(submissionsPermissions?.can_view ?? true) ? (
            <div className="p-6">
              {renderError(undefined, undefined, false)}
            </div>
          ) : submissionsLoading ? (
            <div className="overflow-x-auto">
              <div className="p-6">
                <div className="space-y-4">
                  <ListSkeleton count={5} showAvatar={true} />
                </div>
              </div>
            </div>
          ) : submissions && submissions.length > 0 ? (
            <div className="overflow-x-auto">
              {/* Mobile Card View */}
              <div className="md:hidden space-y-4 p-4">
                {submissions.map((submission: any) => (
                  <div key={getObjId(submission)} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <Link
                        href={`/students/${getObjId(submission.student)}`}
                        className="flex items-center gap-3 hover:underline"
                      >
                        <div className="size-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          <UserIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {submission.student?.name || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {submission.student?.email || ''}
                          </p>
                        </div>
                      </Link>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium ${submission.status === 'graded'
                        ? 'bg-primary-pastel text-primary'
                        : submission.status === 'submitted'
                          ? 'bg-primary-pastel/60 text-primary-light'
                          : 'bg-primary-pastel/60 text-primary-light'
                        }`}>
                        {submission.status === 'graded' ? 'Đã chấm' :
                          submission.status === 'submitted' ? 'Đã nộp' :
                            submission.is_late ? 'Nộp muộn' : 'Chưa nộp'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Ngày nộp</p>
                        <p className="text-gray-900 dark:text-white">
                          {submission.submitted_at
                            ? new Date(submission.submitted_at).toLocaleString('vi-VN')
                            : 'Chưa nộp'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Điểm số</p>
                        <p className="text-gray-900 dark:text-white font-medium">
                          {submission.score !== null && submission.score !== undefined
                            ? formatScore(submission.score, submission.max_score || assignment.max_score)
                            : 'Chưa chấm'}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                      <Link
                        href={`/submissions/${getObjId(submission)}`}
                        className="text-sm font-medium text-primary hover:text-primary/80"
                      >
                        Xem bài nộp →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              <table className="hidden md:table min-w-[800px] w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Học viên
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Ngày nộp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Trạng thái
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Điểm
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {submissions.map((submission: any) => (
                    <tr key={getObjId(submission)}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/students/${getObjId(submission.student)}`}
                          className="flex items-center gap-3 hover:underline"
                        >
                          <div className="size-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            <UserIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {submission.student?.name || 'N/A'}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {submission.student?.email || ''}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {submission.submitted_at
                          ? new Date(submission.submitted_at).toLocaleString('vi-VN')
                          : 'Chưa nộp'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium ${submission.status === 'graded'
                          ? 'bg-primary-pastel text-primary'
                          : submission.status === 'submitted'
                            ? 'bg-primary-pastel/60 text-primary-light'
                            : 'bg-primary-pastel/60 text-primary-light'
                          }`}>
                          {submission.status === 'graded' ? 'Đã chấm' :
                            submission.status === 'submitted' ? 'Đã nộp' :
                              submission.is_late ? 'Nộp muộn' : 'Chưa nộp'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {submission.score !== null && submission.score !== undefined
                          ? formatScore(submission.score, submission.max_score || assignment.max_score)
                          : 'Chưa chấm'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          href={`/submissions/${getObjId(submission)}`}
                          className="text-primary hover:text-primary/80"
                        >
                          Xem bài nộp
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              Chưa có bài nộp nào
            </div>
          )}
        </div>
      </TabPanel>
    </div>
  );
}
