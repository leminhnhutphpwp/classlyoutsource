"use client";

import { SparklesIcon } from "@heroicons/react/24/outline";
import { useOrgAiUsage } from "@/hooks/use-api";
import { CardSkeleton } from "@/components/ui/loading";
import { Panel, EmptyRow, TableHead } from "./finance-ui";
import { num } from "./finance-format";
import type { AiUsageBucket } from "@/types/org-finance";

function limitLabel(b?: AiUsageBucket): string {
  if (!b) return "—";
  if (b.limit === null) return `${num(b.used)} · không giới hạn`;
  return `${num(b.used)} / ${num(b.limit)}`;
}

function remainingLabel(b?: AiUsageBucket): string {
  if (!b) return "—";
  if (b.limit === null || b.remaining === null) return "Không giới hạn";
  return num(b.remaining);
}

/** Thẻ hạn mức AI dùng chung của trung tâm (pool) + phân bổ theo giáo viên. */
export function AiUsageCard({ orgHash }: { orgHash: string }) {
  const { data, loading, error } = useOrgAiUsage(orgHash);

  if (loading && !data) return <CardSkeleton lines={3} />;
  if (error && !data) return null; // Không phá layout tổng quan nếu lỗi.

  const pool = data?.pool;
  const breakdown = data?.breakdown ?? [];

  return (
    <Panel
      title="Hạn mức AI của trung tâm"
      subtitle="Lượt gọi AI dùng chung cho cả trung tâm trong kỳ hiện tại"
    >
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-6">
        <div className="rounded-lg border border-gray-100 p-4 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-primary" />
            <p className="text-sm font-medium text-dark dark:text-white">Lượt gọi AI</p>
          </div>
          <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
            {limitLabel(pool?.calls)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Còn lại: {remainingLabel(pool?.calls)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-100 p-4 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-primary" />
            <p className="text-sm font-medium text-dark dark:text-white">Lượt tạo nội dung</p>
          </div>
          <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
            {limitLabel(pool?.generate)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Còn lại: {remainingLabel(pool?.generate)}
          </p>
        </div>
      </div>

      {breakdown.length > 0 ? (
        <div className="overflow-x-auto border-t border-gray-200 dark:border-gray-700">
          <table className="w-full min-w-[420px] text-left text-sm">
            <TableHead>
              <tr>
                <th className="px-4 py-3 sm:px-6">Giáo viên</th>
                <th className="px-4 py-3 text-right">Lượt gọi</th>
                <th className="px-4 py-3 text-right sm:px-6">Lượt tạo</th>
              </tr>
            </TableHead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {breakdown.map((r, i) => (
                <tr key={r.tutor_id ?? i} className="text-gray-900 dark:text-gray-200">
                  <td className="px-4 py-3 font-medium sm:px-6">{r.tutor_name ?? "—"}</td>
                  <td className="px-4 py-3 text-right">{num(r.calls)}</td>
                  <td className="px-4 py-3 text-right sm:px-6">{num(r.generate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyRow message="Chưa có dữ liệu sử dụng AI." />
      )}
    </Panel>
  );
}
