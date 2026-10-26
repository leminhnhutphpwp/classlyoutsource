"use client";
import type { ReactNode } from "react";
import Pagination from "@/components/Common/Pagination";
import type { PaginationMeta } from "@/hooks/use-api/family";

export type Column<T> = {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
};

type ResourceViewProps<T> = {
  data: T[];
  columns: Column<T>[];
  loading: boolean;
  error: string | null;
  meta: PaginationMeta | null;
  currentPage: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  rowKey: (row: T, index: number) => string;
  emptyIcon: ReactNode;
  emptyTitle: string;
  emptyHint: string;
  itemLabel: string;
};

/**
 * Shared table + states (skeleton / error / empty / pagination) for the parent
 * child-resource pages (schedule, attendance, grades, assignments).
 */
export default function ResourceView<T>({
  data,
  columns,
  loading,
  error,
  meta,
  currentPage,
  onPageChange,
  onRetry,
  rowKey,
  emptyIcon,
  emptyTitle,
  emptyHint,
  itemLabel,
}: ResourceViewProps<T>) {
  if (loading) {
    return (
      <div className="space-y-3 rounded-2xl bg-white p-5 dark:bg-gray-800">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700/40" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center dark:bg-gray-800">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Không thể tải dữ liệu</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{error}</p>
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-opacity-90"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center dark:bg-gray-800">
        <div className="mx-auto mb-4 h-14 w-14 text-gray-300 dark:text-gray-600">{emptyIcon}</div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{emptyTitle}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl bg-white dark:bg-gray-800">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.header}
                  className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 ${col.className || ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
            {data.map((row, index) => (
              <tr key={rowKey(row, index)} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                {columns.map((col) => (
                  <td
                    key={col.header}
                    className={`px-4 py-4 text-sm text-gray-700 dark:text-gray-300 ${col.className || ""}`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && (
        <Pagination
          meta={meta}
          currentPage={currentPage}
          onPageChange={onPageChange}
          itemLabel={itemLabel}
        />
      )}
    </div>
  );
}

/** Shared date/value formatting helpers with defensive field fallbacks. */
export function formatDate(value: unknown): string {
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("vi-VN");
}

export function pick(row: Record<string, any>, ...keys: string[]): any {
  for (const key of keys) {
    const parts = key.split(".");
    let val: any = row;
    for (const p of parts) {
      val = val?.[p];
      if (val === undefined || val === null) break;
    }
    if (val !== undefined && val !== null && val !== "") return val;
  }
  return undefined;
}
