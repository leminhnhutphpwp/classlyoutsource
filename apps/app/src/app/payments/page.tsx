"use client";
import { useMemo, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Tooltip from "@/components/Common/Tooltip";
import { usePayments, usePaymentStatistics, useClasses, useApprovePayment, useRejectPayment, useRefundPayment, useMarkPaymentFailed } from "@/hooks/use-api";
import { useAuthContext } from "@/contexts/auth-context";
import { PlusIcon, EyeIcon, CurrencyDollarIcon, CheckCircleIcon, ClockIcon, XCircleIcon, PencilIcon, BanknotesIcon, BuildingLibraryIcon, CreditCardIcon, EllipsisHorizontalIcon, XMarkIcon, ArrowPathIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { useTutorGuard } from "@/hooks/use-role-guard";
import { useNotification } from "@/hooks/use-notification";
import InputGroup from "@/components/FormElements/InputGroup";
import SelectInput from "@/components/FormElements/SelectInput";
import SearchInput from "@/components/FormElements/SearchInput";
import DateRangePicker from "@/components/FormElements/DateRangePicker";
import ButtonLink from "@/components/Common/ButtonLink";
import Button from "@/components/Common/Button";
import Pagination from "@/components/Common/Pagination";
import { TextAreaGroup } from "@/components/FormElements/InputGroup/text-area";
import { useListPage } from "@/hooks/use-list-page";
import { useLockContext } from "@/contexts/lock-context";
import ErrorDisplay, { useErrorDisplay } from "@/components/Common/ErrorDisplay";
import { ListSkeleton, StatsCardSkeleton } from "@/components/ui/loading";
import { formatCurrency } from "@/lib/format-currency";
import Money from "@/components/Common/Money";
import { getObjId } from "@/lib/id-utils";
import UserInfoBox from "@/components/User/UserInfoBox";
export default function PaymentsPage() {
  const { actionsLocked, planFeatureMessage } = useLockContext();
  const { renderError } = useErrorDisplay("Quản lý thanh toán");
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { user } = useAuthContext();
  const { isBlocked } = useTutorGuard();
  const { success, error: showError } = useNotification();

  // Use combined hook for pagination and filters
  const {
    currentPage,
    setCurrentPage,
    filters,
    updateFilter,
    resetFilters,
    apiFilters,
  } = useListPage({
    defaultPage: 1,
    defaultPerPage: 10,
    filterKeys: ["status", "class_id", "search", "date_from", "date_to"],
    filterDefaults: {
      status: "all",
      class_id: "all",
      search: "",
      date_from: "",
      date_to: "",
    },
  });

  // Extract individual filters for easier access
  const statusFilter = filters.status || "all";
  const classFilter = filters.class_id || "all";
  const searchQuery = filters.search || "";

  // Date range filter from URL
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(() => {
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    if (dateFrom && dateTo) {
      return { start: dateFrom, end: dateTo };
    }
    return null;
  });

  // Sync dateRange with URL when URL changes
  useEffect(() => {
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    if (dateFrom && dateTo) {
      setDateRange({ start: dateFrom, end: dateTo });
    } else {
      setDateRange(null);
    }
  }, [searchParams]);

  // Helper to create date range filters
  const createDateRangeFilters = useCallback((dateRange: { start: string; end: string } | null) => {
    if (!dateRange) return {};
    return {
      date_from: dateRange.start,
      date_to: dateRange.end,
    };
  }, []);

  // Separate state for search input (not synced with URL until search is triggered)
  const [searchInput, setSearchInput] = useState(searchQuery);

  // Sync searchInput with searchQuery when filter changes externally
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  // Handle search button click or Enter key
  const handleSearch = () => {
    updateFilter("search", searchInput);
  };

  const paymentsApiFilters = useMemo(() => {
    return {
      ...apiFilters,
      ...createDateRangeFilters(dateRange),
      sort: 'created_at',
      order: 'desc',
    };
  }, [apiFilters, dateRange, createDateRangeFilters]);

  const { data: payments, loading, error, refetch, meta: paymentsMeta, permissions } = usePayments(actionsLocked ? undefined : paymentsApiFilters);

  // Thẻ KPI phải lấy số TỔNG HỢP từ server, không cộng dồn `payments` — biến đó chỉ chứa
  // TRANG HIỆN TẠI (mặc định 15 bản ghi). Trước đây trang này hiện "Doanh thu 25tr / 10 khoản"
  // trong khi Dashboard và Báo cáo hiện 193tr / 82 khoản, vì mỗi bên đếm một phạm vi khác nhau.
  const { data: paymentStats } = usePaymentStatistics(
    actionsLocked ? undefined : { date_from: paymentsApiFilters?.date_from, date_to: paymentsApiFilters?.date_to }
  );

  // Fetch classes for filtering (must be called before early returns)
  const { data: classes, loading: classesLoading } = useClasses(undefined, !actionsLocked);

  // Use permissions from API response
  const canView = permissions?.can_view ?? true; // Default true cho view
  const canManage = permissions?.can_manage ?? false;

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // Action modals state
  const [actionModal, setActionModal] = useState<{
    type: 'approve' | 'reject' | 'refund' | 'mark-failed' | null;
    paymentId: string | null;
    payment: any | null;
  }>({ type: null, paymentId: null, payment: null });
  const [reason, setReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");

  // Action hooks
  const { mutate: approvePayment, loading: approving } = useApprovePayment();
  const { mutate: rejectPayment, loading: rejecting } = useRejectPayment();
  const { mutate: refundPayment, loading: refunding } = useRefundPayment();
  const { mutate: markPaymentFailed, loading: markingFailed } = useMarkPaymentFailed();

  // Memoized values (must be called before early returns)
  const classFilterOptions = useMemo(
    () => [
      { value: "all", label: "Tất cả lớp học" },
      ...(classes || []).map((cls: any) => ({
        value: getObjId(cls),
        label: cls.name,
      })),
    ],
    [classes]
  );

  // Disable scroll when modal is open (must be called before early returns)
  useEffect(() => {
    if (actionModal.type) {
      const previousBodyOverflow = document.body.style.overflow;
      const previousHtmlOverflow = document.documentElement.style.overflow;

      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = previousBodyOverflow || '';
        document.documentElement.style.overflow = previousHtmlOverflow || '';
      };
    }
  }, [actionModal.type]);

  // Check lock first to show lock message
  if (actionsLocked || planFeatureMessage) {
    return renderError();
  }

  // Check view permission - chỉ block khi không có quyền xem
  if (!loading && permissions !== undefined && !canView) {
    return renderError(undefined, undefined, false);
  }

  // In tutor-only system, no center owner concept
  if (isBlocked) {
    return null;
  }

  const statusOptions = [
    { value: "all", label: "Tất cả trạng thái" },
    { value: "paid", label: "Đã thanh toán" },
    { value: "pending", label: "Chờ thanh toán" },
    { value: "failed", label: "Thất bại" },
    { value: "refunded", label: "Đã hoàn tiền" },
  ];

  // Số theo trạng thái lấy từ `by_status` của API thống kê; nếu API cũ chưa trả thì mới
  // rơi về đếm trên trang hiện tại (kèm dấu hiệu để không hiểu nhầm là số toàn bộ).
  const statusRow = (s: string) =>
    (paymentStats as any)?.by_status?.find((r: any) => r.status === s);

  const countByStatus = (s: string): number =>
    statusRow(s)?.count ?? (payments?.filter((p: any) => p.status === s).length || 0);

  const totalRevenue: number =
    Number(statusRow('paid')?.total ?? NaN) ||
    (payments?.reduce((sum: number, payment: any) => {
      if (payment.status === 'paid') {
        const amount = typeof payment.amount === 'number' ? payment.amount : parseFloat(payment.amount) || 0;
        return sum + amount;
      }
      return sum;
    }, 0) || 0);

  // Action handlers
  const handleApprove = async () => {
    if (!actionModal.paymentId) return;

    const result = await approvePayment({
      id: actionModal.paymentId,
      note: reason || undefined,
    });

    if (result.success) {
      success("Đã duyệt thanh toán thành công");
      closeActionModal();
      refetch();
    } else {
      showError(result.message || "Không thể duyệt thanh toán");
    }
  };

  const handleReject = async () => {
    if (!actionModal.paymentId || !reason.trim()) {
      showError("Vui lòng nhập lý do từ chối");
      return;
    }

    const result = await rejectPayment({
      id: actionModal.paymentId,
      reason: reason.trim(),
    });

    if (result.success) {
      success("Đã từ chối thanh toán thành công");
      closeActionModal();
      refetch();
    } else {
      showError(result.message || "Không thể từ chối thanh toán");
    }
  };

  const handleRefund = async () => {
    if (!actionModal.paymentId || !reason.trim()) {
      showError("Vui lòng nhập lý do hoàn tiền");
      return;
    }

    const paymentAmount = typeof actionModal.payment?.amount === 'number'
      ? actionModal.payment.amount
      : parseFloat(actionModal.payment?.amount || '0') || 0;

    const refundAmountNum = refundAmount ? parseFloat(refundAmount.replace(/[^\d]/g, '')) : undefined;
    if (refundAmountNum !== undefined) {
      if (isNaN(refundAmountNum) || refundAmountNum <= 0) {
        showError("Số tiền hoàn không hợp lệ");
        return;
      }
      if (refundAmountNum > paymentAmount) {
        showError(`Số tiền hoàn không được vượt quá số tiền đã thanh toán (${formatCurrency(paymentAmount)})`);
        return;
      }
    }

    const result = await refundPayment({
      id: actionModal.paymentId,
      reason: reason.trim(),
      refund_amount: refundAmountNum,
    });

    if (result.success) {
      success("Đã ghi nhận hoàn tiền thành công");
      closeActionModal();
      refetch();
    } else {
      showError(result.message || "Không thể ghi nhận hoàn tiền");
    }
  };

  const handleMarkFailed = async () => {
    if (!actionModal.paymentId || !reason.trim()) {
      showError("Vui lòng nhập lý do thất bại");
      return;
    }

    const result = await markPaymentFailed({
      id: actionModal.paymentId,
      reason: reason.trim(),
    });

    if (result.success) {
      success("Đã đánh dấu thanh toán thất bại thành công");
      closeActionModal();
      refetch();
    } else {
      showError(result.message || "Không thể đánh dấu thất bại");
    }
  };

  const openActionModal = (type: 'approve' | 'reject' | 'refund' | 'mark-failed', payment: any) => {
    setActionModal({ type, paymentId: getObjId(payment), payment });
    setReason("");
    setRefundAmount("");
  };

  const closeActionModal = () => {
    setActionModal({ type: null, paymentId: null, payment: null });
    setReason("");
    setRefundAmount("");
  };

  const isTutor = user?.role === 'tutor';

  if (error && !loading) {
    return <ErrorDisplay error={error} title="Quản lý học phí" onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-dark dark:text-white">Học phí & Thanh toán</h1>
          <p className="text-dark-4 dark:text-dark-6 mt-1">
            Theo dõi trạng thái học phí, lịch sử và những khoản cần chú ý
          </p>
        </div>

        <ButtonLink
          href="/payments/create"
          icon={<PlusIcon />}
          size="sm"
          disabled={!canManage}
        >
          Tạo thanh toán mới
        </ButtonLink>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        {loading ? (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : (
          <>
            <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                  <CurrencyDollarIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="ml-3 sm:ml-4 min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Doanh thu">Doanh thu</p>
                  {/* Money tự rút gọn số lớn ("229,8 tr") và giữ giá trị chính xác ở tooltip.
                      Bỏ `truncate`: cắt chữ số của một con số làm sai hẳn độ lớn. */}
                  <Money
                    amount={totalRevenue}
                    className="block font-semibold text-gray-900 dark:text-white mt-0.5 sm:mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                  <CheckCircleIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="ml-3 sm:ml-4 min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Thanh toán">Thanh toán</p>
                  <p className="text-sm sm:text-lg lg:text-2xl font-semibold text-gray-900 dark:text-white mt-0.5 sm:mt-1">
                    {countByStatus('paid')}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                  <ClockIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="ml-3 sm:ml-4 min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Đang chờ">Đang chờ</p>
                  <p className="text-sm sm:text-lg lg:text-2xl font-semibold text-gray-900 dark:text-white mt-0.5 sm:mt-1">
                    {countByStatus('pending')}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
                  <XCircleIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="ml-3 sm:ml-4 min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 truncate" title="Thất bại">Thất bại</p>
                  <p className="text-sm sm:text-lg lg:text-2xl font-semibold text-gray-900 dark:text-white mt-0.5 sm:mt-1">
                    {countByStatus('failed')}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Search and Filters */}
      <div className="rounded-lg bg-white p-4 dark:bg-gray-800">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 relative">
          <SearchInput
            label="Tìm kiếm"
            name="search"
            placeholder={loading ? "Đang tải..." : "Tìm kiếm thanh toán..."}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={handleSearch}
            disabled={loading}
          />
          <SelectInput
            label="Trạng thái"
            name="status_filter"
            value={statusFilter}
            onChange={(e) => updateFilter("status", e.target.value)}
            disabled={loading}
            options={statusOptions}
            placeholder={loading ? "Đang tải..." : "Chọn trạng thái"}
          />
          <SelectInput
            label="Lớp học"
            name="class_filter"
            value={classFilter}
            onChange={(e) => updateFilter("class_id", e.target.value)}
            options={classFilterOptions}
            disabled={classesLoading || loading}
            placeholder={classesLoading || loading ? "Đang tải..." : "Chọn lớp học"}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Khoảng thời gian
            </label>
            <DateRangePicker
              value={dateRange || undefined}
              onChange={(range) => {
                setDateRange(range || null);
                // Update URL with date range using router to trigger re-render
                const params = new URLSearchParams(searchParams.toString());
                if (range) {
                  params.set("date_from", range.start);
                  params.set("date_to", range.end);
                } else {
                  params.delete("date_from");
                  params.delete("date_to");
                }
                const queryString = params.toString();
                router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
              }}
              className="z-[100]"
            />
          </div>

          {(searchQuery || statusFilter !== "all" || classFilter !== "all" || dateRange) && (
            <button
              onClick={() => {
                setSearchInput("");
                setDateRange(null);
                resetFilters();
              }}
              className="absolute -top-3 right-0 text-xs font-medium text-red-500 hover:text-red-700 bg-white dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-100 dark:border-gray-700"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Payments Table */}
      {loading ? (
        <ListSkeleton count={5} showAvatar={true} />
      ) : !payments || payments.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center dark:bg-gray-800">
          <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
            <CurrencyDollarIcon className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {searchQuery || statusFilter !== "all" || classFilter !== "all" ? "Không tìm thấy thanh toán" : "Chưa có thanh toán nào"}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {searchQuery || statusFilter !== "all" || classFilter !== "all"
              ? "Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc"
              : "Bắt đầu bằng cách tạo thanh toán đầu tiên"
            }
          </p>
          {!searchQuery && statusFilter === "all" && classFilter === "all" && (
            <ButtonLink
              href="/payments/create"
              icon={<PlusIcon />}
              size="sm"
              disabled={!canManage}
            >
              Tạo thanh toán đầu tiên
            </ButtonLink>
          )}
        </div>
      ) : (
        <div className="rounded-lg bg-white dark:bg-gray-800">
          {/* Mobile Card View */}
          <div className="block lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
            {(payments || []).map((payment: any) => {
              const paymentId = getObjId(payment);
              return (
                <div key={paymentId} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-lg font-medium text-gray-700 dark:text-gray-300">
                          {payment.student?.name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white break-words">
                            {payment.student?.name || 'N/A'}
                          </h3>
                          <span className={`self-start sm:self-auto inline-flex items-center px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 whitespace-nowrap ${payment.status === 'paid'
                            ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                            : payment.status === 'pending'
                              ? 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]'
                              : payment.status === 'refunded'
                                ? 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]'
                                : 'bg-[var(--status-badge-error)] text-[var(--status-badge-error-text)]'
                            }`}>
                            {payment.status_label || (payment.status === 'paid' ? 'Đã thanh toán' :
                              payment.status === 'pending' ? 'Chờ thanh toán' :
                                payment.status === 'refunded' ? 'Đã hoàn tiền' : 'Thất bại')}
                          </span>
                        </div>
                        <div className="space-y-1.5 mb-3">
                          {payment.student?.email && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1.5">
                              <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              <span className="truncate">{payment.student?.email}</span>
                            </div>
                          )}
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {payment.amount_formatted || formatCurrency(payment.amount || 0)}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            {payment.payment_method_label ? (
                              <>
                                {payment.payment_method === 'cash' && <BanknotesIcon className="h-3.5 w-3.5" />}
                                {payment.payment_method === 'bank' && <BuildingLibraryIcon className="h-3.5 w-3.5" />}
                                {payment.payment_method === 'card' && <CreditCardIcon className="h-3.5 w-3.5" />}
                                {payment.payment_method === 'free' && <EllipsisHorizontalIcon className="h-3.5 w-3.5" />}
                                <span>{payment.payment_method_label}</span>
                              </>
                            ) : (
                              <>
                                {payment.payment_method === 'cash' ? (
                                  <>
                                    <BanknotesIcon className="h-3.5 w-3.5" />
                                    <span>Tiền mặt</span>
                                  </>
                                ) : payment.payment_method === 'bank' ? (
                                  <>
                                    <BuildingLibraryIcon className="h-3.5 w-3.5" />
                                    <span>Chuyển khoản</span>
                                  </>
                                ) : payment.payment_method === 'other' ? (
                                  <>
                                    <EllipsisHorizontalIcon className="h-3.5 w-3.5" />
                                    <span>Khác</span>
                                  </>
                                ) : null}
                              </>
                            )}
                            {payment.month && (
                              <>
                                <span>•</span>
                                <span>{payment.month}</span>
                              </>
                            )}
                          </div>
                          {payment.invoice_number && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              <span className="font-medium">Hóa đơn:</span> #{payment.invoice_number}
                            </div>
                          )}
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            <span className="font-medium">Ngày:</span> {payment.payment_date
                              ? new Date(payment.payment_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                              : new Date(payment.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </div>
                          {payment.due_date && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              <span className="font-medium">Hạn:</span> {new Date(payment.due_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-1.5 flex-shrink-0">
                      <Tooltip label="Xem thanh toán">
                        <ButtonLink
                          href={`/payments/${paymentId}`}
                          variant="ghost"
                          size="sm"
                          icon={<EyeIcon />}
                          className="h-8 w-8 p-0 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          aria-label="Xem thanh toán"
                        >
                          <span className="sr-only">Xem thanh toán</span>
                        </ButtonLink>
                      </Tooltip>
                      <Tooltip label="Chỉnh sửa">
                        <Button
                          onClick={() => {
                            if (payment.status !== 'failed' && payment.status !== 'refunded') {
                              router.push(`/payments/${paymentId}/edit`);
                            }
                          }}
                          disabled={!canManage || payment.status === 'failed' || payment.status === 'refunded'}
                          variant="ghost"
                          size="sm"
                          icon={<PencilIcon />}
                          className={`h-8 w-8 p-0 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${(payment.status === 'failed' || payment.status === 'refunded') ? 'text-gray-400 opacity-50' : ''}`}
                          aria-label="Chỉnh sửa"
                        >
                          <span className="sr-only">Chỉnh sửa</span>
                        </Button>
                      </Tooltip>
                      {isTutor && (
                        <>
                          {/* Approve & Reject buttons - chỉ hiển thị cho pending */}
                          {payment.status === 'pending' && (
                            <>
                              <Tooltip label="Duyệt">
                                <Button
                                  onClick={() => openActionModal('approve', payment)}
                                  variant="ghost"
                                  size="sm"
                                  icon={<CheckCircleIcon />}
                                  className="h-8 w-8 p-0 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-primary"
                                  aria-label="Duyệt"
                                >
                                  <span className="sr-only">Duyệt</span>
                                </Button>
                              </Tooltip>
                              <Tooltip label="Từ chối">
                                <Button
                                  onClick={() => openActionModal('reject', payment)}
                                  variant="ghost"
                                  size="sm"
                                  icon={<XCircleIcon />}
                                  className="h-8 w-8 p-0 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-red-600"
                                  aria-label="Từ chối"
                                >
                                  <span className="sr-only">Từ chối</span>
                                </Button>
                              </Tooltip>
                            </>
                          )}
                          {/* Refund & Mark Failed buttons - chỉ hiển thị cho paid, failed, refunded */}
                          {(payment.status === 'paid' || payment.status === 'failed' || payment.status === 'refunded') && (
                            <>
                              <Tooltip label="Hoàn tiền">
                                <Button
                                  onClick={() => payment.status === 'paid' ? openActionModal('refund', payment) : undefined}
                                  disabled={payment.status !== 'paid'}
                                  variant="ghost"
                                  size="sm"
                                  icon={<ArrowPathIcon />}
                                  className={`h-8 w-8 p-0 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${payment.status === 'paid' ? 'text-primary' : 'text-gray-400 opacity-50'}`}
                                  aria-label="Hoàn tiền"
                                >
                                  <span className="sr-only">Hoàn tiền</span>
                                </Button>
                              </Tooltip>
                              <Tooltip label="Đánh dấu thất bại">
                                <Button
                                  onClick={() => payment.status === 'paid' ? openActionModal('mark-failed', payment) : undefined}
                                  disabled={payment.status !== 'paid'}
                                  variant="ghost"
                                  size="sm"
                                  icon={<XCircleIcon />}
                                  className={`h-8 w-8 p-0 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${payment.status === 'paid' ? 'text-red-600' : 'text-gray-400 opacity-50'}`}
                                  aria-label="Đánh dấu thất bại"
                                >
                                  <span className="sr-only">Đánh dấu thất bại</span>
                                </Button>
                              </Tooltip>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="min-w-[1000px] w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Học viên
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                    Hóa đơn/Tháng
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Số tiền
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Trạng thái
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                    Ngày
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {(payments || []).map((payment: any) => {
                  const paymentId = getObjId(payment);
                  return (
                    <tr key={paymentId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-4">
                        <UserInfoBox
                          name={payment.student?.name || 'N/A'}
                          email={payment.student?.email}
                          emailVerified={payment.student?.email_verified || false}
                          avatar={payment.student?.avatar}
                          studentCode={payment.student?.student_code}
                          size="sm"
                          layout="horizontal"
                        />
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {payment.invoice_number && (
                            <div className="font-medium">#{payment.invoice_number}</div>
                          )}
                          {payment.month && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {payment.month}
                            </div>
                          )}
                          {!payment.invoice_number && !payment.month && (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">
                          {payment.amount_formatted || formatCurrency(payment.amount || 0)}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${payment.status === 'paid'
                            ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
                            : payment.status === 'pending'
                              ? 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]'
                              : payment.status === 'refunded'
                                ? 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]'
                                : 'bg-[var(--status-badge-error)] text-[var(--status-badge-error-text)]'
                            }`}>
                            {payment.status_label || (payment.status === 'paid' ? 'Đã thanh toán' :
                              payment.status === 'pending' ? 'Chờ thanh toán' :
                                payment.status === 'refunded' ? 'Đã hoàn tiền' : 'Thất bại')}
                          </span>
                          {/* Phương thức thanh toán - chỉ hiện trên desktop */}
                          <span className="hidden lg:inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            {payment.payment_method_label ? (
                              <>
                                {payment.payment_method === 'cash' && <BanknotesIcon className="h-3.5 w-3.5" />}
                                {payment.payment_method === 'bank' && <BuildingLibraryIcon className="h-3.5 w-3.5" />}
                                {payment.payment_method === 'card' && <CreditCardIcon className="h-3.5 w-3.5" />}
                                {payment.payment_method === 'free' && <EllipsisHorizontalIcon className="h-3.5 w-3.5" />}
                                <span>{payment.payment_method_label}</span>
                              </>
                            ) : (
                              <>
                                {payment.payment_method === 'cash' ? (
                                  <>
                                    <BanknotesIcon className="h-3.5 w-3.5" />
                                    <span>Tiền mặt</span>
                                  </>
                                ) : payment.payment_method === 'bank' ? (
                                  <>
                                    <BuildingLibraryIcon className="h-3.5 w-3.5" />
                                    <span>Chuyển khoản</span>
                                  </>
                                ) : payment.payment_method === 'other' ? (
                                  <>
                                    <EllipsisHorizontalIcon className="h-3.5 w-3.5" />
                                    <span>Khác</span>
                                  </>
                                ) : (
                                  <span>{payment.payment_method || 'N/A'}</span>
                                )}
                              </>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap hidden lg:table-cell">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : new Date(payment.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </div>
                        {payment.due_date && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Hạn: {new Date(payment.due_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium relative overflow-visible">
                        <div className="flex items-center gap-2">
                          <Tooltip label="Xem thanh toán">
                            <ButtonLink
                              href={`/payments/${getObjId(payment)}`}
                              variant="ghost"
                              size="sm"
                              icon={<EyeIcon />}
                              className="h-8 w-8 p-0"
                              aria-label="Xem thanh toán"
                            >
                              <span className="sr-only">Xem thanh toán</span>
                            </ButtonLink>
                          </Tooltip>
                          <Tooltip label="Chỉnh sửa">
                            <Button
                              onClick={() => {
                                if (payment.status !== 'failed' && payment.status !== 'refunded') {
                                  router.push(`/payments/${getObjId(payment)}/edit`);
                                }
                              }}
                              disabled={!canManage || payment.status === 'failed' || payment.status === 'refunded'}
                              variant="ghost"
                              size="sm"
                              icon={<PencilIcon />}
                              className={`h-8 w-8 p-0 ${payment.status === 'failed' || payment.status === 'refunded' ? 'text-gray-400 opacity-50' : ''}`}
                              aria-label="Chỉnh sửa"
                            >
                              <span className="sr-only">Chỉnh sửa</span>
                            </Button>
                          </Tooltip>
                          {isTutor && (
                            <>
                              {/* Approve & Reject buttons - chỉ hiển thị cho pending */}
                              {payment.status === 'pending' && (
                                <>
                                  <Tooltip label="Duyệt">
                                    <Button
                                      onClick={() => openActionModal('approve', payment)}
                                      variant="ghost"
                                      size="sm"
                                      icon={<CheckCircleIcon />}
                                      className="h-8 w-8 p-0 text-primary"
                                      aria-label="Duyệt"
                                    >
                                      <span className="sr-only">Duyệt</span>
                                    </Button>
                                  </Tooltip>
                                  <Tooltip label="Từ chối">
                                    <Button
                                      onClick={() => openActionModal('reject', payment)}
                                      variant="ghost"
                                      size="sm"
                                      icon={<XCircleIcon />}
                                      className="h-8 w-8 p-0 text-red-600"
                                      aria-label="Từ chối"
                                    >
                                      <span className="sr-only">Từ chối</span>
                                    </Button>
                                  </Tooltip>
                                </>
                              )}
                              {/* Refund & Mark Failed buttons - chỉ hiển thị cho paid, failed, refunded */}
                              {(payment.status === 'paid' || payment.status === 'failed' || payment.status === 'refunded') && (
                                <>
                                  <Tooltip label="Hoàn tiền">
                                    <Button
                                      onClick={() => payment.status === 'paid' ? openActionModal('refund', payment) : undefined}
                                      disabled={payment.status !== 'paid'}
                                      variant="ghost"
                                      size="sm"
                                      icon={<ArrowPathIcon />}
                                      className={`h-8 w-8 p-0 ${payment.status === 'paid' ? 'text-primary' : 'text-gray-400 opacity-50'}`}
                                      aria-label="Hoàn tiền"
                                    >
                                      <span className="sr-only">Hoàn tiền</span>
                                    </Button>
                                  </Tooltip>
                                  <Tooltip label="Đánh dấu thất bại">
                                    <Button
                                      onClick={() => payment.status === 'paid' ? openActionModal('mark-failed', payment) : undefined}
                                      disabled={payment.status !== 'paid'}
                                      variant="ghost"
                                      size="sm"
                                      icon={<XCircleIcon />}
                                      className={`h-8 w-8 p-0 ${payment.status === 'paid' ? 'text-red-600' : 'text-gray-400 opacity-50'}`}
                                      aria-label="Đánh dấu thất bại"
                                    >
                                      <span className="sr-only">Đánh dấu thất bại</span>
                                    </Button>
                                  </Tooltip>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div >
        </div >
      )
      }

      {/* Pagination - chỉ hiển thị khi có dữ liệu */}
      {
        payments && payments.length > 0 && (
          <Pagination
            meta={paymentsMeta}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            itemLabel="thanh toán"
          />
        )
      }

      {/* Action Modals */}
      {
        actionModal.type && actionModal.payment &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeActionModal} role="dialog" aria-modal="true" aria-labelledby="payment-action-modal-title">
            <div className="max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 id="payment-action-modal-title" className="text-xl font-bold text-gray-900 dark:text-white">
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
                          <li>Học viên không có ví trong hệ thống</li>
                          <li>Việc trả tiền thực tế diễn ra bên ngoài hệ thống (chuyển khoản ngân hàng, tiền mặt, v.v.)</li>
                          <li>Trạng thái sẽ chuyển từ &quot;Đã thanh toán&quot; sang &quot;Đã hoàn tiền&quot;</li>
                        </ul>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={closeActionModal}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Thông tin thanh toán</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {actionModal.payment.student?.name || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {actionModal.payment.amount_formatted || formatCurrency(actionModal.payment.amount || 0)}
                  </div>
                </div>

                {actionModal.type === 'approve' && (
                  <TextAreaGroup
                    label="Ghi chú (tùy chọn)"
                    name="note"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Nhập ghi chú nếu có..."
                    rows={3}
                  />
                )}

                {(actionModal.type === 'reject' || actionModal.type === 'mark-failed') && (
                  <TextAreaGroup
                    label="Lý do"
                    name="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Nhập lý do..."
                    rows={3}
                    required
                  />
                )}

                {actionModal.type === 'refund' && (
                  <>
                    <InputGroup
                      type="text"
                      label="Số tiền hoàn (tùy chọn - chỉ để tham khảo)"
                      name="refund_amount"
                      value={refundAmount}
                      handleChange={(e) => {
                        const inputValue = e.target.value;
                        // Loại bỏ tất cả ký tự không phải số
                        const numericValue = inputValue.replace(/[^\d]/g, '');

                        if (!numericValue) {
                          setRefundAmount('');
                          return;
                        }

                        const numValue = parseFloat(numericValue) || 0;
                        const paymentAmount = typeof actionModal.payment?.amount === 'number'
                          ? actionModal.payment.amount
                          : parseFloat(actionModal.payment?.amount || '0') || 0;

                        // Nếu số tiền nhập vượt quá số tiền thanh toán, giới hạn ở số tiền thanh toán
                        if (numValue > paymentAmount) {
                          const formattedMax = paymentAmount.toLocaleString('vi-VN');
                          setRefundAmount(formattedMax);
                          showError(`Số tiền hoàn tối đa là ${formatCurrency(paymentAmount)}`);
                        } else {
                          // Format số tiền với dấu chấm ngăn cách hàng nghìn
                          const formatted = numValue.toLocaleString('vi-VN');
                          setRefundAmount(formatted);
                        }
                      }}
                      placeholder={`Tối đa: ${formatCurrency(typeof actionModal.payment?.amount === 'number' ? actionModal.payment.amount : parseFloat(actionModal.payment?.amount || '0') || 0)}`}
                      icon={<CurrencyDollarIcon />}
                      helperText={`Số tiền này chỉ để tham khảo, không ảnh hưởng đến ví. Tối đa: ${formatCurrency(typeof actionModal.payment?.amount === 'number' ? actionModal.payment.amount : parseFloat(actionModal.payment?.amount || '0') || 0)}`}
                    />
                    <TextAreaGroup
                      label="Lý do hoàn tiền"
                      name="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Nhập lý do hoàn tiền (bắt buộc)..."
                      rows={3}
                      required
                    />
                  </>
                )}

                <div className="flex items-center gap-4 pt-4 justify-end">
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
                    icon={
                      actionModal.type === 'approve' ? <CheckCircleIcon /> :
                        actionModal.type === 'reject' ? <XCircleIcon /> :
                          actionModal.type === 'refund' ? <ArrowPathIcon /> :
                            <XCircleIcon />
                    }
                  >
                    {actionModal.type === 'approve' && 'Duyệt'}
                    {actionModal.type === 'reject' && 'Từ chối'}
                    {actionModal.type === 'refund' && 'Ghi nhận hoàn tiền'}
                    {actionModal.type === 'mark-failed' && 'Đánh dấu thất bại'}
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      }
    </div >
  );
}
