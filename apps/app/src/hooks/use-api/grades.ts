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
 * Shared builder for the grades list cache key. BOTH the useGrades hook and
 * every warm-up path (login bootstrap, prefetch manager) must use this so their
 * keys can never drift apart.
 */
export function gradesListKey(filters: Record<string, any> = {}): string {
  return buildListKey('grades:list', filters);
}

// Grades hooks
export function useGrades(filters?: { per_page?: number; page?: number; class_id?: string; student_id?: string; assignment_id?: string; search?: string }) {
  // Extract individual filter values for dependencies
  const perPage = filters?.per_page;
  const page = filters?.page;
  const classId = filters?.class_id;
  const studentId = filters?.student_id;
  const assignmentId = filters?.assignment_id;
  const search = filters?.search;

  // Create stable cache key
  const cacheKey = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    if (classId !== undefined) filterObj.class_id = classId;
    if (studentId !== undefined) filterObj.student_id = studentId;
    if (assignmentId !== undefined) filterObj.assignment_id = assignmentId;
    if (search !== undefined) filterObj.search = search;
    return gradesListKey(filterObj);
  }, [perPage, page, classId, studentId, assignmentId, search]);

  // Create stable filters object
  const stableFilters = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    if (classId !== undefined) filterObj.class_id = classId;
    if (studentId !== undefined) filterObj.student_id = studentId;
    if (assignmentId !== undefined) filterObj.assignment_id = assignmentId;
    if (search !== undefined) filterObj.search = search;
    return filterObj;
  }, [perPage, page, classId, studentId, assignmentId, search]);

  // Memoize apiCall to prevent it from being recreated on every render
  const memoizedApiCall = useCallback(() => apiClient.getGrades(stableFilters), [stableFilters]);

  return useApi(
    memoizedApiCall,
    [perPage, page, classId, studentId, assignmentId, search],
    true,
    true,
    {
      cacheKey,
      ttl: DEFAULT_CACHE_TTL,
      strategy: 'stale-while-revalidate', // Show cached data immediately, fetch fresh data in background
    }
  );
}

export function useGrade(id: string) {
  return useApi(() => apiClient.getGrade(id), [id], true, true, {
    cacheKey: `grade:${id}`,
    ttl: REPORT_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  });
}

export function useGradesByClass(classId: string) {
  const sanitizedId = classId?.trim();
  const shouldFetch = !!sanitizedId && sanitizedId !== '0';
  return useApi(() => apiClient.getGradesByClass(classId), [classId], true, shouldFetch, shouldFetch ? {
    cacheKey: `grades:class:${sanitizedId}`,
    ttl: DEFAULT_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  } : undefined);
}

export function useGradesByStudent(studentId: string) {
  const sanitizedId = studentId?.trim();
  const shouldFetch = !!sanitizedId && sanitizedId !== '0';
  return useApi(() => apiClient.getGradesByStudent(studentId), [studentId], true, shouldFetch, shouldFetch ? {
    cacheKey: `grades:student:${sanitizedId}`,
    ttl: DEFAULT_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  } : undefined);
}

// Whole-class gradebook grid (rows = students, columns = grade types).
export function useGradebook(classId: string) {
  const sanitizedId = classId?.trim();
  const shouldFetch = !!sanitizedId && sanitizedId !== '0';
  return useApi(() => apiClient.getGradebook(classId), [classId], true, shouldFetch, shouldFetch ? {
    cacheKey: `grades:gradebook:${sanitizedId}`,
    ttl: DEFAULT_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  } : undefined);
}

// Printable per-student report card.
export function useReportCard(classId: string, studentId: string) {
  const cId = classId?.trim();
  const sId = studentId?.trim();
  const shouldFetch = !!cId && cId !== '0' && !!sId && sId !== '0';
  return useApi(
    () => apiClient.getReportCard(classId, studentId),
    [classId, studentId],
    true,
    shouldFetch,
    shouldFetch ? {
      cacheKey: `grades:report-card:${cId}:${sId}`,
      ttl: REPORT_CACHE_TTL,
      strategy: 'stale-while-revalidate',
    } : undefined,
  );
}

// All-or-nothing bulk upsert of grade cells (used by the gradebook "Lưu tất cả").
export function useBulkStoreGrades() {
  return useMutation((data: any) => apiClient.bulkStoreGrades(data), {
    getInvalidatePrefixes: () => ['grade:', 'grades:', 'class:', 'student:'],
  });
}

export function useCreateGrade() {
  return useMutation((gradeData: any) => apiClient.createGrade(gradeData), {
    getInvalidatePrefixes: (gradeData: any) => {
      const classId = gradeData?.class_id;
      const studentId = gradeData?.student_id;
      const prefixes: string[] = ['grade:'];
      if (classId) prefixes.push(`class:${classId}:`, 'class:');
      if (studentId) prefixes.push(`student:${studentId}:`, 'student:');
      return prefixes;
    },
  });
}

export function useUpdateGrade() {
  return useMutation((id: string, gradeData: any) => apiClient.updateGrade(id, gradeData), {
    getInvalidatePrefixes: (id: string) => [`grade:${id}`, 'grade:', 'class:', 'student:'], // Invalidate grade và related data
  });
}

export function useDeleteGrade() {
  return useMutation((id: string) => apiClient.deleteGrade(id));
}
