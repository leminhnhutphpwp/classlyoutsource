"use client";

import React, { memo, useRef, useState, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

type TooltipPosition = "top" | "bottom" | "left" | "right";

type TooltipProps = {
  label: string;
  children: React.ReactNode;
  className?: string;
  preferredPosition?: TooltipPosition;
};

/**
 * Smart tooltip with React Portal to escape overflow constraints.
 * Automatically positions to avoid viewport edges.
 */
function TooltipComponent({
  label,
  children,
  className = "",
  preferredPosition = "top"
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>(preferredPosition);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !isVisible) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current?.getBoundingClientRect();

    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollY: window.scrollY,
      scrollX: window.scrollX
    };

    const margin = 8;
    const tooltipWidth = tooltipRect?.width || 100;
    const tooltipHeight = tooltipRect?.height || 32;

    // Calculate available space
    const spaceTop = triggerRect.top;
    const spaceBottom = viewport.height - triggerRect.bottom;

    // Determine best position
    let bestPosition: TooltipPosition = preferredPosition;

    if (preferredPosition === "top" && spaceTop >= tooltipHeight + margin) {
      bestPosition = "top";
    } else if (preferredPosition === "bottom" && spaceBottom >= tooltipHeight + margin) {
      bestPosition = "bottom";
    } else if (spaceBottom >= spaceTop) {
      bestPosition = "bottom";
    } else {
      bestPosition = "top";
    }

    setPosition(bestPosition);

    // Calculate coordinates (no need to add scrollY/scrollX since tooltip is position:fixed)
    let top = 0;
    let left = 0;

    if (bestPosition === "top") {
      top = triggerRect.top - tooltipHeight - 8;
      left = triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;
    } else if (bestPosition === "bottom") {
      top = triggerRect.bottom + 8;
      left = triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;
    } else if (bestPosition === "left") {
      top = triggerRect.top + triggerRect.height / 2 - tooltipHeight / 2;
      left = triggerRect.left - tooltipWidth - 8;
    } else { // right
      top = triggerRect.top + triggerRect.height / 2 - tooltipHeight / 2;
      left = triggerRect.right + 8;
    }

    // Prevent horizontal overflow
    if (left < margin) {
      left = margin;
    } else if (left + tooltipWidth > viewport.width - margin) {
      left = viewport.width - tooltipWidth - margin;
    }

    // Prevent vertical overflow (no scrollY needed for fixed positioning)
    if (top < margin) {
      top = margin;
    } else if (top + tooltipHeight > viewport.height - margin) {
      top = viewport.height - tooltipHeight - margin;
    }

    setCoords({ top, left });
  }, [isVisible, preferredPosition]);

  useLayoutEffect(() => {
    if (isVisible) {
      updatePosition();
    }
  }, [isVisible, updatePosition]);

  // Update position on scroll and resize
  useLayoutEffect(() => {
    if (!isVisible) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isVisible, updatePosition]);

  const handleMouseEnter = useCallback(() => {
    setIsVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsVisible(false);
  }, []);

  const getArrowStyles = (): React.CSSProperties => {
    if (!triggerRef.current) return {};

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipLeft = coords.left;
    const triggerCenterX = triggerRect.left + triggerRect.width / 2;

    if (position === "top" || position === "bottom") {
      return {
        left: `${triggerCenterX - tooltipLeft}px`
      };
    }
    return {};
  };

  const getArrowClasses = (): string => {
    const base = "absolute w-0 h-0 border-solid";
    switch (position) {
      case "top":
        return `${base} top-full -translate-x-1/2 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-700`;
      case "bottom":
        return `${base} bottom-full -translate-x-1/2 border-l-[6px] border-r-[6px] border-b-[6px] border-l-transparent border-r-transparent border-b-gray-900 dark:border-b-gray-700`;
      case "left":
        return `${base} left-full top-1/2 -translate-y-1/2 border-t-[6px] border-b-[6px] border-l-[6px] border-t-transparent border-b-transparent border-l-gray-900 dark:border-l-gray-700`;
      case "right":
        return `${base} right-full top-1/2 -translate-y-1/2 border-t-[6px] border-b-[6px] border-r-[6px] border-t-transparent border-b-transparent border-r-gray-900 dark:border-r-gray-700`;
    }
  };

  const tooltipContent = isVisible && (
    <div
      ref={tooltipRef}
      className="hidden md:block pointer-events-none fixed z-[9999] whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg dark:bg-gray-700 transition-opacity duration-200"
      style={{
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        opacity: coords.top === 0 ? 0 : 1
      }}
    >
      {label}
      <span className={getArrowClasses()} style={getArrowStyles()} />
    </div>
  );

  return (
    <>
      <div
        ref={triggerRef}
        className={`relative inline-flex ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
      >
        {children}
      </div>
      {typeof document !== 'undefined' && createPortal(tooltipContent, document.body)}
    </>
  );
}

const Tooltip = memo(TooltipComponent);
export default Tooltip;
