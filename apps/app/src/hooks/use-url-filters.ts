"use client";
import { useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface UseUrlFiltersOptions {
  filters: Record<string, string | number | undefined | null>;
  defaultValues?: Record<string, string | number>;
  excludeKeys?: string[]; // Keys không push lên URL (ví dụ: 'page' đã có trong usePaginationUrl)
}

/**
 * Custom hook để quản lý filters với URL params
 * Tự động sync filters với URL
 */
export function useUrlFilters(options: UseUrlFiltersOptions) {
  const { filters, defaultValues = {}, excludeKeys = ['page', 'per_page'] } = options;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Memoize filters string để tránh infinite loop
  const filtersString = useMemo(() => JSON.stringify(filters), [filters]);
  const defaultValuesString = useMemo(() => JSON.stringify(defaultValues), [defaultValues]);
  const excludeKeysString = useMemo(() => JSON.stringify(excludeKeys), [excludeKeys]);
  
  // Track previous values để tránh update không cần thiết
  const prevFiltersStringRef = useRef<string>('');
  const prevPathnameRef = useRef<string>(pathname);
  
  // Update URL khi filters thay đổi
  useEffect(() => {
    // Skip nếu filters không thay đổi và pathname không thay đổi
    if (prevFiltersStringRef.current === filtersString && prevPathnameRef.current === pathname) {
      return;
    }
    
    prevFiltersStringRef.current = filtersString;
    prevPathnameRef.current = pathname;
    
    // Get current URL params (use window.location to avoid stale closure)
    const currentParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    let hasChanges = false;
    
    const parsedDefaultValues = JSON.parse(defaultValuesString);
    const parsedExcludeKeys = JSON.parse(excludeKeysString);
    const parsedFilters = JSON.parse(filtersString);

    // Update hoặc xóa params dựa trên filters hiện tại
    Object.entries(parsedFilters).forEach(([key, value]: [string, any]) => {
      // Bỏ qua các keys trong excludeKeys
      if (parsedExcludeKeys.includes(key)) {
        return;
      }

      const defaultValue = parsedDefaultValues[key] !== undefined ? String(parsedDefaultValues[key]) : undefined;
      const currentValue = currentParams.get(key);

      // Nếu value là undefined, null, hoặc bằng default, xóa param
      if (value === undefined || value === null || value === '') {
        if (currentValue !== null) {
          currentParams.delete(key);
          hasChanges = true;
        }
      } else if (defaultValue !== undefined && String(value) === defaultValue) {
        // Nếu value bằng default, xóa param
        if (currentValue !== null) {
          currentParams.delete(key);
          hasChanges = true;
        }
      } else {
        // Nếu value khác với current, update param
        const stringValue = String(value);
        if (currentValue !== stringValue) {
          currentParams.set(key, stringValue);
          hasChanges = true;
        }
      }
    });

    // Chỉ update URL nếu có thay đổi
    if (hasChanges) {
      const queryString = currentParams.toString();
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(newUrl, { scroll: false });
    }
  }, [filtersString, pathname, router, defaultValuesString, excludeKeysString]);

  // Helper để đọc filter từ URL
  const getFilterFromUrl = useCallback((key: string, defaultValue?: string | number): string | number | undefined => {
    const urlValue = searchParams.get(key);
    if (urlValue !== null) {
      return urlValue;
    }
    return defaultValue;
  }, [searchParams]);

  return {
    getFilterFromUrl,
  };
}

