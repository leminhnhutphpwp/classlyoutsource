"use client";
import clsx from "clsx";
import { useRef, useEffect } from "react";
import { CalendarIcon } from "@heroicons/react/24/outline";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import { keepFlatpickrInViewport } from "@/lib/flatpickr-position";

// Global CSS để ẩn input gốc khi sử dụng altInput
if (typeof document !== 'undefined') {
  const styleId = 'flatpickr-hide-input';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Ẩn input gốc khi sử dụng altInput */
      input.flatpickr-input[data-input],
      input[data-input].flatpickr-input,
      input.sr-only[data-input],
      input[type="text"][data-input].sr-only {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border-width: 0 !important;
        opacity: 0 !important;
        pointer-events: none !important;
        visibility: hidden !important;
      }
      
      /* Đảm bảo altInput hiển thị đúng và có style */
      input.flatpickr-alt-input {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        width: 100% !important;
        border-radius: 0.5rem !important;
        border-width: 1px !important;
        border-style: solid !important;
        border-color: rgb(209 213 219);
        background-color: white !important;
        color: rgb(17 24 39) !important;
        outline: none !important;
        transition: all 0.2s !important;
        line-height: inherit !important;
      }
      
      /* Style cho altInput trong dark mode */
      .dark input.flatpickr-alt-input {
        border-color: rgb(75 85 99);
        background-color: rgb(55 65 81) !important;
        color: white !important;
      }
      
      /* Focus state cho altInput */
      input.flatpickr-alt-input:focus {
        border-color: var(--primary-color, #EF4444) !important;
      }
      
      /* Placeholder cho altInput */
      input.flatpickr-alt-input::placeholder {
        color: rgb(156 163 175) !important;
      }
      
      .dark input.flatpickr-alt-input::placeholder {
        color: rgb(156 163 175) !important;
      }
      
      /* Fix calendar popup position on mobile */
      @media (max-width: 640px) {
        .flatpickr-calendar {
          left: 50% !important;
          transform: translateX(-50%) !important;
          right: auto !important;
          margin-left: 0 !important;
        }
        
        /* Ensure calendar doesn't overflow on small screens */
        .flatpickr-calendar.arrowTop::before,
        .flatpickr-calendar.arrowTop::after {
          left: 50% !important;
          transform: translateX(-50%) !important;
          margin-left: 0 !important;
        }
        
        .flatpickr-calendar.arrowBottom::before,
        .flatpickr-calendar.arrowBottom::after {
          left: 50% !important;
          transform: translateX(-50%) !important;
          margin-left: 0 !important;
        }
        
        /* Center calendar wrapper */
        .flatpickr-calendar.open {
          left: 50% !important;
          transform: translateX(-50%) !important;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

interface DateInputProps {
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
  size?: "sm" | "md";
  error?: string;
}

export default function DateInput({
  value,
  onChange,
  handleChange,
  name,
  label,
  placeholder = "Chọn ngày",
  required,
  disabled,
  min,
  max,
  className = "",
  icon,
  iconPosition = "right",
  size = "sm",
  error,
}: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const flatpickrInstanceRef = useRef<any>(null);
  const onChangeRef = useRef(onChange || handleChange);
  const nameRef = useRef(name);
  const iconPositionRef = useRef(iconPosition);
  const placeholderRef = useRef(placeholder);
  const sizeRef = useRef(size);

  useEffect(() => {
    onChangeRef.current = onChange || handleChange;
  }, [onChange, handleChange]);

  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  useEffect(() => {
    iconPositionRef.current = iconPosition;
  }, [iconPosition]);

  useEffect(() => {
    placeholderRef.current = placeholder;
  }, [placeholder]);

  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  // Helper function để parse và format date
  const parseDateValue = (dateValue: string | undefined): string | undefined => {
    // Ensure dateValue is a string before calling trim
    if (!dateValue) return undefined;
    const strValue = String(dateValue).trim();
    if (!strValue) return undefined;

    const dateStr = strValue.includes('T') ? strValue.split('T')[0] : strValue;

    // Nếu đã là format Y-m-d (yyyy-mm-dd)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }

    // Thử parse và format lại
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return undefined;
  };

  // Initialize flatpickr only once on mount
  useEffect(() => {
    if (!inputRef.current) return;

    // Initialize flatpickr only if not already initialized
    if (!flatpickrInstanceRef.current) {
      // Set placeholder cho input gốc (flatpickr sẽ copy sang altInput)
      if (inputRef.current && placeholder) {
        inputRef.current.placeholder = placeholder;
      }

      // Parse và format value để đảm bảo đúng format Y-m-d
      const initialDate = parseDateValue(value);

      flatpickrInstanceRef.current = flatpickr(inputRef.current, {
        dateFormat: "Y-m-d", // Format để lưu vào value (yyyy-mm-dd)
        altInput: true, // Hiển thị format khác
        altFormat: "d/m/Y", // Format hiển thị (dd/mm/yyyy)
        altInputClass: "flatpickr-alt-input", // Class cho altInput
        defaultDate: initialDate,
        minDate: min || undefined,
        maxDate: max || undefined,
        disableMobile: true, // Disable mobile native picker to avoid double icon
        clickOpens: !disabled, // Disable click to open if disabled
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
        onChange: (selectedDates, dateStr) => {
          if (onChangeRef.current && inputRef.current) {
            // Create synthetic event
            const syntheticEvent = {
              target: {
                name: nameRef.current || "",
                value: dateStr,
              },
            } as React.ChangeEvent<HTMLInputElement>;
            onChangeRef.current(syntheticEvent);
          }
        },
        onReady: (selectedDates, dateStr, instance) => {
          // Đảm bảo altInput được style đúng sau khi flatpickr khởi tạo
          const altInput = instance.altInput;
          if (altInput) {
            const currentSize = sizeRef.current || 'sm';
            const height = currentSize === 'sm' ? '41px' : '46px';
            const padding = currentSize === 'sm' ? '0 0.75rem' : '0 1rem';
            const paddingLeft = iconPositionRef.current === "left" ? (currentSize === 'sm' ? '2.5rem' : '3rem') : padding;
            const paddingRight = iconPositionRef.current === "right" ? (currentSize === 'sm' ? '2.5rem' : '3rem') : padding;

            // Apply styles to altInput - đồng bộ với SelectInput
            altInput.style.width = '100%';
            altInput.style.height = height;
            altInput.style.borderRadius = '0.5rem';
            altInput.style.borderWidth = '1px';
            altInput.style.borderStyle = 'solid';
            if (!error) {
              altInput.style.borderColor = 'rgb(209 213 219)';
            }
            altInput.style.backgroundColor = 'white';
            altInput.style.padding = padding;
            altInput.style.paddingLeft = paddingLeft;
            altInput.style.paddingRight = paddingRight;
            altInput.style.color = 'rgb(17 24 39)';
            altInput.style.outline = 'none';
            altInput.style.transition = 'all 0.2s';
            altInput.style.fontSize = currentSize === 'sm' ? '0.875rem' : 'inherit';
            altInput.style.lineHeight = 'inherit';

            // Apply disabled styles if disabled
            if (disabled) {
              altInput.style.pointerEvents = 'none';
              altInput.style.opacity = '0.6';
              altInput.style.cursor = 'not-allowed';
            }

            // Set placeholder nếu có
            if (placeholderRef.current && inputRef.current) {
              altInput.placeholder = inputRef.current.placeholder || placeholderRef.current;
            }

            // Set required cho altInput nếu cần để hiển thị validation của trình duyệt
            if (required) {
              altInput.required = true;
            }
          }

          // Nếu có value nhưng chưa được set (có thể value được set sau khi mount)
          // Đảm bảo set date ngay sau khi ready
          if (value && typeof value === 'string' && value.trim()) {
            const parsedDate = parseDateValue(value);
            if (parsedDate && (!selectedDates || selectedDates.length === 0)) {
              // Sử dụng setTimeout để đảm bảo flatpickr đã sẵn sàng
              setTimeout(() => {
                instance.setDate(parsedDate, false);
              }, 0);
            }
          }
        },
        onOpen: (selectedDates, dateStr, instance) => {
          // Fix calendar position: flatpickr decides below/above while the
          // calendar is still animating in, so on short viewports it can end
          // up past the bottom edge — unreachable when a modal locks the
          // body scroll. Re-measure after the open animation and clamp it.
          setTimeout(() => {
            keepFlatpickrInViewport(instance);
          }, 0);
        },
      });
    }

    return () => {
      if (flatpickrInstanceRef.current) {
        flatpickrInstanceRef.current.destroy();
        flatpickrInstanceRef.current = null;
      }
    };
    // Intentionally run once on mount: the flatpickr instance is created a
    // single time, and every prop (value, min, max, disabled, required, error,
    // placeholder) is kept in sync by its own dedicated effect below. Adding
    // those props as deps would destroy and recreate the picker on every
    // change (closing an open calendar and losing focus on each keystroke).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Update flatpickr when disabled prop changes
  useEffect(() => {
    if (!flatpickrInstanceRef.current) return;

    if (disabled) {
      flatpickrInstanceRef.current.close();
      flatpickrInstanceRef.current.config.clickOpens = false;
      // Disable altInput
      const altInput = flatpickrInstanceRef.current.altInput;
      if (altInput) {
        altInput.style.pointerEvents = 'none';
        altInput.style.opacity = '0.6';
        altInput.style.cursor = 'not-allowed';
      }
    } else {
      flatpickrInstanceRef.current.config.clickOpens = true;
      // Enable altInput
      const altInput = flatpickrInstanceRef.current.altInput;
      if (altInput) {
        altInput.style.pointerEvents = 'auto';
        altInput.style.opacity = '1';
        altInput.style.cursor = 'pointer';
      }
    }
  }, [disabled]);

  // Update altInput required attribute when required prop changes
  useEffect(() => {
    if (!flatpickrInstanceRef.current) return;
    const altInput = flatpickrInstanceRef.current.altInput;
    if (altInput) {
      altInput.required = !!required;
    }
  }, [required]);

  // Update flatpickr when value changes externally
  useEffect(() => {
    if (!flatpickrInstanceRef.current) return;

    if (value !== undefined) {
      const parsedDate = parseDateValue(value);

      if (parsedDate) {
        // Kiểm tra xem date hiện tại có khác với date mới không
        const currentDate = flatpickrInstanceRef.current.selectedDates[0];
        const newDate = new Date(parsedDate);

        if (!currentDate || currentDate.getTime() !== newDate.getTime()) {
          flatpickrInstanceRef.current.setDate(parsedDate, false);
        }
      } else {
        // Nếu value rỗng, clear date
        if (flatpickrInstanceRef.current.selectedDates.length > 0) {
          flatpickrInstanceRef.current.clear();
        }
      }
    }
  }, [value]);

  // Update min/max dates when they change
  useEffect(() => {
    if (flatpickrInstanceRef.current) {
      if (min) {
        flatpickrInstanceRef.current.set('minDate', min);
      } else {
        flatpickrInstanceRef.current.set('minDate', undefined);
      }
    }
  }, [min]);

  useEffect(() => {
    if (flatpickrInstanceRef.current) {
      if (max) {
        flatpickrInstanceRef.current.set('maxDate', max);
      } else {
        flatpickrInstanceRef.current.set('maxDate', undefined);
      }
    }
  }, [max]);

  // Update height and error border when size or error changes
  useEffect(() => {
    if (!flatpickrInstanceRef.current) return;

    const altInput = flatpickrInstanceRef.current.altInput;
    if (altInput) {
      const currentSize = sizeRef.current || 'sm';
      const height = currentSize === 'sm' ? '41px' : '46px';
      const padding = currentSize === 'sm' ? '0 0.75rem' : '0 1rem';
      const paddingLeft = iconPositionRef.current === "left" ? (currentSize === 'sm' ? '2.5rem' : '3rem') : padding;
      const paddingRight = iconPositionRef.current === "right" ? (currentSize === 'sm' ? '2.5rem' : '3rem') : padding;

      altInput.style.height = height;
      altInput.style.padding = padding;
      altInput.style.paddingLeft = paddingLeft;
      altInput.style.paddingRight = paddingRight;
      altInput.style.fontSize = currentSize === 'sm' ? '0.875rem' : 'inherit';

      // Update border color based on error
      if (!error) {
        altInput.style.borderColor = 'rgb(209 213 219)';
      } else {
        altInput.style.borderColor = ''; // Let Tailwind handle it
      }

      // Update focus styles if needed via class or direct style
      if (error) {
        altInput.classList.add("!border-red-500", "focus:!border-red-500", "dark:!border-red-400");
      } else {
        altInput.classList.remove("!border-red-500", "focus:!border-red-500", "dark:!border-red-400");
      }

      // Update required attribute
      if (required) {
        altInput.required = true;
      } else {
        altInput.required = false;
      }
    }
  }, [size, error, required]);

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
          `relative ${iconPosition === "left" ? "[&_svg]:left-4" : "[&_svg]:right-4"
          } [&_svg]:absolute [&_svg]:top-1/2 [&_svg]:-translate-y-1/2 [&_svg]:h-5 [&_svg]:w-5 [&_svg]:pointer-events-none [&_input.flatpickr-alt-input]:w-full [&_input.flatpickr-alt-input]:rounded-lg [&_input.flatpickr-alt-input]:border [&_input.flatpickr-alt-input]:border-gray-300 [&_input.flatpickr-alt-input]:bg-white [&_input.flatpickr-alt-input]:text-gray-900 [&_input.flatpickr-alt-input]:outline-none [&_input.flatpickr-alt-input]:transition [&_input.flatpickr-alt-input]:focus:border-primary [&_input.flatpickr-alt-input]:dark:border-gray-600 [&_input.flatpickr-alt-input]:dark:bg-gray-700 [&_input.flatpickr-alt-input]:dark:text-white [&_input.flatpickr-alt-input]:dark:focus:border-primary`,
          error && "[&_input.flatpickr-alt-input]:!border-red-500 [&_input.flatpickr-alt-input]:focus:!border-red-500 [&_input.flatpickr-alt-input]:dark:!border-red-400 [&_input.flatpickr-alt-input]:dark:focus:!border-red-400"
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
          data-input
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            borderWidth: 0,
          }}
        />
        {iconElement}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

