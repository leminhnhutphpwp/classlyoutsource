"use client";

interface WeekPattern {
  mode: "offline" | "online";
}

interface AlternatingWeeksPatternProps {
  alternateWeeks: WeekPattern[];
  startDate?: string;
  endDate?: string;
  defaultMode: "offline" | "online";
  onAddWeek: () => void;
  onInitTwoWeeks?: () => void; // Callback để init 2 tuần đầu tiên
  onRemoveWeek: (index: number) => void;
  onUpdateWeek: (index: number, mode: "offline" | "online") => void;
}

export default function AlternatingWeeksPattern({
  alternateWeeks,
  startDate,
  endDate,
  defaultMode: _defaultMode,
  onAddWeek,
  onInitTwoWeeks,
  onRemoveWeek,
  onUpdateWeek,
}: AlternatingWeeksPatternProps) {
  const computeMaxWeeks = (start: string | undefined, end: string | undefined) => {
    if (!start || !end) return Number.POSITIVE_INFINITY;
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return Number.POSITIVE_INFINITY;
    const diffDays = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, Math.floor(diffDays / 7));
  };

  const maxWeeks = computeMaxWeeks(startDate, endDate);
  const isAtMax = alternateWeeks.length >= maxWeeks;
  const label = alternateWeeks.length === 0 ? 'Khởi tạo mẫu 2 tuần' : 'Thêm tuần';

  const handleInitOrAdd = () => {
    if (alternateWeeks.length === 0) {
      // Initialize with 2 weeks
      if (onInitTwoWeeks) {
        onInitTwoWeeks();
      } else {
        // Fallback: add 2 weeks manually
        onAddWeek();
        onAddWeek();
      }
    } else {
      if (!isAtMax) {
        onAddWeek();
      }
    }
  };

  return (
    <div className="rounded-lg bg-white p-4 md:p-6 dark:bg-gray-800 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Pattern xen kẽ theo tuần</h4>
        <div className="flex flex-col items-end">
          <button
            type="button"
            onClick={handleInitOrAdd}
            disabled={isAtMax}
            className={`rounded-full border border-gray-300 px-3 py-1 text-sm ${isAtMax
                ? 'cursor-not-allowed opacity-60 text-gray-400 dark:text-gray-500'
                : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
              } dark:border-gray-600`}
            aria-disabled={isAtMax}
          >
            {label}
          </button>
          {isAtMax && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Bạn đã thêm đủ số tuần theo thời hạn đã chọn
            </p>
          )}
        </div>
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {alternateWeeks.length === 0 && (
          <div className="p-2 text-sm text-gray-500 dark:text-gray-400">
            VD: Tuần 1 offline, tuần 2 online, lặp lại...
          </div>
        )}
        {alternateWeeks.map((w, i) => {
          const modeLabel =
            w.mode === "offline" ? "Offline (Trực tiếp tại lớp)" : "Online (Qua Internet)";
          return (
            <div
              key={i}
              className="py-3 grid grid-cols-1 md:grid-cols-[120px_1fr_auto] items-start md:items-center gap-3"
            >
              <div className="text-sm text-gray-600 dark:text-gray-400">Tuần {i + 1}</div>
              <div className="flex flex-col gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">Chế độ tuần này</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateWeek(i, "offline")}
                    className={`rounded-full border px-3 py-1 text-xs ${w.mode === "offline"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      }`}
                  >
                    Offline
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateWeek(i, "online")}
                    className={`rounded-full border px-3 py-1 text-xs ${w.mode === "online"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      }`}
                  >
                    Online
                  </button>
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                    {modeLabel}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-start md:justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onRemoveWeek(i)}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  Xóa
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

