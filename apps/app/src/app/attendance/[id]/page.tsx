"use client";
import { useParams, useRouter } from "next/navigation";
import { useAttendanceRecord, useUpdateAttendance, useDeleteAttendance } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { useNotification } from "@/hooks/use-notification";
import { useState, useEffect, useMemo } from "react";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CalendarIcon,
  UserGroupIcon,
  PencilIcon,
  TrashIcon
} from "@heroicons/react/24/outline";
import ConfirmDeleteDialog from '@/components/Common/ConfirmDeleteDialog';
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import ErrorDisplay, { useErrorDisplay } from "@/components/Common/ErrorDisplay";

export default function AttendanceDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { success, error: showError } = useNotification();
  const attendanceId = params.id as string;
  const handleGoBack = useGoBack('/attendance');
  const { renderError } = useErrorDisplay("Chi tiết điểm danh");

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [formData, setFormData] = useState({
    status: 'present' as 'present' | 'absent' | 'late' | 'excused',
    note: '',
  });

  const {
    data: attendance,
    loading,
    error,
    permissions,
    refetch,
  } = useAttendanceRecord(attendanceId);

  // Use permissions from API response
  const canView = permissions?.can_view ?? true; // Default true cho view
  const canManage = permissions?.can_manage ?? false;

  const { mutate: updateAttendance, loading: updating } = useUpdateAttendance();
  const { mutate: deleteAttendance, loading: deleting } = useDeleteAttendance();

  useEffect(() => {
    if (attendance) {
      setFormData({
        status: attendance.status || 'present',
        note: attendance.note || attendance.notes || '',
      });
    }
  }, [attendance]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await updateAttendance(attendanceId, {
      status: formData.status,
      notes: formData.note,
    });
    if (response.success) {
      success('Cập nhật thành công', 'Thông tin điểm danh đã được cập nhật');
      setEditing(false);
      refetch();
    } else {
      showError('Lỗi cập nhật', response.message || 'Không thể cập nhật điểm danh');
    }
  };

  const handleDelete = async () => {
    const response = await deleteAttendance(attendanceId);
    if (response.success) {
      success('Xóa thành công', 'Bản ghi điểm danh đã được xóa');
      router.push('/attendance');
    } else {
      showError('Lỗi xóa', response.message || 'Không thể xóa bản ghi điểm danh');
      setConfirmDelete(false);
    }
  };

  const statusConfig = useMemo(() => ({
    present: {
      label: 'Có mặt',
      icon: CheckCircleIcon,
      bg: 'bg-primary-pastel text-primary',
    },
    absent: {
      label: 'Vắng mặt',
      icon: XCircleIcon,
      bg: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    },
    late: {
      label: 'Đi muộn',
      icon: ClockIcon,
      bg: 'bg-primary-pastel/60 text-primary-light',
    },
    excused: {
      label: 'Có phép',
      icon: CheckCircleIcon,
      bg: 'bg-primary-pastel/40 text-primary',
    },
  }), []);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center gap-4">
          <div className="h-10 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="flex-1">
            <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-2" />
            <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
          <div className="h-10 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>

        {/* Content Skeleton */}
        <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-10 w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-10 w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-24 w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <Button
          onClick={handleGoBack}
          variant="outline"
          size="sm"
          icon={<ArrowLeftIcon />}
        >
          Quay lại
        </Button>

        <ErrorDisplay error={error} title="Chi tiết điểm danh" onRetry={() => refetch()} />
      </div>
    );
  }

  if (!attendance) {
    return (
      <div className="space-y-6">
        <Button
          onClick={handleGoBack}
          variant="outline"
          size="sm"
          icon={<ArrowLeftIcon />}
        >
          Quay lại
        </Button>

        <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          <h3 className="font-medium mb-2">Không tìm thấy bản ghi điểm danh</h3>
          <p>Bản ghi điểm danh này không tồn tại hoặc bạn không có quyền truy cập.</p>
        </div>
      </div>
    );
  }

  // Check view permission - chỉ block khi không có quyền xem
  if (!loading && attendance && permissions !== undefined && !canView) {
    return renderError(undefined, undefined, false);
  }

  const statusInfo = statusConfig[attendance.status as keyof typeof statusConfig] || statusConfig.present;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-6">
      <ConfirmDeleteDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        loading={deleting}
        message="Bạn có chắc chắn muốn xóa bản ghi điểm danh này? Hành động không thể hoàn tác."
      />
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <ButtonLink
            href="/attendance"
            variant="outline"
            size="sm"
            icon={<ArrowLeftIcon />}
            className="w-full sm:w-auto"
          >
            Quay lại
          </ButtonLink>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">Thông tin điểm danh</h1>
            <p className="text-sm sm:text-base text-dark-4 dark:text-dark-6 mt-1 break-words">
              Chi tiết bản ghi điểm danh
            </p>
          </div>
        </div>

        {!editing && canManage && (
          <div className="flex items-center gap-2 w-full sm:w-auto self-start sm:self-auto">
            <Button
              onClick={() => setEditing(true)}
              variant="outline"
              size="sm"
              icon={<PencilIcon />}
              className="flex-1 sm:flex-initial justify-center"
            >
              Chỉnh sửa
            </Button>
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

      {/* Edit Form */}
      {editing && (
        <form onSubmit={handleUpdate} className="rounded-lg bg-white p-6 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Chỉnh sửa điểm danh
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Trạng thái
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="present">Có mặt</option>
                <option value="absent">Vắng mặt</option>
                <option value="late">Đi muộn</option>
                <option value="excused">Có phép</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Ghi chú
              </label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                rows={4}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="Nhập ghi chú (tùy chọn)"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setFormData({
                    status: attendance.status || 'present',
                    note: attendance.note || attendance.notes || '',
                  });
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={updating}
                className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {updating ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Card */}
          <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
            <div className="flex items-center gap-4">
              <div className={`rounded-lg p-3 ${statusInfo.bg}`}>
                <StatusIcon className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {statusInfo.label}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Trạng thái điểm danh
                </p>
              </div>
            </div>
          </div>

          {/* Student & Class Info */}
          <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Thông tin học viên và lớp học
            </h3>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                    {attendance.student?.name?.charAt(0).toUpperCase() || 'S'}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {attendance.student?.name || 'Không có tên'}
                  </p>
                  {attendance.student?.email && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {attendance.student.email}
                    </p>
                  )}
                </div>
              </div>

              {attendance.class && (
                <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <UserGroupIcon className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {attendance.class.name}
                    </p>
                    {attendance.class.tutor && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Giáo viên: {attendance.class.tutor.name}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {(attendance.note || attendance.notes) && (
            <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Ghi chú
              </h3>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {attendance.note || attendance.notes}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Date & Time */}
          <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Ngày và giờ
            </h3>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <CalendarIcon className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Ngày điểm danh</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {new Date(attendance.date).toLocaleDateString('vi-VN', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              {attendance.check_in_time && (
                <div className="flex items-center gap-3">
                  <ClockIcon className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Giờ vào</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {attendance.check_in_time}
                    </p>
                  </div>
                </div>
              )}

              {attendance.check_out_time && (
                <div className="flex items-center gap-3">
                  <ClockIcon className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Giờ ra</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {attendance.check_out_time}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tutor Info */}
          {attendance.tutor && (
            <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Giáo viên điểm danh
              </h3>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {attendance.tutor.name?.charAt(0).toUpperCase() || 'T'}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {attendance.tutor.name}
                  </p>
                  {attendance.tutor.email && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {attendance.tutor.email}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Thông tin hệ thống
            </h3>

            <div className="space-y-2 text-sm">
              {attendance.created_at && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Ngày tạo</p>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(attendance.created_at).toLocaleString('vi-VN')}
                  </p>
                </div>
              )}
              {attendance.updated_at && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Cập nhật cuối</p>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(attendance.updated_at).toLocaleString('vi-VN')}
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

