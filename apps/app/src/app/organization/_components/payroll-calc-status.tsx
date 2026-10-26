"use client";

// Banner trạng thái vòng đời TÍNH LƯƠNG (job chạy nền ComputePayrollPeriod).
// Đặt ở trang chi tiết kỳ lương: người dùng bấm "Tính lương" là job ngầm — không
// còn "toast xong rồi tự mò F5" mà thấy rõ đang chạy / xong / lỗi ngay tại chỗ.

import { useEffect, useState } from "react";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import Button from "@/components/Common/Button";
import {
  calcInFlight,
  isCalcStale,
  calcStatusStartedMs,
} from "./payroll-ui";
import type { PayrollPeriod } from "@/types/org-payroll";

const STALE_AFTER_MS = 2 * 60 * 1000; // 2 phút không nhúc nhích → nghi queue worker chết

function elapsedLabel(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}p${s % 60 > 0 ? ` ${s % 60}s` : ""}`;
}

function timeLabel(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

/**
 * @param onCompute  gọi lại khi bấm "Thử lại" (chính là mutate compute).
 * @param computing  state loading của mutate compute (để disable nút).
 */
export function CalculationStatusPanel({
  period,
  onCompute,
  computing,
}: {
  period: PayrollPeriod | null | undefined;
  onCompute: () => void;
  computing: boolean;
}) {
  const status = period?.calculation_status;
  const inFlight = calcInFlight(status);
  // Mốc đo "kẹt": worker nhận việc (calculation_started_at); nếu còn "queued" —
  // chưa được nhận — thì đo từ updated_at (≈ lúc server dispatch job).
  const flightRef = period?.calculation_started_at ?? period?.updated_at ?? null;
  const stale = isCalcStale(status, flightRef, STALE_AFTER_MS);
  const startedMs = calcStatusStartedMs(status, period?.calculation_started_at);

  // Đồng hồ chạy: chỉ tick khi job đang in-flight (polling 3s của trang đã cập
  // nhật dữ liệu; tick cục bộ 1s để số giây mượt, không phụ thuộc polling).
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!inFlight) return;
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [inFlight]);

  if (!status || status === "not_started") return null;

  // ---- FAILED -------------------------------------------------------------
  if (status === "failed") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ExclamationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
              Tính lương thất bại
            </p>
            <p className="mt-0.5 break-words text-sm text-red-600/90 dark:text-red-300/80">
              {period?.calculation_error || "Đã xảy ra lỗi khi tính lương cho kỳ này."}
              {timeLabel(period?.updated_at) ? ` (${timeLabel(period?.updated_at)})` : ""}
            </p>
          </div>
        </div>
        {!computing && (
          <Button
            size="sm"
            variant="outline"
            icon={<ArrowPathIcon />}
            onClick={onCompute}
            disabled={computing}
            lockAware={false}
            className="shrink-0"
          >
            Thử lại
          </Button>
        )}
      </div>
    );
  }

  // ---- QUEUED / COMPUTING -------------------------------------------------
  if (inFlight) {
    return (
      <div
        className={`rounded-xl border p-4 ${
          stale
            ? "border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20"
            : "border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/20"
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent ${
              stale
                ? "text-amber-600 dark:text-amber-400"
                : "text-blue-600 dark:text-blue-400"
            }`}
          />
          <p
            className={`text-sm font-medium ${
              stale
                ? "text-amber-700 dark:text-amber-300"
                : "text-blue-700 dark:text-blue-300"
            }`}
          >
            {status === "queued" ? "Đang chờ tính lương" : "Đang tính lương"}
            {startedMs !== null ? ` — đã chạy ${elapsedLabel(startedMs)}` : ""}
          </p>
        </div>
        {stale && (
          <div className="mt-3 flex items-start gap-2 border-t border-amber-200/70 pt-3 dark:border-amber-800/50">
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Lượt tính này đã quá {Math.round(STALE_AFTER_MS / 60000)} phút mà chưa xong.
              Có thể queue worker chưa chạy — kiểm tra{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 text-xs dark:bg-amber-900/50">
                php artisan queue:work
              </code>{" "}
              rồi tải lại trang.
            </p>
          </div>
        )}
      </div>
    );
  }

  // ---- COMPLETED ----------------------------------------------------------
  return (
    <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-900/20">
      <CheckCircleIcon className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
      <p className="text-sm font-medium text-green-700 dark:text-green-300">
        Đã tính xong{ltime(period?.computed_at)}
      </p>
    </div>
  );
}

function ltime(iso?: string | null): string {
  const t = timeLabel(iso);
  return t ? ` lúc ${t}` : "";
}
