'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getCachedValue, setCachedValue, invalidateClientCache, invalidateCacheByPrefix, isCacheEntryFresh } from '@/lib/client-cache';
import { type ApiResponse } from '@/lib/api-config';
import {
  DEFAULT_CACHE_TTL,
} from '@/config/cache';
import { useLockContext } from '@/contexts/lock-context';

type CacheStrategy = 'network-only' | 'cache-first' | 'stale-while-revalidate';

type CacheOptions = {
  cacheKey: string;
  ttl?: number;
  strategy?: CacheStrategy;
  revalidateOnMount?: boolean;
};

type MutationOptions = {
  invalidateCacheKeys?: string[];
  invalidateCachePrefixes?: string[];
};

/**
 * Sanitize error message để loại bỏ domain/URL và thông tin nhạy cảm
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return 'Đã xảy ra lỗi. Vui lòng thử lại.';

  // Remove URLs
  const sanitized = message
    .replace(/https?:\/\/[^\s]+/gi, '[server]')
    .replace(/[a-zA-Z0-9.-]+\.(com|net|org|io|online|dev|local|test|vn|edu|gov)[^\s]*/gi, '[server]')
    // Remove technical error codes that might expose server info
    .replace(/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN/gi, '')
    // Remove IP addresses
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[server]')
    // Remove port numbers in error messages
    .replace(/:\d{1,5}/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return sanitized || 'Đã xảy ra lỗi. Vui lòng thử lại.';
}

// Chỉ cho phép MỘT lần đăng xuất chạy: một trang dashboard bắn nhiều request song
// song, nên nếu không chặn thì mỗi cái 401 sẽ tự gọi logout và tự điều hướng.
let signOutInFlight = false;

export function autoRedirectIfUnauthenticated(response: any) {
  const isUnauthenticated =
    response?.code === 'UNAUTHENTICATED' ||
    response?.message === 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' ||
    response?.message === 'Chưa xác thực. Vui lòng đăng nhập.';

  if (!isUnauthenticated) return;
  if (typeof window === 'undefined') return;
  if (window.location.pathname.startsWith('/auth')) return;
  if (signOutInFlight) return;

  signOutInFlight = true;

  // PHẢI xoá cookie trước khi rời trang, nếu không sẽ lặp vô hạn: middleware.ts chỉ
  // kiểm tra cookie CÓ TỒN TẠI chứ không kiểm tra còn hợp lệ, nên nó thấy token hỏng
  // vẫn tưởng đã đăng nhập và đá /auth/sign-in ngược về /dashboard — trong khi API
  // vẫn trả 401 và đẩy ta trở lại /auth/sign-in.
  // Cookie là HttpOnly nên JS không xoá được, buộc phải nhờ route server.
  // Điều hướng phải đợi request xong: chuyển trang trước sẽ huỷ request đang bay và
  // để cookie hỏng nằm lại — đúng trạng thái gây lặp.
  fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    .catch(() => {
      // Xoá thất bại thì vẫn rời trang. Trang đăng nhập tự xử lý được, và ở lại đây
      // chắc chắn tệ hơn.
    })
    .finally(() => {
      window.location.href = '/auth/sign-in';
    });
}

export function useApi<T = any>(
  apiCall: () => Promise<ApiResponse<T>>,
  dependencies: any[] = [],
  shouldRedirectOnAuth: boolean = true,
  enabled: boolean = true,
  cacheOptions?: CacheOptions
) {
  const lockContext = useLockContext();
  const cacheKey = cacheOptions?.cacheKey;
  const cacheStrategy: CacheStrategy = cacheOptions?.strategy ?? 'network-only';
  const cacheTtl = cacheOptions?.ttl ?? DEFAULT_CACHE_TTL;
  const revalidateOnMount =
    cacheOptions?.revalidateOnMount ??
    (cacheStrategy === 'stale-while-revalidate');

  const cachedValue = cacheKey ? getCachedValue<T>(cacheKey) : null;

  const [data, setData] = useState<T | null>(cachedValue ?? null);
  const [loading, setLoading] = useState<boolean>(() => {
    if (!cacheKey) return true;
    if (!cachedValue) return true;
    if (cacheStrategy === 'cache-first' && !revalidateOnMount) return false;
    if (cacheStrategy === 'stale-while-revalidate') return false;
    return true;
  });
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ApiResponse<T>['meta'] | undefined>(undefined);
  const [permissions, setPermissions] = useState<ApiResponse<T>['permissions'] | undefined>(undefined);

  // Use useRef to store the latest apiCall without causing re-renders
  const apiCallRef = useRef(apiCall);
  useEffect(() => {
    apiCallRef.current = apiCall;
  }, [apiCall]);

  const fetchData = useCallback(async (forceNetwork: boolean = false) => {
    if (!enabled) {
      setLoading(false);
      if (!forceNetwork) {
        setData(null);
      }
      setError(null);
      return;
    }

    const existingCache = cacheKey ? getCachedValue<T>(cacheKey) : null;
    const shouldSkipNetwork =
      !forceNetwork &&
      cacheKey &&
      cacheStrategy === 'cache-first' &&
      existingCache &&
      !revalidateOnMount;

    if (shouldSkipNetwork) {
      setData(existingCache);
      setError(null);
      setLoading(false);
      return;
    }

    const hasCacheForSWR =
      !forceNetwork &&
      existingCache &&
      cacheStrategy === 'stale-while-revalidate';

    if (hasCacheForSWR) {
      setData(existingCache);
      setError(null);
      setLoading(false);
    }

    // Freshness window: right after the login bootstrap wrote this key the data
    // is by definition current, so skip the background revalidation entirely.
    // This is what stops the dashboard from refiring 14–28 requests on mount
    // after a warm bootstrap. User-triggered refetch (forceNetwork) still bypasses.
    const isFresh = !forceNetwork && !!cacheKey && isCacheEntryFresh(cacheKey);
    if (isFresh) {
      return;
    }

    const shouldShowSpinner =
      forceNetwork ||
      (!data && !existingCache);
    // Trần an toàn cuối cùng, chỉ để tránh spinner quay mãi nếu apiCall không bao giờ resolve.
    //
    // PHẢI LỚN HƠN timeout thật của tầng fetch (api-client.ts: AbortController 30s), nếu không nó
    // bắn trước và báo lỗi cho một request vẫn đang KHỎE MẠNH — chỉ là đang xếp hàng. Trình duyệt
    // giới hạn 6 kết nối/origin; Dashboard bắn 14–28 request khi mount, nên request cuối hàng có thể
    // chờ 20–25s dù server chỉ mất 1–3s. Ngưỡng 15s cũ khiến 8 widget cùng lật đỏ, và vì `error`
    // không được xoá khi response thành công về sau, chữ đỏ vẫn nằm đó dù dữ liệu đã có.
    // Khi request treo thật, AbortController 30s đã trả về lỗi đúng luồng response.success === false.
    const timeoutSafety = setTimeout(() => {
      setLoading(false);
      setError('Yêu cầu đã hết thời gian chờ. Vui lòng thử lại.');
    }, 35000);

    try {
      if (shouldShowSpinner) {
        setLoading(true);
      }
      setError(null);
      // Use ref to get the latest apiCall
      const response = await apiCallRef.current();
      clearTimeout(timeoutSafety);

      if (shouldRedirectOnAuth && response.code === 'UNAUTHENTICATED' && !response.success) {
        autoRedirectIfUnauthenticated(response);
      }

      if (response.success) {
        const nextData = response.data || null;
        setData(nextData);
        if (cacheKey) {
          setCachedValue(cacheKey, nextData, cacheTtl);
        }
        setMeta(response.meta);
        setPermissions(response.permissions);
      } else {
        // Nếu API trả trạng thái lock → bật popup global và KHÔNG set error message
        // Lock content sẽ tự xử lý việc hiển thị
        if (
          response.code === 'ACCOUNT_ACTIONS_LOCKED' ||
          response.code === 'ACCOUNT_LOCKED' ||
          response.code === 'ACCOUNT_INACTIVE' ||
          response.code === 'TUTOR_INACTIVE' ||
          response.code === 'TUTOR_ACTIVE'
        ) {
          lockContext.setActionLockFromResponse(response);
          // Không set error để tránh hiển thị message cũ, lock content sẽ xử lý
        } else {
          // Chỉ set error cho các lỗi khác không phải lock codes
          const errorMessage = response.message ? sanitizeErrorMessage(response.message) : 'Đã xảy ra lỗi. Vui lòng thử lại.';
          setError(errorMessage);
        }
      }
    } catch (err) {
      clearTimeout(timeoutSafety);
      const errorMessage = err instanceof Error ? sanitizeErrorMessage(err.message) : 'Đã xảy ra lỗi. Vui lòng thử lại.';
      setError(errorMessage);
    } finally {
      clearTimeout(timeoutSafety);
      setLoading(false);
    }
    // Intentionally omit `data` and `lockContext` from the deps: `data` is only a spinner
    // heuristic and `lockContext` only feeds the lock banner. `data` changes after every
    // successful fetch and the lock-context value is a fresh object on every provider render,
    // so including them would recreate fetchData (and therefore `refetch`/`refresh`) on every
    // render, churning identities for all consumers — re-render and refetch-loop risk. Reading
    // them from the render closure keeps runtime behavior identical.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shouldRedirectOnAuth,
    enabled,
    cacheKey,
    cacheStrategy,
    cacheTtl,
    revalidateOnMount,
  ]);

  // Track previous dependencies to detect changes
  const prevDepsRef = useRef<string>('');
  const prevEnabledRef = useRef<boolean>(enabled);
  const currentDepsString = useMemo(() => JSON.stringify(dependencies), [dependencies]);

  // Trigger fetch when dependencies change hoặc khi enabled thay đổi
  // Không include fetchData trong dependencies để tránh re-render không cần thiết
  // fetchData đã được memoize với useCallback và sẽ luôn là function mới nhất
  useEffect(() => {
    // Fetch nếu dependencies thay đổi
    const depsChanged = prevDepsRef.current !== currentDepsString;
    // Fetch nếu enabled thay đổi từ false sang true (khi bật lại)
    const enabledChanged = prevEnabledRef.current !== enabled;
    const shouldFetch = depsChanged || (enabledChanged && enabled);

    if (shouldFetch) {
      prevDepsRef.current = currentDepsString;
      prevEnabledRef.current = enabled;
      fetchData();
    } else if (enabledChanged && !enabled) {
      // Nếu enabled chuyển từ true sang false, chỉ update ref
      prevEnabledRef.current = enabled;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDepsString, enabled]); // Include enabled để detect changes

  const refetch = useCallback((forceNetwork: boolean = true) => {
    fetchData(forceNetwork);
  }, [fetchData]);

  const refresh = useCallback(() => {
    fetchData(false);
  }, [fetchData]);

  return { data, loading, error, refetch, refresh, meta, permissions };
}

// Mutation hooks for creating/updating/deleting data
export function useMutation<T = any>(
  mutationFn: (...args: any[]) => Promise<ApiResponse<T>>,
  options?: MutationOptions & {
    // Function to generate cache keys/prefixes from mutation arguments
    getInvalidateKeys?: (...args: any[]) => string[];
    getInvalidatePrefixes?: (...args: any[]) => string[];
  }
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lockContext = useLockContext();

  const mutate = async (...args: any[]) => {
    try {
      // Nếu đã biết tài khoản đang bị khóa thao tác, không gọi API nữa
      if (lockContext?.actionsLocked) {
        const info = lockContext.lockInfo;
        const message =
          info?.message ||
          'Tài khoản đang bị tạm khóa thao tác, bạn chưa thể tạo/sửa/xóa dữ liệu.';
        setError(message);
        return {
          success: false,
          message,
          code: 'ACCOUNT_ACTIONS_LOCKED',
          data: info,
        } as ApiResponse<T>;
      }

      setLoading(true);
      setError(null);
      const response = await mutationFn(...args);

      if (!response.success) {
        // Nếu backend trả trạng thái khóa thao tác → lưu vào LockContext để hiển thị banner global
        // KHÔNG set error message để tránh hiển thị message cũ, lock content sẽ xử lý
        if (
          lockContext &&
          (response.code === 'ACCOUNT_ACTIONS_LOCKED' ||
            response.code === 'ACCOUNT_LOCKED' ||
            response.code === 'ACCOUNT_INACTIVE' ||
            response.code === 'TUTOR_INACTIVE')
        ) {
          lockContext.setActionLockFromResponse(response);
          // Không set error để tránh hiển thị message cũ
        } else {
          // Chỉ set error cho các lỗi khác không phải lock codes
          const errorMessage = response.message ? sanitizeErrorMessage(response.message) : 'Đã xảy ra lỗi. Vui lòng thử lại.';
          setError(errorMessage);
        }
      }

      if (response.success) {
        // Static cache keys
        if (options?.invalidateCacheKeys && options.invalidateCacheKeys.length > 0) {
          invalidateClientCache(options.invalidateCacheKeys);
        }

        // Dynamic cache keys from arguments
        if (options?.getInvalidateKeys) {
          const dynamicKeys = options.getInvalidateKeys(...args);
          if (dynamicKeys.length > 0) {
            invalidateClientCache(dynamicKeys);
          }
        }

        // Static cache prefixes
        if (options?.invalidateCachePrefixes && options.invalidateCachePrefixes.length > 0) {
          options.invalidateCachePrefixes.forEach(prefix => invalidateCacheByPrefix(prefix));
        }

        // Dynamic cache prefixes from arguments
        if (options?.getInvalidatePrefixes) {
          const dynamicPrefixes = options.getInvalidatePrefixes(...args);
          dynamicPrefixes.forEach(prefix => invalidateCacheByPrefix(prefix));
        }
      }

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? sanitizeErrorMessage(err.message) : 'Đã xảy ra lỗi. Vui lòng thử lại.';
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return { mutate, loading, error };
}
