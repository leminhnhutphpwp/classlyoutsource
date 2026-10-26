'use client';

import { useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import { buildListKey } from '@/lib/cache-keys';
import {
  STUDENT_CACHE_TTL,
} from '@/config/cache';
import { useApi, useMutation } from './core';

/**
 * Shared builder for the students list cache key. BOTH the useStudents hook and
 * every warm-up path (login bootstrap, prefetch manager) must use this so their
 * keys can never drift apart (P1-C: a mismatch meant prefetched results were
 * never read).
 */
export function studentsListKey(filters: Record<string, any> = {}): string {
  return buildListKey('students:list', filters);
}

// Students hooks
export function useStudents(filters?: { per_page?: number; page?: number; status?: string; search?: string; class_id?: string }) {
  // Extract individual filter values for dependencies
  const perPage = filters?.per_page;
  const page = filters?.page;
  const status = filters?.status;
  const search = filters?.search;
  const classId = filters?.class_id;

  // Create stable cache key
  const cacheKey = useMemo(
    () => {
      const filterObj: Record<string, any> = {};
      if (perPage !== undefined) filterObj.per_page = perPage;
      if (page !== undefined) filterObj.page = page;
      if (status !== undefined) filterObj.status = status;
      if (search !== undefined) filterObj.search = search;
      if (classId !== undefined) filterObj.class_id = classId;
      return studentsListKey(filterObj);
    },
    [perPage, page, status, search, classId]
  );

  // Create stable filters object
  const stableFilters = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    if (status !== undefined) filterObj.status = status;
    if (search !== undefined) filterObj.search = search;
    if (classId !== undefined) filterObj.class_id = classId;
    return filterObj;
  }, [perPage, page, status, search, classId]);

  // Memoize apiCall to prevent it from being recreated on every render
  const memoizedApiCall = useCallback(() => apiClient.getStudents(stableFilters), [stableFilters]);

  const result = useApi(
    memoizedApiCall,
    [perPage, page, status, search, classId],
    true,
    true,
    {
      cacheKey,
      ttl: STUDENT_CACHE_TTL,
      strategy: 'stale-while-revalidate',
    }
  );

  // Transform data to ensure it's an array
  // Handles both { data: [...] } and { data: { students: [...] } } structures
  const students = Array.isArray(result.data)
    ? result.data
    : (result.data?.students || result.data?.data || []);

  // Extract meta if nested in data
  const meta = (result.data as any)?.meta || result.meta;

  return {
    ...result,
    data: students,
    students: students,
    meta,
  };
}

export function useStudent(id: string, enabled: boolean = true) {
  return useApi(() => apiClient.getStudent(id), [id], true, enabled, {
    cacheKey: `student:${id}`,
    ttl: STUDENT_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  });
}

export function useStudentDetails(id: string, enabled: boolean = true) {
  return useStudent(id, enabled);
}

type StudentListFilterOptions = {
  page?: number;
  per_page?: number;
  status?: string;
  class_id?: string | number;
  date_from?: string;
  date_to?: string;
};

export function useStudentClasses(id: string, options?: StudentListFilterOptions, hookOptions?: { enabled?: boolean; shouldRedirectOnAuth?: boolean }) {
  const shouldEnable = hookOptions?.enabled ?? (!!id && id.trim() !== '' && id !== '0');
  const shouldRedirectOnAuth = hookOptions?.shouldRedirectOnAuth ?? true; // Default true for backward compatibility
  const serializedOptions = useMemo(() => JSON.stringify(options || {}), [options]);
  const result = useApi(
    () => apiClient.getStudentClasses(id, options),
    [id, options?.page, options?.per_page, serializedOptions],
    shouldRedirectOnAuth,
    shouldEnable, // Use enabled option if provided, otherwise check if id is valid
    {
      cacheKey: `student:${id}:classes:${options?.page || 1}:${options?.per_page || 15}:${serializedOptions}`,
      ttl: STUDENT_CACHE_TTL,
      strategy: 'stale-while-revalidate',
    }
  );

  // API trả về structure: { classes: [...], student_id, student_name, statistics: {...}, meta: {...} }
  const classes = result.data?.classes || [];
  const permissions = result.permissions;
  const studentInfo = result.data ? {
    student_id: result.data.student_id,
    student_name: result.data.student_name,
  } : null;
  const statistics = result.data?.statistics || null;
  // Support both root-level meta and nested meta in data for backward compatibility
  const meta = (result as any)?.meta || result.data?.meta || null;

  return {
    ...result,
    data: classes,
    classes: classes,
    studentInfo: studentInfo,
    statistics: statistics,
    meta: meta,
    permissions: permissions,
  };
}

export function useStudentAssignments(id: string, options?: StudentListFilterOptions, hookOptions?: { enabled?: boolean }) {
  const shouldEnable = hookOptions?.enabled ?? (!!id && id.trim() !== '' && id !== '0');
  const serializedOptions = useMemo(() => JSON.stringify(options || {}), [options]);
  const result = useApi<any>(
    () => apiClient.getStudentAssignments(id, options),
    [id, options?.page, options?.per_page, serializedOptions],
    true,
    shouldEnable, // Use enabled option if provided, otherwise check if id is valid
    {
      cacheKey: `student:${id}:assignments:${options?.page || 1}:${options?.per_page || 15}:${serializedOptions}`,
      ttl: STUDENT_CACHE_TTL,
      strategy: 'stale-while-revalidate',
    }
  );

  // API trả về structure: { assignments: [...], student_id, student_name, statistics: {...}, meta: {...} }
  const assignments = result.data?.assignments || [];
  const studentInfo = result.data ? {
    student_id: result.data.student_id,
    student_name: result.data.student_name,
  } : null;
  const statistics = result.data?.statistics || null;
  // Support both root-level meta and nested meta
  const meta = (result as any)?.meta || result.data?.meta || null;

  return {
    ...result,
    data: assignments,
    assignments: assignments,
    studentInfo: studentInfo,
    statistics: statistics,
    meta: meta,
  };
}

export function useStudentAttendance(id: string, options?: StudentListFilterOptions, hookOptions?: { enabled?: boolean }) {
  const shouldEnable = hookOptions?.enabled ?? (!!id && id.trim() !== '' && id !== '0');
  const serializedOptions = useMemo(() => JSON.stringify(options || {}), [options]);
  const result = useApi(
    () => apiClient.getStudentAttendance(id, options),
    [id, options?.page, options?.per_page, serializedOptions],
    true,
    shouldEnable, // Use enabled option if provided, otherwise check if id is valid
    {
      cacheKey: `student:${id}:attendance:${options?.page || 1}:${options?.per_page || 15}:${serializedOptions}`,
      ttl: STUDENT_CACHE_TTL,
      strategy: 'stale-while-revalidate',
    }
  );

  // API trả về structure: { attendances: [...], student_id, student_name, statistics: {...}, meta: {...} }
  const attendance = result.data?.attendances || result.data?.attendance || result.data?.data || [];
  const studentInfo = result.data ? {
    student_id: result.data.student_id,
    student_name: result.data.student_name,
  } : null;
  const statistics = result.data?.statistics || null;
  // Support both root-level meta and nested meta
  const meta = (result as any)?.meta || result.data?.meta || null;

  return {
    ...result,
    data: attendance,
    attendance: attendance,
    studentInfo: studentInfo,
    statistics: statistics,
    meta: meta,
  };
}

export function useStudentGrades(id: string, options?: StudentListFilterOptions, hookOptions?: { enabled?: boolean }) {
  const shouldEnable = hookOptions?.enabled ?? (!!id && id.trim() !== '' && id !== '0');
  const serializedOptions = useMemo(() => JSON.stringify(options || {}), [options]);
  const result = useApi(
    () => apiClient.getStudentGrades(id, options),
    [id, options?.page, options?.per_page, serializedOptions],
    true,
    shouldEnable, // Use enabled option if provided, otherwise check if id is valid
    {
      cacheKey: `student:${id}:grades:${options?.page || 1}:${options?.per_page || 15}:${serializedOptions}`,
      ttl: STUDENT_CACHE_TTL,
      strategy: 'stale-while-revalidate',
    }
  );

  // API trả về structure: { grades: [...], student_id, student_name, statistics: {...}, meta: {...} }
  const grades = result.data?.grades || result.data?.data || [];
  const studentInfo = result.data ? {
    student_id: result.data.student_id,
    student_name: result.data.student_name,
  } : null;
  const statistics = result.data?.statistics || null;
  // Support both root-level meta and nested meta
  const meta = (result as any)?.meta || result.data?.meta || null;

  return {
    ...result,
    data: grades,
    grades: grades,
    studentInfo: studentInfo,
    statistics: statistics,
    meta: meta,
  };
}

export function useStudentRecentActivity(
  id: string,
  options?: { limit?: number; page?: number; per_page?: number },
  hookOptions?: { enabled?: boolean }
) {
  const shouldEnable = hookOptions?.enabled ?? (!!id && id.trim() !== '' && id !== '0');
  const cacheKey = `student:${id}:recent-activity:${options ? JSON.stringify(options) : 'default'}`;
  const result = useApi(
    () => apiClient.getStudentRecentActivity(id, options),
    [id, options?.limit, options?.page, options?.per_page],
    true,
    shouldEnable, // Use enabled option if provided, otherwise check if id is valid
    {
      cacheKey,
      ttl: STUDENT_CACHE_TTL,
      strategy: 'stale-while-revalidate',
    }
  );

  // API trả về structure: { activities: [...], grouped_by_date: {...}, student_id, student_name }
  // Pagination info trong meta
  const activities = result.data?.activities || [];
  const groupedByDate = result.data?.grouped_by_date || {};
  const studentInfo = result.data ? {
    student_id: result.data.student_id,
    student_name: result.data.student_name,
  } : null;
  const pagination = result.meta ? {
    current_page: result.meta.current_page || 1,
    per_page: result.meta.per_page || 20,
    total: result.meta.total || 0,
    last_page: result.meta.last_page || 1,
    from: result.meta.from || 0,
    to: result.meta.to || 0,
  } : null;

  return {
    ...result,
    data: activities,
    activities: activities,
    groupedByDate: groupedByDate,
    studentInfo: studentInfo,
    pagination: pagination,
  };
}

export function useStudentStatistics(
  id: string,
  filters?: { class_id?: string | number; date_from?: string; date_to?: string },
  hookOptions?: { enabled?: boolean }
) {
  const shouldEnable = hookOptions?.enabled ?? (!!id && id.trim() !== '' && id !== '0');
  const serializedFilters = useMemo(() => JSON.stringify(filters || {}), [filters]);
  return useApi(
    () => apiClient.getStudentStatistics(id, filters),
    [id, serializedFilters],
    true,
    shouldEnable, // Use enabled option if provided, otherwise check if id is valid
    {
      cacheKey: `student:${id}:statistics:${serializedFilters}`,
      ttl: STUDENT_CACHE_TTL,
      strategy: 'stale-while-revalidate',
    }
  );
}

export function useCreateStudent() {
  return useMutation((studentData: any) => apiClient.createStudent(studentData), {
    invalidateCacheKeys: ['students:list', 'dashboard:overview'],
  });
}

export function useResetStudentPassword() {
  return useMutation(
    ({ id, password, password_confirmation }: { id: string; password: string; password_confirmation: string }) =>
      apiClient.resetStudentPassword(id, { password, password_confirmation })
  );
}

export function useUpdateStudent() {
  return useMutation((id: string, studentData: any) => apiClient.updateStudent(id, studentData), {
    invalidateCacheKeys: ['students:list', 'dashboard:overview'],
    getInvalidatePrefixes: (id: string) => [`student:${id}`, 'student:'], // Invalidate student detail và tất cả nested data
  });
}

export function useDeleteStudent() {
  return useMutation((id: string) => apiClient.deleteStudent(id), {
    invalidateCacheKeys: ['students:list', 'dashboard:overview'],
    getInvalidatePrefixes: (id: string) => [`student:${id}`, 'student:'], // Invalidate student detail và tất cả nested data
  });
}

export function useLockStudent() {
  return useMutation(
    (id: string, lockData: { type: 'login' | 'actions' | 'all'; reason?: string; start_at?: string; end_at?: string }) =>
      apiClient.lockStudent(id, lockData),
    {
      invalidateCacheKeys: ['students:list', 'dashboard:overview'],
      getInvalidatePrefixes: (id: string) => [`student:${id}`, 'student:'], // Invalidate student detail và tất cả nested data
    }
  );
}

export function useUnlockStudent() {
  return useMutation((id: string) => apiClient.unlockStudent(id), {
    invalidateCacheKeys: ['students:list', 'dashboard:overview'],
    getInvalidatePrefixes: (id: string) => [`student:${id}`, 'student:'], // Invalidate student detail và tất cả nested data
  });
}
