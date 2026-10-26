"use client";

import { ReactNode } from "react";
import { EyeIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import Tooltip from "@/components/Common/Tooltip";
import ButtonLink from "@/components/Common/ButtonLink";
import Button from "@/components/Common/Button";
import { getObjId } from "@/lib/id-utils";

interface ScheduleData {
  id: string | number;
  name?: string;
  description?: string;
  class?: {
    name: string;
  };
  status?: string;
  status_label?: string;
  start_time?: string;
  end_time?: string;
  time_range?: string;
  duration?: number;
  day_name?: string;
  day_of_week?: number;
  recurring_days?: string;
  start_date?: string;
  end_date?: string;
  room?: string;
  location?: string;
  default_mode?: string;
  online_platform?: string;
  recurring_type?: string;
}

interface ScheduleListCardProps {
  schedule: ScheduleData;
  canManage?: boolean;
  onDelete?: (id: string | number) => void;
  actions?: ReactNode;
  className?: string;
}

const getStatusBadgeClass = (status?: string) => {
  switch (status) {
    case "upcoming":
      return "bg-[var(--status-badge-pending)] text-[var(--status-badge-pending-text)]";
    case "in_progress":
      return "bg-[var(--status-badge-active)] text-[var(--status-badge-active-text)]";
    case "paused":
      return "bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]";
    case "completed":
      return "bg-[var(--status-badge-completed)] text-[var(--status-badge-completed-text)]";
    default:
      return "bg-[var(--status-badge-inactive)] text-[var(--status-badge-inactive-text)]";
  }
};

const getStatusLabel = (schedule: ScheduleData) => {
  if (schedule.status_label) return schedule.status_label;

  switch (schedule.status) {
    case "upcoming":
      return "Sắp bắt đầu";
    case "in_progress":
      return "Đang diễn ra";
    case "paused":
      return "Tạm dừng";
    case "completed":
      return "Đã hoàn thành";
    default:
      return schedule.status || "Chưa xác định";
  }
};

const getModeLabel = (mode?: string) => {
  if (!mode) return "";
  if (mode === "online") return "Trực tuyến";
  if (mode === "offline") return "Trực tiếp";
  return mode;
};

const getRecurringTypeLabel = (type?: string) => {
  if (!type) return "";
  if (type === "daily") return "Hàng ngày";
  if (type === "weekly") return "Hàng tuần";
  if (type === "monthly") return "Hàng tháng";
  return type;
};

export function ScheduleListCard({
  schedule,
  canManage = false,
  onDelete,
  actions,
  className = "",
}: ScheduleListCardProps) {
  return (
    <div
      className={`flex flex-col rounded-lg bg-white p-6 transition-shadow dark:bg-gray-800 ${className}`}
    >
      <div className="mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {schedule.class?.name || "Chưa phân lớp"}
          </h3>
          {schedule.name && schedule.name !== schedule.class?.name && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {schedule.name}
            </p>
          )}
          {schedule.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
              {schedule.description}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <div className="grid grid-cols-[90px_1fr] items-center gap-2 text-sm">
          <span className="text-gray-500 dark:text-gray-400">Trạng thái:</span>
          <div>
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(
                schedule.status
              )}`}
            >
              {getStatusLabel(schedule)}
            </span>
          </div>
        </div>

        {schedule.start_time && schedule.end_time && (
          <div className="grid grid-cols-[90px_1fr] items-baseline gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Thời gian:</span>
            <span className="font-medium text-gray-900 dark:text-white break-words">
              {schedule.time_range ||
                `${schedule.start_time} - ${schedule.end_time}`}
              {schedule.duration && (
                <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">
                  ({schedule.duration} phút)
                </span>
              )}
            </span>
          </div>
        )}

        {(schedule.day_name || schedule.day_of_week) && (
          <div className="grid grid-cols-[90px_1fr] items-baseline gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Ngày học:</span>
            <span className="font-medium text-gray-900 dark:text-white break-words">
              {schedule.day_name || `Thứ ${schedule.day_of_week}`}
              {schedule.recurring_days && ` (${schedule.recurring_days})`}
            </span>
          </div>
        )}

        {(schedule.start_date || schedule.end_date) && (
          <div className="grid grid-cols-[90px_1fr] items-baseline gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Thời hạn:</span>
            <span className="font-medium text-gray-900 dark:text-white break-words">
              {schedule.start_date &&
                new Date(schedule.start_date).toLocaleDateString("vi-VN")}
              {schedule.start_date && schedule.end_date && " - "}
              {schedule.end_date &&
                new Date(schedule.end_date).toLocaleDateString("vi-VN")}
            </span>
          </div>
        )}

        {(schedule.room || schedule.location) && (
          <div className="grid grid-cols-[90px_1fr] items-baseline gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Địa điểm:</span>
            <span className="font-medium text-gray-900 dark:text-white break-words">
              {schedule.room || schedule.location || "Chưa thiết lập"}
            </span>
          </div>
        )}

        {schedule.default_mode && (
          <div className="grid grid-cols-[90px_1fr] items-baseline gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Chế độ:</span>
            <span className="font-medium text-gray-900 dark:text-white break-words">
              {getModeLabel(schedule.default_mode)}
              {schedule.default_mode === 'online' && schedule.online_platform && ` (${schedule.online_platform})`}
            </span>
          </div>
        )}

        {schedule.recurring_type && (
          <div className="grid grid-cols-[90px_1fr] items-baseline gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Lặp lại:</span>
            <span className="font-medium text-gray-900 dark:text-white break-words">
              {getRecurringTypeLabel(schedule.recurring_type)}
            </span>
          </div>
        )}
      </div>

      {actions ? (
        <div className="mt-auto flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          {actions}
        </div>
      ) : (
        (() => {
          const scheduleId = getObjId(schedule);
          const scheduleIdString = String(scheduleId);

          return (
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              <ButtonLink
                href={`/schedules/${scheduleIdString}`}
                variant="outline"
                size="sm"
                icon={<EyeIcon />}
                className="flex-1 min-w-[140px] justify-center"
                aria-label="Xem buổi học"
              >
                Xem buổi học
              </ButtonLink>
              {canManage && (
                <div className="flex items-center gap-2">
                  <Tooltip label="Chỉnh sửa">
                    <ButtonLink
                      href={`/schedules/${scheduleIdString}/edit`}
                      variant="outline"
                      size="sm"
                      icon={<PencilIcon />}
                      className="flex-shrink-0"
                      aria-label="Chỉnh sửa"
                    >
                      <span className="sr-only">Chỉnh sửa</span>
                    </ButtonLink>
                  </Tooltip>
                  {onDelete && (
                    <Tooltip label="Xóa">
                      <Button
                        onClick={() => onDelete(scheduleIdString)}
                        variant="danger"
                        size="sm"
                        icon={<TrashIcon />}
                        className="flex-shrink-0"
                        aria-label="Xóa"
                      >
                        <span className="sr-only">Xóa</span>
                      </Button>
                    </Tooltip>
                  )}
                </div>
              )}
            </div>
          );
        })()
      )}
    </div>
  );
}

