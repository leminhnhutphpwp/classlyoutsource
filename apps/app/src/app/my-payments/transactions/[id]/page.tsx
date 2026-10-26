"use client";
import { useEffect } from "react";
import { useParams } from "next/navigation";
import { usePayment } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { ArrowLeftIcon, BuildingLibraryIcon } from "@heroicons/react/24/outline";
import ButtonLink from "@/components/Common/ButtonLink";
import Button from "@/components/Common/Button";
import { useNotification } from "@/hooks/use-notification";
import { formatCurrency } from "@/lib/format-currency";
import PaymentQRCode from "@/components/Common/PaymentQRCode";
import { getObjId } from "@/lib/id-utils";
import { CardSkeleton } from "@/components/ui/loading";

export default function StudentPaymentTransactionDetailPage() {
  const params = useParams();
  const transactionId = params?.id as string;
  const handleGoBack = useGoBack('/my-payments');

  const { data: transactionData, loading, error } = usePayment(transactionId);
  // Support both data structures (direct object or nested in data)
  const transaction = transactionData?.data || transactionData;

  const { success: showSuccess, error: showError } = useNotification();

  // Manual payment: No polling needed as per user request.
  // Student transfers manually and waits for tutor confirmation.

  // Handle successful payment redirection/notification if needed
  useEffect(() => {
    if (transaction?.status === 'paid') {
      // Optional: You could redirect back to list after a delay, 
      // but letting user see the success state here is better.
    }
  }, [transaction?.status]);


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
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
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">Chi tiết thanh toán</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 break-words">
              Thông tin chi tiết về khoản thanh toán học phí
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="rounded-lg bg-white dark:bg-gray-800">
        {loading ? (
          <div className="p-6 space-y-4">
            <CardSkeleton lines={2} />
            <CardSkeleton lines={3} />
          </div>
        ) : error || !transaction ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">Không tìm thấy thông tin giao dịch</p>
            <div className="mt-4">
              <ButtonLink
                href="/my-payments"
                variant="outline"
                size="sm"
              >
                Quay lại danh sách
              </ButtonLink>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6">

            {/* Transaction Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Mã thanh toán</p>
                <p className="text-base font-medium text-gray-900 dark:text-white">
                  {transaction.payment_code || (transaction.invoice_number ? `#${transaction.invoice_number}` : `#${getObjId(transaction)}`)}
                </p>
              </div>
              {transaction.reference_code && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Mã tham chiếu</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">
                    {transaction.reference_code}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Kỳ học phí</p>
                <p className="text-base font-medium text-gray-900 dark:text-white">
                  {transaction.month ? `Tháng ${transaction.month}` : (transaction.payment_request?.period_name || 'Học phí')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Số tiền</p>
                <p className="text-lg font-semibold text-primary">
                  {transaction.amount_formatted || formatCurrency(transaction.amount || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Trạng thái</p>
                <div>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${transaction.status === 'paid'
                    ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-200'
                    : transaction.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-200'
                      : transaction.status === 'failed'
                        ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                    {transaction.status_label ||
                      (transaction.status === 'paid' ? 'Đã thanh toán' :
                        transaction.status === 'pending' ? 'Chờ thanh toán' :
                          transaction.status === 'failed' ? 'Thất bại' : transaction.status)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Method */}
            {transaction.payment_method && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Phương thức thanh toán</p>
                <p className="text-base font-medium text-gray-900 dark:text-white">
                  {transaction.payment_method_label || (transaction.payment_method === 'bank' ? 'Chuyển khoản ngân hàng' : transaction.payment_method)}
                </p>
              </div>
            )}

            {/* Bank Transfer Info — shown for every pending payment. If the center has not
                configured a bank account, show the reference code as a fallback so the
                student still knows what to quote when paying. */}
            {transaction.status === 'pending' && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <BuildingLibraryIcon className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Thông tin chuyển khoản</h3>
                </div>

                {(transaction.bank_info || transaction.bank_transfer_info) ? (
                  <>
                    <div className="mb-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-200 border border-blue-100 dark:border-blue-800">
                      <p className="font-semibold mb-1">Hướng dẫn thanh toán:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Vui lòng chuyển khoản chính xác số tiền theo thông tin bên dưới.</li>
                        <li>Sau khi chuyển khoản, vui lòng chờ trung tâm xác nhận (thường mất vài giờ).</li>
                        <li>Bạn không cần thao tác gì thêm trên hệ thống này.</li>
                      </ul>
                    </div>

                    {/* Use either bank_info (from student API) or bank_transfer_info (standardized) */}
                    <PaymentQRCode
                      bankInfo={transaction.bank_info || transaction.bank_transfer_info}
                      qrUrl={transaction.bank_info?.qr_code_url || transaction.bank_transfer_info?.qr_code_url || transaction.qr_code_url}
                      amount={transaction.amount}
                      content={transaction.qr_code_content}
                      onCopySuccess={showSuccess}
                      onCopyError={showError}
                    />
                  </>
                ) : (
                  <div className="space-y-3 rounded-lg bg-primary-pastel/20 p-4 dark:bg-primary/10">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Trung tâm chưa cấu hình tài khoản ngân hàng. Vui lòng liên hệ trung tâm
                      và sử dụng mã tham chiếu dưới đây khi thanh toán.
                    </p>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Mã tham chiếu</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {transaction.reference_code || `#${getObjId(transaction)}`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Note */}
            {transaction.note && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Ghi chú</p>
                <p className="text-base text-gray-900 dark:text-white">{transaction.note}</p>
              </div>
            )}

            {/* Timestamps */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Thời gian</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Ngày tạo</p>
                  <p className="text-base text-gray-900 dark:text-white">
                    {transaction.created_at ? new Date(transaction.created_at).toLocaleString('vi-VN') : '-'}
                  </p>
                </div>
                {transaction.paid_at && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Ngày thanh toán</p>
                    <p className="text-base text-gray-900 dark:text-white">
                      {new Date(transaction.paid_at).toLocaleString('vi-VN')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
