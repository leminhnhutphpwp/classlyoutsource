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
 * Shared builder for the attendance list cache key. BOTH the useAttendance hook
 * and every warm-up path (login bootstrap, prefetch manager) must use this so
 * their keys can never drift apart.
 */
export function attendanceListKey(filters: Record<string, any> = {}): string {
  return buildListKey('attendance:list', filters);
}

// Attendance hooks
export function useAttendance(filters?: {
  per_page?: number;
  page?: number;
  class_id?: string | number;
  student_id?: string | number;
  date_from?: string;
  date_to?: string;
  status?: string;
  search?: string;
}) {
  // Extract individual filter values for dependencies
  const perPage = filters?.per_page;
  const page = filters?.page;
  const classId = filters?.class_id;
  const studentId = filters?.student_id;
  const dateFrom = filters?.date_from;
  const dateTo = filters?.date_to;
  const status = filters?.status;
  const search = filters?.search;

  // Create stable cache key - use filters object directly like useClasses
  const cacheKey = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    if (classId !== undefined) filterObj.class_id = classId;
    if (studentId !== undefined) filterObj.student_id = studentId;
    if (dateFrom !== undefined) filterObj.date_from = dateFrom;
    if (dateTo !== undefined) filterObj.date_to = dateTo;
    if (status !== undefined) filterObj.status = status;
    if (search !== undefined) filterObj.search = search;
    return attendanceListKey(filterObj);
  }, [perPage, page, classId, studentId, dateFrom, dateTo, status, search]);

  // Create stable filters object
  const stableFilters = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    if (classId !== undefined) filterObj.class_id = classId;
    if (studentId !== undefined) filterObj.student_id = studentId;
    if (dateFrom !== undefined) filterObj.date_from = dateFrom;
    if (dateTo !== undefined) filterObj.date_to = dateTo;
    if (status !== undefined) filterObj.status = status;
    if (search !== undefined) filterObj.search = search;
    return filterObj;
  }, [perPage, page, classId, studentId, dateFrom, dateTo, status, search]);

  // Memoize apiCall to prevent it from being recreated on every render
  const memoizedApiCall = useCallback(() => apiClient.getAttendance(stableFilters), [stableFilters]);

  return useApi(
    memoizedApiCall,
    [perPage, page, classId, studentId, dateFrom, dateTo, status, search],
    true,
    true,
    {
      cacheKey,
      ttl: DEFAULT_CACHE_TTL,
      strategy: 'stale-while-revalidate', // Show cached data immediately, fetch fresh data in background
    }
  );
}

export function useAttendanceByClass(classId: string) {
  const sanitizedId = classId?.trim();
  const shouldFetch = !!sanitizedId && sanitizedId !== '0';
  return useApi(() => apiClient.getAttendanceByClass(classId), [classId], true, shouldFetch, shouldFetch ? {
    cacheKey: `attendance:class:${sanitizedId}`,
    ttl: DEFAULT_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  } : undefined);
}

export function useAttendanceByStudent(studentId: string) {
  const sanitizedId = studentId?.trim();
  const shouldFetch = !!sanitizedId && sanitizedId !== '0';
  return useApi(() => apiClient.getAttendanceByStudent(studentId), [studentId], true, shouldFetch, shouldFetch ? {
    cacheKey: `attendance:student:${sanitizedId}`,
    ttl: DEFAULT_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  } : undefined);
}

export function useAttendanceRecord(id: string, enabled: boolean = true) {
  const sanitizedId = id?.trim();
  const shouldFetch = enabled && !!sanitizedId && sanitizedId !== '0';
  return useApi(() => apiClient.getAttendanceById(id), [id], true, shouldFetch, shouldFetch ? {
    cacheKey: `attendance:${sanitizedId}`,
    ttl: REPORT_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  } : undefined);
}

export function useAttendanceStatusOptions() {
  return useApi(() => apiClient.getAttendanceStatusOptions());
}

export function useCreateAttendance() {
  return useMutation((attendanceData: any) => apiClient.createAttendance(attendanceData), {
    getInvalidatePrefixes: (attendanceData: any) => {
      const classId = attendanceData?.class_id;
      const studentId = attendanceData?.attendances?.[0]?.student_id;
      const prefixes: string[] = [];
      if (classId) prefixes.push(`class:${classId}:`, 'class:');
      if (studentId) prefixes.push(`student:${studentId}:`, 'student:');
      return prefixes;
    },
  });
}

export function useUpdateAttendance() {
  return useMutation((id: string, attendanceData: any) => apiClient.updateAttendance(id, attendanceData), {
    getInvalidatePrefixes: (id: string) => [`attendance:${id}`, 'attendance:', 'class:', 'student:'], // Invalidate attendance và related data
  });
}

export function useDeleteAttendance() {
  return useMutation((id: string) => apiClient.deleteAttendance(id), {
    getInvalidatePrefixes: (id: string) => [`attendance:${id}`, 'attendance:', 'class:', 'student:'],
  });
}

export function useBulkUpdateAttendance() {
  return useMutation((attendanceData: any) => apiClient.bulkUpdateAttendance(attendanceData), {
    getInvalidatePrefixes: () => ['attendance:', 'class:', 'student:'], // Invalidate all attendance data
  });
}

// QR attendance hooks

/**
 * Poll dữ liệu điểm danh trực tiếp của một buổi học.
 * Dùng network-only (không cache) để `refetch()` luôn lấy dữ liệu mới nhất khi poll.
 */
export function useAttendanceLive(sessionId: string, enabled: boolean = true) {
  const sanitizedId = sessionId?.trim();
  const shouldFetch = enabled && !!sanitizedId && sanitizedId !== '0' && sanitizedId !== 'undefined';
  return useApi(
    () => apiClient.getAttendanceLive(sessionId),
    [sessionId, enabled],
    true,
    shouldFetch
  );
}

/** Bắt đầu phiên QR điểm danh cho một buổi học. */
export function useStartAttendanceQr() {
  return useMutation((sessionId: string) => apiClient.startAttendanceQr(sessionId));
}

/** Lấy token QR mới (xoay vòng) để làm mới mã QR. */
export function useAttendanceQrToken() {
  return useMutation((sessionId: string) => apiClient.getAttendanceQrToken(sessionId));
}

/** Học viên điểm danh bằng token (quét QR) hoặc code (nhập tay). */
export function useCheckInAttendance() {
  return useMutation((body: { token?: string; code?: string }) => apiClient.checkInAttendance(body), {
    getInvalidatePrefixes: () => ['attendance:', 'student:'],
  });
}
