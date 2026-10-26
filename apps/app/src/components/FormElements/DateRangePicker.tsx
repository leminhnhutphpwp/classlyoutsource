"use client";
import { useRef, useEffect, useState } from "react";
import { CalendarIcon, XMarkIcon } from "@heroicons/react/24/outline";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import { colorValues } from "@/config/colors";
import { useIsMobile } from "@/hooks/use-mobile";

interface DateRangePickerProps {
  value?: { start: string; end: string };
  onChange?: (range: { start: string; end: string } | null) => void;
  placeholder?: string;
  className?: string;
}

interface QuickOption {
  label: string;
  getRange: () => { start: string; end: string };
}

export default function DateRangePicker({
  value,
  onChange,
  placeholder = "Chọn khoảng thời gian",
  className = "",
}: DateRangePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const flatpickrInstanceRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const [showPicker, setShowPicker] = useState(false);
  const [popupPosition, setPopupPosition] = useState<'bottom' | 'top'>('bottom');
  const isMobile = useIsMobile();

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Helper functions for quick date ranges
  const getQuickOptions = (): QuickOption[] => {
    const now = new Date();

    return [
      {
        label: "Tháng này",
        getRange: () => {
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
          const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          return {
            start: firstDay.toISOString().split('T')[0],
            end: lastDay.toISOString().split('T')[0],
          };
        },
      },
      {
        label: "Tháng trước",
        getRange: () => {
          const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
          return {
            start: firstDay.toISOString().split('T')[0],
            end: lastDay.toISOString().split('T')[0],
          };
        },
      },
      {
        label: "Quý này",
        getRange: () => {
          const quarter = Math.floor(now.getMonth() / 3);
          const firstDay = new Date(now.getFullYear(), quarter * 3, 1);
          const lastDay = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
          return {
            start: firstDay.toISOString().split('T')[0],
            end: lastDay.toISOString().split('T')[0],
          };
        },
      },
      {
        label: "Quý trước",
        getRange: () => {
          const quarter = Math.floor(now.getMonth() / 3);
          const prevQuarter = quarter === 0 ? 3 : quarter - 1;
          const year = quarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
          const firstDay = new Date(year, prevQuarter * 3, 1);
          const lastDay = new Date(year, (prevQuarter + 1) * 3, 0);
          return {
            start: firstDay.toISOString().split('T')[0],
            end: lastDay.toISOString().split('T')[0],
          };
        },
      },
      {
        label: "Năm nay",
        getRange: () => {
          const firstDay = new Date(now.getFullYear(), 0, 1);
          const lastDay = new Date(now.getFullYear(), 11, 31);
          return {
            start: firstDay.toISOString().split('T')[0],
            end: lastDay.toISOString().split('T')[0],
          };
        },
      },
      {
        label: "Năm trước",
        getRange: () => {
          const firstDay = new Date(now.getFullYear() - 1, 0, 1);
          const lastDay = new Date(now.getFullYear() - 1, 11, 31);
          return {
            start: firstDay.toISOString().split('T')[0],
            end: lastDay.toISOString().split('T')[0],
          };
        },
      },
      {
        label: "7 ngày qua",
        getRange: () => {
          const lastDay = new Date(now);
          const firstDay = new Date(now);
          firstDay.setDate(firstDay.getDate() - 6);
          return {
            start: firstDay.toISOString().split('T')[0],
            end: lastDay.toISOString().split('T')[0],
          };
        },
      },
      {
        label: "30 ngày qua",
        getRange: () => {
          const lastDay = new Date(now);
          const firstDay = new Date(now);
          firstDay.setDate(firstDay.getDate() - 29);
          return {
            start: firstDay.toISOString().split('T')[0],
            end: lastDay.toISOString().split('T')[0],
          };
        },
      },
    ];
  };

  const handleQuickSelect = (option: QuickOption) => {
    const range = option.getRange();
    onChangeRef.current?.(range);
    if (flatpickrInstanceRef.current) {
      const startDate = new Date(range.start);
      const endDate = new Date(range.end);
      flatpickrInstanceRef.current.setDate([startDate, endDate], false);
      // Update calendar view to show the selected month
      flatpickrInstanceRef.current.jumpToDate(startDate);
    }
  };

  const formatDisplayValue = () => {
    if (!value || !value.start || !value.end) return "";
    const start = new Date(value.start);
    const end = new Date(value.end);
    return `${start.getDate()}/${start.getMonth() + 1}/${start.getFullYear()} - ${end.getDate()}/${end.getMonth() + 1}/${end.getFullYear()}`;
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChangeRef.current?.(null);
    if (flatpickrInstanceRef.current) {
      flatpickrInstanceRef.current.clear();
    }
  };

  // Initialize flatpickr with inline calendar when picker is shown
  useEffect(() => {
    if (!showPicker) {
      // Clean up when picker is closed
      if (flatpickrInstanceRef.current) {
        const instance = flatpickrInstanceRef.current as any;
        if (instance.__hiddenInput && instance.__hiddenInput.parentNode) {
          instance.__hiddenInput.parentNode.removeChild(instance.__hiddenInput);
        }
        flatpickrInstanceRef.current.destroy();
        flatpickrInstanceRef.current = null;
      }
      return;
    }

    if (flatpickrInstanceRef.current) return;

    // Wait for DOM to be ready
    let retryCount = 0;
    const maxRetries = 20; // Max 200ms wait time

    const initCalendar = () => {
      if (!wrapperRef.current) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(initCalendar, 10);
        }
        return;
      }

      const calendarContainer = wrapperRef.current.querySelector('.calendar-container') as HTMLElement;
      if (!calendarContainer) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(initCalendar, 10);
        }
        return;
      }

      // Create a hidden input for flatpickr to attach to
      const hiddenInput = document.createElement('input');
      hiddenInput.type = 'text';
      hiddenInput.style.position = 'absolute';
      hiddenInput.style.opacity = '0';
      hiddenInput.style.pointerEvents = 'none';
      hiddenInput.style.width = '1px';
      hiddenInput.style.height = '1px';
      calendarContainer.appendChild(hiddenInput);

      const instance = flatpickr(hiddenInput, {
        mode: "range",
        dateFormat: "d/m/Y",
        inline: true, // Always show calendar inline
        locale: {
          firstDayOfWeek: 1,
          weekdays: {
            shorthand: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"],
            longhand: ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"],
          },
          months: {
            shorthand: ["Th1", "Th2", "Th3", "Th4", "Th5", "Th6", "Th7", "Th8", "Th9", "Th10", "Th11", "Th12"],
            longhand: [
              "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
              "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
            ],
          },
        },
        onChange: (selectedDates) => {
          if (selectedDates.length === 2) {
            const start = selectedDates[0].toISOString().split('T')[0];
            const end = selectedDates[1].toISOString().split('T')[0];
            onChangeRef.current?.({ start, end });
          } else if (selectedDates.length === 0) {
            onChangeRef.current?.(null);
          }
        },
      });

      flatpickrInstanceRef.current = instance;

      // Store hiddenInput ref for cleanup
      (instance as any).__hiddenInput = hiddenInput;

      // Set initial value if available
      if (value?.start && value?.end) {
        const startDate = new Date(value.start);
        const endDate = new Date(value.end);
        instance.setDate([startDate, endDate], false);
        instance.jumpToDate(startDate);
      }
    };

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(initCalendar);
  }, [showPicker, value?.start, value?.end]);

  // Update calendar when value changes (from quick select or manual selection)
  useEffect(() => {
    if (!flatpickrInstanceRef.current || !showPicker) return;

    if (value?.start && value?.end) {
      const startDate = new Date(value.start);
      const endDate = new Date(value.end);

      // Check if dates need updating (avoid unnecessary updates)
      const currentDates = flatpickrInstanceRef.current.selectedDates;
      if (
        currentDates.length !== 2 ||
        currentDates[0]?.toISOString().split('T')[0] !== value.start ||
        currentDates[1]?.toISOString().split('T')[0] !== value.end
      ) {
        // Update selected dates
        flatpickrInstanceRef.current.setDate([startDate, endDate], false);

        // Jump to start date to show the selected range
        flatpickrInstanceRef.current.jumpToDate(startDate);
      }
    } else if (!value && flatpickrInstanceRef.current.selectedDates.length > 0) {
      // Clear selection if value is null
      flatpickrInstanceRef.current.clear();
    }
  }, [value, showPicker]);


  // Calculate popup position based on available space
  useEffect(() => {
    if (!showPicker || !inputRef.current) return;

    const calculatePosition = () => {
      const inputRect = inputRef.current?.getBoundingClientRect();
      if (!inputRect) return;

      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceBelow = viewportHeight - inputRect.bottom;
      const spaceAbove = inputRect.top;
      const spaceRight = viewportWidth - inputRect.right;
      const spaceLeft = inputRect.left;
      const popupHeight = isMobile ? 500 : 450; // Approximate height of the popup
      const popupWidth = isMobile ? Math.min(600, viewportWidth - 32) : 600;

      // If not enough space below but enough space above, show on top
      if (spaceBelow < popupHeight && spaceAbove > spaceBelow && spaceAbove > popupHeight) {
        setPopupPosition('top');
      } else {
        setPopupPosition('bottom');
      }

      // Adjust horizontal position if needed (for mobile or edge cases)
      if (wrapperRef.current && !isMobile) {
        const wrapper = wrapperRef.current;
        // Adjust if popup would go off screen
        if (spaceRight < popupWidth && spaceLeft > spaceRight) {
          wrapper.style.left = 'auto';
          wrapper.style.right = '0';
        } else {
          wrapper.style.left = '0';
          wrapper.style.right = 'auto';
        }
      }
    };

    // Calculate on mount and on scroll/resize
    calculatePosition();
    const timeoutId = setTimeout(calculatePosition, 100); // Small delay to ensure DOM is ready
    window.addEventListener('scroll', calculatePosition, true);
    window.addEventListener('resize', calculatePosition);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('scroll', calculatePosition, true);
      window.removeEventListener('resize', calculatePosition);
    };
  }, [showPicker, isMobile]);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowPicker(false);
        if (flatpickrInstanceRef.current) {
          flatpickrInstanceRef.current.close();
        }
      }
    };

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showPicker]);

  return (
    <div className={`relative ${showPicker ? "z-[150]" : ""} ${className}`}>
      <input
        ref={inputRef}
        type="text"
        readOnly
        placeholder={placeholder}
        value={formatDisplayValue()}
        className="w-full h-[41px] rounded-lg border border-gray-300 bg-transparent px-4 pr-10 text-sm font-normal outline-none transition focus:border-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-primary"
        onClick={(e) => {
          e.stopPropagation();
          setShowPicker((prev) => !prev);
        }}
      />
      <div className="absolute inset-y-0 right-0 flex items-center pr-2">
        {value && value.start && value.end ? (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        ) : (
          <CalendarIcon className="h-5 w-5 text-gray-400" />
        )}
      </div>

      {/* Custom Picker with 2 Columns */}
      {showPicker && (
        <>
          {isMobile && (
            <div
              className="fixed inset-0 z-[140] bg-black/20 backdrop-blur-sm"
              onClick={() => setShowPicker(false)}
            />
          )}
          <div
            ref={wrapperRef}
            className={`flex rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800 ${isMobile
              ? 'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[150] flex-col w-[90vw] max-w-md max-h-[85vh] overflow-y-auto'
              : `absolute z-[150] left-0 flex-row ${popupPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`
              }`}
            style={isMobile ? {} : {
              minWidth: '600px',
              maxWidth: 'calc(100vw - 2rem)',
              // Remove fixed maxHeight/overflow to avoid scrollbar on desktop unless necessary
            }}
          >
            {/* Left Column - Quick Options */}
            <div className={`${isMobile ? 'w-full border-b border-r-0' : 'w-48 border-r'} border-gray-200 p-3 dark:border-gray-700`}>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Chọn nhanh
              </div>
              <div className={`${isMobile ? 'grid grid-cols-2 gap-2' : 'space-y-1'}`}>
                {getQuickOptions().map((option, index) => {
                  const optionRange = option.getRange();
                  const isActive =
                    value?.start === optionRange.start &&
                    value?.end === optionRange.end;

                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleQuickSelect(option)}
                      className={`w-full rounded px-3 py-2 text-left text-sm transition-colors ${isActive
                        ? 'bg-primary/10 text-primary dark:bg-primary/20'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column - Calendar */}
            <div className={`calendar-container ${isMobile ? 'w-full' : 'flex-1'} flex items-center justify-center`}>
              {/* flatpickr calendar will be appended here */}
            </div>
          </div>
        </>
      )}

      {/* Custom styles for flatpickr calendar - reduced blue colors, minimal borders and shadows */}
      <style jsx global>{`
        .calendar-container .flatpickr-calendar {
          border: none;
          box-shadow: none;
          font-family: inherit;
          background: transparent;
          padding: 0;
          width: 100% !important;
          height: 100% !important;
        }
        
        .calendar-container .flatpickr-calendar .flatpickr-month {
          background: transparent;
          color: #374151;
          padding: 8px 4px;
          border-bottom: 1px solid #e5e7eb;
          margin-bottom: 8px;
        }
        
        .calendar-container .flatpickr-calendar .flatpickr-prev-month,
        .calendar-container .flatpickr-calendar .flatpickr-next-month {
          color: #6b7280;
          fill: #6b7280;
          padding: 4px;
        }
        
        .calendar-container .flatpickr-calendar .flatpickr-prev-month:hover,
        .calendar-container .flatpickr-calendar .flatpickr-next-month:hover {
          color: #374151;
          fill: #374151;
        }
        
        .calendar-container .flatpickr-calendar .flatpickr-current-month {
          color: #111827;
          font-weight: 600;
          font-size: 15px;
          padding-top: 0;
          height: 28px;
          line-height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .calendar-container .flatpickr-calendar .flatpickr-weekdays {
          background: transparent;
          padding: 8px 0;
        }
        
        .calendar-container .flatpickr-calendar .flatpickr-weekday {
          color: #6b7280;
          font-weight: 500;
          font-size: 12px;
          text-transform: none;
        }
        
        .calendar-container .flatpickr-calendar .flatpickr-day {
          color: #374151;
          border-radius: 6px;
          border: none;
          margin: 2px;
          height: 36px;
          line-height: 36px;
        }
        
        .calendar-container .flatpickr-calendar .flatpickr-day:hover {
          background: #f3f4f6;
          border-color: transparent;
        }
        
        .calendar-container .flatpickr-calendar .flatpickr-day.selected,
        .calendar-container .flatpickr-calendar .flatpickr-day.startRange,
        .calendar-container .flatpickr-calendar .flatpickr-day.endRange {
          background: ${colorValues.primary};
          border-color: ${colorValues.primary};
          color: #fff;
          font-weight: 600;
        }
        
        .calendar-container .flatpickr-calendar .flatpickr-day.inRange {
          background: #eff6ff;
          border-color: transparent;
          color: #1e40af;
          box-shadow: -2px 0 0 #eff6ff, 2px 0 0 #eff6ff;
        }
        
        .calendar-container .flatpickr-calendar .flatpickr-day.startRange.inRange {
          background: linear-gradient(to right, ${colorValues.primary} 50%, #eff6ff 50%);
        }
        
        .calendar-container .flatpickr-calendar .flatpickr-day.endRange.inRange {
          background: linear-gradient(to left, ${colorValues.primary} 50%, #eff6ff 50%);
        }
        
        .calendar-container .flatpickr-calendar .flatpickr-day.today {
          border-color: #d1d5db;
          color: #374151;
        }
        
        .calendar-container .flatpickr-calendar .flatpickr-day.today:hover {
          background: #f3f4f6;
          border-color: #d1d5db;
        }
        
        .calendar-container .flatpickr-calendar .flatpickr-day.prevMonthDay,
        .calendar-container .flatpickr-calendar .flatpickr-day.nextMonthDay {
          color: #d1d5db;
        }
        
        .calendar-container .flatpickr-calendar .flatpickr-day.flatpickr-disabled {
          color: #e5e7eb;
          cursor: not-allowed;
        }
        
        /* Dark mode styles */
        .dark .calendar-container .flatpickr-calendar .flatpickr-month {
          color: #d1d5db;
          border-bottom-color: #374151;
        }
        
        .dark .calendar-container .flatpickr-calendar .flatpickr-prev-month,
        .dark .calendar-container .flatpickr-calendar .flatpickr-next-month {
          color: #9ca3af;
          fill: #9ca3af;
        }
        
        .dark .calendar-container .flatpickr-calendar .flatpickr-prev-month:hover,
        .dark .calendar-container .flatpickr-calendar .flatpickr-next-month:hover {
          color: #d1d5db;
          fill: #d1d5db;
        }
        
        .dark .calendar-container .flatpickr-calendar .flatpickr-current-month {
          color: #f9fafb;
        }
        
        .dark .calendar-container .flatpickr-calendar .flatpickr-weekday {
          color: #9ca3af;
        }
        
        .dark .calendar-container .flatpickr-calendar .flatpickr-day {
          color: #d1d5db;
        }
        
        .dark .calendar-container .flatpickr-calendar .flatpickr-day:hover {
          background: #374151;
        }
        
        .dark .calendar-container .flatpickr-calendar .flatpickr-day.inRange {
          background: #1e3a5f;
          color: #93c5fd;
          box-shadow: -2px 0 0 #1e3a5f, 2px 0 0 #1e3a5f;
        }
        
        .dark .calendar-container .flatpickr-calendar .flatpickr-day.startRange.inRange {
          background: linear-gradient(to right, ${colorValues.primary} 50%, #1e3a5f 50%);
        }
        
        .dark .calendar-container .flatpickr-calendar .flatpickr-day.endRange.inRange {
          background: linear-gradient(to left, ${colorValues.primary} 50%, #1e3a5f 50%);
        }
        
        .dark .calendar-container .flatpickr-calendar .flatpickr-day.today {
          border-color: #4b5563;
          color: #d1d5db;
        }
        
        .dark .calendar-container .flatpickr-calendar .flatpickr-day.today:hover {
          background: #374151;
          border-color: #4b5563;
        }
        
        .dark .calendar-container .flatpickr-calendar .flatpickr-day.prevMonthDay,
        .dark .calendar-container .flatpickr-calendar .flatpickr-day.nextMonthDay {
          color: #4b5563;
        }
      `}</style>
    </div >
  );
}
