"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import SelectInput from "@/components/FormElements/SelectInput";
import { getObjId } from "@/lib/id-utils";
interface CalendarFiltersProps {
  classes: any[];
  selectedClassId: string;
  selectedMonth: Date;
  selectedMode?: string;
  selectedStatus?: string;
  onClassChange: (classId: string) => void;
  onMonthChange: (month: Date) => void;
  onModeChange?: (mode: string) => void;
  onStatusChange?: (status: string) => void;
  isStudent?: boolean;
  classesLoading: boolean;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export default function CalendarFilters({
  classes,
  selectedClassId,
  selectedMonth,
  selectedMode = "all",
  selectedStatus = "all",
  onClassChange,
  onMonthChange,
  onModeChange,
  onStatusChange,
  classesLoading,
  onClearFilters,
  hasActiveFilters,
}: CalendarFiltersProps) {
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const monthPickerRef = useRef<HTMLDivElement>(null);

  const monthNames = [
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
    "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
  ];

  const currentMonthName = monthNames[selectedMonth.getMonth()];
  const currentYear = selectedMonth.getFullYear();
  const currentMonth = selectedMonth.getMonth();

  // Generate years (current year ± 5 years)
  const currentYearValue = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYearValue - 5 + i);

  // Close month picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (monthPickerRef.current && !monthPickerRef.current.contains(event.target as Node)) {
        setShowMonthPicker(false);
      }
    };

    if (showMonthPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMonthPicker]);

  const handlePreviousMonth = () => {
    const newDate = new Date(selectedMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    onMonthChange(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(selectedMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    onMonthChange(newDate);
  };

  const handleMonthSelect = (month: number) => {
    const newDate = new Date(selectedMonth.getFullYear(), month, 1);
    onMonthChange(newDate);
    setShowMonthPicker(false);
  };

  const handleYearSelect = (year: number) => {
    const newDate = new Date(year, selectedMonth.getMonth(), 1);
    onMonthChange(newDate);
    setShowMonthPicker(false);
  };

  return (
    <>
      {/* Month Navigation - Separate component */}
      <div className="rounded-lg bg-white p-3 sm:p-4 dark:bg-gray-800">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handlePreviousMonth}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors h-[41px] w-10 sm:w-auto flex items-center justify-center flex-shrink-0"
            aria-label="Tháng trước"
          >
            <ChevronLeftIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 dark:text-gray-400" />
          </button>

          <div className="relative flex-1" ref={monthPickerRef}>
            <button
              onClick={() => setShowMonthPicker(!showMonthPicker)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors w-full sm:min-w-[200px] justify-between h-[41px]"
            >
              <div className="flex items-center gap-1.5 sm:gap-2">
                <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate">
                  {currentMonthName} {currentYear}
                </span>
              </div>
              <ChevronDownIcon className={`h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform flex-shrink-0 ${showMonthPicker ? 'rotate-180' : ''}`} />
            </button>

            {/* Month/Year Picker Dropdown */}
            {showMonthPicker && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 z-50 w-[calc(100vw-2rem)] sm:w-auto sm:min-w-[320px]">
                {/* Year Selector */}
                <div className="mb-3 sm:mb-4">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Năm
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-4 gap-1.5 sm:gap-2 max-h-[120px] overflow-y-auto scrollbar-thin">
                    {years.map((year) => (
                      <button
                        key={year}
                        onClick={() => handleYearSelect(year)}
                        className={`h-[41px] px-2 sm:px-3 text-xs sm:text-sm rounded-md transition-colors ${year === currentYear
                          ? 'bg-primary text-white font-medium'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Month Selector */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tháng
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-3 gap-1.5 sm:gap-2">
                    {monthNames.map((month, index) => (
                      <button
                        key={index}
                        onClick={() => handleMonthSelect(index)}
                        className={`h-[41px] px-2 sm:px-3 text-xs sm:text-sm rounded-md transition-colors ${index === currentMonth && currentYear === selectedMonth.getFullYear()
                          ? 'bg-primary text-white font-medium'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                      >
                        {month.replace('Tháng ', '')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleNextMonth}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors h-[41px] w-10 sm:w-auto flex items-center justify-center flex-shrink-0"
            aria-label="Tháng sau"
          >
            <ChevronRightIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Filters - Separate component */}
      <div className="rounded-lg bg-white p-3 sm:p-4 md:p-6 dark:bg-gray-800">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 relative">
          {/* Class Filter */}
          <div>
            <SelectInput
              label="Lớp học"
              name="class"
              value={selectedClassId}
              handleChange={(e) => onClassChange(e.target.value)}
              options={[
                { value: "all", label: "Tất cả lớp học" },
                ...classes.map((cls: any) => ({
                  value: getObjId(cls),
                  label: cls.name,
                })),
              ]}
              disabled={classesLoading}
              placeholder={classesLoading ? "Đang tải..." : "Chọn lớp học"}
            />
          </div>

          {/* Mode Filter */}
          {onModeChange && (
            <div>
              <SelectInput
                label="Chế độ học"
                name="mode"
                value={selectedMode}
                handleChange={(e) => onModeChange(e.target.value)}
                options={[
                  { value: "all", label: "Tất cả chế độ" },
                  { value: "offline", label: "Trực tiếp (Offline)" },
                  { value: "online", label: "Trực tuyến (Online)" },
                ]}
              />
            </div>
          )}

          {/* Status Filter */}
          {onStatusChange && (
            <div>
              <SelectInput
                label="Trạng thái"
                name="status"
                value={selectedStatus}
                handleChange={(e) => onStatusChange(e.target.value)}
                options={[
                  { value: "all", label: "Tất cả trạng thái" },
                  { value: "upcoming", label: "Sắp bắt đầu" },
                  { value: "in_progress", label: "Đang diễn ra" },
                  { value: "paused", label: "Tạm dừng" },
                ]}
              />
            </div>
          )}

          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="absolute -top-3 right-0 text-xs font-medium text-red-500 hover:text-red-700 bg-white dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-100 dark:border-gray-700"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>
    </>
  );
}

