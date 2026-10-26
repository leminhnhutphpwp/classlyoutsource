"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import InputGroup from "@/components/FormElements/InputGroup";
import DateInput from "@/components/FormElements/DateInput";
import SelectInput from "@/components/FormElements/SelectInput";
import { usePayment, useUpdatePayment } from "@/hooks/use-api";
import { useGoBack } from "@/hooks/use-go-back";
import { useAuthContext } from "@/contexts/auth-context";
import { useResourceGuard } from "@/lib/permission-guards";
import { ArrowLeftIcon, CalendarIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { useNotification } from "@/hooks/use-notification";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";

export default function EditPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const paymentId = params.id as string;
  const { user } = useAuthContext();
  const handleGoBack = useGoBack(`/payments/${paymentId}`);

  // All hooks must be called before any early returns
  const { data: payment, loading: paymentLoading, error: paymentError, permissions } = usePayment(paymentId);
  const { mutate: updatePayment, loading: updateLoading, error: updateError } = useUpdatePayment();
  const { success } = useNotification();

  // Use resource guard to protect this route (check after payment loads)
  const { hasAccess, isChecking } = useResourceGuard(
    user,
    'update',
    'payment',
    `/payments/${paymentId}`,
    {
      checkAfterLoad: true,
      loaded: !paymentLoading && !!payment,
    }
  );

  // All state hooks must be called before any early returns
  const [formData, setFormData] = useState({
    month: "",
    amount: "",
    payment_date: "",
    due_date: "",
    payment_method: "cash" as "cash" | "bank" | "other",
    status: "pending" as "paid" | "pending" | "failed" | "refunded",
    note: "",
  });

  // Format số tiền với dấu chấm phân cách hàng nghìn
  const formatAmount = (value: string): string => {
    // Loại bỏ tất cả ký tự không phải số
    const numericValue = value.replace(/[^\d]/g, '');
    if (!numericValue) return '';
    // Format với dấu chấm phân cách hàng nghìn
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  // Parse số tiền từ format có dấu chấm về số thuần
  const parseAmount = (value: string): string => {
    return value.replace(/\./g, '');
  };

  useEffect(() => {
    if (payment) {
      // Chặn chỉnh sửa nếu trạng thái là failed hoặc refunded
      if (payment.status === 'failed' || payment.status === 'refunded') {
        router.replace(`/payments/${paymentId}`);
        return;
      }

      // Format số tiền khi load từ API
      const amountValue = (payment.amount || 0).toString();
      const formattedAmount = formatAmount(amountValue);

      setFormData({
        month: payment.month || "",
        amount: formattedAmount,
        payment_date: payment.payment_date ? new Date(payment.payment_date).toISOString().split("T")[0] : "",
        due_date: payment.due_date ? new Date(payment.due_date).toISOString().split("T")[0] : "",
        payment_method: (payment.payment_method || "cash") as "cash" | "bank" | "other",
        status: (payment.status || "pending") as "paid" | "pending" | "failed" | "refunded",
        note: payment.note || payment.notes || "",
      });
    }
  }, [payment, paymentId, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // Format số tiền khi nhập vào field amount
    if (name === 'amount') {
      const formatted = formatAmount(value);
      setFormData(prev => ({ ...prev, [name]: formatted }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await updatePayment(paymentId, {
      month: formData.month || undefined,
      amount: formData.amount ? parseFloat(parseAmount(formData.amount)) : undefined,
      payment_date: formData.payment_date || undefined,
      due_date: formData.due_date || undefined,
      payment_method: formData.payment_method,
      status: formData.status,
      note: formData.note || undefined,
    });
    if (result.success) {
      success("Cập nhật thanh toán thành công");
      setTimeout(() => {
        router.push(`/payments/${paymentId}`);
      }, 500);
    }
  };

  // Show loading skeleton while loading or checking permissions
  if (paymentLoading || isChecking) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center gap-4">
          <div className="h-10 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="flex-1">
            <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-2" />
            <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
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
              <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="flex items-center gap-4">
              <div className="h-12 w-32 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-12 w-20 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (paymentError || !payment) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
        <h3 className="font-medium mb-2">Lỗi tải dữ liệu</h3>
        <p>{paymentError || "Không tìm thấy thanh toán"}</p>
      </div>
    );
  }

  // Check permissions from API response
  // Only check canManageFromApi if permissions exists (API returned permissions)
  // If permissions is undefined, rely only on hasAccess from useResourceGuard
  const canManageFromApi = permissions?.can_manage;
  if (!hasAccess || (permissions !== undefined && canManageFromApi === false)) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
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
        <div className="flex-1 w-full">
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white">Chỉnh sửa thanh toán</h1>
          <p className="text-sm sm:text-base text-dark-4 dark:text-dark-6 mt-1">Cập nhật thông tin thanh toán</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-800 space-y-6">
        {updateError && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {updateError}
          </div>
        )}

        {payment.invoice_number && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
              Số hóa đơn
            </label>
            <div className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
              #{payment.invoice_number}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Số hóa đơn được tự động tạo bởi hệ thống
            </p>
          </div>
        )}

        <InputGroup
          type="month"
          label="Tháng"
          placeholder=""
          name="month"
          value={formData.month}
          handleChange={handleChange}
          icon={<CalendarIcon />}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputGroup
            type="text"
            label="Số tiền (₫)"
            placeholder="Nhập số tiền"
            name="amount"
            value={formData.amount}
            handleChange={handleChange}
          />

          <DateInput
            label="Ngày thanh toán"
            placeholder="Chọn ngày"
            name="payment_date"
            value={formData.payment_date}
            onChange={handleChange}
            icon={<CalendarIcon />}
          />
        </div>

        <DateInput
          label="Hạn thanh toán"
          placeholder="Chọn ngày"
          name="due_date"
          value={formData.due_date}
          onChange={handleChange}
          icon={<CalendarIcon />}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectInput
            label="Phương thức thanh toán"
            name="payment_method"
            value={formData.payment_method}
            handleChange={handleChange}
            options={[
              { value: "cash", label: "Tiền mặt" },
              { value: "bank", label: "Chuyển khoản" },
              { value: "other", label: "Khác" },
            ]}
          />

          <SelectInput
            label="Trạng thái"
            name="status"
            value={formData.status}
            handleChange={handleChange}
            options={[
              { value: "pending", label: "Chờ thanh toán" },
              { value: "paid", label: "Đã thanh toán" },
              { value: "failed", label: "Thất bại" },
              { value: "refunded", label: "Đã hoàn tiền" },
            ]}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">Ghi chú</label>
          <textarea
            name="note"
            value={formData.note}
            onChange={handleChange}
            rows={4}
            placeholder="Nhập ghi chú (tùy chọn)"
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-primary"
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4">
          <Button
            type="submit"
            disabled={updateLoading}
            loading={updateLoading}
            size="sm"
            variant="primary"
            icon={<CheckCircleIcon />}
            className="w-full sm:w-auto justify-center"
          >
            Cập nhật
          </Button>
          <ButtonLink
            href={`/payments/${paymentId}`}
            variant="outline"
            size="sm"
            className="w-full sm:w-auto justify-center"
          >
            Hủy
          </ButtonLink>
        </div>
      </form>
    </div>
  );
}


