"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Thẻ số liệu tổng hợp (P&L card, cashflow summary...). */
export function StatCard({
  label,
  value,
  valueClass,
  hint,
}: {
  label: string;
  value: ReactNode;
  valueClass?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg bg-white p-4 dark:bg-gray-800 md:p-5">
      <p className="truncate text-[11px] font-medium text-gray-500 dark:text-gray-400 sm:text-xs">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold text-gray-900 dark:text-white md:text-xl",
          valueClass
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

/** Khung card có tiêu đề + vùng thao tác (export...). */
export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg bg-white dark:bg-gray-800", className)}>
      <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-dark dark:text-white sm:text-lg">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

export function EmptyRow({ message }: { message: string }) {
  return (
    <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
      {message}
    </div>
  );
}

/** <thead> chuẩn hoá kiểu bảng trong app. */
export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-gray-2 text-xs uppercase text-gray-500 dark:bg-dark-2 dark:text-gray-400">
      {children}
    </thead>
  );
}
