"use client";
import { useCallback, useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { ArrowLeftIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { usePaymentRequest } from "@/hooks/use-api";
import { useNotification } from "@/hooks/use-notification";
import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";

function PaymentRequestPayContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const paymentRequestId = params?.id as string;
  const paymentId = searchParams?.get('payment_id');
  const { success, error: showError } = useNotification();

  const { data: paymentRequestData, loading: loadingPaymentRequest } = usePaymentRequest(paymentRequestId);
  const request = paymentRequestData?.payment_request || paymentRequestData;

  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [bankTransactionId, setBankTransactionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingPaymentInfo, setLoadingPaymentInfo] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const hasCalledRef = useRef<string | null>(null);

  const fetchPaymentInfo = useCallback(async () => {
    if (!paymentId) {
      setError("Thiếu thông tin thanh toán");
      return;
    }

    setLoadingPaymentInfo(true);
    setError(null);

    try {
      // Get payment info - similar to deposit flow
      // We'll use the payment ID to get bank transfer info
      const response = await apiClient.getPayment(paymentId);

      if (response.success && response.data) {
        const payment = response.data.payment || response.data;

        // Get payment info endpoint (if available)
        // For now, we'll use a generic approach
        // In a real implementation, you might have a specific endpoint like:
        // /api/payments/{id}/payment-info

        // For now, we'll construct payment info from available data
        // This should be replaced with actual API call to get bank info
        setPaymentInfo({
          amount: payment.amount || request?.amount_per_student || 0,
          amount_formatted: payment.amount_formatted || formatCurrency(payment.amount || request?.amount_per_student || 0),
          payment_reference: payment.invoice_number || `PAY${paymentId}`,
          // These should come from backend payment info endpoint
          bank_name: "Ngân hàng ABC", // Placeholder
          bank_account_number: "1234567890", // Placeholder
          bank_account_holder: "Tên chủ tài khoản", // Placeholder
          bank_branch: "Chi nhánh", // Placeholder
          bank_transfer_instructions: "Vui lòng chuyển khoản đúng số tiền và nội dung. Sau khi chuyển khoản, vui lòng nhập mã giao dịch để xác nhận.",
        });
      } else {
        setError(response.message || "Không thể tải thông tin");
        if (hasCalledRef.current === paymentId) {
          hasCalledRef.current = null;
        }
      }
    } catch {
      setError("Có lỗi xảy ra khi tải thông tin");
      if (hasCalledRef.current === paymentId) {
        hasCalledRef.current = null;
      }
    } finally {
      setLoadingPaymentInfo(false);
    }
  }, [paymentId, request]);

  useEffect(() => {
    if (paymentId && !paymentInfo && hasCalledRef.current !== paymentId) {
      hasCalledRef.current = paymentId;
      fetchPaymentInfo();
    }
  }, [paymentId, paymentInfo, fetchPaymentInfo]);

  const handleConfirm = async () => {
    if (!bankTransactionId.trim()) {
      showError("Vui lòng nhập mã giao dịch chuyển khoản");
      return;
    }

    if (!paymentId) {
      showError("Thiếu thông tin");
      return;
    }

    setConfirmingPayment(true);

    try {
      // Update payment with transaction ID
      // In a real implementation, you might have a specific endpoint like:
      // /api/payments/{id}/confirm-bank-transfer
      const result = await apiClient.updatePayment(paymentId, {
        note: `Mã giao dịch: ${bankTransactionId.trim()}`,
        // Status will be updated by backend after admin approval
      });

      if (result.success) {
        success("Đã xác nhận chuyển khoản! Vui lòng chờ được duyệt.");
        router.push('/my-payments?tab=requests');
      } else {
        showError(result.message || "Không thể xác nhận đóng học phí");
      }
    } catch (error: any) {
      showError(error.message || "Có lỗi xảy ra khi xác nhận đóng học phí");
    } finally {
      setConfirmingPayment(false);
    }
  };

  if (loadingPaymentRequest) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-4 mx-auto" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}></div>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Đang tải thông tin...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-8">
            <ExclamationTriangleIcon className="h-12 w-12 text-primary-light mx-auto mb-2" />
            <p className="text-gray-500 dark:text-gray-400">Không tìm thấy đợt đóng học phí</p>
            <button
              onClick={() => router.back()}
              className="mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Quay lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Quay lại
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Xác nhận đóng học phí
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {request.period_name}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg">
          <div className="p-6 space-y-6">
            {/* Payment Request Info */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                {request.period_name}
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <div>Lớp: {request.class?.name || `Lớp học #${request.class_id}`}</div>
                {request.period_month && (
                  <div className="mt-1">Tháng: {request.period_month}</div>
                )}
              </div>
            </div>

            {/* Amount Info */}
            {paymentInfo?.amount && paymentInfo.amount > 0 && (
              <div className="bg-primary/10 dark:bg-primary/20 rounded-lg p-4">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Học phí cần đóng</div>
                <div className="text-3xl font-bold text-primary">
                  {paymentInfo.amount_formatted || formatCurrency(paymentInfo.amount)}
                </div>
              </div>
            )}

            {/* Payment Info */}
            {loadingPaymentInfo ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-4 mx-auto" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}></div>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Đang tải thông tin...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <ExclamationTriangleIcon className="h-12 w-12 text-primary-light mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400">{error}</p>
                <button
                  onClick={() => router.back()}
                  className="mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Quay lại
                </button>
              </div>
            ) : paymentInfo ? (
              <div className="space-y-6">
                {/* Bank Info */}
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Thông tin ngân hàng</h3>
                  <div className="space-y-2 text-sm">
                    {paymentInfo.bank_name && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Ngân hàng:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{paymentInfo.bank_name}</span>
                      </div>
                    )}
                    {paymentInfo.bank_account_number && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Số tài khoản:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{paymentInfo.bank_account_number}</span>
                      </div>
                    )}
                    {paymentInfo.bank_account_holder && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Chủ tài khoản:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{paymentInfo.bank_account_holder}</span>
                      </div>
                    )}
                    {paymentInfo.bank_branch && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Chi nhánh:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{paymentInfo.bank_branch}</span>
                      </div>
                    )}
                    {paymentInfo.payment_reference && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Nội dung CK:</span>
                        <span className="font-medium text-primary">{paymentInfo.payment_reference}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Instructions */}
                {paymentInfo.bank_transfer_instructions && (
                  <div className="rounded-lg bg-primary-pastel/40 p-4">
                    <h3 className="font-semibold text-primary mb-2">Hướng dẫn</h3>
                    <div className="text-sm text-primary whitespace-pre-line">
                      {paymentInfo.bank_transfer_instructions}
                    </div>
                  </div>
                )}

                {/* Transaction ID Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Mã giao dịch chuyển khoản <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={bankTransactionId}
                    onChange={(e) => setBankTransactionId(e.target.value)}
                    placeholder="Nhập mã giao dịch từ ngân hàng (VD: TT123456789)"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={confirmingPayment}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Mã giao dịch được hiển thị trên lịch sử giao dịch ngân hàng của bạn
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => router.back()}
                    disabled={confirmingPayment}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={confirmingPayment || !bankTransactionId.trim()}
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {confirmingPayment ? 'Đang xử lý...' : 'Xác nhận đã chuyển khoản'}
                  </button>
                </div>

                {/* Warning */}
                <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                    ⚠️ Sau khi xác nhận, yêu cầu sẽ chờ được duyệt. Bạn sẽ được thông báo khi được duyệt.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentRequestPayPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
      </div>
    }>
      <PaymentRequestPayContent />
    </Suspense>
  );
}

