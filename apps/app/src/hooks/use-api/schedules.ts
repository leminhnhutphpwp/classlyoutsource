'use client';

import { useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import { buildListKey } from '@/lib/cache-keys';
import {
  DEFAULT_CACHE_TTL,
  ASSIGNMENT_CACHE_TTL,
  REPORT_CACHE_TTL,
} from '@/config/cache';
import { useApi, useMutation } from './core';

/**
 * Shared builder for the schedules list cache key. BOTH the useSchedules hook
 * and every warm-up path (login bootstrap, prefetch manager) must use this so
 * their keys can never drift apart.
 */
export function schedulesListKey(filters: Record<string, any> = {}): string {
  return buildListKey('schedules:list', filters);
}

// Schedules hooks
export function useSchedules(filters?: {
  per_page?: number;
  page?: number;
  status?: string;
  class_id?: string;
  search?: string;
  mode?: string;
}) {
  // Extract individual filter values for dependencies
  const perPage = filters?.per_page;
  const page = filters?.page;
  const status = filters?.status;
  const classId = filters?.class_id;
  const search = filters?.search;
  const mode = filters?.mode;

  // Create stable cache key
  const cacheKey = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    if (status !== undefined) filterObj.status = status;
    if (classId !== undefined) filterObj.class_id = classId;
    if (search !== undefined) filterObj.search = search;
    if (mode !== undefined) filterObj.mode = mode;
    return schedulesListKey(filterObj);
  }, [perPage, page, status, classId, search, mode]);

  // Create stable filters object
  const stableFilters = useMemo(
    () => {
      const filterObj: Record<string, any> = {};
      if (perPage !== undefined) filterObj.per_page = perPage;
      if (page !== undefined) filterObj.page = page;
      if (status !== undefined) filterObj.status = status;
      if (classId !== undefined) filterObj.class_id = classId;
      if (search !== undefined) filterObj.search = search;
      if (mode !== undefined) filterObj.mode = mode;
      return filterObj;
    },
    [perPage, page, status, classId, search, mode]
  );

  // Memoize apiCall to prevent it from being recreated on every render
  const memoizedApiCall = useCallback(() => apiClient.getSchedules(stableFilters), [stableFilters]);

  return useApi(
    memoizedApiCall,
    [perPage, page, status, classId, search, mode],
    true,
    true,
    {
      cacheKey,
      ttl: ASSIGNMENT_CACHE_TTL,
      strategy: 'stale-while-revalidate', // Show cached data immediately, fetch fresh data in background
    }
  );
}

export function useSchedule(id: string) {
  const shouldFetch = !!id && id !== 'undefined' && id !== '0';
  return useApi(() => apiClient.getSchedule(id), [id], false, shouldFetch, shouldFetch ? {
    cacheKey: `schedule:${id}`,
    ttl: REPORT_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  } : undefined);
}

export function useScheduleSessions(id: string) {
  const sanitizedId = id?.trim();
  const shouldFetch = !!sanitizedId && sanitizedId !== 'undefined' && sanitizedId !== '0';
  return useApi(() => apiClient.getScheduleSessions(id), [id], false, shouldFetch, shouldFetch ? {
    cacheKey: `schedule:${sanitizedId}:sessions`,
    ttl: DEFAULT_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  } : undefined);
}

export function useScheduleSession(id: string) {
  const shouldFetch = !!id && id !== 'undefined' && id !== '0';
  return useApi(() => apiClient.getScheduleSession(id), [id], false, shouldFetch, shouldFetch ? {
    cacheKey: `schedule-session:${id}`,
    ttl: DEFAULT_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  } : undefined);
}

export function useUpdateScheduleSession() {
  return useMutation((id: string, data: any) =>
    apiClient.updateScheduleSession(id, data)
  );
}

export function useDeleteScheduleSession() {
  return useMutation((id: string) => apiClient.deleteScheduleSession(id));
}

export function useCompleteScheduleSession() {
  return useMutation((id: string) => apiClient.completeScheduleSession(id));
}

export function useCancelScheduleSession() {
  return useMutation((id: string) => apiClient.cancelScheduleSession(id));
}

export function useRescheduleSession() {
  return useMutation(
    (id: string, data: {
      session_date: string;
      start_time: string;
      end_time: string;
      status?: "scheduled" | "postponed";
    }) => apiClient.rescheduleSession(id, data)
  );
}

export function useCreateSchedule() {
  return useMutation((scheduleData: any) => apiClient.createSchedule(scheduleData), {
    invalidateCacheKeys: ['schedules:list'],
  });
}

export function useUpdateSchedule() {
  return useMutation((id: string, scheduleData: any) => apiClient.updateSchedule(id, scheduleData), {
    invalidateCacheKeys: ['schedules:list'],
    getInvalidatePrefixes: (id: string) => [`schedule:${id}`, 'schedule:'], // Invalidate schedule detail
  });
}

export function useDeleteSchedule() {
  return useMutation((id: string) => apiClient.deleteSchedule(id), {
    invalidateCacheKeys: ['schedules:list'],
    getInvalidatePrefixes: (id: string) => [`schedule:${id}`, 'schedule:'], // Invalidate schedule detail
  });
}
