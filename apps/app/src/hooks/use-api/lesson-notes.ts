'use client';

import { useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  DEFAULT_CACHE_TTL,
} from '@/config/cache';
import { useApi, useMutation } from './core';

// Lesson Notes hooks
export function useLessonNotes(filters?: { per_page?: number; page?: number; class_id?: string; search?: string; date_from?: string; date_to?: string }) {
  // Extract individual filter values for dependencies
  const perPage = filters?.per_page;
  const page = filters?.page;
  const classId = filters?.class_id;
  const search = filters?.search;
  const dateFrom = filters?.date_from;
  const dateTo = filters?.date_to;

  // Create stable cache key
  const cacheKey = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    if (classId !== undefined) filterObj.class_id = classId;
    if (search !== undefined) filterObj.search = search;
    if (dateFrom !== undefined) filterObj.date_from = dateFrom;
    if (dateTo !== undefined) filterObj.date_to = dateTo;
    const sortedKeys = Object.keys(filterObj).sort();
    const sortedFilters = sortedKeys.reduce((acc, key) => {
      acc[key] = filterObj[key];
      return acc;
    }, {} as Record<string, any>);
    return `lesson-notes:list:${JSON.stringify(sortedFilters)}`;
  }, [perPage, page, classId, search, dateFrom, dateTo]);

  // Create stable filters object
  const stableFilters = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    if (classId !== undefined) filterObj.class_id = classId;
    if (search !== undefined) filterObj.search = search;
    if (dateFrom !== undefined) filterObj.date_from = dateFrom;
    if (dateTo !== undefined) filterObj.date_to = dateTo;
    return filterObj;
  }, [perPage, page, classId, search, dateFrom, dateTo]);

  // Memoize apiCall to prevent it from being recreated on every render
  const memoizedApiCall = useCallback(() => apiClient.getLessonNotes(stableFilters), [stableFilters]);

  return useApi(
    memoizedApiCall,
    [perPage, page, classId, search, dateFrom, dateTo],
    true,
    true,
    {
      cacheKey,
      ttl: DEFAULT_CACHE_TTL,
      strategy: 'stale-while-revalidate', // Show cached data immediately, fetch fresh data in background
    }
  );
}

export function useLessonNote(id: string) {
  const shouldFetch = !!id && id !== 'undefined' && id !== '0';
  return useApi(() => apiClient.getLessonNote(id), [id], true, shouldFetch, shouldFetch ? {
    cacheKey: `lesson-note:${id}`,
    ttl: DEFAULT_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  } : undefined);
}

export function useLessonNotesByClass(classId: string) {
  return useApi<any>(() => apiClient.getLessonNotesByClass(classId), [classId]);
}

export function useCreateLessonNote() {
  return useMutation((lessonNoteData: any) => apiClient.createLessonNote(lessonNoteData));
}

export function useUpdateLessonNote() {
  return useMutation((id: string, lessonNoteData: any) => apiClient.updateLessonNote(id, lessonNoteData));
}

export function useDeleteLessonNote() {
  return useMutation((id: string) => apiClient.deleteLessonNote(id));
}
