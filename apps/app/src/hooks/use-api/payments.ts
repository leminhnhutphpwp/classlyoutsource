'use client';

import { useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import { buildListKey } from '@/lib/cache-keys';
import {
  DEFAULT_CACHE_TTL,
  REPORT_CACHE_TTL,
} from '@/config/cache';
import { useApi, useMutation } from './core';

/**
 * Shared builder for the payments list cache key. BOTH the usePayments hook and
 * every warm-up path (login bootstrap, prefetch manager) must use this so their
 * keys can never drift apart.
 */
export function paymentsListKey(filters: Record<string, any> = {}): string {
  return buildListKey('payments:list', filters);
}

// Payments hooks
export function usePayments(filters?: {
  class_id?: string;
  student_id?: string;
  status?: string;
  payment_method?: string;
  date_from?: string;
  date_to?: string;
  per_page?: number;
  page?: number;
  sort?: string;
  order?: string;
  search?: string;
}) {
  // Extract individual filter values for dependencies
  const classId = filters?.class_id;
  const studentId = filters?.student_id;
  const status = filters?.status;
  const paymentMethod = filters?.payment_method;
  const dateFrom = filters?.date_from;
  const dateTo = filters?.date_to;
  const perPage = filters?.per_page;
  const page = filters?.page;
  const sort = filters?.sort;
  const order = filters?.order;
  const search = filters?.search;

  // Create stable cache key that includes all filter values
  const cacheKey = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (classId !== undefined) filterObj.class_id = classId;
    if (studentId !== undefined) filterObj.student_id = studentId;
    if (status !== undefined) filterObj.status = status;
    if (paymentMethod !== undefined) filterObj.payment_method = paymentMethod;
    if (dateFrom !== undefined) filterObj.date_from = dateFrom;
    if (dateTo !== undefined) filterObj.date_to = dateTo;
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    if (sort !== undefined) filterObj.sort = sort;
    if (order !== undefined) filterObj.order = order;
    if (search !== undefined) filterObj.search = search;
    return paymentsListKey(filterObj);
  }, [classId, studentId, status, paymentMethod, dateFrom, dateTo, perPage, page, sort, order, search]);

  // Create stable filters object
  const stableFilters = useMemo(
    () => {
      const filterObj: Record<string, any> = {};
      if (classId !== undefined) filterObj.class_id = classId;
      if (studentId !== undefined) filterObj.student_id = studentId;
      if (status !== undefined) filterObj.status = status;
      if (paymentMethod !== undefined) filterObj.payment_method = paymentMethod;
      if (dateFrom !== undefined) filterObj.date_from = dateFrom;
      if (dateTo !== undefined) filterObj.date_to = dateTo;
      if (perPage !== undefined) filterObj.per_page = perPage;
      if (page !== undefined) filterObj.page = page;
      if (sort !== undefined) filterObj.sort = sort;
      if (order !== undefined) filterObj.order = order;
      if (search !== undefined) filterObj.search = search;
      return filterObj;
    },
    [classId, studentId, status, paymentMethod, dateFrom, dateTo, perPage, page, sort, order, search]
  );

  // Memoize apiCall to prevent it from being recreated on every render
  const memoizedApiCall = useCallback(() => apiClient.getPayments(stableFilters), [stableFilters]);

  return useApi(
    memoizedApiCall,
    [classId, studentId, status, paymentMethod, dateFrom, dateTo, perPage, page, sort, order, search],
    true,
    true,
    {
      cacheKey,
      ttl: REPORT_CACHE_TTL,
      strategy: 'stale-while-revalidate', // Show cached data immediately, fetch fresh data in background
    }
  );
}

export function usePayment(id: string) {
  const shouldFetch = !!id && id !== 'undefined' && id !== '0';
  return useApi(() => apiClient.getPayment(id), [id], true, shouldFetch, shouldFetch ? {
    cacheKey: `payment:${id}`,
    ttl: REPORT_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  } : undefined);
}

export function usePaymentsByStudent(
  studentId: string,
  filters?: Record<string, any>,
  hookOptions?: { enabled?: boolean }
) {
  const sanitizedId = studentId?.trim();
  const shouldEnable = hookOptions?.enabled ?? (!!sanitizedId && sanitizedId !== '0');

  // Tạo cacheKey ổn định theo student + filters để dùng chung giữa các màn (my-payments, dashboard, v.v.)
  // Serialize filters to a primitive so the memo deps can be statically checked; re-hydrate to keep
  // a stable object identity whenever the filter VALUES are unchanged (same semantics as the old
  // [JSON.stringify(filters)] dep, without referencing `filters` from inside the memo).
  const serializedFilters = useMemo(() => JSON.stringify(filters || {}), [filters]);
  const stableFilters = useMemo(
    () => JSON.parse(serializedFilters) as Record<string, any>,
    [serializedFilters]
  );
  const cacheKey = useMemo(
    () => `payments:student:${sanitizedId || 'unknown'}:${JSON.stringify(stableFilters)}`,
    [sanitizedId, stableFilters]
  );

  // Memo hoá apiCall để tránh recreate mỗi render
  const memoizedApiCall = useCallback(
    () => apiClient.getPaymentsByStudent(studentId, stableFilters),
    [studentId, stableFilters]
  );

  return useApi(
    memoizedApiCall,
    [studentId, JSON.stringify(stableFilters)],
    true, // bật shared cache để tận dụng config cache chung
    shouldEnable,
    {
      cacheKey,
      ttl: DEFAULT_CACHE_TTL,
      strategy: 'stale-while-revalidate',
    }
  );
}

export function usePaymentStatistics(filters?: { date_from?: string; date_to?: string; payment_method?: string; period?: number }) {
  return useApi(
    () => apiClient.getPaymentStatistics(filters),
    [filters?.date_from, filters?.date_to, filters?.payment_method, filters?.period]
  );
}

export function useApprovePayment() {
  return useMutation(
    ({ id, note }: { id: string; note?: string }) => apiClient.approvePayment(id, { note }),
    {
      invalidateCacheKeys: ['payments:list'],
      getInvalidatePrefixes: ({ id }) => [`payments:student:`, `payment:${id}`],
    }
  );
}

export function useRejectPayment() {
  return useMutation(
    ({ id, reason }: { id: string; reason: string }) => apiClient.rejectPayment(id, { reason }),
    {
      invalidateCacheKeys: ['payments:list'],
      getInvalidatePrefixes: ({ id }) => [`payments:student:`, `payment:${id}`],
    }
  );
}

export function useRefundPayment() {
  return useMutation(
    ({ id, reason, refund_amount }: { id: string; reason: string; refund_amount?: number }) =>
      apiClient.refundPayment(id, { reason, refund_amount }),
    {
      invalidateCacheKeys: ['payments:list'],
      getInvalidatePrefixes: ({ id }) => [`payments:student:`, `payment:${id}`],
    }
  );
}

export function useMarkPaymentFailed() {
  return useMutation(
    ({ id, reason }: { id: string; reason: string }) => apiClient.markPaymentFailed(id, { reason }),
    {
      invalidateCacheKeys: ['payments:list'],
      getInvalidatePrefixes: ({ id }) => [`payments:student:`, `payment:${id}`],
    }
  );
}

// Payment Requests hooks
export function usePaymentRequests(classId: string, filters?: { status?: string; period_month?: string; per_page?: number; page?: number }) {
  // Extract individual filter values for dependencies
  const status = filters?.status;
  const periodMonth = filters?.period_month;
  const perPage = filters?.per_page;
  const page = filters?.page;

  // Create stable cache key
  const cacheKey = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (status !== undefined) filterObj.status = status;
    if (periodMonth !== undefined) filterObj.period_month = periodMonth;
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    const sortedKeys = Object.keys(filterObj).sort();
    const sortedFilters = sortedKeys.reduce((acc, key) => {
      acc[key] = filterObj[key];
      return acc;
    }, {} as Record<string, any>);
    return `payment-requests:class:${classId}:${JSON.stringify(sortedFilters)}`;
  }, [classId, status, periodMonth, perPage, page]);

  // Create stable filters object
  const stableFilters = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (status !== undefined) filterObj.status = status;
    if (periodMonth !== undefined) filterObj.period_month = periodMonth;
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    return filterObj;
  }, [status, periodMonth, perPage, page]);

  // Memoize apiCall to prevent it from being recreated on every render
  const memoizedApiCall = useCallback(() => apiClient.getPaymentRequests(classId, stableFilters), [classId, stableFilters]);

  return useApi(
    memoizedApiCall,
    [classId, status, periodMonth, perPage, page],
    true,
    !!classId,
    {
      cacheKey,
      ttl: DEFAULT_CACHE_TTL,
      strategy: 'stale-while-revalidate',
    }
  );
}

export function usePaymentRequest(id: string | number) {
  const idString = String(id || '');
  return useApi(
    () => apiClient.getPaymentRequest(idString),
    [idString],
    true,
    !!idString && idString.trim() !== '',
    {
      cacheKey: `payment-request:${idString}`,
      ttl: DEFAULT_CACHE_TTL,
      strategy: 'stale-while-revalidate',
    }
  );
}

export function useCreatePaymentRequest() {
  return useMutation(
    ({ classId, data }: {
      classId: string; data: {
        period_name: string;
        period_month?: string;
        amount_per_student: number;
        due_date: string;
        description?: string;
        auto_create_payments?: boolean;
      }
    }) => apiClient.createPaymentRequest(classId, data),
    {
      getInvalidatePrefixes: ({ classId }: { classId: string }) => [`payment-requests:class:${classId}:`],
    }
  );
}

export function useBulkCreatePaymentRequests() {
  return useMutation(
    ({ classId, data }: {
      classId: string; data: {
        amount_per_student: number;
        start_date: string;
        number_of_periods: number;
        period_type: 'monthly' | 'weekly' | 'custom';
        period_name_template?: string;
        description?: string;
        auto_create_payments?: boolean;
      }
    }) => apiClient.bulkCreatePaymentRequests(classId, data),
    {
      getInvalidatePrefixes: ({ classId }: { classId: string }) => [`payment-requests:class:${classId}:`],
    }
  );
}

export function useUpdatePaymentRequest() {
  return useMutation(
    ({ id, data }: {
      id: string; data: {
        period_name?: string;
        period_month?: string;
        amount_per_student?: number;
        due_date?: string;
        description?: string;
        status?: 'pending' | 'active' | 'cancelled';
      }
    }) => apiClient.updatePaymentRequest(id, data),
    {
      invalidateCacheKeys: ['payment-requests:list'],
      getInvalidatePrefixes: () => ['payment-request:', 'payment-requests:class:'],
    }
  );
}

export function useDeletePaymentRequest() {
  return useMutation(
    (id: string) => apiClient.deletePaymentRequest(id),
    {
      invalidateCacheKeys: ['payment-requests:list'],
      getInvalidatePrefixes: () => ['payment-request:', 'payment-requests:class:'],
    }
  );
}

export function usePaymentRequestStatistics(id: string | number) {
  const idString = String(id || '');
  return useApi(
    () => apiClient.getPaymentRequestStatistics(idString),
    [idString],
    true,
    !!idString && idString.trim() !== '',
    {
      cacheKey: `payment-request:${idString}:statistics`,
      ttl: DEFAULT_CACHE_TTL,
      strategy: 'stale-while-revalidate',
    }
  );
}

export function useCreatePayment() {
  return useMutation((paymentData: any) => apiClient.createPayment(paymentData), {
    invalidateCacheKeys: ['payments:list', 'dashboard:overview'],
    invalidateCachePrefixes: ['payments:student:'],
  });
}

export function useUpdatePayment() {
  return useMutation((id: string, paymentData: any) => apiClient.updatePayment(id, paymentData), {
    invalidateCacheKeys: ['payments:list', 'dashboard:overview'],
    invalidateCachePrefixes: ['payments:student:'],
  });
}

export function useDeletePayment() {
  return useMutation((id: string) => apiClient.deletePayment(id), {
    invalidateCacheKeys: ['payments:list', 'dashboard:overview'],
    invalidateCachePrefixes: ['payments:student:'],
  });
}
