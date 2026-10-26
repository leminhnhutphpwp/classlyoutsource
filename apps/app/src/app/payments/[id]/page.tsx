"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { usePayment, useDeletePayment, useApprovePayment, useRejectPayment, useRefundPayment, useMarkPaymentFailed } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { useAuthorization, isStudent } from "@/lib/authz";
import { useNotification } from "@/hooks/use-notification";
import { formatCurrency } from "@/lib/format-currency";
import {
  ArrowLeftIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  PencilIcon,
  TrashIcon,
  DocumentTextIcon,
  CreditCardIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
  XMarkIcon,
  ArrowPathIcon,
  InformationCircleIcon
} from "@heroicons/react/24/outline";
import ConfirmDeleteDialog from '@/components/Common/ConfirmDeleteDialog';
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import { TextAreaGroup } from "@/components/FormElements/InputGroup/text-area";
import InputGroup from "@/components/FormElements/InputGroup";
import ErrorDisplay from "@/components/Common/ErrorDisplay";

export default function PaymentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { success, error: showError } = useNotification();
  const paymentId = params.id as string;
  const { can, user } = useAuthorization();
  const { data: payment, loading, error, refetch } = usePayment(paymentId);
  const handleGoBack = useGoBack('/payments');

  // Action hooks
  const { mutate: deletePayment, loading: deleting } = useDeletePayment();
  const { mutate: approvePayment, loading: approving } = useApprovePayment();
  const { mutate: rejectPayment, loading: rejecting } = useRejectPayment();
  const { mutate: refundPayment, loading: refunding } = useRefundPayment();
  const { mutate: markPaymentFailed, loading: markingFailed } = useMarkPaymentFailed();

  // Dialog/Modal states
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionModal, setActionModal] = useState<{
    type: 'approve' | 'reject' | 'refund' | 'mark-failed' | null;
    paymentId: string | null;
    payment: any | null;
  }>({ type: null, paymentId: null, payment: null });
  const [reason, setReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");

  const isTutor = user?.role === 'tutor' || user?.role === 'admin' || user?.role === 'super_admin';

  // Action handlers
  const handleApprove = async () => {
    if (!paymentId) return;
    const result = await approvePayment({ id: paymentId, note: reason || undefined });
    if (result.success) {
      success("Đã duyệt thanh toán thành công");
      closeActionModal();
      refetch();
    } else {
      showError(result.message || "Không thể duyệt thanh toán");
    }
  };

  const handleReject = async () => {
    if (!paymentId || !reason.trim()) {
      showError("Vui lòng nhập lý do từ chối");
      return;
    }
    const result = await rejectPayment({ id: paymentId, reason: reason.trim() });
    if (result.success) {
      success("Đã từ chối thanh toán thành công");
      closeActionModal();
      refetch();
    } else {
      showError(result.message || "Không thể từ chối thanh toán");
    }
  };

  const handleRefund = async () => {
    if (!paymentId || !reason.trim()) {
      showError("Vui lòng nhập lý do hoàn tiền");
      return;
    }
    const paymentAmount = typeof payment?.amount === 'number' ? payment.amount : parseFloat(payment?.amount || '0') || 0;
    const refundAmountNum = refundAmount ? parseFloat(refundAmount.replace(/[^\d]/g, '')) : undefined;

    if (refundAmountNum !== undefined && (isNaN(refundAmountNum) || refundAmountNum <= 0 || refundAmountNum > paymentAmount)) {
      showError("Số tiền hoàn không hợp lệ");
      return;
    }

    const result = await refundPayment({ id: paymentId, reason: reason.trim(), refund_amount: refundAmountNum });
    if (result.success) {
      success("Đã ghi nhận hoàn tiền thành công");
      closeActionModal();
      refetch();
    } else {
      showError(result.message || "Không thể ghi nhận hoàn tiền");
    }
  };

  const handleMarkFailed = async () => {
    if (!paymentId || !reason.trim()) {
      showError("Vui lòng nhập lý do thất bại");
      return;
    }
    const result = await markPaymentFailed({ id: paymentId, reason: reason.trim() });
    if (result.success) {
      success("Đã đánh dấu thanh toán thất bại thành công");
      closeActionModal();
      refetch();
    } else {
      showError(result.message || "Không thể đánh dấu thất bại");
    }
  };

  const openActionModal = (type: 'approve' | 'reject' | 'refund' | 'mark-failed') => {
    setActionModal({ type, paymentId, payment });
    setReason("");
    setRefundAmount("");
  };

  const closeActionModal = () => {
    setActionModal({ type: null, paymentId: null, payment: null });
    setReason("");
    setRefundAmount("");
  };

  // Lock body scroll when modal is open
  useEffect(() => {
    if (actionModal.type) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [actionModal.type]);

  if (typeof window !== "undefined") {
    // Students should not access tutor payments screen directly
    if (isStudent(user)) {
      router.replace("/my-payments");
      return null;
    }

    if (!(can("view", "payment") || can("view_any", "payment"))) {
      router.replace("/403");
      return null;
    }
  }

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
          <div className="flex gap-2">
            <div className="h-10 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-10 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
              <div className="space-y-4">
                <div className="h-6 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                      <div className="h-6 w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
              <div className="space-y-4">
                <div className="h-6 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-20 w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !loading) {
    return <ErrorDisplay error={error} title="Lỗi tải dữ liệu thanh toán" onRetry={() => refetch()} />;
  }


  // Get status info with theme-based status badge styles
  const getStatusInfo = () => {
    const label = payment.status_label || (() => {
      switch (payment.status) {
        case 'paid': return 'Đã thanh toán';
        case 'pending': return 'Chờ thanh toán';
        case 'failed': return 'Thất bại';
        case 'refunded': return 'Đã hoàn tiền';
        default: return payment.status || 'N/A';
      }
    })();

    switch (payment.status) {
      case 'paid':
        return {
          label,
          badgeClass: 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]',
          icon: CheckCircleIcon
        };
      case 'pending':
        return {
          label,
          badgeClass: 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]',
          icon: ClockIcon
        };
      case 'failed':
        return {
          label,
          badgeClass: 'bg-[var(--status-badge-error)] text-[var(--status-badge-error-text)]',
          icon: XCircleIcon
        };
      case 'refunded':
        return {
          label,
          badgeClass: 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]',
          icon: ArrowLeftIcon
        };
      default:
        return {
          label,
          badgeClass: 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]',
          icon: ClockIcon
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  const getPaymentMethodLabel = (method: string, methodLabel?: string) => {
    if (methodLabel) {
      return `${methodLabel}`;
    }

    switch (method) {
      case 'cash': return 'Tiền mặt';
      case 'bank': return 'Chuyển khoản';
      case 'other': return 'Khác';
      default: return method || 'N/A';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <ConfirmDeleteDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          const res = await deletePayment(paymentId);
          if (res.success) router.push('/payments');
        }}
        loading={deleting}
        message="Bạn có chắc chắn muốn xóa thanh toán này? Hành động không thể hoàn tác."
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
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white truncate break-words">
            Chi tiết thanh toán
          </h1>
          {payment.invoice_number && (
            <p className="text-sm sm:text-base text-dark-4 dark:text-dark-6 mt-1 break-words">
              Hóa đơn #{payment.invoice_number}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          {isTutor && payment.status === 'pending' && (
            <>
              <Button
                onClick={() => openActionModal('approve')}
                variant="primary"
                size="sm"
                icon={<CheckCircleIcon />}
                className="flex-1 sm:flex-none justify-center"
              >
                Duyệt
              </Button>
              <Button
                onClick={() => openActionModal('reject')}
                variant="danger"
                size="sm"
                icon={<XCircleIcon />}
                className="flex-1 sm:flex-none justify-center"
              >
                Từ chối
              </Button>
            </>
          )}

          {isTutor && payment.status === 'paid' && (
            <>
              <Button
                onClick={() => openActionModal('refund')}
                variant="outline"
                size="sm"
                icon={<ArrowPathIcon />}
                className="flex-1 sm:flex-none justify-center text-primary"
              >
                Hoàn tiền
              </Button>
              <Button
                onClick={() => openActionModal('mark-failed')}
                variant="outline"
                size="sm"
                icon={<XCircleIcon />}
                className="flex-1 sm:flex-none justify-center text-red-600"
              >
                Thất bại
              </Button>
            </>
          )}

          <ButtonLink
            href={`/payments/${paymentId}/edit`}
            variant="outline"
            size="sm"
            icon={<PencilIcon />}
            className="flex-1 sm:flex-none justify-center"
            disabled={!can("update", "payment") || payment.status === 'failed' || payment.status === 'refunded'}
          >
            Chỉnh sửa
          </ButtonLink>
          <Button
            onClick={() => setConfirmDelete(true)}
            variant="danger"
            size="sm"
            icon={<TrashIcon />}
            className="flex-1 sm:flex-none justify-center"
            disabled={!can("delete", "payment")}
          >
            Xóa
          </Button>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <span className={`inline-flex items-center px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium ${statusInfo.badgeClass}`}>
          <StatusIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
          {statusInfo.label}
        </span>
        <span className="inline-flex items-center px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
          <CreditCardIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
          {getPaymentMethodLabel(payment.payment_method, payment.payment_method_label)}
        </span>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Payment Information */}
          <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">
              Thông tin thanh toán
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Số tiền
                </label>
                <p className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white break-words">
                  {payment.amount_formatted || new Intl.NumberFormat('vi-VN', {
                    style: 'currency',
                    currency: 'VND',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                  }).format(payment.amount || 0)}
                </p>
              </div>

              {payment.invoice_number && (
                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-2">
                    <DocumentTextIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                    Số hóa đơn
                  </label>
                  <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-words">
                    #{payment.invoice_number}
                  </p>
                </div>
              )}

              {payment.reference_code && (
                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-2">
                    <DocumentTextIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                    Mã tham chiếu
                  </label>
                  <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-words">
                    {payment.reference_code}
                  </p>
                </div>
              )}

              {payment.month && (
                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-2">
                    <CalendarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                    Tháng
                  </label>
                  <p className="text-sm sm:text-base text-gray-900 dark:text-white break-words">
                    {payment.month}
                  </p>
                </div>
              )}

              {payment.payment_date && (
                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-2">
                    <CalendarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                    Ngày thanh toán
                  </label>
                  <p className="text-sm sm:text-base text-gray-900 dark:text-white break-words">
                    {new Date(payment.payment_date).toLocaleDateString('vi-VN', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              )}

              {payment.due_date && (
                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-2">
                    <ClockIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                    Hạn thanh toán
                  </label>
                  <p className="text-sm sm:text-base text-gray-900 dark:text-white break-words">
                    {new Date(payment.due_date).toLocaleDateString('vi-VN', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              )}
            </div>

            {(payment.note || payment.notes) && (
              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-200 dark:border-gray-700">
                <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Ghi chú
                </label>
                <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                  {payment.note || payment.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-4 sm:space-y-6">
          {/* Student Info */}
          {payment.student && (
            <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center gap-2">
                <UserIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                Học viên
              </h3>
              <div className="space-y-2.5 sm:space-y-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Tên học viên
                  </label>
                  <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-words">
                    {payment.student.name || 'N/A'}
                  </p>
                </div>
                {payment.student.email && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Email
                    </label>
                    <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 break-words">
                      {payment.student.email}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Meta Information */}
          <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
              Thông tin hệ thống
            </h3>
            <div className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">
                  Ngày tạo
                </label>
                <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 break-words">
                  {new Date(payment.created_at).toLocaleDateString('vi-VN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              {payment.updated_at && payment.updated_at !== payment.created_at && (
                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">
                    Cập nhật lần cuối
                  </label>
                  <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 break-words">
                    {new Date(payment.updated_at).toLocaleDateString('vi-VN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Modals */}
      {actionModal.type && actionModal.payment &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={closeActionModal} role="dialog" aria-modal="true">
            <div className="max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800 border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {actionModal.type === 'approve' && 'Duyệt thanh toán'}
                  {actionModal.type === 'reject' && 'Từ chối thanh toán'}
                  {actionModal.type === 'refund' && 'Ghi nhận hoàn tiền'}
                  {actionModal.type === 'mark-failed' && 'Đánh dấu thất bại'}
                </h2>
                <div className="flex items-center gap-2">
                  {actionModal.type === 'refund' && (
                    <div className="relative group">
                      <InformationCircleIcon className="h-5 w-5 text-primary cursor-help" />
                      <div className="absolute right-0 top-full mt-2 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 pointer-events-none">
                        <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900 rotate-45"></div>
                        <p className="font-medium mb-2">⚠️ Lưu ý quan trọng:</p>
                        <ul className="space-y-1 list-disc list-inside text-gray-200">
                          <li>Hành động này chỉ <strong>ghi nhận</strong> việc hoàn tiền, không chuyển tiền thực tế</li>
                          <li>Việc trả tiền thực tế diễn ra bên ngoài hệ thống (chuyển khoản ngân hàng, tiền mặt, v.v.)</li>
                          <li>Trạng thái sẽ chuyển từ &quot;Đã thanh toán&quot; sang &quot;Đã hoàn tiền&quot;</li>
                        </ul>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={closeActionModal}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-4 border border-gray-100 dark:border-gray-600">
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold tracking-wider mb-1">Học viên</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {actionModal.payment.student?.name || 'N/A'}
                  </div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Số tiền: {actionModal.payment.amount_formatted || formatCurrency(actionModal.payment.amount || 0)}
                  </div>
                </div>

                {actionModal.type === 'approve' && (
                  <TextAreaGroup
                    label="Ghi chú (tùy chọn)"
                    name="note"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Nhập ghi chú hoặc lời nhắn cho phụ huynh/học viên..."
                    rows={3}
                  />
                )}

                {(actionModal.type === 'reject' || actionModal.type === 'mark-failed') && (
                  <TextAreaGroup
                    label="Lý do"
                    name="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Tại sao bạn từ chối hoặc đánh dấu thất bại thanh toán này?"
                    rows={3}
                    required
                  />
                )}

                {actionModal.type === 'refund' && (
                  <>
                    <InputGroup
                      type="text"
                      label="Số tiền hoàn (chỉ để tham khảo)"
                      name="refund_amount"
                      value={refundAmount}
                      handleChange={(e) => {
                        const numericValue = e.target.value.replace(/[^\d]/g, '');
                        if (!numericValue) { setRefundAmount(''); return; }
                        const numValue = parseFloat(numericValue) || 0;
                        const paymentAmount = typeof actionModal.payment?.amount === 'number' ? actionModal.payment.amount : parseFloat(actionModal.payment?.amount || '0') || 0;
                        if (numValue > paymentAmount) {
                          setRefundAmount(paymentAmount.toLocaleString('vi-VN'));
                        } else {
                          setRefundAmount(numValue.toLocaleString('vi-VN'));
                        }
                      }}
                      placeholder={`Tối đa: ${formatCurrency(typeof actionModal.payment?.amount === 'number' ? actionModal.payment.amount : parseFloat(actionModal.payment?.amount || '0') || 0)}`}
                      icon={<CurrencyDollarIcon />}
                    />
                    <TextAreaGroup
                      label="Lý do hoàn tiền"
                      name="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Lý do hoàn lại tiền cho học viên..."
                      rows={3}
                      required
                    />
                  </>
                )}

                <div className="flex items-center gap-3 pt-4 justify-end">
                  <Button
                    onClick={closeActionModal}
                    variant="outline"
                    size="sm"
                    disabled={approving || rejecting || refunding || markingFailed}
                  >
                    Hủy
                  </Button>
                  <Button
                    onClick={() => {
                      if (actionModal.type === 'approve') handleApprove();
                      else if (actionModal.type === 'reject') handleReject();
                      else if (actionModal.type === 'refund') handleRefund();
                      else if (actionModal.type === 'mark-failed') handleMarkFailed();
                    }}
                    variant={actionModal.type === 'reject' || actionModal.type === 'mark-failed' ? 'danger' : 'primary'}
                    size="sm"
                    loading={approving || rejecting || refunding || markingFailed}
                    icon={actionModal.type === 'approve' ? <CheckCircleIcon /> : actionModal.type === 'refund' ? <ArrowPathIcon /> : <XCircleIcon />}
                  >
                    Xác nhận {actionModal.type === 'approve' ? 'duyệt' : actionModal.type === 'reject' ? 'từ chối' : actionModal.type === 'refund' ? 'hoàn tiền' : 'thất bại'}
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      }
    </div>
  );
}


