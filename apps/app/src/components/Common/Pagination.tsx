"use client";
import { memo } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface PaginationMeta {
  current_page?: number;
  per_page?: number;
  total?: number;
  last_page?: number;
  from?: number;
  to?: number;
}

interface PaginationProps {
  meta: PaginationMeta | null | undefined;
  currentPage: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  className?: string;
}

function PaginationComponent({
  meta,
  currentPage,
  onPageChange,
  itemLabel = "bản ghi",
  className = "",
}: PaginationProps) {
  if (!meta || !meta.total || meta.total <= 0) {
    return null;
  }

  const currentPageNum = meta.current_page || currentPage || 1;
  const perPage = meta.per_page || 15;
  const total = meta.total;
  const lastPage = meta.last_page || Math.ceil(total / perPage);
  const from = ((currentPageNum - 1) * perPage) + 1;
  const to = Math.min(currentPageNum * perPage, total);
  const isFirstPage = currentPageNum <= 1;
  const isLastPage = currentPageNum >= lastPage;

  const handlePrevious = () => {
    if (!isFirstPage) {
      onPageChange(currentPageNum - 1);
    }
  };

  const handleNext = () => {
    if (!isLastPage) {
      onPageChange(currentPageNum + 1);
    }
  };

  const handlePageClick = (page: number) => {
    if (page >= 1 && page <= lastPage && page !== currentPageNum) {
      onPageChange(page);
    }
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7; // Maximum number of page buttons to show

    if (lastPage <= maxVisible) {
      // Show all pages if total pages is less than maxVisible
      for (let i = 1; i <= lastPage; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      // Calculate start and end of middle section
      let start = Math.max(2, currentPageNum - 1);
      let end = Math.min(lastPage - 1, currentPageNum + 1);

      // Adjust if we're near the start
      if (currentPageNum <= 3) {
        end = 4;
      }

      // Adjust if we're near the end
      if (currentPageNum >= lastPage - 2) {
        start = lastPage - 3;
      }

      // Add ellipsis after first page if needed
      if (start > 2) {
        pages.push("...");
      }

      // Add middle pages
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      // Add ellipsis before last page if needed
      if (end < lastPage - 1) {
        pages.push("...");
      }

      // Always show last page
      pages.push(lastPage);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 rounded-lg bg-white px-4 sm:px-6 py-4 dark:bg-gray-800 ${className}`}>
      <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 text-center sm:text-left">
        Hiển thị {from} - {to} trong tổng {total} {itemLabel}
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={handlePrevious}
          disabled={isFirstPage}
          className="inline-flex items-center justify-center min-w-[41px] h-[41px] px-2 sm:px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Trước"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-0.5 sm:gap-1">
          {pageNumbers.map((page, index) => {
            if (page === "...") {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-1 sm:px-2 text-gray-500 dark:text-gray-400 text-xs sm:text-sm"
                >
                  ...
                </span>
              );
            }

            const pageNum = page as number;
            const isActive = pageNum === currentPageNum;

            return (
              <button
                key={pageNum}
                onClick={() => handlePageClick(pageNum)}
                disabled={isActive}
                className={`
                  inline-flex items-center justify-center min-w-[41px] h-[41px] px-2 sm:px-3 text-xs sm:text-sm font-medium rounded-md transition-colors
                  ${isActive
                    ? "bg-primary text-white cursor-default"
                    : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
                  }
                `}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleNext}
          disabled={isLastPage}
          className="inline-flex items-center justify-center min-w-[41px] h-[41px] px-2 sm:px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Sau"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

const Pagination = memo(PaginationComponent);
export default Pagination;
