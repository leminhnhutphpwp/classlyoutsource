"use client";
import { usePaymentRequest, usePaymentRequestStatistics, useClassStudents, usePayments } from "@/hooks/use-api";
import { formatCurrency } from "@/lib/format-currency";
import { getObjId, idsEqual } from "@/lib/id-utils";
import Button from "@/components/Common/Button";
import ButtonLink from "@/components/Common/ButtonLink";
import {
  ArrowLeftIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ClockIcon,
  ChartBarIcon,
  EyeIcon,
  XCircleIcon
} from "@heroicons/react/24/outline";
import { useMemo } from "react";
import UserInfoBox from "@/components/User/UserInfoBox";

interface PaymentRequestDetailProps {
  requestId: string;
  onBack: () => void;
}

export default function PaymentRequestDetail({ requestId, onBack }: PaymentRequestDetailProps) {
  const { data: paymentRequestData, loading, error } = usePaymentRequest(requestId);
  const { data: statisticsData } = usePaymentRequestStatistics(requestId);

  const request = paymentRequestData?.payment_request || paymentRequestData;
  const stats = statisticsData?.data || request?.statistics || {};
  const classId = request?.class_id || getObjId(request?.class);

  // Fetch class students and payments
  const { data: classStudentsData } = useClassStudents(classId);
  const { data: paymentsData } = usePayments();

  const students = useMemo(
    () => classStudentsData?.students || classStudentsData || [],
    [classStudentsData]
  );
  const payments = useMemo(
    () => paymentsData?.data || paymentsData || [],
    [paymentsData]
  );

  // Match students with their payment status for this payment request
  const studentsWithPaymentStatus = useMemo(() => {
    if (!students || !Array.isArray(students)) return [];

    return students.map((student: any) => {
      // Find payment for this student and payment request
      const payment = payments.find((p: any) =>
        idsEqual(p.student_id, student) &&
        idsEqual(p.payment_request_id, request)
      );

      return {
        ...student,
        payment: payment || null,
        paymentStatus: payment?.status || 'pending',
        paymentStatusLabel: payment?.status_label || 'Chưa đóng',
        paymentAmount: payment?.amount || request?.amount_per_student || 0,
        paymentDate: payment?.payment_date || null,
      };
    });
  }, [students, payments, request]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
          <div className="space-y-4">
            <div className="h-6 w-64 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 rounded bg-gray-200 dark:bg-gray-700" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="rounded-lg bg-primary-pastel border border-primary/30 p-6 text-primary dark:bg-primary/20 dark:border-primary/40 dark:text-primary-light">
        <h3 className="font-medium mb-2">Lỗi tải dữ liệu</h3>
        <p>{error || "Không tìm thấy yêu cầu đóng học phí"}</p>
        <Button
          onClick={onBack}
          variant="outline"
          size="sm"
          icon={<ArrowLeftIcon />}
          className="mt-4"
        >
          Quay lại
        </Button>
      </div>
    );
  }

  const completionRate = stats.completion_rate || 0;
  const isFullyPaid = stats.is_fully_paid || false;
  const isOverdue = stats.is_overdue || false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button
          onClick={onBack}
          variant="outline"
          size="sm"
          icon={<ArrowLeftIcon />}
          className="w-full sm:w-auto justify-center"
        >
          Quay lại
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
            {request.period_name}
          </h2>
          {request.period_month && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 break-words">
              Tháng: {request.period_month}
            </p>
          )}
        </div>
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-medium mt-1 sm:mt-0 self-start sm:self-auto ${request.status === 'active'
            ? 'bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]'
            : request.status === 'pending'
              ? 'bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]'
              : 'bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]'
            }`}
        >
          {request.status_label ||
            (request.status === 'active' ? 'Đang áp dụng' :
              request.status === 'pending' ? 'Chưa bắt đầu' :
                'Đã hủy')}
        </span>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        <div className="rounded-lg bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-800">
          <div className="flex items-center gap-3 mb-1.5 sm:mb-2">
            <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
              <UserGroupIcon className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600 dark:text-gray-300" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Tất cả</p>
              <p className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                {stats.total_students || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-800">
          <div className="flex items-center gap-3 mb-1.5 sm:mb-2">
            <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
              <CheckCircleIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary dark:text-primary-light" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Đã đóng</p>
              <p className="text-lg sm:text-xl md:text-2xl font-semibold text-primary dark:text-primary-light">
                {stats.paid_students || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-800">
          <div className="flex items-center gap-3 mb-1.5 sm:mb-2">
            <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
              <ClockIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary dark:text-primary-light" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Chưa đóng</p>
              <p className="text-lg sm:text-xl md:text-2xl font-semibold text-primary dark:text-primary-light">
                {stats.unpaid_students || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-800">
          <div className="flex items-center gap-3 mb-1.5 sm:mb-2">
            <div className="p-2 bg-primary-100 bg-primary-pastel/40 rounded-lg">
              <ChartBarIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary dark:text-primary-light" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Tỷ lệ hoàn thành</p>
              <p className="text-lg sm:text-xl md:text-2xl font-semibold text-primary dark:text-primary-light">
                {completionRate.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Left: Payment Info */}
        <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Thông tin đợt đóng học phí
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Tên đợt
              </label>
              <p className="text-gray-900 dark:text-white font-medium">
                {request.period_name}
              </p>
            </div>

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

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Số tiền mỗi học viên
              </label>
              <p className="text-gray-900 dark:text-white font-semibold text-lg">
                {request.amount_per_student_formatted || formatCurrency(request.amount_per_student || 0)}
              </p>
            </div>

            {request.due_date && (
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Hạn đóng
                </label>
                <p className={`font-semibold ${isOverdue ? 'text-primary dark:text-primary-light' : 'text-gray-900 dark:text-white'
                  }`}>
                  {new Date(request.due_date).toLocaleDateString('vi-VN', {
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })}
                  {isOverdue && " (Quá hạn)"}
                </p>
              </div>
            )}

            {request.description && (
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Mô tả
                </label>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {request.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Financial Summary */}
        <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Tổng kết tài chính
          </h3>
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Tổng tiền dự kiến
              </label>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {formatCurrency(stats.total_expected || 0)}
              </p>
            </div>

            <div className="bg-primary-pastel/30 dark:bg-primary/10 rounded-lg p-3 sm:p-4">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Tổng đã thu
              </label>
              <p className="text-2xl font-semibold text-primary dark:text-primary-light">
                {formatCurrency(stats.total_collected || 0)}
              </p>
            </div>

            <div className="bg-primary-pastel/20 dark:bg-primary/10 rounded-lg p-3 sm:p-4">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Tổng đang chờ
              </label>
              <p className="text-2xl font-semibold text-primary dark:text-primary-light">
                {formatCurrency(stats.total_pending || 0)}
              </p>
            </div>

            <div className="bg-primary-pastel/40 dark:bg-primary/20 rounded-lg p-3 sm:p-4">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Tổng còn nợ
              </label>
              <p className="text-2xl font-semibold text-primary dark:text-primary-light">
                {formatCurrency(stats.total_debt || 0)}
              </p>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Trạng thái
                </span>
                <div className="flex items-center gap-2">
                  {isFullyPaid ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]">
                      <CheckCircleIcon className="h-4 w-4 mr-1" />
                      Đã đóng đủ
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]">
                      <ClockIcon className="h-4 w-4 mr-1" />
                      Chưa đóng đủ
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="rounded-lg bg-white p-4 sm:p-6 dark:bg-gray-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
            Tiến độ thu học phí
          </h3>
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {completionRate.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700">
          <div
            className="bg-primary h-4 rounded-full transition-all duration-300"
            style={{ width: `${completionRate}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Đã đóng: </span>
            <span className="font-semibold text-primary dark:text-primary-light">
              {stats.paid_students || 0}/{stats.total_students || 0} học viên
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Chưa đóng: </span>
            <span className="font-semibold text-primary dark:text-primary-light">
              {stats.unpaid_students || 0}/{stats.total_students || 0} học viên
            </span>
          </div>
        </div>
      </div>

      {/* Students List */}
      <div className="rounded-lg bg-white dark:bg-gray-800">
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <UserGroupIcon className="h-5 w-5" />
            Danh sách học viên ({studentsWithPaymentStatus.length})
          </h3>
        </div>

        {/* Mobile Card View */}
        <div className="block lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
          {studentsWithPaymentStatus.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Chưa có học viên nào
            </div>
          ) : (
            studentsWithPaymentStatus.map((student: any) => {
              const isPaid = student.paymentStatus === 'paid';
              const isPending = student.paymentStatus === 'pending';
              const isFailed = student.paymentStatus === 'failed';
              const isRefunded = student.paymentStatus === 'refunded';

              return (
                <div key={getObjId(student)} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <UserInfoBox
                        name={student.name || "Chưa có tên"}
                        email={student.email || "Chưa có email"}
                        emailVerified={student.email_verified || false}
                        avatar={student.avatar}
                        phone={student.phone}
                        size="sm"
                        layout="horizontal"
                      />
                      <div className="flex-shrink-0">
                        {isPaid ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]">
                            <CheckCircleIcon className="h-3.5 w-3.5 mr-1" />
                            Đã đóng
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]">
                            <ClockIcon className="h-3.5 w-3.5 mr-1" />
                            Chờ thanh toán
                          </span>
                        ) : isFailed ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--status-badge-error)] text-[var(--status-badge-error-text)]">
                            <XCircleIcon className="h-3.5 w-3.5 mr-1" />
                            Thất bại
                          </span>
                        ) : isRefunded ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]">
                            <XCircleIcon className="h-3.5 w-3.5 mr-1" />
                            Đã hoàn tiền
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                            Chưa đóng
                          </span>
                        )}
                      </div>
                    </div>
                    {student.payment && getObjId(student.payment) && (
                      <ButtonLink
                        href={`/payments/${getObjId(student.payment)}`}
                        variant="ghost"
                        size="sm"
                        icon={<EyeIcon />}
                        className="flex-shrink-0"
                      >
                        <span className="hidden sm:inline">Xem</span>
                      </ButtonLink>
                    )}
                  </div>
                  <div className="mt-3 space-y-1">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(student.paymentAmount)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Ngày thanh toán:{" "}
                      {student.paymentDate ? (
                        new Date(student.paymentDate).toLocaleDateString("vi-VN")
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Học viên
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Số tiền
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Ngày thanh toán
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {studentsWithPaymentStatus.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    Chưa có học viên nào
                  </td>
                </tr>
              ) : (
                studentsWithPaymentStatus.map((student: any) => {
                  const isPaid = student.paymentStatus === "paid";
                  const isPending = student.paymentStatus === "pending";
                  const isFailed = student.paymentStatus === "failed";
                  const isRefunded = student.paymentStatus === "refunded";

                  return (
                    <tr
                      key={getObjId(student)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <UserInfoBox
                          name={student.name || "Chưa có tên"}
                          email={student.email || "Chưa có email"}
                          emailVerified={student.email_verified || false}
                          avatar={student.avatar}
                          phone={student.phone}
                          size="sm"
                          layout="horizontal"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatCurrency(student.paymentAmount)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isPaid ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]">
                            <CheckCircleIcon className="h-3.5 w-3.5 mr-1" />
                            Đã đóng
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]">
                            <ClockIcon className="h-3.5 w-3.5 mr-1" />
                            Chờ thanh toán
                          </span>
                        ) : isFailed ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--status-badge-error)] text-[var(--status-badge-error-text)]">
                            <XCircleIcon className="h-3.5 w-3.5 mr-1" />
                            Thất bại
                          </span>
                        ) : isRefunded ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]">
                            <XCircleIcon className="h-3.5 w-3.5 mr-1" />
                            Đã hoàn tiền
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]">
                            Chưa đóng
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {student.paymentDate ? (
                          new Date(student.paymentDate).toLocaleDateString("vi-VN")
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {student.payment && getObjId(student.payment) && (
                          <ButtonLink
                            href={`/payments/${getObjId(student.payment)}`}
                            variant="ghost"
                            size="sm"
                            icon={<EyeIcon />}
                          >
                            Xem
                          </ButtonLink>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

