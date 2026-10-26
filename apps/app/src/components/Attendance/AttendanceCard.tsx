"use client";

import { memo } from "react";

type AttendanceStatus = "present" | "absent" | "late" | "excused";

interface AttendanceRecord {
  id: string | number;
  status: AttendanceStatus;
  class?: {
    name: string;
  };
  date: string;
  check_in_time?: string;
  check_out_time?: string;
  note?: string;
}

interface AttendanceCardProps {
  record: AttendanceRecord;
  className?: string;
}

const getStatusConfig = (status: AttendanceStatus) => {
  const configs = {
    present: {
      iconBg: "bg-primary-pastel/40",
      iconColor: "text-primary",
      icon: "✓",
      badgeBg: "bg-primary-pastel text-primary",
      label: "Có mặt",
    },
    absent: {
      iconBg: "bg-red-50 dark:bg-red-900/30",
      iconColor: "text-red-600 dark:text-red-400",
      icon: "✗",
      badgeBg: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      label: "Vắng",
    },
    late: {
      iconBg: "bg-primary-pastel/40",
      iconColor: "text-primary-light",
      icon: "⏰",
      badgeBg: "bg-primary-pastel/60 text-primary-light",
      label: "Đi muộn",
    },
    excused: {
      iconBg: "bg-primary-pastel/40",
      iconColor: "text-primary",
      icon: "✓",
      badgeBg: "bg-primary-pastel/40 text-primary",
      label: "Có phép",
    },
  };

  return (
    configs[status] || {
      iconBg: "bg-gray-50 dark:bg-gray-700",
      iconColor: "text-gray-600 dark:text-gray-400",
      icon: "?",
      badgeBg: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
      label: "Chưa xác định",
    }
  );
};

function AttendanceCardComponent({ record, className = "" }: AttendanceCardProps) {
  const statusConfig = getStatusConfig(record.status);

  return (
    <div
      className={`rounded-lg bg-white p-5 border border-gray-100 transition-all dark:bg-gray-800 dark:border-gray-700 ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full flex-shrink-0 ${statusConfig.iconBg}`}
          >
            <span className={`text-lg font-semibold ${statusConfig.iconColor}`}>
              {statusConfig.icon}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                {record.class?.name || "Chưa có lớp"}
              </h4>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${statusConfig.badgeBg}`}
              >
                {statusConfig.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 dark:text-gray-400">Ngày:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {new Date(record.date).toLocaleDateString("vi-VN")}
                </span>
              </div>
              {record.check_in_time && (
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 dark:text-gray-400">Vào:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {record.check_in_time}
                  </span>
                </div>
              )}
              {record.check_out_time && (
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 dark:text-gray-400">Ra:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {record.check_out_time}
                  </span>
                </div>
              )}
            </div>
            {record.note && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium text-gray-600 dark:text-gray-400">
                    Ghi chú:{" "}
                  </span>
                  {record.note}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const AttendanceCard = memo(AttendanceCardComponent);
