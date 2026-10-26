"use client";
import { useMemo, useState, useEffect } from "react";
import ProtectedRoute from "@/components/Auth/ProtectedRoute";
import { useStudentId } from "@/hooks/use-student-id";
import { usePaymentsByStudent, useStudentClasses } from "@/hooks/use-api";
import { useLockContext } from "@/contexts/lock-context";
import { useErrorDisplay } from "@/components/Common/ErrorDisplay";
import { CheckCircleIcon, ClockIcon, FaceSmileIcon } from "@heroicons/react/24/outline";
import { STATUS_LABELS } from "@/app/reports/_components/report-constants";
import { formatCurrency } from "@/lib/format-currency";
import SelectInput from "@/components/FormElements/SelectInput";
import Pagination from "@/components/Common/Pagination";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useNotification } from "@/hooks/use-notification";
import StudentPaymentRequestsList from "@/components/PaymentRequests/StudentPaymentRequestsList";
import PaymentRequestModal from "@/components/PaymentRequests/PaymentRequestModal";
import { useListPage } from "@/hooks/use-list-page";
import SearchInput from "@/components/FormElements/SearchInput";
import { getObjId } from "@/lib/id-utils";
import { CardSkeleton, StatsCardSkeleton } from "@/components/ui/loading";
import { Skeleton } from "@/components/ui/skeleton";

type PaymentRecord = Record<string, any>;

const STATUS_OPTIONS = [
  { value: "all", label: "Tất cả" },
  { value: "pending", label: "Chờ thanh toán" },
  { value: "paid", label: "Đã thanh toán" },
  { value: "failed", label: "Thất bại" },
  { value: "refunded", label: "Đã hoàn tiền" },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "all", label: "Tất cả cách đóng" },
  { value: "cash", label: "Tiền mặt" },
  { value: "bank", label: "Chuyển khoản" },
];

function resolvePaymentDate(payment: PaymentRecord) {
  return (
    payment.paid_at ||
    payment.payment_date ||
    payment.completed_at ||
    payment.updated_at ||
    payment.created_at ||
    null
  );
}

export default function MyPaymentsPage() {
  const router = useRouter();
  const { success, error: showError } = useNotification();
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const { renderError } = useErrorDisplay("Học phí của tôi");

  // Local state for filters & pagination
  const {
    currentPage,
    perPage,
    setCurrentPage,
    filters,
    updateFilter,
    apiFilters,
  } = useListPage({
    defaultPage: 1,
    defaultPerPage: 15,
    filterKeys: ["search", "status", "payment_method"],
    filterDefaults: {
      search: "",
      status: "all",
      payment_method: "all",
    },
  });

  // Search keyword
  const searchQuery = filters.search || "";
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [submittingPaymentRequest, setSubmittingPaymentRequest] = useState(false);
  const [hasLoadedPayments, setHasLoadedPayments] = useState(false);
  const [hasLoadedClasses, setHasLoadedClasses] = useState(false);

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  const { studentId, loading: studentIdLoading } = useStudentId();

  // Explicit search trigger (button / Enter)
  const handleSearch = () => {
    updateFilter("search", searchInput.trim());
  };

  const statusFilter = filters.status || "all";
  const methodFilter = filters.payment_method || "all";

  const {
    data: paymentsData,
    loading: paymentsLoading,
    error,
    meta: paymentsMeta,
    permissions: paymentsPermissions,
    refetch: refetchPayments,
  } = usePaymentsByStudent(studentId || "0", apiFilters, { enabled: !actionsLocked && !!studentId && studentId !== "0" });
  const { classes: studentClasses, loading: classesLoading } = useStudentClasses(studentId || "0", undefined, { enabled: !actionsLocked && !!studentId && studentId !== "0" });

  // Use permissions from API response, fallback to false if not available.
  // Students get can_view (read-only) — can_manage is only for tutors/org staff.
  const canView = paymentsPermissions?.can_view ?? paymentsPermissions?.can_manage ?? false;

  useEffect(() => {
    if (!paymentsLoading) {
      setHasLoadedPayments(true);
    }
  }, [paymentsLoading]);

  useEffect(() => {
    if (!classesLoading) {
      setHasLoadedClasses(true);
    }
  }, [classesLoading]);

  // Extract payments from API response (now paginated)
  const allPayments = useMemo<PaymentRecord[]>(() => {
    if (!paymentsData) return [];
    if (paymentsData?.payments && Array.isArray(paymentsData.payments)) return paymentsData.payments;
    if (paymentsData?.data?.payments && Array.isArray(paymentsData.data.payments)) return paymentsData.data.payments;
    if (Array.isArray(paymentsData?.data)) return paymentsData.data;
    if (paymentsData?.data?.data && Array.isArray(paymentsData.data.data)) return paymentsData.data.data;
    return [];
  }, [paymentsData]);

  // Backend đã filter + phân trang, FE chỉ dùng trực tiếp
  const payments = allPayments;

  const classIds = useMemo(() => {
    if (!studentClasses || !Array.isArray(studentClasses)) return [];
    return studentClasses
      .map((cls: any) => getObjId(cls) || cls.class_id || getObjId(cls.class) || cls.pivot?.class_id)
      .filter((id: any) => !!id);
  }, [studentClasses]);

  const paymentStats = useMemo(() => {
    const paidPayments = payments.filter((p) => p.status === "paid");
    const pendingPayments = payments.filter((p) => p.status !== "paid" && p.status !== "refunded");
    const failedPayments = payments.filter((p) => p.status === "failed");
    const paidAmount = paidPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const completionRate = payments.length > 0 ? Math.round((paidPayments.length / payments.length) * 100) : 100;

    const nextDueCandidate = payments
      .map((p) => {
        const dueDate = p.due_date || p.payment_request?.due_date;
        return dueDate ? ({ ...p, dueAt: new Date(dueDate) } as PaymentRecord & { dueAt: Date }) : null;
      })
      .filter((p): p is PaymentRecord & { dueAt: Date } => {
        if (!p || !p.dueAt) {
          return false;
        }
        return p.status !== "paid";
      })
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0];

    let friendlyMessage = "Bạn đang quản lý học phí rất ổn định.";
    if (completionRate < 70) {
      friendlyMessage = "Bạn cứ từ từ hoàn tất học phí, cần hỗ trợ cứ liên hệ giáo viên nhé.";
    } else if (completionRate < 90) {
      friendlyMessage = "Bạn đang theo kịp tiến độ, chỉ còn một vài khoản nhỏ nữa thôi.";
    }

    const nextDueClass =
      nextDueCandidate?.class?.name ||
      nextDueCandidate?.payment_request?.period_name ||
      (nextDueCandidate ? `Học phí #${getObjId(nextDueCandidate)}` : null);

    return {
      totalCount: payments.length,
      paidCount: paidPayments.length,
      pendingCount: pendingPayments.length,
      failedCount: failedPayments.length,
      paidAmount,
      totalAmount,
      completionRate,
      nextDueDate: nextDueCandidate?.dueAt || null,
      nextDueLabel: nextDueClass,
      friendlyMessage,
    };
  }, [payments]);

  type PaymentGroup = {
    key: string;
    label: string;
    order: number;
    items: PaymentRecord[];
  };

  function capitalize(value: string) {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  const groupedPayments = useMemo<PaymentGroup[]>(() => {
    if (payments.length === 0) return [];

    const map = new Map<string, PaymentGroup>();

    payments.forEach((payment) => {
      const monthSource =
        payment.payment_request?.period_month ||
        payment.month ||
        (payment.payment_request?.due_date || payment.due_date)?.slice(0, 7) ||
        (payment.created_at ? payment.created_at.slice(0, 7) : null);

      let monthDate: Date | null = null;
      if (monthSource) {
        const normalized = monthSource.length === 7 ? `${monthSource}-01` : monthSource;
        const parsed = new Date(normalized);
        if (!Number.isNaN(parsed.getTime())) {
          monthDate = parsed;
        }
      } else if (payment.created_at) {
        const fallback = new Date(payment.created_at);
        if (!Number.isNaN(fallback.getTime())) {
          monthDate = fallback;
        }
      }

      const key = monthDate ? `${monthDate.getFullYear()}-${monthDate.getMonth() + 1}` : `other-${getObjId(payment)}`;
      const label = monthDate
        ? capitalize(
          monthDate.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })
        )
        : "Khác";
      const order = monthDate ? monthDate.getTime() : (payment.created_at ? new Date(payment.created_at).getTime() : 0);

      if (!map.has(key)) {
        map.set(key, { key, label, order, items: [] });
      }

      map.get(key)!.items.push(payment);
    });

    return Array.from(map.values()).sort((a, b) => b.order - a.order);
  }, [payments]);

  const handlePayClick = (request: any, existingPayment?: any) => {
    // If a payment already exists (and is pending), navigate directly to details
    if (existingPayment && getObjId(existingPayment)) {
      router.push(`/my-payments/transactions/${getObjId(existingPayment)}`);
      return;
    }

    setSelectedRequest(request);
    setIsRequestModalOpen(true);
  };

  const handleCloseRequestModal = () => {
    if (submittingPaymentRequest) return;
    setIsRequestModalOpen(false);
    setSelectedRequest(null);
  };

  const handleConfirmPaymentRequest = async () => {
    if (!selectedRequest || !studentId || studentId === "0") {
      showError("Không thể xác định thông tin học viên hoặc đợt học phí.");
      return;
    }

    const classId = selectedRequest.class_id || (selectedRequest.class && getObjId(selectedRequest.class));
    if (!classId) {
      showError("Đợt học phí không hợp lệ do thiếu thông tin lớp.");
      return;
    }

    setSubmittingPaymentRequest(true);
    try {
      const monthValue =
        selectedRequest.period_month ||
        (selectedRequest.due_date ? selectedRequest.due_date.slice(0, 7) : new Date().toISOString().slice(0, 7));

      const response = await apiClient.createPayment({
        class_id: String(classId),
        student_id: String(studentId),
        month: monthValue,
        amount: selectedRequest.amount_per_student,
        due_date: selectedRequest.due_date,
        payment_method: "bank",
        status: "pending",
        note: `Đóng học phí ${selectedRequest.period_name}`,
        payment_request_id: getObjId(selectedRequest),
      });

      if (!response.success) {
        throw new Error(response.message || "Không thể tạo yêu cầu đóng học phí. Vui lòng thử lại.");
      }

      success("Đã ghi nhận yêu cầu đóng học phí", "Vui lòng chuyển khoản và chờ giáo viên xác nhận.");
      setIsRequestModalOpen(false);
      setSelectedRequest(null);

      // Redirect to payment detail page
      if (response.data && getObjId(response.data)) {
        router.push(`/my-payments/transactions/${getObjId(response.data)}`);
      } else {
        await refetchPayments();
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Không thể ghi nhận yêu cầu đóng học phí.");
    } finally {
      setSubmittingPaymentRequest(false);
    }
  };

  // Kiểm tra lock và plan feature trước để ưu tiên hiển thị lock content
  if (actionsLocked || planFeatureMessage) {
    return (
      <ProtectedRoute>
        {renderError()}
      </ProtectedRoute>
    );
  }

  // Check permissions after data loaded - show locked content if no view permission
  // Only check when data is loaded (not loading) and permissions are available
  if (!paymentsLoading && paymentsPermissions !== undefined && !canView) {
    return (
      <ProtectedRoute>
        {renderError(undefined, undefined, false)}
      </ProtectedRoute>
    );
  }

  const showInitialSkeleton =
    studentIdLoading ||
    (!hasLoadedClasses && classesLoading) ||
    (!hasLoadedPayments && paymentsLoading);

  const isRefreshingPayments = paymentsLoading && hasLoadedPayments;
  const isRefreshingClasses = classesLoading && hasLoadedClasses;

  if (showInitialSkeleton) {
    return (
      <ProtectedRoute>
        <div className="space-y-6">
          <div className="animate-pulse space-y-2">
            <Skeleton className="h-8 w-60 rounded" />
            <Skeleton className="h-4 w-72 rounded" />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <StatsCardSkeleton key={`summary-skeleton-${i}`} />
            ))}
          </div>

          <div className="rounded-lg bg-white p-4 dark:bg-gray-800">
            <div className="flex flex-col gap-4 md:flex-row">
              <Skeleton className="h-11 flex-1 rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl md:w-48" />
              <Skeleton className="h-11 w-full rounded-xl md:w-48" />
            </div>
          </div>

          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
        </div>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        {renderError(error, () => refetchPayments())}
      </ProtectedRoute>
    );
  }

  if (!studentId) {
    return (
      <ProtectedRoute>
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-6 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
          <p className="font-semibold">Không tìm thấy thông tin học viên</p>
          <p className="mt-2 text-sm">Vui lòng đảm bảo bạn đã đăng nhập với tài khoản học viên hợp lệ.</p>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <>
      <ProtectedRoute>
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Học phí của tôi</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Xem các đợt học phí cần đóng và lịch sử đóng học phí
            </p>
          </div>

          {/* Gentle status reports */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl bg-white p-5 dark:bg-gray-800">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary-pastel/50 p-3 text-primary">
                  <FaceSmileIcon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {paymentStats.friendlyMessage}
                  </p>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Tỷ lệ học phí đã hoàn tất
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-lg font-bold text-primary">
                      {paymentStats.completionRate}%
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-700">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${paymentStats.completionRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 dark:bg-gray-800">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                  <ClockIcon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Đợt sắp đến hạn
                  </p>
                  {paymentStats.nextDueDate ? (
                    <>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {paymentStats.nextDueDate.toLocaleDateString("vi-VN")}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {paymentStats.nextDueLabel || "Đợt học phí"}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      Hiện chưa có hạn đóng nào, cứ yên tâm học nhé!
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 dark:bg-gray-800">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-green-50 p-3 text-green-600 dark:bg-green-500/10 dark:text-green-300">
                  <CheckCircleIcon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Tổng quan nhẹ nhàng
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {paymentStats.paidCount} đã xong
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {paymentStats.pendingCount > 0
                      ? `${paymentStats.pendingCount} đợt đang chờ, hoàn tất khi bạn sẵn sàng`
                      : "Không còn khoản nào phải lo trong thời điểm này"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <SectionDivider label="Đợt đóng học phí" />
          {/* Đợt đóng học phí hiện tại */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Đợt đóng học phí của lớp
                </h2>
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                  Theo dõi các đợt học phí giáo viên đã tạo cho các lớp bạn đang tham gia
                </p>
              </div>
              {(isRefreshingPayments || isRefreshingClasses) && (
                <InlineLoader text="Đang cập nhật..." />
              )}
            </div>

            <div className={`transition-opacity ${isRefreshingPayments || isRefreshingClasses ? "opacity-75" : "opacity-100"}`}>
              {classIds.length === 0 ? (
                <div className="rounded-lg bg-white p-6 text-center dark:bg-gray-800">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Chưa có lớp học</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Bạn chưa tham gia lớp học nào hoặc giáo viên chưa tạo đợt đóng học phí.
                  </p>
                </div>
              ) : (
                <StudentPaymentRequestsList
                  classIds={classIds}
                  selectedClassId="all"
                  studentClasses={studentClasses}
                  studentPayments={payments}
                  onPayClick={handlePayClick}
                />
              )}
            </div>
          </div>

          <SectionDivider label="Lịch sử đóng học phí" />
          {/* Lịch sử đóng học phí */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Lịch sử đóng học phí
                </h2>
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                  Xem lại các kỳ học phí đã đóng
                </p>
              </div>
              {isRefreshingPayments && (
                <InlineLoader text="Đang tải lịch sử..." />
              )}
            </div>

            <div className="rounded-2xl bg-white p-5 dark:bg-gray-800">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <SearchInput
                    label="Tìm kiếm"
                    name="search"
                    placeholder="Tìm kiếm theo lớp học, kỳ học phí..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onSearch={handleSearch}
                  />
                </div>
                <SelectInput
                  label="Trạng thái"
                  name="status"
                  value={statusFilter}
                  handleChange={(e) => {
                    updateFilter("status", e.target.value);
                  }}
                  options={STATUS_OPTIONS}
                />
                <SelectInput
                  label="Cách đóng"
                  name="method"
                  value={methodFilter}
                  handleChange={(e) => {
                    updateFilter("payment_method", e.target.value);
                  }}
                  options={PAYMENT_METHOD_OPTIONS}
                />
              </div>
            </div>

            <div className={`space-y-6 transition-opacity ${isRefreshingPayments ? "opacity-75" : "opacity-100"}`}>
              {groupedPayments.length === 0 ? (
                <div className="rounded-2xl bg-white p-8 text-center dark:bg-gray-800">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Chưa có lịch sử đóng học phí</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Khi bạn hoàn tất học phí, thông tin sẽ hiển thị tại đây.
                  </p>
                </div>
              ) : (
                groupedPayments.map((group) => (
                  <div key={group.key} className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gray-50 px-4 py-3 text-gray-700 dark:bg-gray-800/60 dark:text-gray-200">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{group.label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {group.items.length} kỳ học phí trong giai đoạn này
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900/70 dark:text-gray-300">
                        {group.items.length} {group.items.length > 1 ? "kỳ học phí" : "kỳ học phí"}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {group.items.map((payment: PaymentRecord) => {
                        const periodName =
                          payment.payment_request?.period_name ||
                          payment.period_name ||
                          (payment.payment_request?.period_month
                            ? `Tháng ${payment.payment_request.period_month}`
                            : null);
                        const className = payment.class?.name || null;
                        const invoiceNumber = payment.invoice_number || `#${getObjId(payment)}`;
                        const referenceCode = payment.reference_code || invoiceNumber;
                        const paymentDate = resolvePaymentDate(payment);
                        const dueDate = payment.due_date || payment.payment_request?.due_date;
                        const displayDate =
                          payment.status === "paid" && paymentDate
                            ? { label: "Đã đóng", date: new Date(paymentDate).toLocaleDateString("vi-VN") }
                            : dueDate
                              ? { label: "Hạn đóng", date: new Date(dueDate).toLocaleDateString("vi-VN") }
                              : { label: payment.status === "paid" ? "Đã đóng" : "Hạn đóng", date: "Đang cập nhật" };
                        const methodLabel = payment.payment_method_label || payment.payment_method || "Không rõ";
                        const statusKey = (payment.status || "pending").toLowerCase();
                        const statusClass =
                          statusKey === "paid"
                            ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-200"
                            : statusKey === "failed"
                              ? "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-200"
                              : statusKey === "overdue"
                                ? "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-200"
                                : "bg-primary-pastel/50 text-primary dark:bg-primary/20 dark:text-primary-light";

                        return (
                          <div
                            key={getObjId(payment)}
                            className="rounded-2xl border border-gray-100 bg-white p-5 transition hover:border-primary/40 dark:border-gray-700 dark:bg-gray-800"
                          >
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{periodName || className || referenceCode}</p>
                                {className && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {className}
                                  </p>
                                )}
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                  {referenceCode}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-3">
                                <div className="text-lg font-bold text-gray-900 dark:text-white">
                                  {payment.amount_formatted || formatCurrency(payment.amount || 0)}
                                </div>
                                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
                                  {payment.status_label ||
                                    (STATUS_LABELS.payments?.[payment.status as keyof typeof STATUS_LABELS.payments] as string) ||
                                    payment.status}
                                </span>
                              </div>
                            </div>
                            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                              <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Trạng thái thanh toán</p>
                                <p className="text-sm text-gray-900 dark:text-white">
                                  {displayDate.label}: <span className="font-semibold">{displayDate.date}</span>
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Phương thức</p>
                                <p className="text-sm text-gray-900 dark:text-white">{methodLabel}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Ngày khởi tạo</p>
                                <p className="text-sm text-gray-900 dark:text-white">
                                  {payment.created_at
                                    ? new Date(payment.created_at).toLocaleDateString("vi-VN", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric",
                                    })
                                    : "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Ghi chú</p>
                                <p className="text-sm text-gray-900 dark:text-white">
                                  {payment.note || payment.payment_request?.description || "Không có ghi chú"}
                                </p>
                              </div>
                            </div>
                            <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-700">
                              <button
                                type="button"
                                onClick={() => router.push(`/my-payments/transactions/${getObjId(payment)}`)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-pastel/40 px-3 py-1.5 text-sm font-medium text-primary transition hover:bg-primary-pastel dark:bg-primary/20 dark:text-primary-light dark:hover:bg-primary/30"
                              >
                                {statusKey === "pending"
                                  ? "Hướng dẫn thanh toán"
                                  : "Xem chi tiết"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}

              {groupedPayments.length > 0 && (
                <Pagination
                  meta={paymentsMeta || { current_page: currentPage, per_page: perPage, total: payments.length, last_page: 1 }}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  itemLabel="kỳ học phí"
                  className="justify-between"
                />
              )}
              {isRefreshingPayments && (
                <div className="rounded-2xl border border-dashed border-primary/30 bg-white/80 p-4 text-center text-xs text-gray-500 dark:border-primary/40 dark:bg-gray-900/60 dark:text-gray-300">
                  Đang tải lịch sử mới nhất...
                </div>
              )}
            </div>
          </div>

        </div>

      </ProtectedRoute>

      <PaymentRequestModal
        request={selectedRequest}
        isOpen={isRequestModalOpen}
        onClose={handleCloseRequestModal}
        onConfirm={handleConfirmPaymentRequest}
        loading={submittingPaymentRequest}
      />
    </>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="my-10 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.35em] text-gray-400 dark:text-gray-500">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-gray-700" />
      <span>{label}</span>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-gray-700" />
    </div>
  );
}

function InlineLoader({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-primary dark:text-primary-light">
      <span className="h-2.5 w-2.5 animate-ping rounded-full bg-primary" />
      {text}
    </div>
  );
}


