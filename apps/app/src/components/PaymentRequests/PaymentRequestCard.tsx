"use client";

import { ReactNode, memo } from "react";
import {
  EyeIcon,
  TrashIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ClockIcon,
  ChartBarIcon,
  PlayIcon,
  PauseIcon,
} from "@heroicons/react/24/outline";
import Button from "@/components/Common/Button";
import { formatCurrency } from "@/lib/format-currency";
import { getObjId } from "@/lib/id-utils";

interface PaymentRequestStatistics {
  total_students?: number;
  paid_students?: number;
  unpaid_students?: number;
  completion_rate?: number;
  is_fully_paid?: boolean;
  is_overdue?: boolean;
  total_collected?: number;
  total_debt?: number;
}

interface PaymentRequestData {
  id: string | number;
  period_name: string;
  period_month?: string;
  description?: string;
  status?: string;
  status_label?: string;
  amount_per_student?: number;
  amount_per_student_formatted?: string;
  due_date?: string;
  statistics?: PaymentRequestStatistics;
}

interface PaymentRequestCardProps {
  request: PaymentRequestData;
  canManage?: boolean;
  onViewClick?: (id: string | number) => void;
  onActivate?: (id: string | number) => void;
  onDeactivate?: (id: string | number) => void;
  onDelete?: (id: string | number) => void;
  actions?: ReactNode;
  className?: string;
}

const getStatusBadgeClass = (status?: string) => {
  const requestStatus = (status || "").toString().toLowerCase().trim();
  if (requestStatus === "active") {
    return "bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]";
  }
  if (requestStatus === "pending") {
    return "bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]";
  }
  return "bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]";
};

const getStatusLabel = (request: PaymentRequestData) => {
  if (request.status_label) return request.status_label;
  const requestStatus = (request.status || "").toString().toLowerCase().trim();
  if (requestStatus === "active") return "Đang áp dụng";
  if (requestStatus === "pending") return "Chưa bắt đầu";
  return "Đã hủy";
};

function PaymentRequestCardComponent({
  request,
  canManage = false,
  onViewClick,
  onActivate,
  onDeactivate,
  onDelete,
  actions,
  className = "",
}: PaymentRequestCardProps) {
  const stats = request.statistics || {};
  const completionRate = stats.completion_rate || 0;
  const isOverdue = stats.is_overdue || false;
  const requestStatus = (request.status || "").toString().toLowerCase().trim();
  const isPending = requestStatus === "pending";
  const isActive = requestStatus === "active";

  return (
    <div
      className={`rounded-lg bg-white p-6 dark:bg-gray-800 transition-shadow ${className}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        {/* Left: Info */}
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                {request.period_name}
              </h3>
              {request.period_month && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Tháng: {request.period_month}
                </p>
              )}
              {request.description && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  {request.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(
                  request.status
                )}`}
              >
                {getStatusLabel(request)}
              </span>
            </div>
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <UserGroupIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Tổng học viên
                </span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {stats.total_students || 0}
              </p>
            </div>

            <div className="bg-primary-pastel/30 dark:bg-primary/10 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircleIcon className="h-4 w-4 text-primary dark:text-primary-light" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Đã đóng
                </span>
              </div>
              <p className="text-lg font-semibold text-primary dark:text-primary-light">
                {stats.paid_students || 0}
              </p>
            </div>

            <div className="bg-primary-pastel/30 dark:bg-primary/10 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <ClockIcon className="h-4 w-4 text-primary dark:text-primary-light" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Chưa đóng
                </span>
              </div>
              <p className="text-lg font-semibold text-primary dark:text-primary-light">
                {stats.unpaid_students || 0}
              </p>
            </div>

            <div className="bg-primary-pastel/30 dark:bg-primary/10 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <ChartBarIcon className="h-4 w-4 text-primary dark:text-primary-light" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Tỷ lệ hoàn thành
                </span>
              </div>
              <p className="text-lg font-semibold text-primary dark:text-primary-light">
                {completionRate.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Amount Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Số tiền/học viên
              </span>
              <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                {request.amount_per_student_formatted ||
                  formatCurrency(request.amount_per_student || 0)}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Tổng đã thu
              </span>
              <p className="text-sm font-semibold text-primary dark:text-primary-light mt-1">
                {formatCurrency(stats.total_collected || 0)}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Còn nợ
              </span>
              <p className="text-sm font-semibold text-primary dark:text-primary-light mt-1">
                {formatCurrency(stats.total_debt || 0)}
              </p>
            </div>
          </div>

          {/* Due Date */}
          {request.due_date && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <ClockIcon className="h-4 w-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Hạn đóng:{" "}
                </span>
                <span
                  className={`text-xs font-semibold ${isOverdue
                    ? "text-primary dark:text-primary-light"
                    : "text-gray-900 dark:text-white"
                    }`}
                >
                  {new Date(request.due_date).toLocaleDateString("vi-VN", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                  {isOverdue && " (Quá hạn)"}
                </span>
              </div>
            </div>
          )}

          {/* Actions - Mobile: Show at bottom */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 lg:hidden">
            {actions ? (
              <div className="flex flex-wrap gap-2">
                {actions}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {onViewClick && (
                  <Button
                    onClick={() => onViewClick(getObjId(request))}
                    variant="ghost"
                    size="sm"
                    icon={<EyeIcon />}
                    className="flex-1 min-w-[120px]"
                  >
                    Xem học phí
                  </Button>
                )}
                {isPending && canManage && (
                  <>
                    {onActivate && (
                      <Button
                        onClick={() => onActivate(getObjId(request))}
                        variant="ghost"
                        size="sm"
                        icon={<PlayIcon />}
                        className="text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary flex-1 min-w-[120px]"
                      >
                        Kích hoạt
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        onClick={() => onDelete(getObjId(request))}
                        variant="ghost"
                        size="sm"
                        icon={<TrashIcon />}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex-1 min-w-[120px]"
                      >
                        Xóa
                      </Button>
                    )}
                  </>
                )}
                {isActive && canManage && (
                  <>
                    {onDeactivate && (
                      <Button
                        onClick={() => onDeactivate(getObjId(request))}
                        variant="ghost"
                        size="sm"
                        icon={<PauseIcon />}
                        className="flex-1 min-w-[120px]"
                      >
                        Hủy kích hoạt
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        onClick={() => onDelete(getObjId(request))}
                        variant="ghost"
                        size="sm"
                        icon={<TrashIcon />}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex-1 min-w-[120px]"
                      >
                        Xóa
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions - Desktop */}
        {actions ? (
          <div className="hidden lg:flex flex-col items-end gap-2 flex-shrink-0">
            {actions}
          </div>
        ) : (
          <div className="hidden lg:flex flex-col items-end gap-2 flex-shrink-0">
            {onViewClick && (
              <Button
                onClick={() => onViewClick(getObjId(request))}
                variant="ghost"
                size="sm"
                icon={<EyeIcon />}
              >
                Xem học phí
              </Button>
            )}
            {isPending && canManage && (
              <>
                {onActivate && (
                  <Button
                    onClick={() => onActivate(getObjId(request))}
                    variant="ghost"
                    size="sm"
                    icon={<PlayIcon />}
                    className="text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary"
                  >
                    Kích hoạt
                  </Button>
                )}
                {onDelete && (
                  <Button
                    onClick={() => onDelete(getObjId(request))}
                    variant="ghost"
                    size="sm"
                    icon={<TrashIcon />}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Xóa
                  </Button>
                )}
              </>
            )}
            {isActive && canManage && (
              <>
                {onDeactivate && (
                  <Button
                    onClick={() => onDeactivate(getObjId(request))}
                    variant="ghost"
                    size="sm"
                    icon={<PauseIcon />}
                  >
                    Hủy kích hoạt
                  </Button>
                )}
                {onDelete && (
                  <Button
                    onClick={() => onDelete(getObjId(request))}
                    variant="ghost"
                    size="sm"
                    icon={<TrashIcon />}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Xóa
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const PaymentRequestCard = memo(PaymentRequestCardComponent);
