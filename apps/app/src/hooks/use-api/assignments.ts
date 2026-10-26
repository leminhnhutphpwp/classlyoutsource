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
 * Shared builder for the assignments list cache key. BOTH the useAssignments
 * hook and every warm-up path (login bootstrap, prefetch manager) must use this
 * so their keys can never drift apart.
 */
export function assignmentsListKey(filters: Record<string, any> = {}): string {
  return buildListKey('assignments:list', filters);
}

// Assignments hooks
export function useAssignments(filters?: { per_page?: number; page?: number; status?: string; class_id?: string | number; search?: string }) {
  // Extract individual filter values for dependencies
  const perPage = filters?.per_page;
  const page = filters?.page;
  const status = filters?.status;
  const classId = filters?.class_id;
  const search = filters?.search;

  // Create stable cache key
  const cacheKey = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    if (status !== undefined) filterObj.status = status;
    if (classId !== undefined) filterObj.class_id = classId;
    if (search !== undefined) filterObj.search = search;
    return assignmentsListKey(filterObj);
  }, [perPage, page, status, classId, search]);

  // Create stable filters object
  const stableFilters = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    if (status !== undefined) filterObj.status = status;
    if (classId !== undefined) filterObj.class_id = classId;
    if (search !== undefined) filterObj.search = search;
    return filterObj;
  }, [perPage, page, status, classId, search]);

  // Memoize apiCall to prevent it from being recreated on every render
  const memoizedApiCall = useCallback(() => apiClient.getAssignments(stableFilters), [stableFilters]);

  return useApi(
    memoizedApiCall,
    [perPage, page, status, classId, search],
    true,
    true,
    {
      cacheKey,
      ttl: REPORT_CACHE_TTL,
      strategy: 'stale-while-revalidate', // Show cached data immediately, fetch fresh data in background
    }
  );
}

export function useAssignment(id: string, enabled: boolean = true) {
  // Don't fetch if id is empty, "0", or "undefined"
  const shouldFetch = enabled && !!id && id !== "0" && id !== "undefined";
  return useApi(() => apiClient.getAssignment(id), [id], true, shouldFetch, shouldFetch ? {
    cacheKey: `assignment:${id}`,
    ttl: REPORT_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  } : undefined);
}

export function useAssignmentQuizSchema(id: string, enabled: boolean = true) {
  const shouldFetch = enabled && !!id && id !== "0";
  return useApi(() => apiClient.getAssignmentQuizSchema(id), [id, 'quiz-schema'], true, shouldFetch, shouldFetch ? {
    cacheKey: `assignment:${id}:quiz-schema`,
    ttl: DEFAULT_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  } : undefined);
}

export function useAssignmentQuizTake(id: string, enabled: boolean = true) {
  const shouldFetch = enabled && !!id && id !== "0";
  return useApi(() => apiClient.getAssignmentQuizForStudent(id), [id, 'quiz-take'], true, shouldFetch, shouldFetch ? {
    cacheKey: `assignment:${id}:quiz-take`,
    ttl: 30_000,
    strategy: 'network-only',
  } : undefined);
}

export function useAssignmentSubmissions(id: string) {
  const result = useApi(() => apiClient.getAssignmentSubmissions(id), [id], true, true, {
    cacheKey: `assignment:${id}:submissions`,
    ttl: DEFAULT_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  });

  // API trả về structure: { assignment: {...}, submissions: [...] }
  // Extract submissions array để dễ sử dụng
  const submissions = result.data?.submissions || (Array.isArray(result.data) ? result.data : []);

  return {
    ...result,
    data: submissions,
    submissions: submissions,
    permissions: result.permissions,
  };
}

export function useAssignmentsByClass(classId: string) {
  return useApi(() => apiClient.getAssignmentsByClass(classId), [classId]);
}

// Submissions hooks
export function useSubmissions(filters?: { per_page?: number; page?: number; assignment_id?: string; student_id?: string; status?: string; search?: string }) {
  // Extract individual filter values for dependencies
  const perPage = filters?.per_page;
  const page = filters?.page;
  const assignmentId = filters?.assignment_id;
  const studentId = filters?.student_id;
  const status = filters?.status;
  const search = filters?.search;

  // Create stable cache key
  const cacheKey = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    if (assignmentId !== undefined) filterObj.assignment_id = assignmentId;
    if (studentId !== undefined) filterObj.student_id = studentId;
    if (status !== undefined) filterObj.status = status;
    if (search !== undefined) filterObj.search = search;
    const sortedKeys = Object.keys(filterObj).sort();
    const sortedFilters = sortedKeys.reduce((acc, key) => {
      acc[key] = filterObj[key];
      return acc;
    }, {} as Record<string, any>);
    return `submissions:list:${JSON.stringify(sortedFilters)}`;
  }, [perPage, page, assignmentId, studentId, status, search]);

  // Create stable filters object
  const stableFilters = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    if (assignmentId !== undefined) filterObj.assignment_id = assignmentId;
    if (studentId !== undefined) filterObj.student_id = studentId;
    if (status !== undefined) filterObj.status = status;
    if (search !== undefined) filterObj.search = search;
    return filterObj;
  }, [perPage, page, assignmentId, studentId, status, search]);

  // Memoize apiCall to prevent it from being recreated on every render
  const memoizedApiCall = useCallback(() => apiClient.getSubmissions(stableFilters), [stableFilters]);

  return useApi(
    memoizedApiCall,
    [perPage, page, assignmentId, studentId, status, search],
    true,
    true,
    {
      cacheKey,
      ttl: REPORT_CACHE_TTL,
      strategy: 'stale-while-revalidate', // Show cached data immediately, fetch fresh data in background
    }
  );
}

export function useSubmission(id: string) {
  const shouldFetch = !!id && id !== 'undefined' && id !== '0';
  return useApi(() => apiClient.getSubmission(id), [id], true, shouldFetch, shouldFetch ? {
    cacheKey: `submission:${id}`,
    ttl: REPORT_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  } : undefined);
}

/** Quiz paper review for one submission (students see their own; staff see all with the answer key). */
export function useSubmissionReview(submissionId: string, enabled: boolean = true) {
  const shouldFetch = enabled && !!submissionId && submissionId !== 'undefined' && submissionId !== '0';
  return useApi(() => apiClient.getSubmissionReview(submissionId), [submissionId], true, shouldFetch, shouldFetch ? {
    cacheKey: `submission:${submissionId}:review`,
    ttl: 30_000,
    strategy: 'stale-while-revalidate',
  } : undefined);
}

export function useLatestSubmission(assignmentId: string, enabled: boolean = true) {
  const shouldFetch = enabled && !!assignmentId && assignmentId !== "0";
  return useApi(() => apiClient.getLatestSubmission(assignmentId), [assignmentId], true, shouldFetch, {
    cacheKey: `assignment:${assignmentId}:latest-submission`,
    ttl: 30_000, // 30 giây (thay đổi thường xuyên)
    strategy: 'stale-while-revalidate',
  });
}

export function useSubmissionHistory(assignmentId: string, studentId?: string, enabled: boolean = true) {
  const shouldFetch = enabled && !!assignmentId && assignmentId !== "0";
  return useApi(() => apiClient.getSubmissionHistory(assignmentId, studentId), [assignmentId, studentId], true, shouldFetch);
}

/** Tutor skill dashboard (per-student progress by section_type). Staff-only on the backend. */
export function useAssignmentSkillReport(assignmentId: string, enabled: boolean = true) {
  const shouldFetch = enabled && !!assignmentId && assignmentId !== "0";
  return useApi(() => apiClient.getAssignmentSkillReport(assignmentId), [assignmentId], true, shouldFetch, {
    cacheKey: `assignment:${assignmentId}:skill-report`,
    ttl: 60_000,
    strategy: 'stale-while-revalidate',
  });
}

export function useCreateAssignment() {
  return useMutation((assignmentData: any) => apiClient.createAssignment(assignmentData), {
    invalidateCacheKeys: ['assignments:list', 'dashboard:overview'],
  });
}

export function useUpdateAssignment() {
  return useMutation((id: string, assignmentData: any) => apiClient.updateAssignment(id, assignmentData), {
    invalidateCacheKeys: ['assignments:list', 'dashboard:overview'],
    getInvalidatePrefixes: (id: string) => [`assignment:${id}`, 'assignment:'], // Invalidate assignment detail và submissions
  });
}

export function useDeleteAssignment() {
  return useMutation((id: string) => apiClient.deleteAssignment(id), {
    invalidateCacheKeys: ['assignments:list', 'dashboard:overview'],
    getInvalidatePrefixes: (id: string) => [`assignment:${id}`, 'assignment:'], // Invalidate assignment detail và submissions
  });
}

export function useCreateSubmission() {
  return useMutation((submissionData: any) => apiClient.createSubmission(submissionData), {
    getInvalidatePrefixes: (submissionData: any) => {
      const assignmentId = submissionData?.assignment_id;
      return assignmentId ? [`assignment:${assignmentId}:`, 'assignment:'] : [];
    },
  });
}

export function useUpdateSubmission() {
  return useMutation((id: string, submissionData: any) => apiClient.updateSubmission(id, submissionData), {
    getInvalidatePrefixes: (id: string) => [`submission:${id}`, 'assignment:'], // Invalidate submission và assignment submissions
  });
}

export function useDeleteSubmission() {
  return useMutation((id: string) => apiClient.deleteSubmission(id));
}

export function useGradeSubmission() {
  return useMutation((id: string, gradeData: any) => apiClient.gradeSubmission(id, gradeData), {
    getInvalidatePrefixes: (id: string) => [
      `submission:${id}`,
      'assignment:', // Invalidate assignment submissions
      'grade:', // Invalidate grades
    ],
  });
}
