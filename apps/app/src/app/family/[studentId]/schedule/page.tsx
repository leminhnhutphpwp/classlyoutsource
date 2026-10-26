"use client";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  CalendarIcon,
  ListBulletIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { useChildResource } from "@/hooks/use-api/family";
import ResourceView, { formatDate, pick, type Column } from "../_components/ResourceView";
import ScheduleCalendar, { type CalendarSession } from "../_components/ScheduleCalendar";

type ViewMode = "list" | "calendar";

/** Normalize any date-ish value to a `YYYY-MM-DD` key (tz-safe for date strings). */
function toDateKey(value: unknown): string | null {
  if (!value) return null;
  const s = String(value);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function firstOfMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function readTimeRange(row: Record<string, any>): string {
  const start = pick(row, "start_time", "time_start", "from");
  const end = pick(row, "end_time", "time_end", "to");
  if (start && end) return `${start} - ${end}`;
  return start || pick(row, "time") || "";
}

export default function ChildSchedulePage() {
  const params = useParams();
  const studentId = params?.studentId as string;
  const [view, setView] = useState<ViewMode>("list");

  // ---- List mode (default): unchanged paginated table ----
  const [page, setPage] = useState(1);
  const listQuery = useMemo(() => ({ page, per_page: 15 }), [page]);
  const {
    data: listData,
    meta,
    loading: listLoading,
    error: listError,
    refetch: listRefetch,
  } = useChildResource(studentId, "schedule", listQuery, { enabled: view === "list" });

  // ---- Calendar mode: fetch the visible month's sessions ----
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const calendarQuery = useMemo(
    () => ({ from: firstOfMonthKey(selectedMonth), per_page: 100 }),
    [selectedMonth]
  );
  const {
    data: calData,
    loading: calLoading,
    error: calError,
    refetch: calRefetch,
  } = useChildResource(studentId, "schedule", calendarQuery, { enabled: view === "calendar" });

  const sessionsByDate = useMemo(() => {
    const map: Record<string, CalendarSession[]> = {};
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();

    for (let i = 0; i < calData.length; i++) {
      const row = calData[i] as Record<string, any>;
      const key = toDateKey(pick(row, "session_date", "date", "start_date", "day"));
      if (!key) continue;

      // Keep only the visible month (endpoint's `from` returns forward-looking rows too).
      const [ky, km] = key.split("-").map(Number);
      if (ky !== year || km !== month + 1) continue;

      const session: CalendarSession = {
        id: String(pick(row, "id") ?? `${key}-${i}`),
        className: pick(row, "class_name", "class.name", "className") || "Lớp học",
        timeRange: readTimeRange(row),
        room: pick(row, "room", "location", "note") || undefined,
        status: pick(row, "status") || "scheduled",
      };

      (map[key] ||= []).push(session);
    }
    return map;
  }, [calData, selectedMonth]);

  const goToPrevMonth = () =>
    setSelectedMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const goToNextMonth = () =>
    setSelectedMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  const goToToday = () => {
    const now = new Date();
    setSelectedMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const columns: Column<Record<string, any>>[] = [
    {
      header: "Ngày",
      render: (row) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {formatDate(pick(row, "date", "session_date", "start_date", "day"))}
        </span>
      ),
    },
    {
      header: "Thời gian",
      render: (row) => readTimeRange(row) || "—",
    },
    {
      header: "Lớp học",
      render: (row) => pick(row, "class_name", "class.name", "className") || "—",
    },
    {
      header: "Phòng / Ghi chú",
      render: (row) => pick(row, "room", "location", "note") || "—",
    },
  ];

  return (
    <div className="space-y-4">
      {/* View toggle + (calendar) month navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-800">
          {(
            [
              { key: "list", label: "Danh sách", Icon: ListBulletIcon },
              { key: "calendar", label: "Lịch", Icon: CalendarIcon },
            ] as const
          ).map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              aria-pressed={view === key}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                view === key
                  ? "bg-primary text-white"
                  : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {view === "calendar" && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={goToPrevMonth}
              aria-label="Tháng trước"
              className="inline-flex h-[41px] w-[41px] items-center justify-center rounded-lg border border-gray-300 text-gray-600 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <span className="min-w-[120px] text-center text-sm font-semibold capitalize text-gray-900 dark:text-white">
              {selectedMonth.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              onClick={goToNextMonth}
              aria-label="Tháng sau"
              className="inline-flex h-[41px] w-[41px] items-center justify-center rounded-lg border border-gray-300 text-gray-600 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="ml-1 inline-flex h-[41px] items-center rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50"
            >
              Hôm nay
            </button>
          </div>
        )}
      </div>

      {view === "list" ? (
        <ResourceView
          data={listData}
          columns={columns}
          loading={listLoading}
          error={listError}
          meta={meta}
          currentPage={page}
          onPageChange={setPage}
          onRetry={listRefetch}
          rowKey={(row, i) => String(pick(row, "id") ?? i)}
          emptyIcon={<CalendarIcon />}
          emptyTitle="Chưa có lịch học"
          emptyHint="Lịch học của học viên sẽ hiển thị tại đây khi giáo viên xếp lịch."
          itemLabel="buổi học"
        />
      ) : calError ? (
        <div className="rounded-2xl bg-white p-8 text-center dark:bg-gray-800">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Không thể tải lịch học</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{calError}</p>
          <button
            onClick={calRefetch}
            className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-opacity-90"
          >
            Thử lại
          </button>
        </div>
      ) : (
        <ScheduleCalendar
          sessionsByDate={sessionsByDate}
          selectedMonth={selectedMonth}
          loading={calLoading}
        />
      )}
    </div>
  );
}
