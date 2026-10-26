"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { LockClosedIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Button from "@/components/Common/Button";
import SelectInput from "@/components/FormElements/SelectInput";
import DateInput from "@/components/FormElements/DateInput";

// Helper functions for date manipulation
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDaysToDate = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

interface LockStudentDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (lockData: {
    type: 'login' | 'actions' | 'all';
    reason?: string;
    start_at?: string;
    end_at?: string;
  }) => Promise<void>;
  studentName?: string;
  loading?: boolean;
  isTutor?: boolean; // True if current user is a tutor (not admin)
}

export default function LockStudentDialog({
  open,
  onClose,
  onConfirm,
  studentName,
  loading = false,
  isTutor = true, // Default to tutor (only login option)
}: LockStudentDialogProps) {
  const [lockType, setLockType] = useState<'login' | 'actions' | 'all'>('all');
  const [reason, setReason] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [durationDays, setDurationDays] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      // Giáo viên mặc định là 'login', admin mặc định là 'all'
      setLockType(isTutor ? 'login' : 'all');
      setReason('');
      setStartAt(''); // Để trống mặc định = có hiệu lực ngay
      setEndAt(''); // Để trống mặc định = khóa vô thời hạn
      setDurationDays('');
      setErrors({});
    }
  }, [open, isTutor]);

  // Auto set dates when duration is selected
  useEffect(() => {
    if (durationDays) {
      if (durationDays === 'unlimited') {
        // Vô thời hạn: clear endAt
        setEndAt('');
      } else {
        const days = parseInt(durationDays);
        if (!isNaN(days) && days > 0) {
          // Nếu startAt trống, dùng ngày hiện tại làm mốc
          const startDate = startAt ? new Date(startAt) : new Date();
          const endDate = addDaysToDate(startDate, days);
          setEndAt(formatDate(endDate));
          
          // Nếu startAt trống, tự động set = ngày hiện tại khi chọn số ngày
          if (!startAt) {
            setStartAt(formatDate(new Date()));
          }
        }
      }
    }
  }, [durationDays, startAt]);

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (open) {
      const previousBodyOverflow = document.body.style.overflow;
      const previousHtmlOverflow = document.documentElement.style.overflow;
      
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      
      return () => {
        document.body.style.overflow = previousBodyOverflow || "";
        document.documentElement.style.overflow = previousHtmlOverflow || "";
      };
    }
  }, [open]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!lockType) {
      newErrors.lockType = 'Vui lòng chọn loại khóa';
    }

    if (startAt && endAt) {
      const start = new Date(startAt);
      const end = new Date(endAt);
      if (end <= start) {
        newErrors.endAt = 'Thời gian kết thúc phải sau thời gian bắt đầu';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const lockData: {
      type: 'login' | 'actions' | 'all';
      reason?: string;
      start_at?: string;
      end_at?: string;
    } = {
      type: lockType,
    };

    // Lý do khóa (tùy chọn)
    if (reason.trim()) {
      lockData.reason = reason.trim();
    }

    // Thời gian bắt đầu: để trống = có hiệu lực ngay
    if (startAt && startAt.trim()) {
      lockData.start_at = new Date(startAt).toISOString();
    }
    // Nếu để trống, không gửi field này → backend sẽ hiểu là có hiệu lực ngay

    // Thời gian kết thúc: để trống = khóa vô thời hạn
    if (endAt && endAt.trim()) {
      lockData.end_at = new Date(endAt).toISOString();
    }
    // Nếu để trống, không gửi field này → backend sẽ hiểu là khóa vô thời hạn

    await onConfirm(lockData);
  };

  if (!open) return null;

  const dialogContent = (
    <div className="fixed inset-0 flex items-center justify-center z-[1000] bg-black/50 backdrop-blur-[1px] p-4" role="dialog" aria-modal="true" aria-labelledby="lock-student-title">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] flex flex-col rounded-lg bg-white shadow-xl dark:bg-gray-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20 flex-shrink-0">
              <LockClosedIcon className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="min-w-0">
              <h3 id="lock-student-title" className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                {isTutor ? 'Khóa đăng nhập của học viên' : 'Khóa tài khoản học viên'}
              </h3>
              {studentName && (
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                  {studentName}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 flex-shrink-0 ml-2"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Lock Type - Đặt ở ngoài scrollable để dropdown không bị cắt */}
          <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="relative">
                {isTutor ? (
                  // Giáo viên: chỉ hiển thị thông tin, không có select
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Khóa đăng nhập *
                    </label>
                    <div className="rounded-lg border border-gray-300 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Khóa đăng nhập của học viên
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Học viên sẽ không thể đăng nhập vào hệ thống cho đến khi được mở khóa
                      </p>
                    </div>
                    <input type="hidden" name="lockType" value="login" />
                  </div>
                ) : (
                  // Admin: có select để chọn loại khóa
                  <>
                    <SelectInput
                      label="Loại khóa *"
                      name="lockType"
                      value={lockType}
                      onChange={(e) => setLockType(e.target.value as 'login' | 'actions' | 'all')}
                      options={[
                        { value: 'login', label: 'Chỉ khóa đăng nhập' },
                        { value: 'actions', label: 'Chỉ khóa thao tác' },
                        { value: 'all', label: 'Khóa toàn bộ' },
                      ]}
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {lockType === 'login' && 'Học viên không thể đăng nhập vào hệ thống'}
                      {lockType === 'actions' && 'Học viên có thể đăng nhập nhưng không thể thực hiện thao tác'}
                      {lockType === 'all' && 'Học viên không thể đăng nhập và thực hiện thao tác'}
                    </p>
                    {errors.lockType && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.lockType}</p>
                    )}
                  </>
                )}
              </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
            <div className="space-y-4">

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {isTutor ? 'Lý do khóa đăng nhập (tùy chọn)' : 'Lý do khóa (tùy chọn)'}
                </label>
                <textarea
                  name="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder={isTutor ? "Nhập lý do khóa đăng nhập..." : "Nhập lý do khóa tài khoản..."}
                  maxLength={1000}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-primary resize-none"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {reason.length}/1000 ký tự
                </p>
              </div>

              {/* Duration Quick Select */}
              <div>
                <SelectInput
                  label={isTutor ? "Chọn thời hạn khóa đăng nhập (tùy chọn)" : "Chọn thời hạn khóa (tùy chọn)"}
                  name="durationDays"
                  value={durationDays}
                  onChange={(e) => {
                    setDurationDays(e.target.value);
                    if (!e.target.value) {
                      setEndAt('');
                    }
                  }}
                  placeholder="Chọn số ngày hoặc để trống"
                  options={[
                    { value: '3', label: '3 ngày' },
                    { value: '5', label: '5 ngày' },
                    { value: '10', label: '10 ngày' },
                    { value: '20', label: '20 ngày' },
                    { value: '30', label: '30 ngày' },
                    { value: '60', label: '60 ngày' },
                    { value: '90', label: '90 ngày' },
                    { value: 'unlimited', label: 'Vô thời hạn' },
                  ]}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {durationDays === 'unlimited' 
                    ? (isTutor ? 'Đăng nhập của học viên sẽ bị khóa vô thời hạn' : 'Tài khoản sẽ bị khóa vô thời hạn')
                    : 'Chọn số ngày để tự động tính thời gian kết thúc'}
                </p>
              </div>

              {/* Date Fields - 2 columns on desktop */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Start Date */}
                <div>
                  <DateInput
                    label="Thời gian bắt đầu (tùy chọn)"
                    name="start_at"
                    value={startAt}
                    onChange={(e) => {
                      const newStartAt = e.target.value;
                      setStartAt(newStartAt);
                      // Recalculate end date if duration is set
                      if (durationDays && newStartAt) {
                        const days = parseInt(durationDays);
                        if (!isNaN(days) && days > 0) {
                          const startDate = new Date(newStartAt);
                          const endDate = addDaysToDate(startDate, days);
                          setEndAt(formatDate(endDate));
                        }
                      } else if (durationDays && !newStartAt) {
                        // Nếu xóa startAt nhưng vẫn có duration, clear endAt
                        setEndAt('');
                      }
                    }}
                    placeholder="Ngày bắt đầu"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {isTutor ? 'Để trống sẽ khóa đăng nhập ngay bây giờ' : 'Để trống sẽ có hiệu lực ngay'}
                  </p>
                </div>

                {/* End Date */}
                <div>
                  <DateInput
                    label="Thời gian kết thúc (tùy chọn)"
                    name="end_at"
                    value={endAt}
                    onChange={(e) => {
                      setEndAt(e.target.value);
                      // Clear duration when manually changing end date (trừ khi là unlimited)
                      if (durationDays && durationDays !== 'unlimited') {
                        setDurationDays('');
                      }
                    }}
                    placeholder="Ngày kết thúc"
                    disabled={durationDays === 'unlimited'}
                  />
                  {errors.endAt && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.endAt}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {durationDays === 'unlimited' 
                      ? (isTutor ? 'Đã chọn khóa đăng nhập vô thời hạn' : 'Đã chọn vô thời hạn')
                      : (isTutor ? 'Để trống sẽ khóa đăng nhập vô thời hạn' : 'Để trống sẽ khóa vô thời hạn')}
                  </p>
                </div>
              </div>

              {/* Warning */}
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 sm:p-4 dark:bg-yellow-900/20 dark:border-yellow-800">
                <p className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Lưu ý:</strong> {isTutor 
                    ? 'Học viên bị khóa đăng nhập sẽ không thể đăng nhập vào hệ thống cho đến khi được mở khóa.'
                    : 'Học viên bị khóa sẽ không thể đăng nhập hoặc thực hiện các thao tác tùy theo loại khóa bạn chọn.'}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-3 sm:p-4 md:p-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              Hủy
            </Button>
              <Button
                type="submit"
                variant="danger"
                loading={loading}
                icon={<LockClosedIcon />}
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                {isTutor ? 'Khóa đăng nhập' : 'Khóa tài khoản'}
              </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
}

