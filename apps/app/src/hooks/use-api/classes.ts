'use client';

import { useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import { buildListKey } from '@/lib/cache-keys';
import {
  DEFAULT_CACHE_TTL,
  CLASS_CACHE_TTL,
  REPORT_CACHE_TTL,
} from '@/config/cache';
import { useApi, useMutation } from './core';

/**
 * Shared builder for the classes list cache key. BOTH the useClasses hook and
 * every warm-up path (login bootstrap, prefetch manager) must use this so their
 * keys can never drift apart (P1-C: a mismatch meant prefetched results were
 * never read).
 */
export function classesListKey(filters: Record<string, any> = {}): string {
  return buildListKey('classes:list', filters);
}

// Classes hooks
export function useClasses(filters?: { per_page?: number; page?: number; status?: string; search?: string; subject_id?: number | string }, enabled: boolean = true) {
  // Extract individual filter values for dependencies
  const perPage = filters?.per_page;
  const page = filters?.page;
  const status = filters?.status;
  const search = filters?.search;
  const subjectId = filters?.subject_id;

  // Create stable cache key
  const cacheKey = useMemo(
    () => {
      const filterObj: Record<string, any> = {};
      if (perPage !== undefined) filterObj.per_page = perPage;
      if (page !== undefined) filterObj.page = page;
      if (status !== undefined) filterObj.status = status;
      if (search !== undefined) filterObj.search = search;
      if (subjectId !== undefined) filterObj.subject_id = subjectId;
      return classesListKey(filterObj);
    },
    [perPage, page, status, search, subjectId]
  );

  // Create stable filters object
  const stableFilters = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    if (status !== undefined) filterObj.status = status;
    if (search !== undefined) filterObj.search = search;
    if (subjectId !== undefined) filterObj.subject_id = subjectId;
    return filterObj;
  }, [perPage, page, status, search, subjectId]);

  // Memoize apiCall to prevent it from being recreated on every render
  const memoizedApiCall = useCallback(() => apiClient.getClasses(stableFilters), [stableFilters]);

  return useApi(
    memoizedApiCall,
    [perPage, page, status, search, subjectId],
    true,
    enabled,
    {
      cacheKey,
      ttl: CLASS_CACHE_TTL,
      strategy: 'stale-while-revalidate', // Show cached data immediately, fetch fresh data in background
    }
  );
}

export function useClass(id: string) {
  return useApi(() => apiClient.getClass(id), [id], true, true, {
    cacheKey: `class:${id}`,
    ttl: REPORT_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  });
}

export function useClassDetails(id: string) {
  return useClass(id);
}

export function useClassStudents(id: string | number | undefined | null) {
  const idString = id ? String(id) : '';
  const enabled = !!idString && idString.trim() !== '';
  const result = useApi(
    () => apiClient.getClassStudents(idString),
    [idString],
    true,
    enabled
  );

  // API trả về structure: { students: [...], count, active_count, max_students, available_slots }
  // Extract students array để tương thích với code hiện tại
  const students = result.data?.students || [];
  const statistics = result.data ? {
    count: result.data.count,
    active_count: result.data.active_count,
    max_students: result.data.max_students,
    paused_count: result.data.paused_count,
    available_slots: result.data.available_slots,
  } : null;

  return {
    ...result,
    data: students,
    students: students,
    statistics: statistics,
    // Permissions từ API response
    permissions: result.permissions,
  };
}

export function usePauseStudent() {
  return useMutation(
    ({ classId, studentId, reason }: { classId: string | number; studentId: string | number; reason?: string }) =>
      apiClient.pauseStudent(String(classId), String(studentId), reason ? { reason } : undefined),
    {
      getInvalidatePrefixes: ({ classId, studentId }) => [
        `class:${classId}:`,
        `class:${classId}:students`,
        `student:${studentId}`,
        `student:${studentId}:`,
      ],
    }
  );
}

export function useResumeStudent() {
  return useMutation(
    ({ classId, studentId }: { classId: string | number; studentId: string | number }) =>
      apiClient.resumeStudent(String(classId), String(studentId)),
    {
      getInvalidatePrefixes: ({ classId, studentId }) => [
        `class:${classId}:`,
        `class:${classId}:students`,
        `student:${studentId}`,
        `student:${studentId}:`,
      ],
    }
  );
}

export function useClassAssignments(id: string | undefined | null) {
  const enabled = !!id && id.trim() !== '';
  const result = useApi(
    () => apiClient.getClassAssignments(id!),
    [id],
    true,
    enabled,
    {
      cacheKey: `class:${id}:assignments`,
      ttl: DEFAULT_CACHE_TTL,
      strategy: 'stale-while-revalidate',
    }
  );

  // API trả về structure: { assignments: [...], statistics: {...} }
  // Extract assignments array và statistics để dễ sử dụng
  const assignments = result.data?.assignments || result.data || [];
  const statistics = result.data?.statistics || null;

  return {
    ...result,
    data: assignments,
    assignments: assignments,
    statistics: statistics,
    // Permissions từ API response
    permissions: result.permissions,
  };
}

export function useClassSchedules(id: string) {
  const result = useApi(() => apiClient.getClassSchedules(id), [id], true, true, {
    cacheKey: `class:${id}:schedules`,
    ttl: DEFAULT_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  });

  // API trả về structure: { class: {...}, schedules: [...], statistics: {...} }
  // Extract schedules array và statistics để dễ sử dụng
  const schedules = result.data?.schedules || [];
  const classInfo = result.data?.class || null;
  const statistics = result.data?.statistics || null;

  return {
    ...result,
    data: schedules,
    schedules: schedules,
    classInfo: classInfo,
    statistics: statistics,
    // Permissions từ API response
    permissions: result.permissions,
  };
}

// Specific mutation hooks
export function useCreateClass() {
  return useMutation((classData: any) => apiClient.createClass(classData), {
    invalidateCacheKeys: ['classes:list', 'dashboard:overview'],
  });
}

export function useUpdateClass() {
  return useMutation((id: string, classData: any) => apiClient.updateClass(id, classData), {
    invalidateCacheKeys: ['classes:list', 'dashboard:overview'],
    getInvalidatePrefixes: (id: string) => [`class:${id}`, 'class:'], // Invalidate class detail và tất cả nested data
  });
}

export function useDeleteClass() {
  return useMutation((id: string) => apiClient.deleteClass(id), {
    invalidateCacheKeys: ['classes:list', 'dashboard:overview'],
    getInvalidatePrefixes: (id: string) => [`class:${id}`, 'class:'], // Invalidate class detail và tất cả nested data
  });
}
