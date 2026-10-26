"use client";

import { ReactNode } from "react";
import { getObjId } from "@/lib/id-utils";

interface TopListProps {
  title: string;
  items: any[];
  renderItem?: (item: any, index: number) => ReactNode;
  emptyMessage?: string;
  loading?: boolean;
  rankColor?: string;
  valueColor?: string;
}

export default function TopList({
  title,
  items,
  renderItem,
  emptyMessage = "Chưa có dữ liệu",
  loading = false,
  rankColor = "bg-primary/10 text-primary",
  valueColor = "text-gray-900 dark:text-white"
}: TopListProps) {
  if (loading) {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800 h-full">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-6 dark:bg-gray-800 h-full">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
      <div className="space-y-3">
        {items.length > 0 ? (
          items.map((item, index) => {
            const content = renderItem ? renderItem(item, index) : (
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${rankColor}`}>
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{item.name}</div>
                    {item.subtitle && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">{item.subtitle}</div>
                    )}
                  </div>
                </div>
                <div className={`text-right ${valueColor}`}>
                  <div className="font-semibold">{item.value}</div>
                  {item.valueLabel && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">{item.valueLabel}</div>
                  )}
                </div>
              </div>
            );
            return <div key={getObjId(item) || index}>{content}</div>;
          })
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}
