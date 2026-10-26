"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { XMarkIcon, ClockIcon } from "@heroicons/react/24/outline";

import { CalendarScheduleCard } from "@/components/Calendar/CalendarScheduleCard";
interface CalendarViewProps {
  schedules: any[];
  sessionsByDate?: Record<string, any[]>;
  selectedMonth: Date;
  loading: boolean;
  classes?: any[];
  pausedClassIds?: Set<string>;
  isStudent?: boolean;
}

import { getObjId, idsEqual } from "@/lib/id-utils";

// Generate color for schedule based on class_id
const getScheduleColor = (classId: number | string): string => {
  const colors = [
    'bg-primary', 'bg-primary-light', 'bg-primary-pastel',
    'bg-red-500', 'bg-primary', 'bg-primary-light'
  ];

  let idNumber = 0;
  const idStr = String(classId);
  for (let i = 0; i < idStr.length; i++) {
    idNumber += idStr.charCodeAt(i);
  }

  return colors[idNumber % colors.length];
};

const STATUS_CONFIGS: Record<string, { label: string; color: string; bgColor: string; calendarBgColor: string }> = {
  scheduled: {
    label: 'Đã lên lịch',
    color: 'text-[var(--status-badge-pending-text)]',
    bgColor: 'bg-[var(--status-badge-pending)]',
    calendarBgColor: 'bg-primary'
  },
  ongoing: {
    label: 'Đang diễn ra',
    color: 'text-[var(--status-badge-active-text)]',
    bgColor: 'bg-[var(--status-badge-active)]',
    calendarBgColor: 'bg-primary-light'
  },
  completed: {
    label: 'Đã hoàn thành',
    color: 'text-[var(--status-badge-completed-text)]',
    bgColor: 'bg-[var(--status-badge-completed)]',
    calendarBgColor: 'bg-primary-pastel'
  },
  cancelled: {
    label: 'Đã hủy',
    color: 'text-[var(--status-badge-error-text)]',
    bgColor: 'bg-[var(--status-badge-error)]',
    calendarBgColor: 'bg-red-500'
  },
  postponed: {
    label: 'Hoãn lại',
    color: 'text-[var(--status-badge-pending-text)]',
    bgColor: 'bg-[var(--status-badge-pending)]',
    calendarBgColor: 'bg-gray-500'
  },
};

const getStatusConfig = (status: string) => STATUS_CONFIGS[status] || STATUS_CONFIGS.scheduled;

export default function CalendarView({
  schedules: _schedules,
  sessionsByDate = {},
  selectedMonth,
  loading,
  classes: _classes = [],
  pausedClassIds = new Set(),
  isStudent = false,
}: CalendarViewProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSchedules, setSelectedSchedules] = useState<any[]>([]);
  const [hoveredSchedule, setHoveredSchedule] = useState<{ schedule: any; position: { x: number; y: number } } | null>(null);
  const closeTooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTooltipTimeoutRef.current) {
        clearTimeout(closeTooltipTimeoutRef.current);
      }
    };
  }, []);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // If clicking on calendar item or tooltip, don't close
      const target = e.target as Element;
      if (target.closest('.calendar-item') || target.closest('.calendar-tooltip')) {
        return;
      }
      setHoveredSchedule(null);
    };

    if (hoveredSchedule) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [hoveredSchedule]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // Get day of week for first day (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const startDayOfWeek = firstDay.getDay();

    // Days in month
    const daysInMonth = lastDay.getDate();

    // Create array of days
    const days: Array<{ date: Date; day: number; isCurrentMonth: boolean }> = [];

    // Add days from previous month to fill first week
    // Column mapping: 0 = Monday, 1 = Tuesday, ..., 5 = Saturday, 6 = Sunday
    // getDay(): 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    // Formula: column = (getDay() + 6) % 7
    // Days to add: if getDay() = 0 (Sunday), need 6 days; if getDay() = 1 (Monday), need 0 days; etc.
    const daysToAdd = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    if (daysToAdd > 0) {
      // Calculate the first day we need to show (Monday of the week containing the 1st)
      const firstDayToShow = new Date(year, month, 1);
      const firstDayToShowDate = firstDayToShow.getDate() - daysToAdd;

      // Add days from previous month
      for (let i = 0; i < daysToAdd; i++) {
        const date = new Date(year, month - 1, firstDayToShowDate + i);
        days.push({
          date,
          day: date.getDate(),
          isCurrentMonth: false,
        });
      }
    }

    // Add days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        date: new Date(year, month, day),
        day,
        isCurrentMonth: true,
      });
    }

    // Add days from next month to fill last week (total 42 days = 6 weeks)
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      days.push({
        date: new Date(year, month + 1, day),
        day,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [selectedMonth]);

  // Pre-process and memoize sessions with status configs and correct links
  const processedSessions = useMemo(() => {
    const processed: Record<string, any[]> = {};

    Object.entries(sessionsByDate).forEach(([dateKey, sessions]) => {
      let filtered = sessions;

      if (isStudent && pausedClassIds.size > 0) {
        filtered = sessions.filter((session: any) => {
          const classId = getObjId(session.class_id || session.class || session.schedule?.class);
          return !pausedClassIds.has(classId);
        });
      }

      processed[dateKey] = filtered.map(item => {
        const isSession = Boolean(item.session_date || item.date || item.schedule_id);
        const itemId = getObjId(item);
        const status = item.status || 'scheduled';
        const statusConfig = getStatusConfig(status);

        return {
          ...item,
          _id: itemId,
          id: itemId,
          isSession,
          status,
          statusConfig,
          className: item.schedule_name || item.class?.name || item.class_name || "Lớp học",
          timeRange: item.time_range || (item.start_time && item.end_time ? `${item.start_time} - ${item.end_time}` : ''),
          linkUrl: isSession
            ? (itemId && itemId !== "undefined" ? `/schedule-sessions/${itemId}` : "/calendar")
            : (itemId && itemId !== "undefined" ? `/schedules/${itemId}` : "/calendar"),
          calendarBgColor: isSession ? statusConfig.calendarBgColor : getScheduleColor(getObjId(item.class || item.class_id) || itemId)
        };
      });
    });

    return processed;
  }, [sessionsByDate, isStudent, pausedClassIds]);

  const getSessionsForDate = (date: Date): any[] => {
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return processedSessions[dateKey] || [];
  };



  const dayNames = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  const dayNamesFull = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

  if (loading) {
    return (
      <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="grid grid-cols-7 gap-2">
            {[...Array(42)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="grid grid-cols-7 bg-primary text-white">
                {dayNames.map((day, index) => (
                  <th
                    key={day}
                    className={`flex h-12 sm:h-15 items-center justify-center p-1 sm:p-2 text-[10px] sm:text-body-xs font-medium md:text-base xl:p-5 ${index === 0 ? "rounded-tl-[10px]" : ""
                      } ${index === 6 ? "rounded-tr-[10px]" : ""
                      }`}
                  >
                    <span className="hidden lg:block">{dayNamesFull[index]}</span>
                    <span className="block lg:hidden">{day}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, weekIndex) => (
                <tr key={weekIndex} className="grid grid-cols-7">
                  {calendarDays.slice(weekIndex * 7, (weekIndex + 1) * 7).map((dayData, dayIndex) => {
                    const dayItems = getSessionsForDate(dayData.date);
                    const isToday =
                      dayData.isCurrentMonth &&
                      dayData.date.toDateString() === new Date().toDateString();

                    const handleShowAll = (e: React.MouseEvent) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedDate(dayData.date);
                      setSelectedSchedules(dayItems);
                    };

                    return (
                      <td
                        key={`${weekIndex}-${dayIndex}`}
                        className={`ease relative h-20 sm:h-24 cursor-pointer border border-stroke p-0.5 sm:p-1.5 transition duration-500 hover:bg-gray-2 dark:border-dark-3 dark:hover:bg-dark-2 md:h-32 md:p-2 xl:h-36 overflow-visible ${!dayData.isCurrentMonth
                          ? "bg-gray-50 dark:bg-gray-900/50 text-gray-400 dark:text-gray-600"
                          : ""
                          } ${weekIndex === 5 && dayIndex === 0 ? "rounded-bl-[10px]" : ""
                          } ${weekIndex === 5 && dayIndex === 6 ? "rounded-br-[10px]" : ""
                          }`}
                      >
                        <span
                          className={`text-[10px] sm:text-xs md:text-sm font-medium ${isToday
                            ? "text-primary dark:text-primary"
                            : dayData.isCurrentMonth
                              ? "text-dark dark:text-white"
                              : "text-gray-400 dark:text-gray-600"
                            }`}
                        >
                          {dayData.day}
                        </span>

                        {dayData.isCurrentMonth && dayItems.length > 0 && (
                          <div className="mt-0.5 sm:mt-1 md:mt-1.5 flex flex-col gap-0.5 sm:gap-1 max-h-[calc(100%-1rem)] sm:max-h-[calc(100%-1.5rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                            {dayItems.slice(0, 3).map((item: any) => {
                              const { isSession, id: itemId, className, timeRange, status, statusConfig, calendarBgColor, linkUrl } = item;

                              return (
                                <div
                                  key={`${isSession ? 'session' : 'schedule'}-${itemId}`}
                                  className="group relative flex-shrink-0 calendar-item"
                                  onMouseEnter={(e) => {
                                    // Clear timeout when entering item
                                    if (closeTooltipTimeoutRef.current) {
                                      clearTimeout(closeTooltipTimeoutRef.current);
                                      closeTooltipTimeoutRef.current = null;
                                    }

                                    // Only show tooltip on hover for desktop (width >= 768px)
                                    if (window.innerWidth >= 768) {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setHoveredSchedule({
                                        schedule: {
                                          ...item,
                                          className,
                                          timeRange,
                                          session_date: dayData.date.toISOString().split('T')[0],
                                          date: dayData.date.toISOString().split('T')[0],
                                          status,
                                          statusConfig,
                                          linkUrl,
                                        },
                                        position: {
                                          x: rect.left + rect.width / 2,
                                          y: rect.top - 10,
                                        },
                                      });
                                    }
                                  }}
                                  onMouseLeave={() => {
                                    // Only hide tooltip on hover leave for desktop
                                    if (window.innerWidth >= 768) {
                                      closeTooltipTimeoutRef.current = setTimeout(() => {
                                        setHoveredSchedule(null);
                                      }, 100);
                                    }
                                  }}
                                >
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                      e.stopPropagation();

                                      // Mobile handling: Show tooltip
                                      if (window.innerWidth < 768) {
                                        const rect = e.currentTarget.getBoundingClientRect();

                                        // Toggle tooltip if clicking same item
                                        if (idsEqual(hoveredSchedule?.schedule.id, itemId)) {
                                          setHoveredSchedule(null);
                                        } else {
                                          setHoveredSchedule({
                                            schedule: {
                                              ...item,
                                              className,
                                              timeRange,
                                              session_date: dayData.date.toISOString().split('T')[0],
                                              date: dayData.date.toISOString().split('T')[0],
                                              status,
                                              statusConfig,
                                              linkUrl,
                                            },
                                            position: {
                                              x: rect.left + rect.width / 2,
                                              y: rect.top - 10,
                                            },
                                          });
                                        }
                                      } else {
                                        // Desktop: Navigate
                                        router.push(linkUrl);
                                      }
                                    }}
                                    className="block cursor-pointer"
                                  >
                                    <div className={`min-h-[16px] sm:min-h-[18px] md:min-h-[20px] w-full rounded ${calendarBgColor} opacity-80 group-hover:opacity-100 transition-opacity text-white px-1 sm:px-1.5 md:px-2 py-0.5 sm:py-1 flex items-center justify-between relative`}>
                                      <span className="text-[9px] sm:text-[10px] md:text-xs font-medium truncate flex-1" title={`${className}${timeRange ? ` - ${timeRange}` : ''}`}>
                                        <span className="hidden sm:inline">{className}</span>
                                        <span className="sm:hidden">{className.split(' ')[0]}</span>
                                      </span>
                                      <div className="flex items-center gap-0.5 sm:gap-1 ml-0.5 sm:ml-1 flex-shrink-0">
                                        {timeRange && (
                                          <span className="text-[8px] sm:text-[9px] md:text-[10px] opacity-90 whitespace-nowrap">
                                            {timeRange.length > 8 ? timeRange.substring(0, 5) : timeRange}
                                          </span>
                                        )}
                                        {/* Status indicator dot */}
                                        {isSession && (
                                          <span
                                            className={`w-1.5 h-1.5 rounded-full ${status === 'completed' ? 'bg-primary' :
                                              status === 'cancelled' ? 'bg-red-500' :
                                                status === 'ongoing' ? 'bg-primary-light' :
                                                  status === 'postponed' ? 'bg-gray-500' :
                                                    'bg-primary'
                                              }`}
                                            title={statusConfig.label}
                                          />
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {dayItems.length > 3 && (
                              <button
                                onClick={handleShowAll}
                                className="w-full text-[9px] sm:text-[10px] md:text-xs text-primary dark:text-primary hover:underline font-medium text-left flex-shrink-0 mt-0.5 py-0.5 px-0.5"
                              >
                                +{dayItems.length - 3} nữa
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

      {/* Tooltip using Portal - render outside calendar */}
      {hoveredSchedule && typeof window !== 'undefined' && createPortal(
        (() => {
          const tooltipWidth = window.innerWidth < 640 ? 280 : 320; // Match w-[280px] sm:w-[320px]
          const padding = 10;
          const screenWidth = window.innerWidth;
          const x = hoveredSchedule.position.x;

          // Calculate constrained left position
          // Ideal left is centered: x - width/2
          let left = x - tooltipWidth / 2;

          // Clamp to screen edges
          if (left < padding) left = padding;
          if (left + tooltipWidth > screenWidth - padding) left = screenWidth - padding - tooltipWidth;

          // Calculate arrow position relative to tooltip container
          // Arrow should point to x
          // Arrow is absolute inside relative tooltip container
          // Arrow left should be x - left
          const arrowLeft = x - left;

          return (
            <div
              className="fixed z-[9999] calendar-tooltip"
              style={{
                left: `${left}px`,
                top: `${hoveredSchedule.position.y}px`,
                transform: 'translate(0, -100%)', // Remove -50% translate X since we calculated left manually
              }}
              onMouseEnter={() => {
                // Clear timeout when entering tooltip
                if (closeTooltipTimeoutRef.current) {
                  clearTimeout(closeTooltipTimeoutRef.current);
                  closeTooltipTimeoutRef.current = null;
                }
              }}
              onMouseLeave={() => {
                // Set timeout to close when leaving tooltip
                if (window.innerWidth >= 768) {
                  closeTooltipTimeoutRef.current = setTimeout(() => {
                    setHoveredSchedule(null);
                  }, 100);
                }
              }}
            >
              <div className="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg w-[280px] sm:w-[320px] p-2.5">
                {/* Header */}
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-1.5 mb-1">
                      <ClockIcon className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
                      <span className="text-xs font-medium text-gray-900 dark:text-white break-words">
                        {hoveredSchedule.schedule.className}
                      </span>
                    </div>
                    {(() => {
                      const schedule = hoveredSchedule.schedule;
                      const sessionDate = schedule.session_date || schedule.date;
                      const dateStr = sessionDate
                        ? new Date(sessionDate).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
                        : null;
                      const timeStr = schedule.time_range || (schedule.start_time && schedule.end_time ? `${schedule.start_time} - ${schedule.end_time}` : schedule.timeRange || null);

                      return (
                        <>
                          {dateStr && (
                            <p className="text-[10px] text-gray-600 dark:text-gray-400 capitalize leading-tight">{dateStr}</p>
                          )}
                          {timeStr && (
                            <p className="text-[10px] font-medium text-gray-700 dark:text-gray-300 mt-0.5 leading-tight">{timeStr}</p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {(() => {
                      const schedule = hoveredSchedule.schedule;
                      const status = schedule.status;
                      const statusConfig = schedule.statusConfig || getStatusConfig(status || 'scheduled');

                      if (status) {
                        return (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        );
                      }
                      return null;
                    })()}
                    {(() => {
                      const schedule = hoveredSchedule.schedule;
                      const mode = schedule.mode || schedule.default_mode;
                      if (!mode) return null;

                      return (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${mode === 'online'
                          ? 'bg-primary-pastel/40 text-primary'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                          {mode === 'online' ? 'Online' : 'Offline'}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Divider */}
                {(() => {
                  const hasDetails = hoveredSchedule.schedule.room || hoveredSchedule.schedule.location || hoveredSchedule.schedule.notes;

                  if (!hasDetails) return null;

                  return (
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                      <div className="space-y-1">
                        {hoveredSchedule.schedule.room && (
                          <div className="text-[10px] leading-tight">
                            <span className="text-gray-500 dark:text-gray-400">Phòng: </span>
                            <span className="font-medium text-gray-700 dark:text-gray-300">{hoveredSchedule.schedule.room}</span>
                          </div>
                        )}
                        {hoveredSchedule.schedule.location && (
                          <div className="text-[10px] leading-tight">
                            <span className="text-gray-500 dark:text-gray-400">Địa điểm: </span>
                            <span className="font-medium text-gray-700 dark:text-gray-300 break-words">{hoveredSchedule.schedule.location}</span>
                          </div>
                        )}
                        {hoveredSchedule.schedule.notes && (
                          <div className="text-[10px] leading-tight">
                            <span className="text-gray-500 dark:text-gray-400">Ghi chú: </span>
                            <span className="text-gray-700 dark:text-gray-300 break-words">{hoveredSchedule.schedule.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* View Details Link */}
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                  <Link
                    href={hoveredSchedule.schedule.linkUrl || '#'}
                    className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Xem buổi học
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                      <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                    </svg>
                  </Link>
                </div>

                {/* Arrow pointing down */}
                <div
                  className="absolute top-full w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-white dark:border-t-gray-800"
                  style={{
                    left: `${arrowLeft}px`,
                    transform: 'translateX(-50%)'
                  }}
                ></div>
              </div>
            </div>
          );
        })(),
        document.body
      )}

      {/* Modal for showing all schedules */}
      {selectedDate && selectedSchedules.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70" onClick={() => { setSelectedDate(null); setSelectedSchedules([]); }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Lịch học ngày {selectedDate.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </h3>
              <button
                onClick={() => { setSelectedDate(null); setSelectedSchedules([]); }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Đóng"
              >
                <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
              <div className="space-y-3">
                {selectedSchedules.map((item: any) => (
                  <CalendarScheduleCard
                    key={`${item.isSession ? 'session' : 'schedule'}-${item.id}`}
                    item={item}
                    isSession={item.isSession}
                    statusConfig={item.statusConfig}
                    colorClass={item.calendarBgColor}
                    linkUrl={item.linkUrl}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

