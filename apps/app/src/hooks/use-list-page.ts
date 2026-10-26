"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { usePaginationUrl } from "./use-pagination-url";
import { useUrlFilters } from "./use-url-filters";

interface UseListPageOptions {
  // Pagination options
  defaultPage?: number;
  defaultPerPage?: number;

  // Filter keys và default values
  filterKeys?: string[];
  filterDefaults?: Record<string, string | number>;

  // Callback khi filters thay đổi (để reset page)
  onFiltersChange?: () => void;
}

/**
 * Hook tổng hợp để quản lý pagination và filters cho list pages
 * Tự động sync với URL, reset page khi filters thay đổi
 */
export function useListPage(options: UseListPageOptions = {}) {
  const {
    defaultPage = 1,
    defaultPerPage = 10,
    filterKeys = [],
    filterDefaults = {},
    onFiltersChange,
  } = options;

  const searchParams = useSearchParams();

  // Pagination
  const { currentPage, perPage, setCurrentPage } = usePaginationUrl({
    defaultPage,
    defaultPerPage,
  });

  // Đọc filters từ URL - URL là source of truth
  const filtersFromUrl = useMemo(() => {
    const urlFilters: Record<string, string> = {};
    filterKeys.forEach((key) => {
      const urlValue = searchParams.get(key);
      // Nếu có default value trong filterDefaults, dùng nó, nếu không thì dùng empty string (cho search fields)
      const defaultValue = filterDefaults[key] !== undefined
        ? String(filterDefaults[key])
        : "";
      urlFilters[key] = urlValue || defaultValue;
    });
    return urlFilters;
  }, [searchParams, filterKeys, filterDefaults]);

  const [filters, setFilters] = useState<Record<string, string>>(filtersFromUrl);
  const [pageOverride, setPageOverride] = useState<number | null>(null);

  // Sync filters với URL khi URL thay đổi (back/forward button)
  useEffect(() => {
    let hasChanges = false;
    const newFilters: Record<string, string> = { ...filters };

    filterKeys.forEach((key) => {
      const urlValue = searchParams.get(key);
      // Nếu có default value trong filterDefaults, dùng nó, nếu không thì dùng empty string (cho search fields)
      const defaultValue = filterDefaults[key] !== undefined
        ? String(filterDefaults[key])
        : "";
      const newValue = urlValue || defaultValue;

      if (newValue !== filters[key]) {
        newFilters[key] = newValue;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      setFilters(newFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // Chỉ sync khi searchParams thay đổi, filters không cần trong deps

  // Push filters lên URL - memoize để tránh infinite loop
  const urlFilters = useMemo(() => {
    return Object.fromEntries(
      Object.entries(filters).map(([key, value]) => [
        key,
        value === "all" || value === "" ? null : value,
      ])
    );
  }, [filters]);

  useUrlFilters({
    filters: urlFilters,
    defaultValues: filterDefaults,
  });

  // Reset page khi filters thay đổi
  const prevFiltersRef = useRef(filters);
  useEffect(() => {
    const prevFilters = prevFiltersRef.current;
    const filtersChanged = filterKeys.some(
      (key) => prevFilters[key] !== filters[key]
    );

    if (filtersChanged) {
      prevFiltersRef.current = filters;
      if (currentPage !== defaultPage) {
        setPageOverride(defaultPage);
        setCurrentPage(defaultPage);
      }
      onFiltersChange?.();
    }
  }, [filters, filterKeys, currentPage, defaultPage, setCurrentPage, onFiltersChange]);

  useEffect(() => {
    if (pageOverride !== null && currentPage === pageOverride) {
      setPageOverride(null);
    }
  }, [pageOverride, currentPage]);

  // Helper để update filter
  const updateFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Helper để reset filters về defaults
  const resetFilters = () => {
    const resetFilters: Record<string, string> = {};
    filterKeys.forEach((key) => {
      // Nếu có default value trong filterDefaults, dùng nó, nếu không thì dùng empty string
      resetFilters[key] = filterDefaults[key] !== undefined
        ? String(filterDefaults[key])
        : "";
    });
    setFilters(resetFilters);
  };

  // Tạo filter object cho API (loại bỏ "all" và empty values)
  const effectivePage = pageOverride ?? currentPage;

  const apiFilters = useMemo(() => {
    const apiFilters: Record<string, any> = {
      per_page: perPage,
      page: effectivePage,
    };

    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "all" && value !== "") {
        apiFilters[key] = value;
      }
    });

    return apiFilters;
  }, [perPage, effectivePage, filters]);

  return {
    // Pagination
    currentPage,
    perPage,
    setCurrentPage,

    // Filters
    filters,
    updateFilter,
    resetFilters,

    // Combined API filters
    apiFilters,
  };
}

