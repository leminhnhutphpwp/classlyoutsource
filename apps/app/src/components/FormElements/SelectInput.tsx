"use client";

import { cn } from "@/lib/utils";
import { useId, useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

type Option = {
  label: string;
  value: string | number;
  disabled?: boolean;
};

type SelectInputProps = {
  label: string;
  name: string;
  options: Option[];
  value?: string | number;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  handleChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  size?: "sm" | "md";
  hideChevron?: boolean;
  showChevron?: boolean;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
  className?: string;
  error?: string;
  searchable?: boolean; // New prop enable/disable search
};

/**
 * Dropdown menu placement, computed from the trigger's bounding rect.
 * The menu is rendered in a portal (document.body) with `position: fixed`
 * so it is never clipped by an ancestor scroll/overflow container —
 * e.g. FormModal's `max-h-[90vh] overflow-y-auto` card, which previously
 * cut the absolute-positioned menu off at the popup's edge.
 */
type MenuPlacement = {
  placement: "bottom" | "top";
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
};

/** Min space below the trigger to keep the menu opening downward. */
const PREFER_BELOW = 240;
/** Menu max height; also clamped to the available viewport space. */
const MENU_MAX_HEIGHT = 320;
const VIEWPORT_MARGIN = 8;

export default function SelectInput({
  label,
  name,
  options,
  value,
  onChange,
  handleChange,
  placeholder,
  icon,
  iconPosition = "right",
  hideChevron = false,
  showChevron = false,
  required,
  disabled,
  helperText,
  className,
  error,
  searchable = true, // Default to true as requested
}: SelectInputProps) {
  const id = useId();
  const menuId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuPlacement, setMenuPlacement] = useState<MenuPlacement | null>(null);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionsListRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  /** Compute fixed coords for the portaled menu from the trigger's rect. */
  const computePlacement = useCallback((): MenuPlacement | null => {
    const trigger = triggerRef.current;
    if (!trigger) return null;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Prefer opening downward; flip upward only when there is clearly more
    // room above (measured against the VIEWPORT, which is the real boundary
    // once the menu is portaled out of the modal's scroll container).
    const placement: "bottom" | "top" =
      spaceBelow >= PREFER_BELOW || spaceBelow >= spaceAbove ? "bottom" : "top";

    const available =
      placement === "bottom" ? spaceBelow : spaceAbove;
    const maxHeight = Math.max(
      64,
      Math.min(MENU_MAX_HEIGHT, available - VIEWPORT_MARGIN),
    );

    // Keep the menu horizontally inside the viewport.
    const width = Math.min(rect.width, viewportWidth - VIEWPORT_MARGIN * 2);
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(rect.left, viewportWidth - width - VIEWPORT_MARGIN),
    );

    return placement === "bottom"
      ? { placement, top: rect.bottom + 4, left, width, maxHeight }
      : {
          placement,
          bottom: viewportHeight - rect.top + 4,
          left,
          width,
          maxHeight,
        };
  }, []);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setSearchQuery("");
    setActiveIndex(-1);
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    setMenuPlacement(computePlacement());
    // Highlight the currently selected option when the menu opens.
    const selectedIdx = options.findIndex(
      (opt) => String(opt.value) === String(value),
    );
    setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);
    setIsOpen(true);
  }, [disabled, computePlacement, options, value]);

  const toggleOpen = useCallback(() => {
    if (disabled) return;
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }, [disabled, isOpen, closeMenu, openMenu]);

  // Reposition the portaled menu when the page/modal scrolls or resizes.
  // Capture phase so ancestor scrollers (e.g. the modal card) are caught.
  useEffect(() => {
    if (!isOpen) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setMenuPlacement(computePlacement());
      });
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [isOpen, computePlacement]);

  // Close when clicking outside the trigger AND the portaled menu.
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      closeMenu();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, closeMenu]);

  // Escape closes ONLY the dropdown, not the parent modal. Capture phase
  // runs before FormModal's bubble-phase Escape handler (which closes the
  // whole dialog), and stopPropagation keeps the event from reaching it.
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, [isOpen, closeMenu]);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      // Small timeout to allow animation/render to complete
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, searchable]);

  const handleSelect = useCallback((option: Option) => {
    if (option.disabled || disabled) return;

    // Synthetic event to maintain compatibility with existing handlers
    const syntheticEvent = {
      target: {
        name: name,
        value: option.value,
        type: "select-one",
      },
      currentTarget: {
        name: name,
        value: option.value,
      },
    } as unknown as React.ChangeEvent<HTMLSelectElement>;

    if (onChange) onChange(syntheticEvent);
    if (handleChange) handleChange(syntheticEvent);
    closeMenu();
    triggerRef.current?.focus();
  }, [disabled, name, onChange, handleChange, closeMenu]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase().trim();
    return options.filter((opt) => opt.label.toLowerCase().includes(query));
  }, [options, searchQuery]);

  // --- Keyboard navigation (ARIA combobox pattern) ---

  const moveActive = useCallback(
    (delta: 1 | -1) => {
      setActiveIndex((prev) => {
        const len = filteredOptions.length;
        if (len === 0) return -1;
        if (prev < 0) return delta === 1 ? 0 : len - 1;
        return Math.min(len - 1, Math.max(0, prev + delta));
      });
    },
    [filteredOptions.length],
  );

  const selectActive = useCallback(() => {
    if (activeIndex >= 0 && filteredOptions[activeIndex]) {
      handleSelect(filteredOptions[activeIndex]);
    }
  }, [activeIndex, filteredOptions, handleSelect]);

  // Keyboard handler for the trigger (works open or closed).
  const handleTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;
    const key = event.key;

    if (!isOpen) {
      if (
        key === "Enter" ||
        key === " " ||
        key === "ArrowDown" ||
        key === "ArrowUp"
      ) {
        event.preventDefault();
        if (key === "ArrowUp") {
          // Opening upward: start from the last option (like native selects).
          setActiveIndex(
            Math.max(0, options.length - 1),
          );
          setMenuPlacement(computePlacement());
          setIsOpen(true);
        } else {
          openMenu();
        }
      }
      return;
    }

    switch (key) {
      case "ArrowDown":
        event.preventDefault();
        moveActive(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveActive(-1);
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(Math.max(0, filteredOptions.length - 1));
        break;
      case "Enter":
        event.preventDefault();
        selectActive();
        break;
      case "Tab":
        // Let focus move on; just close the menu.
        closeMenu();
        break;
    }
  };

  // Reset the highlight when the search query filters the list, and keep the
  // active index valid while the list shrinks/grows.
  useEffect(() => {
    if (!isOpen) return;
    setActiveIndex((prev) => {
      const len = filteredOptions.length;
      if (len === 0) return -1;
      return Math.min(prev, len - 1);
    });
  }, [isOpen, filteredOptions.length, searchQuery]);

  // Scroll the highlighted option into view inside the (scrollable) menu.
  useEffect(() => {
    if (!isOpen || activeIndex < 0 || !optionsListRef.current) return;
    const el = optionsListRef.current.querySelector(
      `[data-option-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [isOpen, activeIndex, filteredOptions.length]);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  const shouldShowChevron = !hideChevron && (!icon || iconPosition !== "right" || showChevron);

  return (
    <div className={cn("space-y-2 relative", className)} ref={containerRef}>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-900 dark:text-white cursor-pointer"
        onClick={() => toggleOpen()}
      >
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <div className="relative">
        {/* Trigger Button */}
        <div
          ref={triggerRef}
          id={id}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={menuId}
          tabIndex={disabled ? -1 : 0}
          onClick={() => toggleOpen()}
          onKeyDown={handleTriggerKeyDown}
          className={cn(
            "relative w-full appearance-none rounded-lg border bg-white text-gray-900 transition-all dark:bg-gray-700 dark:text-white outline-none cursor-pointer flex items-center overflow-hidden",
            "h-[41px] text-sm",
            disabled
              ? "opacity-70 cursor-not-allowed bg-gray-100 dark:bg-gray-600"
              : "hover:border-primary focus:border-primary dark:hover:border-primary",
            isOpen && !disabled ? "border-primary dark:border-primary" : "border-gray-300 dark:border-gray-600",
            error && "border-red-500 focus:border-red-500 dark:border-red-400 dark:focus:border-red-400",
            // Padding handling based on icon
            icon && iconPosition === "left" ? "pl-12 pr-4" : "pl-4",
            icon && iconPosition === "right" ? "pr-10" : "pr-4"
          )}
        >
          {/* Left Icon */}
          {icon && iconPosition === "left" && (
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 z-10 pointer-events-none">
              {icon}
            </span>
          )}

          {/* Value Display */}
          <span className={cn(
            "flex-1 truncate select-none",
            !selectedOption && "text-gray-400 dark:text-gray-500"
          )}>
            {selectedOption ? selectedOption.label : placeholder || "Select..."}
          </span>

          {/* Right Icon or Chevron */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none gap-2">
            {icon && iconPosition === "right" && (
              <span className="text-gray-500 dark:text-gray-400">
                {icon}
              </span>
            )}
            {shouldShowChevron && (
              <ChevronDownIcon
                className={cn(
                  "h-4 w-4 text-gray-500 transition-transform duration-200",
                  isOpen && "rotate-180"
                )}
              />
            )}
          </div>
        </div>
      </div>

      {helperText && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
      )}
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Dropdown Menu — portaled to document.body with fixed positioning so
          no ancestor overflow container (modal card, table wrapper, etc.) can
          clip it. z-index 1100 sits above FormModal's z-[1000] overlay/card. */}
      {mounted && isOpen && !disabled && menuPlacement &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="listbox"
            aria-label={label}
            style={{
              position: "fixed",
              zIndex: 1100,
              left: menuPlacement.left,
              width: menuPlacement.width,
              maxHeight: menuPlacement.maxHeight,
              ...(menuPlacement.placement === "bottom"
                ? { top: menuPlacement.top }
                : { bottom: menuPlacement.bottom }),
            }}
            className="flex flex-col rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-600 dark:bg-[#1f2937] overflow-hidden"
          >
            {/* Search Input - Sticky Header */}
            {searchable && (
              <div className="shrink-0 p-2 bg-white dark:bg-[#1f2937] border-b border-gray-100 dark:border-gray-600">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="block w-full pl-10 pr-3 py-1.5 border-none rounded-sm leading-5 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:bg-white dark:focus:bg-gray-900 focus:ring-0 sm:text-sm"
                    placeholder="Tìm kiếm..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClick={(e) => e.stopPropagation()} // Prevent closing when clicking input
                  />
                </div>
              </div>
            )}

            {/* Options List - Scrollable */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-white dark:bg-[#1f2937]">
              {placeholder && !searchQuery && !searchable && (
                <div
                  className="px-4 py-2.5 text-sm text-gray-400 cursor-default border-b border-gray-100 dark:border-gray-600 bg-white dark:bg-[#1f2937]"
                >
                  {placeholder}
                </div>
              )}

              {filteredOptions.length > 0 ? (
                <div className="py-1">
                  {filteredOptions.map((option, index) => {
                    const isSelected = String(option.value) === String(value);
                    return (
                      <div
                        key={`${option.value}-${index}`}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelect(option)}
                        className={cn(
                          "relative flex cursor-pointer select-none items-center px-4 py-2.5 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                          isSelected
                            ? "bg-primary/10 text-primary font-medium dark:bg-primary/20 dark:text-white"
                            : "text-gray-900 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600",
                          option.disabled && "cursor-not-allowed opacity-50 bg-gray-50/50 dark:bg-gray-800/50 hover:bg-transparent dark:hover:bg-transparent"
                        )}
                      >
                        {option.label}
                        {isSelected && (
                          <span className="absolute right-4 flex h-3.5 w-3.5 items-center justify-center">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  {searchQuery ? "Không tìm thấy kết quả" : "Không có dữ liệu"}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
