"use client";

import { cn } from "@/lib/utils";
import type { PayrollPeriodStatus, PayModel } from "@/types/org-payroll";

export const PERIOD_STATUS_LABELS: Record<PayrollPeriodStatus, string> = {
  draft: "Nháp",
  computing: "Đang tính",
  computed: "Đã tính",
  approved: "Đã duyệt",
  paid: "Đã trả",
  cancelled: "Đã hủy",
};

const PERIOD_STATUS_STYLES: Record<PayrollPeriodStatus, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  computing: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  computed: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  approved: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  paid: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export function PeriodStatusBadge({
  status,
  className,
}: {
  status: PayrollPeriodStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        PERIOD_STATUS_STYLES[status] ?? PERIOD_STATUS_STYLES.draft,
        className
      )}
    >
      {PERIOD_STATUS_LABELS[status] ?? status}
    </span>
  );
}

export const PAY_MODEL_LABELS: Record<PayModel, string> = {
  fixed_monthly: "Lương cố định/tháng",
  per_session: "Theo buổi",
  revenue_share: "Chia doanh thu",
};

// ---- Vòng đời tính lương (job chạy nền) -------------------------------------
// Backend: App\Models\PayrollPeriod::CALC_* — not_started → queued → computing →
// completed | failed. Đây là trạng thái CỦA LƯỢT TÍNH (calculation_status), khác
// với trạng thái kỳ lương (status: draft/approved/...).

export type CalcStatus =
  | "not_started"
  | "queued"
  | "computing"
  | "completed"
  | "failed";

export const CALC_IN_FLIGHT: CalcStatus[] = ["queued", "computing"];

export function calcInFlight(status?: string | null): boolean {
  return !!status && (CALC_IN_FLIGHT as string[]).includes(status);
}

export function isCalcStale(
  status?: string | null,
  startedAt?: string | null,
  staleAfterMs = 2 * 60 * 1000,
): boolean {
  // Kẹt = vẫn đang chạy sau ngưỡng (default 2 phút). Tính từ lúc worker NHẬN
  // việc (calculation_started_at); nếu chưa được nhận (queued) thì từ updated_at
  // — dấu hiệu điển hình là queue worker không chạy.
  if (!status || !calcInFlight(status)) return false;
  const reference = startedAt ? new Date(startedAt).getTime() : NaN;
  if (!Number.isNaN(reference)) return Date.now() - reference > staleAfterMs;
  return false; // chưa có mốc thời gian tin được → chưa kết luận
}

export function calcStatusStartedMs(
  status?: string | null,
  startedAt?: string | null,
): number | null {
  if (!calcInFlight(status)) return null;
  const t = startedAt ? new Date(startedAt).getTime() : NaN;
  return Number.isNaN(t) ? null : Date.now() - t;
}

const CALC_LABELS: Record<CalcStatus, string> = {
  not_started: "Chưa tính",
  queued: "Đang chờ tính",
  computing: "Đang tính",
  completed: "Đã tính xong",
  failed: "Tính lỗi",
};

const CALC_STYLES: Record<CalcStatus, string> = {
  not_started: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  queued: "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  computing:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  completed:
    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export function CalcStatusBadge({
  status,
  className,
}: {
  status?: string | null;
  className?: string;
}) {
  if (!status || status === "not_started") return null;
  const key = (CALC_LABELS as Record<string, string>)[status] ? status : null;
  if (!key) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        CALC_STYLES[key as CalcStatus],
        className,
      )}
    >
      {calcInFlight(status) && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {CALC_LABELS[key as CalcStatus]}
    </span>
  );
}
