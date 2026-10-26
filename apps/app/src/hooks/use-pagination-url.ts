"use client";
import { useMemo, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface UsePaginationUrlOptions {
  defaultPage?: number;
  defaultPerPage?: number;
  paramName?: string;
  perPageParamName?: string;
}

/**
 * Custom hook để quản lý pagination với URL params
 * URL là source of truth - state được derived từ URL
 */
export function usePaginationUrl(options: UsePaginationUrlOptions = {}) {
  const {
    defaultPage = 1,
    defaultPerPage = 10,
    paramName = "page",
    perPageParamName = "per_page",
  } = options;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Đọc page từ URL - URL là source of truth
  const currentPage = useMemo(() => {
    const urlPage = searchParams.get(paramName);
    if (urlPage) {
      const pageNum = parseInt(urlPage, 10);
      return !isNaN(pageNum) && pageNum > 0 ? pageNum : defaultPage;
    }
    return defaultPage;
  }, [searchParams, paramName, defaultPage]);

  // Đọc per_page từ URL
  const perPage = useMemo(() => {
    const urlPerPage = searchParams.get(perPageParamName);
    if (urlPerPage) {
      const perPageNum = parseInt(urlPerPage, 10);
      return !isNaN(perPageNum) && perPageNum > 0 ? perPageNum : defaultPerPage;
    }
    return defaultPerPage;
  }, [searchParams, perPageParamName, defaultPerPage]);

  // Update URL khi page thay đổi
  const setCurrentPage = useCallback((page: number) => {
    // Lấy searchParams mới nhất từ window.location để tránh stale closure
    const currentSearchParams = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : ''
    );
    
    if (page === defaultPage) {
      // Xóa param nếu là trang mặc định để URL sạch hơn
      currentSearchParams.delete(paramName);
    } else {
      currentSearchParams.set(paramName, page.toString());
    }

    const queryString = currentSearchParams.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;

    // Update URL - replace để không tạo history entry mới
    router.replace(newUrl, { scroll: false });
  }, [router, pathname, paramName, defaultPage]); // Loại bỏ searchParams khỏi dependencies

  // Update URL khi perPage thay đổi
  const setPerPage = useCallback((newPerPage: number) => {
    // Lấy searchParams mới nhất từ window.location để tránh stale closure
    const currentSearchParams = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : ''
    );
    
    if (newPerPage === defaultPerPage) {
      currentSearchParams.delete(perPageParamName);
    } else {
      currentSearchParams.set(perPageParamName, newPerPage.toString());
    }
    
    // Reset về trang 1 khi thay đổi perPage
    currentSearchParams.delete(paramName);
    
    const queryString = currentSearchParams.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
    
    router.replace(newUrl, { scroll: false });
  }, [router, pathname, perPageParamName, defaultPerPage, paramName]); // Loại bỏ searchParams khỏi dependencies

  return {
    currentPage,
    perPage,
    setCurrentPage,
    setPerPage,
  };
}

