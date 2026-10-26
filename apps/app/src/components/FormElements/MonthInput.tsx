"use client";
import clsx from "clsx";
import { useRef, useEffect } from "react";
import { CalendarIcon } from "@heroicons/react/24/outline";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import { keepFlatpickrInViewport } from "@/lib/flatpickr-position";

interface MonthInputProps {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  name?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  error?: string;
}

export default function MonthInput({
  value,
  onChange,
  handleChange,
  name,
  label,
  placeholder = "Chọn tháng",
  required,
  disabled,
  min,
  max,
  className = "",
  icon,
  iconPosition = "right",
  error,
}: MonthInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const flatpickrInstanceRef = useRef<any>(null);
  const onChangeRef = useRef(onChange || handleChange);

  useEffect(() => {
    onChangeRef.current = onChange || handleChange;
  }, [onChange, handleChange]);

  useEffect(() => {
    if (!inputRef.current) return;

    // Destroy existing instance
    if (flatpickrInstanceRef.current) {
      flatpickrInstanceRef.current.destroy();
    }

    // Parse initial value
    let initialDate: Date | undefined;
    if (value) {
      const [year, month] = value.split("-");
      if (year && month) {
        initialDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      }
    }

    // Initialize flatpickr with month picker
    flatpickrInstanceRef.current = flatpickr(inputRef.current, {
      dateFormat: "Y-m", // Internal format: YYYY-MM
      altInput: true,
      altInputClass: "w-full rounded-lg border border-gray-300 bg-white h-[41px] px-4 text-gray-900 outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-70 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-primary",
      altFormat: "F Y", // Display format: Tháng MM YYYY (e.g., "Tháng 12 2024")
      defaultDate: initialDate,
      minDate: min ? new Date(min + "-01") : undefined,
      maxDate: max ? new Date(max + "-01") : undefined,
      disableMobile: true, // Disable mobile native picker to avoid double icon
      locale: {
        firstDayOfWeek: 1, // Monday
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
      onReady: (selectedDates, dateStr, instance) => {
        const altInput = instance.altInput;
        if (altInput && required) {
          altInput.required = true;
        }
      },
      onChange: (selectedDates) => {
        if (onChangeRef.current && inputRef.current) {
          // Format as YYYY-MM for backend
          const date = selectedDates[0];
          if (date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const formattedDate = `${year}-${month}`;
            
            // Create synthetic event
            const syntheticEvent = {
              target: {
                name: name || "",
                value: formattedDate,
              },
            } as React.ChangeEvent<HTMLInputElement>;
            onChangeRef.current(syntheticEvent);
          }
        }
      },
      onOpen: (selectedDates, dateStr, instance) => {
        if (!selectedDates || selectedDates.length === 0) {
          let target = new Date();

          if (min) {
            const minDate = new Date(min + "-01");
            if (target < minDate) target = minDate;
          }
          if (max) {
            const maxDate = new Date(max + "-01");
            if (target > maxDate) target = maxDate;
          }

          instance.setDate(target, true);
        }

        // Fix calendar position: keep it inside the viewport (see
        // keepFlatpickrInViewport) — flatpickr can otherwise hang past the
        // bottom edge on short viewports, unreachable inside modals.
        setTimeout(() => {
          keepFlatpickrInViewport(instance);
        }, 0);
      },
    });

    return () => {
      if (flatpickrInstanceRef.current) {
        flatpickrInstanceRef.current.destroy();
      }
    };
  }, [value, min, max, name, required]);

  // Update flatpickr when value changes externally
  useEffect(() => {
    if (flatpickrInstanceRef.current && value !== undefined) {
      if (value) {
        const [year, month] = value.split("-");
        if (year && month) {
          const date = new Date(parseInt(year), parseInt(month) - 1, 1);
          flatpickrInstanceRef.current.setDate(date, false);
        }
      } else {
        flatpickrInstanceRef.current.clear();
      }
    }
  }, [value]);

  // Update altInput required attribute when required prop changes
  useEffect(() => {
    if (!flatpickrInstanceRef.current) return;
    const altInput = flatpickrInstanceRef.current.altInput;
    if (altInput) {
      altInput.required = !!required;
    }
  }, [required]);

  useEffect(() => {
    if (!flatpickrInstanceRef.current) return;
    const altInput = flatpickrInstanceRef.current.altInput;
    if (altInput) {
      if (error) {
        altInput.classList.add("!border-red-500", "focus:!border-red-500", "dark:!border-red-400");
      } else {
        altInput.classList.remove("!border-red-500", "focus:!border-red-500", "dark:!border-red-400");
      }
    }
  }, [error]);

  const iconElement = icon || <CalendarIcon className="h-5 w-5 text-gray-400" />;

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label
          htmlFor={name}
          className="block text-sm font-medium text-gray-900 dark:text-white"
        >
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}
      <div
        className={clsx(
          `relative ${
            iconPosition === "left" ? "[&_svg]:left-4" : "[&_svg]:right-4"
          } [&_svg]:absolute [&_svg]:top-1/2 [&_svg]:-translate-y-1/2 [&_svg]:h-5 [&_svg]:w-5 [&_svg]:pointer-events-none [&_input.flatpickr-alt-input]:w-full [&_input.flatpickr-alt-input]:h-[41px] [&_input.flatpickr-alt-input]:rounded-lg [&_input.flatpickr-alt-input]:border [&_input.flatpickr-alt-input]:border-gray-300 [&_input.flatpickr-alt-input]:bg-white [&_input.flatpickr-alt-input]:px-4 [&_input.flatpickr-alt-input]:text-gray-900 [&_input.flatpickr-alt-input]:outline-none [&_input.flatpickr-alt-input]:transition [&_input.flatpickr-alt-input]:focus:border-primary [&_input.flatpickr-alt-input]:dark:border-gray-600 [&_input.flatpickr-alt-input]:dark:bg-gray-700 [&_input.flatpickr-alt-input]:dark:text-white [&_input.flatpickr-alt-input]:dark:focus:border-primary ${
            iconPosition === "left" ? "[&_input.flatpickr-alt-input]:pl-12" : "[&_input.flatpickr-alt-input]:pr-12"
          }`,
          error && "[&_input.flatpickr-alt-input]:border-red-500 [&_input.flatpickr-alt-input]:focus:border-red-500 [&_input.flatpickr-alt-input]:dark:border-red-400 [&_input.flatpickr-alt-input]:dark:focus:border-red-400"
        )}
      >
        <input
          ref={inputRef}
          type="text"
          name={name}
          placeholder={placeholder}
          disabled={disabled}
          className="sr-only"
          readOnly
        />
        {iconElement}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

