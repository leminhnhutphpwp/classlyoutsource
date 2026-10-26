"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAttendanceRecord, useUpdateAttendance } from "@/hooks/use-api";
import { useNotification } from "@/hooks/use-notification";
import { useGoBack } from "@/hooks/use-go-back";
import { ArrowLeftIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from "@heroicons/react/24/outline";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import { useResourceGuard } from "@/lib/permission-guards";
import { useAuthContext } from "@/contexts/auth-context";

export default function EditAttendancePage() {
  const params = useParams();
  const router = useRouter();
  const attendanceId = params.id as string;
  const { user } = useAuthContext();
  const { success, error: showError } = useNotification();
  const handleGoBack = useGoBack(`/attendance/${attendanceId}`);

  const {
    data: attendance,
    loading,
    error,
    permissions,
  } = useAttendanceRecord(attendanceId);

  const { mutate: updateAttendance, loading: updating } = useUpdateAttendance();

  // Use resource guard to protect this route
  const { hasAccess, isChecking } = useResourceGuard(
    user,
    'update',
    'attendance',
    '/attendance',
    {
      checkAfterLoad: true,
      loaded: !loading && !!attendance,
    }
  );

  const [formData, setFormData] = useState({
    status: 'present' as 'present' | 'absent' | 'late' | 'excused',
    note: '',
  });

  useEffect(() => {
    if (attendance) {
      setFormData({
        status: attendance.status || 'present',
        note: attendance.note || attendance.notes || '',
      });
    }
  }, [attendance]);

  // Check permissions from API response
  const canManageFromApi = permissions?.can_manage ?? false;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await updateAttendance(attendanceId, {
      status: formData.status,
      notes: formData.note,
    });

    if (result.success) {
      success('Cập nhật thành công', 'Thông tin điểm danh đã được cập nhật');
      setTimeout(() => {
        router.push(`/attendance/${attendanceId}`);
      }, 500);
    } else {
      showError('Lỗi cập nhật', result.message || 'Không thể cập nhật điểm danh');
    }
  };

  // Show loading skeleton while loading or checking permissions
  if (loading || isChecking) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="h-10 w-full sm:w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="flex-1 min-w-0">
            <div className="h-6 sm:h-8 w-full sm:w-64 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-2" />
            <div className="h-4 w-full sm:w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
        </div>

        {/* Form Skeleton */}
        <div className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800">
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-24 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="h-10 w-full sm:w-20 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-10 w-full sm:w-32 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !attendance) {
    return (
      <div className="space-y-6">
        <ButtonLink
          href="/attendance"
          variant="outline"
          size="sm"
          icon={<ArrowLeftIcon />}
        >
          Quay lại
        </ButtonLink>
        <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          <h3 className="font-medium mb-2">Lỗi tải dữ liệu</h3>
          <p>{error || "Không tìm thấy bản ghi điểm danh"}</p>
        </div>
      </div>
    );
  }

  // Check permissions
  if (!hasAccess || (permissions !== undefined && !canManageFromApi)) {
    return (
      <div className="space-y-6">
        <ButtonLink
          href={`/attendance/${attendanceId}`}
          variant="outline"
          size="sm"
          icon={<ArrowLeftIcon />}
        >
          Quay lại
        </ButtonLink>
        <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          <h3 className="font-medium mb-2">Không có quyền</h3>
          <p>Bạn không có quyền chỉnh sửa bản ghi điểm danh này.</p>
        </div>
      </div>
    );
  }

  const statusOptions = [
    { value: 'present', label: 'Có mặt', icon: CheckCircleIcon },
    { value: 'absent', label: 'Vắng mặt', icon: XCircleIcon },
    { value: 'late', label: 'Đi muộn', icon: ClockIcon },
    { value: 'excused', label: 'Có phép', icon: CheckCircleIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Button
          onClick={handleGoBack}
          variant="outline"
          size="sm"
          icon={<ArrowLeftIcon />}
          className="w-full sm:w-auto"
        >
          Quay lại
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate">
            Chỉnh sửa điểm danh
          </h1>
          <p className="text-sm sm:text-base text-dark-4 dark:text-dark-6 mt-1 break-words">
            {attendance.student?.name ? `Điểm danh cho ${attendance.student.name}` : "Cập nhật thông tin điểm danh"}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800 space-y-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="status" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
              Trạng thái <span className="text-red-500">*</span>
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              required
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="note" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
              Ghi chú
            </label>
            <textarea
              id="note"
              name="note"
              value={formData.note}
              onChange={handleChange}
              rows={4}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-primary"
              placeholder="Nhập ghi chú (tùy chọn)"
            />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <ButtonLink
            href={`/attendance/${attendanceId}`}
            variant="outline"
            size="sm"
            className="w-full sm:w-auto justify-center"
          >
            Hủy
          </ButtonLink>
          <Button
            type="submit"
            disabled={updating}
            loading={updating}
            size="sm"
            variant="primary"
            icon={<CheckCircleIcon />}
            className="w-full sm:w-auto justify-center"
          >
            <span className="sm:hidden">Lưu</span>
            <span className="hidden sm:inline">Lưu thay đổi</span>
          </Button>
        </div>
      </form>
    </div>
  );
}

