"use client";
import { useMemo, useState } from "react";
import { XMarkIcon, ClockIcon, MapPinIcon } from "@heroicons/react/24/outline";

/**
 * Read-only month calendar for the parent portal child-schedule page.
 *
 * Deliberately self-contained (no navigation / edit affordances) instead of
 * reusing the tutor `CalendarView`, whose day cells, tooltip and "+N" modal all
 * navigate to tutor routes (`/schedule-sessions/{id}`, `/schedules/{id}`) that
 * live outside the parent portal. A parent must only *view* their child's
 * sessions, so this grid renders sessions and nothing clickable leaves the page.
 */

export type CalendarSession = {
  id: string;
  className: string;
  timeRange: string;
  room?: string;
  status: string;
};

type Props = {
  sessionsByDate: Record<string, CalendarSession[]>;
  selectedMonth: Date;
  loading: boolean;
};

const STATUS: Record<string, { label: string; dot: string; bar: string; badge: string }> = {
  scheduled: { label: "Đã lên lịch", dot: "bg-primary", bar: "bg-primary", badge: "bg-primary/10 text-primary" },
  ongoing: { label: "Đang diễn ra", dot: "bg-primary-light", bar: "bg-primary-light", badge: "bg-primary-light/15 text-primary" },
  completed: { label: "Đã hoàn thành", dot: "bg-primary-pastel", bar: "bg-primary-pastel", badge: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" },
  cancelled: { label: "Đã hủy", dot: "bg-red-500", bar: "bg-red-500", badge: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400" },
  postponed: { label: "Hoãn lại", dot: "bg-gray-500", bar: "bg-gray-500", badge: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" },
};

const statusOf = (status: string) => STATUS[status] || STATUS.scheduled;

const toKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const DAY_NAMES = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const DAY_NAMES_FULL = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

export default function ScheduleCalendar({ sessionsByDate, selectedMonth, loading }: Props) {
  const [modalDate, setModalDate] = useState<Date | null>(null);
  const [modalSessions, setModalSessions] = useState<CalendarSession[]>([]);

  // Build a Monday-first 6-week (42 cell) grid for the visible month.
  const calendarDays = useMemo(() => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday
    const daysInMonth = lastDay.getDate();
    const daysToAdd = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const days: Array<{ date: Date; day: number; isCurrentMonth: boolean }> = [];

    for (let i = 0; i < daysToAdd; i++) {
      const d = new Date(year, month, 1 - daysToAdd + i);
      days.push({ date: d, day: d.getDate(), isCurrentMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({ date: new Date(year, month, day), day, isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let day = 1; day <= remaining; day++) {
      days.push({ date: new Date(year, month + 1, day), day, isCurrentMonth: false });
    }
    return days;
  }, [selectedMonth]);

  const getSessions = (date: Date): CalendarSession[] => sessionsByDate[toKey(date)] || [];

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-6 dark:bg-gray-800">
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 42 }).map((_, i) => (
              <div key={i} className="h-20 rounded bg-gray-100 dark:bg-gray-700/40 md:h-28" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl bg-white dark:bg-gray-800">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="grid grid-cols-7 bg-primary text-white">
                {DAY_NAMES.map((day, index) => (
                  <th
                    key={day}
                    className="flex h-12 items-center justify-center p-2 text-xs font-medium sm:h-14 md:text-sm"
                  >
                    <span className="hidden lg:block">{DAY_NAMES_FULL[index]}</span>
                    <span className="block lg:hidden">{day}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, weekIndex) => (
                <tr key={weekIndex} className="grid grid-cols-7">
                  {calendarDays.slice(weekIndex * 7, (weekIndex + 1) * 7).map((dayData, dayIndex) => {
                    const items = dayData.isCurrentMonth ? getSessions(dayData.date) : [];
                    const isToday =
                      dayData.isCurrentMonth &&
                      dayData.date.toDateString() === new Date().toDateString();

                    return (
                      <td
                        key={`${weekIndex}-${dayIndex}`}
                        className={`relative h-20 border border-stroke p-0.5 transition dark:border-dark-3 sm:p-1.5 md:h-32 md:p-2 xl:h-36 ${
                          !dayData.isCurrentMonth
                            ? "bg-gray-50 text-gray-400 dark:bg-gray-900/50 dark:text-gray-600"
                            : ""
                        }`}
                      >
                        <span
                          className={`text-xs font-medium md:text-sm ${
                            isToday
                              ? "text-primary dark:text-primary"
                              : dayData.isCurrentMonth
                                ? "text-dark dark:text-white"
                                : "text-gray-400 dark:text-gray-600"
                          }`}
                        >
                          {dayData.day}
                        </span>

                        {items.length > 0 && (
                          <div className="mt-0.5 flex max-h-[calc(100%-1rem)] flex-col gap-0.5 overflow-y-auto sm:mt-1 sm:gap-1 sm:max-h-[calc(100%-1.5rem)]">
                            {items.slice(0, 3).map((item) => {
                              const cfg = statusOf(item.status);
                              return (
                                <div
                                  key={item.id}
                                  title={`${item.className}${item.timeRange ? ` - ${item.timeRange}` : ""}`}
                                  className={`flex min-h-[16px] items-center justify-between rounded ${cfg.bar} px-1 py-0.5 text-white opacity-90 sm:min-h-[18px] sm:px-1.5 md:min-h-[20px] md:px-2`}
                                >
                                  <span className="flex-1 truncate text-[9px] font-medium sm:text-[10px] md:text-xs">
                                    <span className="hidden sm:inline">{item.className}</span>
                                    <span className="sm:hidden">{item.className.split(" ")[0]}</span>
                                  </span>
                                  {item.timeRange && (
                                    <span className="ml-1 flex-shrink-0 whitespace-nowrap text-[8px] opacity-90 sm:text-[9px] md:text-[10px]">
                                      {item.timeRange.length > 8 ? item.timeRange.substring(0, 5) : item.timeRange}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                            {items.length > 3 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setModalDate(dayData.date);
                                  setModalSessions(items);
                                }}
                                className="mt-0.5 w-full px-0.5 py-0.5 text-left text-[9px] font-medium text-primary hover:underline sm:text-[10px] md:text-xs"
                              >
                                +{items.length - 3} nữa
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Read-only day detail modal (no navigation) */}
      {modalDate && modalSessions.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 dark:bg-black/70"
          onClick={() => {
            setModalDate(null);
            setModalSessions([]);
          }}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                Lịch học ngày{" "}
                {modalDate.toLocaleDateString("vi-VN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setModalDate(null);
                  setModalSessions([]);
                }}
                className="rounded-lg p-2 transition hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Đóng"
              >
                <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="max-h-[calc(80vh-72px)] space-y-3 overflow-y-auto p-4">
              {modalSessions.map((item) => {
                const cfg = statusOf(item.status);
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-gray-200 p-3 dark:border-gray-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${cfg.dot}`} />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.className}
                        </span>
                      </div>
                      <span
                        className={`inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.badge}`}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 pl-[18px]">
                      {item.timeRange && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                          <ClockIcon className="h-3.5 w-3.5 flex-shrink-0" />
                          {item.timeRange}
                        </div>
                      )}
                      {item.room && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                          <MapPinIcon className="h-3.5 w-3.5 flex-shrink-0" />
                          {item.room}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
