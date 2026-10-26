"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

/**
 * Spinner Component - Circular loading indicator
 */
interface SpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-8 w-8 border-4",
    xl: "h-12 w-12 border-4",
  };

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-solid border-primary border-t-transparent",
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Đang tải...</span>
    </div>
  );
}

/**
 * LoadingOverlay - Full overlay with spinner
 */
interface LoadingOverlayProps {
  isLoading: boolean;
  className?: string;
  spinnerSize?: "sm" | "md" | "lg" | "xl";
  message?: string;
}

export function LoadingOverlay({
  isLoading,
  className,
  spinnerSize = "lg",
  message,
}: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm dark:bg-gray-dark/80",
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <div className="flex flex-col items-center gap-3">
        <Spinner size={spinnerSize} />
        {message && (
          <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
        )}
      </div>
    </div>
  );
}

/**
 * CardSkeleton - Skeleton for card components
 */
interface CardSkeletonProps {
  className?: string;
  showAvatar?: boolean;
  showActions?: boolean;
  lines?: number;
}

export function CardSkeleton({
  className,
  showAvatar = false,
  showActions = false,
  lines = 2,
}: CardSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-lg bg-white p-4 dark:bg-gray-800 sm:p-6",
        className
      )}
    >
      <div className="animate-pulse space-y-3 sm:space-y-4">
        <div className="flex items-start gap-3 sm:gap-4">
          {showAvatar && (
            <Skeleton className="h-10 w-10 shrink-0 rounded-full sm:h-12 sm:w-12" />
          )}
          <div className="flex-1 space-y-2 sm:space-y-3">
            <Skeleton className="h-4 w-3/4 rounded sm:h-5" />
            <Skeleton className="h-3 w-1/2 rounded sm:h-4" />
            {Array.from({ length: lines }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-3 w-full rounded sm:h-4"
              />
            ))}
          </div>
        </div>
        {showActions && (
          <div className="flex gap-2 pt-2 sm:gap-3">
            <Skeleton className="h-8 w-20 rounded sm:h-9 sm:w-24" />
            <Skeleton className="h-8 w-20 rounded sm:h-9 sm:w-24" />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * StatsCardSkeleton - Skeleton for stats cards with icon and text layout
 */
interface StatsCardSkeletonProps {
  className?: string;
}

export function StatsCardSkeleton({ className }: StatsCardSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-lg bg-white p-4 dark:bg-gray-800 md:p-6",
        className
      )}
    >
      <div className="flex items-center animate-pulse">
        <Skeleton className="h-9 w-9 md:h-10 md:w-10 rounded-lg flex-shrink-0" />
        <div className="ml-3 md:ml-4 flex-1 min-w-0">
          <Skeleton className="h-3 w-20 md:h-4 md:w-24 rounded mb-2" />
          <Skeleton className="h-6 w-16 md:h-8 md:w-20 rounded" />
        </div>
      </div>
    </div>
  );
}

/**
 * TableSkeleton - Skeleton for table components
 */
interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  showHeader?: boolean;
  className?: string;
}

export function TableSkeleton({
  rows = 5,
  cols = 4,
  showHeader = true,
  className,
}: TableSkeletonProps) {
  return (
    <div className={cn("overflow-hidden rounded-lg", className)}>
      <div className="animate-pulse">
        {showHeader && (
          <div className="border-b border-stroke bg-gray-2 px-3 py-2.5 dark:border-stroke-dark dark:bg-dark-2 sm:px-4 sm:py-3">
            <div className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {Array.from({ length: cols }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full rounded sm:h-5" />
              ))}
            </div>
          </div>
        )}
        <div className="divide-y divide-stroke dark:divide-stroke-dark">
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <div
              key={rowIdx}
              className="grid gap-2 border-stroke bg-white px-3 py-2.5 dark:border-stroke-dark dark:bg-gray-800 sm:gap-3 sm:px-4 sm:py-3"
              style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
            >
              {Array.from({ length: cols }).map((_, colIdx) => (
                <Skeleton
                  key={colIdx}
                  className={cn(
                    "h-4 rounded sm:h-5",
                    colIdx === 0 ? "w-3/4" : "w-full"
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * ChartSkeleton - Skeleton for chart components
 */
interface ChartSkeletonProps {
  height?: number | string;
  className?: string;
  showTitle?: boolean;
  title?: string;
}

export function ChartSkeleton({
  height = 320,
  className,
  showTitle = true,
  title,
}: ChartSkeletonProps) {
  const heightClass =
    typeof height === "number" ? `h-[${height}px]` : height;

  return (
    <div
      className={cn(
        "rounded-lg bg-white p-4 dark:bg-gray-800 sm:p-6",
        className
      )}
    >
      <div className="space-y-4">
        {showTitle && (
          title ? (
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {title}
            </h3>
          ) : (
            <div className="animate-pulse">
              <Skeleton className="h-5 w-48 rounded sm:h-6 sm:w-64" />
            </div>
          )
        )}
        <div
          className={cn(
            "flex items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-700 animate-pulse",
            heightClass
          )}
        >
          <div className="flex flex-col items-center gap-2 sm:gap-3">
            <Skeleton className="h-12 w-12 rounded-lg sm:h-16 sm:w-16" />
            <Skeleton className="h-4 w-32 rounded sm:h-5 sm:w-40" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ListSkeleton - Skeleton for list components
 */
interface ListSkeletonProps {
  count?: number;
  className?: string;
  itemClassName?: string;
  showAvatar?: boolean;
}

export function ListSkeleton({
  count = 5,
  className,
  itemClassName,
  showAvatar = false,
}: ListSkeletonProps) {
  return (
    <div className={cn("space-y-2 sm:space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "rounded-lg bg-white p-3 dark:bg-gray-800 sm:p-4",
            itemClassName
          )}
        >
          <div className="animate-pulse">
            <div className="flex items-center gap-3 sm:gap-4">
              {showAvatar && (
                <Skeleton className="h-10 w-10 shrink-0 rounded-full sm:h-12 sm:w-12" />
              )}
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4 rounded sm:h-5" />
                <Skeleton className="h-3 w-1/2 rounded sm:h-4" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * GridSkeleton - Skeleton for grid layouts
 */
interface GridSkeletonProps {
  count?: number;
  cols?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  className?: string;
  itemClassName?: string;
  renderItem?: (index: number) => React.ReactNode;
}

export function GridSkeleton({
  count = 3,
  cols = { mobile: 1, tablet: 2, desktop: 3 },
  className,
  itemClassName,
  renderItem,
}: GridSkeletonProps) {
  // Use explicit grid column classes that Tailwind can detect
  const gridColsMap: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
    5: "grid-cols-5",
    6: "grid-cols-6",
  };

  const mobileCols = cols.mobile || 1;
  const tabletCols = cols.tablet || cols.mobile || 1;
  const desktopCols = cols.desktop || cols.tablet || cols.mobile || 1;

  return (
    <div
      className={cn(
        "grid gap-4 sm:gap-6",
        gridColsMap[mobileCols] || "grid-cols-1",
        tabletCols !== mobileCols && (gridColsMap[tabletCols] ? `sm:${gridColsMap[tabletCols]}` : ""),
        desktopCols !== tabletCols && (gridColsMap[desktopCols] ? `lg:${gridColsMap[desktopCols]}` : ""),
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) =>
        renderItem ? (
          renderItem(i)
        ) : (
          <CardSkeleton key={i} className={itemClassName} />
        )
      )}
    </div>
  );
}

/**
 * PageSkeleton - Full page loading skeleton
 */
interface PageSkeletonProps {
  showHeader?: boolean;
  showFilters?: boolean;
  showContent?: boolean;
  className?: string;
}

export function PageSkeleton({
  showHeader = true,
  showFilters = false,
  showContent = true,
  className,
}: PageSkeletonProps) {
  return (
    <div className={cn("space-y-4 sm:space-y-6", className)}>
      {showHeader && (
        <div className="animate-pulse">
          <Skeleton className="h-8 w-64 rounded sm:h-10 sm:w-80" />
          <Skeleton className="mt-2 h-4 w-96 rounded sm:h-5 sm:w-[500px]" />
        </div>
      )}

      {showFilters && (
        <div className="animate-pulse">
          <div className="flex flex-wrap gap-3 sm:gap-4">
            <Skeleton className="h-10 w-32 rounded sm:h-11 sm:w-40" />
            <Skeleton className="h-10 w-32 rounded sm:h-11 sm:w-40" />
            <Skeleton className="h-10 w-32 rounded sm:h-11 sm:w-40" />
          </div>
        </div>
      )}

      {showContent && (
        <div className="space-y-4 sm:space-y-6">
          <GridSkeleton count={6} cols={{ mobile: 1, tablet: 2, desktop: 3 }} />
        </div>
      )}
    </div>
  );
}

