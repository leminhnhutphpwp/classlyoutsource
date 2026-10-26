"use client";
import { useEffect, useState, useMemo } from "react";
import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import { getObjId, idsEqual } from "@/lib/id-utils";
import { CalendarIcon, AcademicCapIcon, BanknotesIcon } from "@heroicons/react/24/outline";
import Button from "@/components/Common/Button";

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
  statistics?: {
    total_students: number;
    paid_students: number;
    unpaid_students: number;
    total_expected: number;
    total_collected: number;
    total_pending: number;
    total_debt: number;
    is_fully_paid: boolean;
    is_overdue: boolean;
    completion_rate: number;
  };
  class?: {
    id: string;
    name: string;
  };
};

type StudentPaymentRequestsListProps = {
  classIds: string[];
  selectedClassId?: string | "all";
  studentClasses?: Array<{ id: string; name: string; class_id?: string }>;
  studentPayments?: Array<any>;
  onPayClick?: (request: PaymentRequest, existingPayment?: any) => void;
};

export default function StudentPaymentRequestsList({
  classIds,
  selectedClassId = "all",
  studentPayments = [],
  onPayClick
}: StudentPaymentRequestsListProps) {
  const [allPaymentRequests, setAllPaymentRequests] = useState<PaymentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (classIds.length === 0) {
      setIsLoading(false);
      return;
    }

    const fetchPaymentRequests = async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        const requests: PaymentRequest[] = [];

        // Fetch payment requests for all classes in parallel
        const promises = classIds.map(async (classId) => {
          try {
            const response = await apiClient.getPaymentRequests(String(classId), {
              status: "active",
              per_page: 100
            });

            if (response.success && response.data) {
              const data = Array.isArray(response.data) ? response.data : response.data.data || [];
              return Array.isArray(data) ? data : [];
            }
            return [];
          } catch (error) {
            console.error(`Error fetching payment requests for class ${classId}:`, error);
            return [];
          }
        });

        const results = await Promise.all(promises);
        results.forEach(classRequests => {
          if (Array.isArray(classRequests)) {
            requests.push(...classRequests);
          }
        });

        // Filter out cancelled payment requests (students should not see cancelled requests)
        const filteredRequests = requests.filter(req => {
          const status = (req.status || '').toString().toLowerCase().trim();
          return status !== 'cancelled';
        });

        // Sort by due_date (ascending)
        filteredRequests.sort((a, b) => {
          const dateA = a.due_date ? new Date(a.due_date).getTime() : 0;
          const dateB = b.due_date ? new Date(b.due_date).getTime() : 0;
          return dateA - dateB;
        });

        setAllPaymentRequests(filteredRequests);
      } catch (error) {
        console.error("Error fetching payment requests:", error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPaymentRequests();
  }, [classIds]);

  // Filter by selected class
  const filteredPaymentRequests = selectedClassId === "all"
    ? allPaymentRequests
    : allPaymentRequests.filter(req =>
      idsEqual(req.class_id, selectedClassId) ||
      idsEqual(getObjId(req.class), selectedClassId)
    );

  // Build a map of existing payments by payment_request_id for current student
  const paymentByRequestId = useMemo(() => {
    if (!studentPayments || studentPayments.length === 0) return {} as Record<string, any>;

    const map: Record<string, any> = {};
    studentPayments.forEach((payment: any) => {
      const requestId = getObjId(payment.payment_request_id);
      if (!requestId) return;
      const key = requestId;
      // If multiple payments exist for same request, prefer the latest one if created_at is available
      if (!map[key]) {
        map[key] = payment;
      } else if (payment.created_at && map[key].created_at) {
        // Simple comparison: take the one with later created_at
        if (new Date(payment.created_at) > new Date(map[key].created_at)) {
          map[key] = payment;
        }
      }
    });

    return map;
  }, [studentPayments]);

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-white p-6 dark:bg-gray-800">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="h-24 rounded-lg bg-gray-100 dark:bg-gray-700/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="rounded-2xl bg-white p-6 dark:bg-gray-800">
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          <p className="font-semibold">Lỗi tải dữ liệu</p>
          <p className="mt-1 text-sm">Không thể tải danh sách đợt đóng học phí. Vui lòng thử lại sau.</p>
        </div>
      </div>
    );
  }

  if (filteredPaymentRequests.length === 0) {
    return (
      <div className="rounded-lg bg-white p-4 dark:bg-gray-800">
        <div className="text-center py-8">
          <AcademicCapIcon className="mx-auto h-10 w-10 text-gray-400" />
          <h3 className="mt-3 text-sm font-medium text-gray-900 dark:text-white">Chưa có đợt đóng học phí</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {selectedClassId === "all"
              ? "Giáo viên chưa tạo đợt đóng học phí nào cho các lớp học của bạn."
              : "Không có đợt đóng học phí nào cho lớp học này."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-gray-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-[1000px] w-full divide-y divide-gray-200 dark:divide-gray-700">
          <colgroup>
            {/* Đợt đóng học phí */}
            <col className="w-[32%]" />
            {/* Trạng thái chung của đợt */}
            <col className="w-[18%]" />
            {/* Hạn đóng */}
            <col className="w-[18%]" />
            {/* Số tiền */}
            <col className="w-[16%]" />
            {/* Thao tác */}
            <col className="w-[16%]" />
          </colgroup>
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Đợt đóng học phí
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Trạng thái
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Hạn đóng
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Số tiền
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredPaymentRequests.map((request: PaymentRequest) => {
              const isOverdue = request.statistics?.is_overdue || false;
              const dueDate = request.due_date ? new Date(request.due_date) : null;
              const isPastDue = dueDate && dueDate < new Date() && request.status === "active";
              const daysUntilDue = dueDate ? Math.ceil((dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;

              return (
                <tr
                  key={getObjId(request)}
                  className={`group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${isPastDue || isOverdue
                    ? "bg-primary/5 dark:bg-primary/10"
                    : ""
                    }`}
                >
                  {/* Đợt đóng học phí */}
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      {/* Status indicator bar */}
                      <div
                        className={`w-1 h-full rounded-full shrink-0 ${isPastDue || isOverdue
                          ? "bg-primary"
                          : request.status === "active"
                            ? "bg-primary"
                            : request.status === "pending"
                              ? "bg-primary/40"
                              : "bg-gray-300 dark:bg-gray-600"
                          }`}
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                          {request.period_name}
                        </h3>
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          {request.class?.name || `Lớp học #${request.class_id}`}
                        </p>
                        {request.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                            {request.description}
                          </p>
                        )}
                        {(isPastDue || isOverdue) && (
                          <div className="mt-2 inline-block rounded-lg bg-primary-pastel dark:bg-primary/20 border border-primary/30 dark:border-primary/40 p-1.5">
                            <p className="text-[10px] font-semibold text-primary dark:text-primary-light flex items-center gap-1">
                              Đã quá hạn đóng học phí
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Trạng thái */}
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${request.status === "active"
                        ? "bg-primary-pastel text-primary"
                        : request.status === "pending"
                          ? "bg-primary-pastel/50 text-primary dark:bg-primary/20 dark:text-primary-light"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                        }`}
                    >
                      {request.status_label ||
                        (request.status === "active" ? "Đang áp dụng" :
                          request.status === "pending" ? "Chưa bắt đầu" : "Đã hủy")}
                    </span>
                  </td>

                  {/* Hạn đóng */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className={`h-4 w-4 shrink-0 ${isPastDue || isOverdue
                        ? "text-primary"
                        : daysUntilDue !== null && daysUntilDue <= 7
                          ? "text-primary/70"
                          : "text-gray-500 dark:text-gray-400"
                        }`} />
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${isPastDue || isOverdue
                          ? "text-primary dark:text-primary-light"
                          : "text-gray-900 dark:text-white"
                          }`}>
                          {dueDate ? dueDate.toLocaleDateString("vi-VN") : "Chưa có"}
                        </p>
                        {daysUntilDue !== null && !isPastDue && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {daysUntilDue > 0 ? `Còn ${daysUntilDue} ngày` : "Hôm nay"}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Số tiền */}
                  <td className="px-6 py-4 text-right">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {request.amount_per_student_formatted || formatCurrency(request.amount_per_student)}
                    </div>
                  </td>

                  {/* Thao tác */}
                  <td className="px-6 py-4 text-right">
                    {onPayClick ? (() => {
                      const existingPayment = paymentByRequestId[getObjId(request)];
                      const existingStatus = (existingPayment?.status || "").toString().toLowerCase().trim();

                      let buttonLabel = "Đóng học phí";
                      // Only disable if cancelled or (not active AND not pending payment)
                      // Actually, if it's visible (not cancelled), we might want to allow payment or at least viewing details
                      let disabled = request.status === "cancelled";

                      // Handle existing payments logic
                      if (existingStatus === "pending") {
                        buttonLabel = "Xem học phí";
                        disabled = false; // Always allow viewing details for pending payments
                      } else if (existingStatus === "paid") {
                        buttonLabel = "Đã đóng";
                        disabled = true;
                      } else if (request.status === "pending") {
                        // If request is pending (not active) and no payment exists
                        // We might want to disable it, BUT user reported issues with this.
                        // If the tutor created it, and it's visible, let's allow interaction
                        // unless explicitly forbidden.
                        // For now, let's keep it enabled but maybe show different text?
                        // No, just keep "Đóng học phí" is fine.
                        // But wait, if it is "pending", maybe we should disable it?
                        // User complaint: "học viên đã thấy... nhưng bị disabled"
                        // So they WANT it enabled.
                        disabled = false;
                      } else if (request.status !== "active") {
                        disabled = true;
                      }

                      return (
                        <Button
                          onClick={() => !disabled && onPayClick(request, existingPayment)}
                          variant={existingStatus === "pending" ? "outline" : "primary"}
                          size="sm"
                          icon={<BanknotesIcon className="h-4 w-4" />}
                          disabled={disabled}
                        >
                          {buttonLabel}
                        </Button>
                      );
                    })() : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

