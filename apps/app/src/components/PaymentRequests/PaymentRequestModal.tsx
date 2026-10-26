"use client";
import { createPortal } from "react-dom";
import { XMarkIcon, CalendarIcon, AcademicCapIcon, CurrencyDollarIcon, DocumentTextIcon, ArrowRightIcon, CheckCircleIcon, ArrowLeftIcon, BuildingLibraryIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@/lib/format-currency";
import Button from "@/components/Common/Button";
import { useEffect, useState } from "react";

type PaymentRequest = {
  id: string;
  class_id: string;
  period_name: string;
  period_month?: string;
  amount_per_student: number;
  amount_per_student_formatted?: string;
  due_date: string;
  description?: string;
  status: "pending" | "active" | "cancelled";
  status_label?: string;
  class?: {
    id: string;
    name: string;
  };
};

type PaymentRequestModalProps = {
  request: PaymentRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  loading?: boolean;
};

export default function PaymentRequestModal({
  request,
  isOpen,
  onClose,
  onConfirm,
  loading = false,
}: PaymentRequestModalProps) {
  const [step, setStep] = useState<1 | 2>(1);

  // Disable scroll when modal is open and reset step
  useEffect(() => {
    if (isOpen) {
      const previousBodyOverflow = document.body.style.overflow;
      const previousHtmlOverflow = document.documentElement.style.overflow;

      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      setStep(1); // Reset to step 1 when modal opens

      // Cleanup: restore scroll when component unmounts or modal closes
      return () => {
        document.body.style.overflow = previousBodyOverflow || '';
        document.documentElement.style.overflow = previousHtmlOverflow || '';
      };
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
  }, [isOpen]);

  if (!isOpen || !request) return null;

  const dueDate = request.due_date ? new Date(request.due_date) : null;
  const isOverdue = dueDate && dueDate < new Date() && request.status === "active";

  const handleContinue = () => {
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleConfirm = async () => {
    await onConfirm();
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto rounded-lg bg-white p-4 sm:p-6 shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Đóng học phí {step === 2 && <span className="text-sm font-normal text-gray-500">(Bước 2/2)</span>}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-center gap-2">
            <div className={`flex items-center ${step >= 1 ? 'text-primary' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${step >= 1 ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'}`}>
                {step > 1 ? <CheckCircleIcon className="h-5 w-5" /> : '1'}
              </div>
              <span className="hidden sm:inline-block sm:ml-2 text-sm font-medium whitespace-nowrap sm:min-w-[140px] text-left">Thông tin học phí</span>
            </div>
            <div className={`w-12 h-0.5 shrink-0 ${step >= 2 ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`} />
            <div className={`flex items-center ${step >= 2 ? 'text-primary' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${step >= 2 ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'}`}>
                2
              </div>
              <span className="hidden sm:inline-block sm:ml-2 text-sm font-medium whitespace-nowrap sm:min-w-[160px] text-left">Phương thức thanh toán</span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Step 1: Thông tin học phí */}
          {step === 1 && (
            <>
              {/* Period Name */}
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Tên đợt
                </label>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {request.period_name}
                </p>
              </div>

              {/* Class Info */}
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-2">
                  <AcademicCapIcon className="h-4 w-4" />
                  Lớp học
                </label>
                <p className="text-gray-900 dark:text-white font-medium">
                  {request.class?.name || `Lớp học #${request.class_id}`}
                </p>
              </div>

              {/* Amount */}
              <div className="bg-primary-pastel/30 dark:bg-primary/10 rounded-lg p-4">
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-2">
                  <CurrencyDollarIcon className="h-4 w-4" />
                  Học phí cần đóng
                </label>
                <p className="text-3xl font-bold text-primary dark:text-primary-light">
                  {request.amount_per_student_formatted || formatCurrency(request.amount_per_student)}
                </p>
              </div>

              {/* Due Date */}
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Hạn đóng
                </label>
                <p className={`text-gray-900 dark:text-white font-medium ${isOverdue ? 'text-primary dark:text-primary-light' : ''}`}>
                  {dueDate ? dueDate.toLocaleDateString("vi-VN", {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : "Chưa có"}
                  {isOverdue && " (Quá hạn)"}
                </p>
              </div>

              {/* Period Month */}
              {request.period_month && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Tháng/Kỳ
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {request.period_month}
                  </p>
                </div>
              )}

              {/* Description */}
              {request.description && (
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-2">
                    <DocumentTextIcon className="h-4 w-4" />
                    Mô tả
                  </label>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {request.description}
                  </p>
                </div>
              )}

              {/* Warning for overdue */}
              {isOverdue && (
                <div className="rounded-lg bg-primary-pastel dark:bg-primary/20 border border-primary/30 dark:border-primary/40 p-3">
                  <p className="text-sm font-semibold text-primary dark:text-primary-light flex items-center gap-1.5">
                    Đã quá hạn đóng học phí
                  </p>
                  <p className="text-xs text-primary/80 dark:text-primary-light/80 mt-1">
                    Vui lòng liên hệ giáo viên để được hỗ trợ nếu cần.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  onClick={handleContinue}
                  variant="primary"
                  size="sm"
                  icon={<ArrowRightIcon className="h-5 w-5" />}
                  className="flex-1"
                >
                  Tiếp tục
                </Button>
                <Button
                  onClick={onClose}
                  variant="outline"
                  size="sm"
                >
                  Hủy
                </Button>
              </div>
            </>
          )}

          {/* Step 2: Phương thức thanh toán */}
          {step === 2 && (
            <>
              {/* Amount Info */}
              <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-4">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Số tiền cần đóng</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {request.amount_per_student_formatted || formatCurrency(request.amount_per_student)}
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Phương thức thanh toán <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col p-4 rounded-lg border-2 border-primary bg-primary-pastel/20 dark:bg-primary/10">
                    <div className="flex items-start gap-3">
                      <BuildingLibraryIcon className="h-5 w-5 mt-0.5 text-primary" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            Chuyển khoản ngân hàng
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Chuyển khoản trực tiếp vào tài khoản ngân hàng
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="rounded-lg bg-primary-pastel/40 p-4">
                <p className="text-sm font-medium text-primary mb-2">
                  Hướng dẫn đóng học phí:
                </p>
                <ul className="text-xs text-primary space-y-1 list-disc list-inside">
                  <li>Sau khi xác nhận, bạn sẽ nhận được thông tin chuyển khoản</li>
                  <li>Vui lòng chuyển khoản đúng số tiền và nội dung</li>
                  <li>Sau khi chuyển khoản, vui lòng xác nhận mã giao dịch</li>
                  <li>Hệ thống sẽ tự động cập nhật trạng thái sau khi được duyệt</li>
                </ul>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  onClick={handleBack}
                  variant="outline"
                  size="sm"
                  icon={<ArrowLeftIcon className="h-5 w-5" />}
                >
                  Quay lại
                </Button>
                <Button
                  onClick={handleConfirm}
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  icon={<CheckCircleIcon className="h-5 w-5" />}
                  loading={loading}
                >
                  Xác nhận đóng học phí
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;

  return createPortal(modalContent, document.body);
}

