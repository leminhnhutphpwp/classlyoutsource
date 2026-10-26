"use client";

import Link from "next/link";
import Tooltip from "@/components/Common/Tooltip";

interface StatusConfig {
  calendarBgColor: string;
  bgColor: string;
  color: string;
  label: string;
}

interface ScheduleItem {
  id: string | number;
  session_date?: string;
  date?: string;
  schedule_name?: string;
  class?: {
    name: string;
  };
  class_name?: string;
  time_range?: string;
  start_time?: string;
  end_time?: string;
  status?: string;
  room?: string;
  class_id?: string | number;
  schedule_id?: string | number;
}

interface CalendarScheduleCardProps {
  item: ScheduleItem;
  isSession: boolean;
  statusConfig: StatusConfig;
  colorClass: string;
  linkUrl: string;
  className?: string;
}

export function CalendarScheduleCard({
  item,
  isSession,
  statusConfig,
  colorClass,
  linkUrl,
  className = "",
}: CalendarScheduleCardProps) {
  const classNameDisplay =
    item.schedule_name ||
    item.class?.name ||
    item.class_name ||
    "Lớp học";
  const timeRange =
    item.time_range ||
    (item.start_time && item.end_time
      ? `${item.start_time} - ${item.end_time}`
      : "");

  return (
    <Tooltip label="Xem buổi học">
      <Link
        href={linkUrl}
        prefetch={true}
        className={`block p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary transition-colors group ${className}`}
        aria-label="Xem buổi học"
      >
        <div className="flex items-start gap-3">
          <div className={`w-1 h-full rounded ${colorClass}`} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-gray-900 dark:text-white group-hover:text-primary dark:group-hover:text-primary transition-colors">
                {classNameDisplay}
              </h4>
              {isSession && item.status && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
                >
                  {statusConfig.label}
                </span>
              )}
            </div>
            {timeRange && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {timeRange}
              </p>
            )}
            {item.room && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Phòng: {item.room}
              </p>
            )}
          </div>
        </div>
      </Link>
    </Tooltip>
  );
}

