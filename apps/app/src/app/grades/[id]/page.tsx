"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useGrade, useDeleteGrade } from "@/hooks/use-api";
import { useAuthorization } from "@/lib/authz";
import { useAuthContext } from "@/contexts/auth-context";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";
import { useLockContext } from "@/contexts/lock-context";
import { PageSkeleton } from "@/components/ui/loading";
import { useGoBack } from "@/hooks/use-go-back";
import {
  ArrowLeftIcon,
  AcademicCapIcon,
  CalendarIcon,
  PencilIcon,
  TrashIcon,
  UserIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserGroupIcon,
  ClockIcon
} from "@heroicons/react/24/outline";
import ConfirmDeleteDialog from '@/components/Common/ConfirmDeleteDialog';
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import { getObjId, idsEqual } from "@/lib/id-utils";
export default function GradeDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const gradeId = params.id as string;
  const { can } = useAuthorization();
  const { user } = useAuthContext();
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const { renderError } = useErrorDisplay("Chi tiết điểm số");
  const { data: grade, loading, error, refetch, permissions } = useGrade(gradeId);
  const { mutate: deleteGrade, loading: deleting } = useDeleteGrade();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Handle go back
  const handleGoBack = useGoBack('/grades');

  // Use permissions from API response
  const canView = permissions?.can_view ?? true; // Default true cho view
  const canManage = permissions?.can_manage ?? false;

  // Check if user can delete this grade (based on ownership and permission)
  // Backend logic: Personal Tutor/Institution Tutor can only delete their own grades
  // Center Owner can delete any grade in their center
  // Super Admin can delete all grades
  const canDeleteGrade = grade && user && (
    (can("delete", "grade") || canManage) ||
    idsEqual(grade.tutor_id, user) ||
    user.role === 'super_admin'
  );

  // Kiểm tra lock và plan feature trước để ưu tiên hiển thị lock content
  if (actionsLocked || planFeatureMessage) {
    return renderError();
  }

  if (loading) {
    return <PageSkeleton showHeader={true} showFilters={false} showContent={true} />;
  }

  if (error || !grade) {
    return renderError(error || "Không tìm thấy điểm số", () => refetch());
  }

  // Check view permission - chỉ block khi không có quyền xem
  if (!loading && grade && permissions !== undefined && !canView) {
    return renderError(undefined, undefined, false);
  }

  // Calculate percentage if not provided
  const score = parseFloat((grade.score || grade.grade || 0).toString());
  const maxScore = parseFloat((grade.max_score || grade.max_points || 100).toString());
  const percentage = grade.percentage !== null && grade.percentage !== undefined
    ? parseFloat(grade.percentage.toString())
    : maxScore > 0 ? (score / maxScore) * 100 : 0;

  // Determine color based on percentage
  const getPercentageColor = (pct: number) => {
    if (pct >= 90) return 'text-primary';
    if (pct >= 80) return 'text-primary-light';
    if (pct >= 70) return 'text-primary-light';
    if (pct >= 60) return 'text-primary-light';
    return 'text-red-600 dark:text-red-400';
  };

  const percentageColor = getPercentageColor(percentage);

  return (
    <div className="space-y-6">
      <ConfirmDeleteDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          const res = await deleteGrade(gradeId);
          if (res.success) router.push('/grades');
        }}
        loading={deleting}
        message="Bạn có chắc chắn muốn xóa điểm số này? Hành động không thể hoàn tác."
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Button
          onClick={handleGoBack}
          variant="outline"
          size="sm"
          icon={<ArrowLeftIcon />}
        >
          Quay lại
        </Button>

        <div className="flex-1">
          <h1 className="text-2xl font-bold text-dark dark:text-white">
            {grade.title || grade.assignment?.title || grade.grade_type?.name || 'Chi tiết điểm số'}
          </h1>
          {grade.student && (
            <p className="text-dark-4 dark:text-dark-6 mt-1">
              Học viên: {grade.student.name}
            </p>
          )}
        </div>

        {canManage && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <ButtonLink
              href={`/grades/${gradeId}/edit`}
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-initial"
              icon={<PencilIcon />}
            >
              Chỉnh sửa
            </ButtonLink>
            <Button
              onClick={() => setConfirmDelete(true)}
              variant="danger"
              size="sm"
              className="flex-1 sm:flex-initial"
              icon={<TrashIcon />}
              disabled={!canDeleteGrade}
            >
              Xóa
            </Button>
          </div>
        )}
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-4 flex-wrap">
        {grade.is_passing !== undefined && (
          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${grade.is_passing
            ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
            : 'bg-[var(--status-badge-error)] text-[var(--status-badge-error-text)]'
            }`}>
            {grade.is_passing ? (
              <>
                <CheckCircleIcon className="h-4 w-4 mr-1.5" />
                Đạt
              </>
            ) : (
              <>
                <XCircleIcon className="h-4 w-4 mr-1.5" />
                Không đạt
              </>
            )}
          </span>
        )}
        {grade.grade_letter && (
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-primary-pastel/40 text-primary">
            {grade.grade_letter}
          </span>
        )}
        {grade.grade_type && (
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
            <AcademicCapIcon className="h-4 w-4 mr-1.5" />
            {grade.grade_type.name}
          </span>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Grade Information */}
          <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Thông tin điểm số
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Score Display */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Điểm số
                </label>
                <div className="flex items-baseline gap-3">
                  <p className={`text-4xl font-bold ${percentageColor}`}>
                    {Number(score.toFixed(1))}
                  </p>
                  <p className="text-2xl text-gray-500 dark:text-gray-400">
                    / {Number(maxScore.toFixed(1))}
                  </p>
                  <p className={`text-xl font-semibold ml-4 ${percentageColor}`}>
                    ({Number(percentage.toFixed(1))}%)
                  </p>
                </div>
              </div>

              {grade.title && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Tiêu đề
                  </label>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {grade.title}
                  </p>
                </div>
              )}

              {grade.assignment && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Bài tập
                  </label>
                  <Link
                    href={`/assignments/${getObjId(grade.assignment)}`}
                    className="inline-flex items-center gap-1 text-primary hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300"
                  >
                    <DocumentTextIcon className="h-4 w-4" />
                    {grade.assignment.title}
                  </Link>
                </div>
              )}

              {grade.grade_date && (
                <div>
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    <CalendarIcon className="h-4 w-4" />
                    Ngày chấm
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(grade.grade_date).toLocaleDateString('vi-VN', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              )}

              {grade.semester && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Học kỳ
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {grade.semester}
                  </p>
                </div>
              )}

              {grade.student && (
                <div>
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    <UserIcon className="h-4 w-4" />
                    Học viên
                  </label>
                  <Link
                    href={`/students/${getObjId(grade.student)}`}
                    className="inline-flex items-center gap-1 text-primary hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300"
                  >
                    {grade.student.name}
                  </Link>
                </div>
              )}

              {grade.class && (
                <div>
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    <UserGroupIcon className="h-4 w-4" />
                    Lớp học
                  </label>
                  <Link
                    href={`/classes/${getObjId(grade.class)}`}
                    className="inline-flex items-center gap-1 text-primary hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300"
                  >
                    {grade.class.name}
                  </Link>
                </div>
              )}

              {grade.tutor && (
                <div>
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    <UserIcon className="h-4 w-4" />
                    Giáo viên chấm
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {grade.tutor.name}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Comments */}
          {(grade.comments || grade.notes) && (
            <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Ghi chú
              </h3>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {grade.comments || grade.notes}
              </p>
            </div>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Grade Summary */}
          <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Tóm tắt
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Điểm số
                </p>
                <p className={`text-2xl font-bold ${percentageColor}`}>
                  {Number(score.toFixed(1))}/{Number(maxScore.toFixed(1))}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Tỷ lệ phần trăm
                </p>
                <p className={`text-xl font-semibold ${percentageColor}`}>
                  {Number(percentage.toFixed(1))}%
                </p>
              </div>

              {grade.grade_letter && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Điểm chữ
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {grade.grade_letter}
                  </p>
                </div>
              )}

              {grade.created_at && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <ClockIcon className="h-4 w-4" />
                    Tạo lúc
                  </p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {new Date(grade.created_at).toLocaleString('vi-VN')}
                  </p>
                </div>
              )}

              {grade.updated_at && grade.updated_at !== grade.created_at && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <ClockIcon className="h-4 w-4" />
                    Cập nhật lúc
                  </p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {new Date(grade.updated_at).toLocaleString('vi-VN')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
