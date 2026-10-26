"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { BanknotesIcon, XMarkIcon } from "@heroicons/react/24/outline";
import {
  useChildTuition,
  createParentPaymentIntent,
  type PendingTuition,
  type PaymentIntent,
} from "@/hooks/use-api/family";
import { formatCurrency } from "@/lib/format-currency";
import PaymentQRCode from "@/components/Common/PaymentQRCode";
import { useNotification } from "@/hooks/use-notification";
import { formatDate } from "../_components/ResourceView";
import { CardSkeleton } from "@/components/ui/loading";

export default function ChildTuitionPage() {
  const params = useParams();
  const studentId = params?.studentId as string;
  const { success, error: showError } = useNotification();

  const { data, loading, error, refetch } = useChildTuition(studentId);

  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  const handlePay = async (payment: PendingTuition) => {
    setPayingId(payment.id);
    try {
      const result = await createParentPaymentIntent(payment.id);
      setIntent(result);
    } catch (e) {
      showError("Không thể tạo lệnh thanh toán", e instanceof Error ? e.message : "Vui lòng thử lại.");
    } finally {
      setPayingId(null);
    }
  };

  const outstanding = data?.outstanding_total ?? 0;
  const pending = data?.pending ?? [];

  if (loading) {
    return (
      <div className="space-y-4">
        <CardSkeleton lines={2} showActions />
        <CardSkeleton lines={3} />
        <CardSkeleton lines={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center dark:bg-gray-800">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Không thể tải học phí</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{error}</p>
        <button
          onClick={() => refetch()}
          className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-opacity-90"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Outstanding summary */}
      <div className="rounded-2xl bg-white p-6 dark:bg-gray-800">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-primary-pastel/50 p-3 text-primary">
            <BanknotesIcon className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Tổng học phí còn nợ</p>
            <p
              className={`text-2xl font-bold ${
                outstanding > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
              }`}
            >
              {formatCurrency(outstanding)}
            </p>
          </div>
        </div>
      </div>

      {/* Pending list */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Các khoản cần đóng</h2>

        {pending.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center dark:bg-gray-800">
            <BanknotesIcon className="mx-auto h-14 w-14 text-gray-300 dark:text-gray-600" />
            <p className="mt-4 text-sm font-semibold text-gray-900 dark:text-white">
              Không còn khoản học phí nào cần đóng
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Cảm ơn bạn đã hoàn tất học phí cho học viên.
            </p>
          </div>
        ) : (
          pending.map((payment) => (
            <div
              key={payment.id}
              className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white">
                  {payment.class_name || payment.month || "Học phí"}
                </p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {payment.month ? `Kỳ: ${payment.month}` : null}
                  {payment.due_date ? `${payment.month ? " · " : ""}Hạn: ${formatDate(payment.due_date)}` : null}
                </p>
                {payment.reference_code && (
                  <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                    Mã: {payment.reference_code}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatCurrency(payment.amount)}
                </span>
                <button
                  onClick={() => handlePay(payment)}
                  disabled={payingId === payment.id}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {payingId === payment.id ? "Đang xử lý..." : "Thanh toán"}
                  {payingId === payment.id && (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent" />
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Payment intent modal */}
      {intent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 dark:bg-gray-800">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Chuyển khoản học phí</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Số tiền: <span className="font-semibold">{formatCurrency(intent.amount)}</span>
                </p>
              </div>
              <button
                onClick={() => setIntent(null)}
                className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                aria-label="Đóng"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {intent.bank ? (
              <PaymentQRCode
                amount={intent.amount}
                content={intent.transfer_content}
                qrUrl={intent.bank.qr_code_url ?? undefined}
                bankInfo={{
                  bank_name: intent.bank.bank_name,
                  account_number: intent.bank.account_number,
                  account_name: intent.bank.account_holder ?? intent.bank.account_name,
                  branch: intent.bank.branch ?? undefined,
                  instructions: intent.bank.instructions ?? undefined,
                  transfer_content: intent.transfer_content,
                }}
                onCopySuccess={(m) => success(m)}
                onCopyError={(m) => showError(m)}
              />
            ) : (
              <div className="space-y-3 rounded-lg bg-primary-pastel/20 p-4 dark:bg-primary/10">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Trung tâm chưa cấu hình tài khoản ngân hàng. Vui lòng liên hệ trung tâm
                  và sử dụng mã tham chiếu dưới đây khi thanh toán.
                </p>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Mã tham chiếu</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{intent.reference_code}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Nội dung chuyển khoản</p>
                  <p className="font-semibold text-gray-900 dark:text-white break-all">{intent.transfer_content}</p>
                </div>
              </div>
            )}

            {intent.note && (
              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">{intent.note}</p>
            )}

            <div className="mt-6 rounded-lg bg-gray-50 p-3 text-xs text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
              Sau khi chuyển khoản, giáo viên sẽ xác nhận và cập nhật trạng thái học phí. Bạn có thể tải lại trang để
              kiểm tra.
            </div>

            <button
              onClick={() => {
                setIntent(null);
                refetch();
              }}
              className="mt-4 w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700/50"
            >
              Đã chuyển khoản
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
