"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { prefetchManager } from '@/lib/prefetch-manager';

/**
 * Hook để prefetch dữ liệu dựa trên current pathname
 * Tự động prefetch dữ liệu cho các pages có thể truy cập tiếp theo
 */
export function usePrefetch() {
  const pathname = usePathname();

  useEffect(() => {
    // Prefetch dữ liệu liên quan dựa trên page hiện tại
    prefetchManager.prefetchForPage(pathname);
  }, [pathname]);
}

/**
 * Hook để prefetch dữ liệu cho một page cụ thể
 * @param pathname Pathname của page cần prefetch
 */
export function usePrefetchPage(pathname: string) {
  useEffect(() => {
    prefetchManager.prefetchForPage(pathname);
  }, [pathname]);
}

