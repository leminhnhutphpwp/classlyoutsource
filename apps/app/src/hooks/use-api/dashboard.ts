'use client';

import { useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  DASHBOARD_CACHE_TTL,
} from '@/config/cache';
import { useApi } from './core';

// Dashboard hooks
export function useDashboard(enabled: boolean = true) {
  return useApi(() => apiClient.getDashboard(), [], true, enabled, {
    cacheKey: 'dashboard:overview',
    ttl: DASHBOARD_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  });
}

export function useDashboardStatistics(period?: string, enabled: boolean = true) {
  return useApi(() => apiClient.getDashboardStatistics(period), [period], true, enabled, {
    cacheKey: `dashboard:statistics:${period || 'default'}`,
    ttl: DASHBOARD_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  });
}

export function useRecentActivity(limit?: number, enabled: boolean = true) {
  return useApi(() => apiClient.getRecentActivity(limit), [limit], true, enabled, {
    cacheKey: `dashboard:recent-activity:${limit || 10}`,
    ttl: DASHBOARD_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  });
}

export function useReminders(options?: {
  type?: 'schedule' | 'payment' | 'assignment' | 'all';
  limit?: number;
  page?: number;
  days_ahead?: number;
  class_id?: string;
}, enabled: boolean = true) {
  const type = options?.type;
  const limit = options?.limit;
  const page = options?.page;
  const daysAhead = options?.days_ahead;
  const classId = options?.class_id;

  const cacheKey = useMemo(() => {
    return `reminders:${type || 'all'}:${limit || 20}:${page || 1}:${daysAhead || 7}:${classId || 'all'}`;
  }, [type, limit, page, daysAhead, classId]);

  const memoizedApiCall = useCallback(
    () => {
      const opts: Record<string, any> = {};
      if (type !== undefined) opts.type = type;
      if (limit !== undefined) opts.limit = limit;
      if (page !== undefined) opts.page = page;
      if (daysAhead !== undefined) opts.days_ahead = daysAhead;
      if (classId !== undefined) opts.class_id = classId;
      return apiClient.getReminders(opts);
    },
    [type, limit, page, daysAhead, classId]
  );

  return useApi(memoizedApiCall, [type, limit, page, daysAhead, classId], true, enabled, {
    cacheKey,
    ttl: 5 * 60 * 1000, // 5 minutes as per API docs
    strategy: 'stale-while-revalidate',
  });
}
