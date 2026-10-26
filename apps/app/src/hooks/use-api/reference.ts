'use client';

import { useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import { buildListKey } from '@/lib/cache-keys';
import {
  DEFAULT_CACHE_TTL,
  REFERENCE_DATA_CACHE_TTL,
} from '@/config/cache';
import { useApi, useMutation } from './core';

/** Shared builder for the assignment-types list cache key. */
export function assignmentTypesListKey(filters: Record<string, any> = {}): string {
  return buildListKey('assignment-types:list', filters);
}

/** Shared builder for the grade-types list cache key. */
export function gradeTypesListKey(filters: Record<string, any> = {}): string {
  return buildListKey('grade-types:list', filters);
}

/** Shared builder for the grade-levels list cache key. */
export function gradeLevelsListKey(filters: Record<string, any> = {}): string {
  return buildListKey('grade-levels:list', filters);
}

/** Shared builder for the subjects list cache key. */
export function subjectsListKey(filters: Record<string, any> = {}): string {
  return buildListKey('subjects:list', filters);
}

/** Shared builder for the learning-resources list cache key. */
export function learningResourcesListKey(filters: Record<string, any> = {}): string {
  return buildListKey('learning-resources:list', filters);
}

export function useAssignmentTypes(
  filters?: {
    is_active?: boolean;
    search?: string;
    per_page?: number;
    page?: number;
  },
  options?: { enabled?: boolean }
) {
  const isActive = filters?.is_active;
  const search = filters?.search;
  const perPage = filters?.per_page;
  const page = filters?.page;
  const enabled = options?.enabled ?? true;

  const cacheKey = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (isActive !== undefined) filterObj.is_active = isActive;
    if (search !== undefined) filterObj.search = search;
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    return assignmentTypesListKey(filterObj);
  }, [isActive, search, perPage, page]);

  const stableFilters = useMemo(
    () => {
      const filterObj: Record<string, any> = {};
      if (isActive !== undefined) filterObj.is_active = isActive;
      if (search !== undefined) filterObj.search = search;
      if (perPage !== undefined) filterObj.per_page = perPage;
      if (page !== undefined) filterObj.page = page;
      return filterObj;
    },
    [isActive, search, perPage, page]
  );

  const memoizedApiCall = useCallback(
    () => apiClient.getAssignmentTypes(stableFilters),
    [stableFilters]
  );

  return useApi(
    memoizedApiCall,
    [isActive, search, perPage, page],
    true,
    enabled,
    {
      cacheKey,
      ttl: REFERENCE_DATA_CACHE_TTL,
      strategy: 'stale-while-revalidate', // Show cached data immediately, fetch fresh data in background
    }
  );
}

export function useAssignmentType(id: string) {
  const shouldFetch = !!id && id !== 'undefined' && id !== '0';
  return useApi(() => apiClient.getAssignmentType(id), [id], true, shouldFetch, shouldFetch ? {
    cacheKey: `assignment-type:${id}`,
    ttl: REFERENCE_DATA_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  } : undefined);
}

export function useCreateAssignmentType() {
  return useMutation((data: any) => apiClient.createAssignmentType(data));
}

export function useUpdateAssignmentType() {
  return useMutation((id: string, data: any) => apiClient.updateAssignmentType(id, data));
}

export function useDeleteAssignmentType() {
  return useMutation((id: string) => apiClient.deleteAssignmentType(id));
}

// Grade Types hooks
export function useGradeTypes(
  filters?: {
    is_active?: boolean;
    search?: string;
    per_page?: number;
    page?: number;
  },
  options?: { enabled?: boolean }
) {
  const isActive = filters?.is_active;
  const search = filters?.search;
  const perPage = filters?.per_page;
  const page = filters?.page;
  const _enabled = options?.enabled ?? true;

  const cacheKey = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (isActive !== undefined) filterObj.is_active = isActive;
    if (search !== undefined) filterObj.search = search;
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    return gradeTypesListKey(filterObj);
  }, [isActive, search, perPage, page]);

  const stableFilters = useMemo(
    () => {
      const filterObj: Record<string, any> = {};
      if (isActive !== undefined) filterObj.is_active = isActive;
      if (search !== undefined) filterObj.search = search;
      if (perPage !== undefined) filterObj.per_page = perPage;
      if (page !== undefined) filterObj.page = page;
      return filterObj;
    },
    [isActive, search, perPage, page]
  );

  const memoizedApiCall = useCallback(
    () => apiClient.getGradeTypes(stableFilters),
    [stableFilters]
  );

  return useApi(
    memoizedApiCall,
    [isActive, search, perPage, page],
    true,
    true,
    {
      cacheKey,
      ttl: REFERENCE_DATA_CACHE_TTL,
      strategy: 'stale-while-revalidate', // Show cached data immediately, fetch fresh data in background
    }
  );
}

export function useGradeType(id: string) {
  return useApi(() => apiClient.getGradeType(id), [id]);
}

export function useCreateGradeType() {
  return useMutation((data: any) => apiClient.createGradeType(data));
}

export function useUpdateGradeType() {
  return useMutation((id: string, data: any) => apiClient.updateGradeType(id, data));
}

export function useDeleteGradeType() {
  return useMutation((id: string) => apiClient.deleteGradeType(id));
}

// Subjects hooks
export function useSubjects(
  filters?: {
    is_active?: boolean;
    search?: string;
    sort?: string;
    order?: string;
    per_page?: number;
    page?: number;
  },
  options?: { enabled?: boolean }
) {
  const isActive = filters?.is_active;
  const search = filters?.search;
  const sort = filters?.sort;
  const order = filters?.order;
  const perPage = filters?.per_page;
  const page = filters?.page;
  const enabled = options?.enabled ?? true;

  const cacheKey = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (isActive !== undefined) filterObj.is_active = isActive;
    if (search !== undefined) filterObj.search = search;
    if (sort !== undefined) filterObj.sort = sort;
    if (order !== undefined) filterObj.order = order;
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    return subjectsListKey(filterObj);
  }, [isActive, search, sort, order, perPage, page]);

  const stableFilters = useMemo(
    () => {
      const filterObj: Record<string, any> = {};
      if (isActive !== undefined) filterObj.is_active = isActive;
      if (search !== undefined) filterObj.search = search;
      if (sort !== undefined) filterObj.sort = sort;
      if (order !== undefined) filterObj.order = order;
      if (perPage !== undefined) filterObj.per_page = perPage;
      if (page !== undefined) filterObj.page = page;
      return filterObj;
    },
    [isActive, search, sort, order, perPage, page]
  );

  const memoizedApiCall = useCallback(
    () => apiClient.getSubjects(stableFilters),
    [stableFilters]
  );

  return useApi(
    memoizedApiCall,
    [isActive, search, sort, order, perPage, page],
    true,
    enabled,
    {
      cacheKey,
      ttl: REFERENCE_DATA_CACHE_TTL,
      strategy: 'stale-while-revalidate', // Show cached data immediately, fetch fresh data in background
    }
  );
}

export function useSubject(id: string) {
  return useApi(() => apiClient.getSubject(id), [id]);
}

export function useCreateSubject() {
  return useMutation((data: any) => apiClient.createSubject(data));
}

export function useUpdateSubject() {
  return useMutation((id: string, data: any) => apiClient.updateSubject(id, data));
}

export function useDeleteSubject() {
  return useMutation((id: string) => apiClient.deleteSubject(id));
}

// Grade Levels hooks
export function useGradeLevels(
  filters?: {
    is_active?: boolean;
    search?: string;
    sort?: string;
    order?: string;
    per_page?: number;
    page?: number;
  },
  options?: { enabled?: boolean }
) {
  const isActive = filters?.is_active;
  const search = filters?.search;
  const sort = filters?.sort;
  const order = filters?.order;
  const perPage = filters?.per_page;
  const page = filters?.page;
  const _enabled = options?.enabled ?? true;

  const cacheKey = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (isActive !== undefined) filterObj.is_active = isActive;
    if (search !== undefined) filterObj.search = search;
    if (sort !== undefined) filterObj.sort = sort;
    if (order !== undefined) filterObj.order = order;
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    return gradeLevelsListKey(filterObj);
  }, [isActive, search, sort, order, perPage, page]);

  const stableFilters = useMemo(
    () => {
      const filterObj: Record<string, any> = {};
      if (isActive !== undefined) filterObj.is_active = isActive;
      if (search !== undefined) filterObj.search = search;
      if (sort !== undefined) filterObj.sort = sort;
      if (order !== undefined) filterObj.order = order;
      if (perPage !== undefined) filterObj.per_page = perPage;
      if (page !== undefined) filterObj.page = page;
      return filterObj;
    },
    [isActive, search, sort, order, perPage, page]
  );

  const memoizedApiCall = useCallback(
    () => apiClient.getGradeLevels(stableFilters),
    [stableFilters]
  );

  return useApi(
    memoizedApiCall,
    [isActive, search, sort, order, perPage, page],
    true,
    true,
    {
      cacheKey,
      ttl: REFERENCE_DATA_CACHE_TTL,
      strategy: 'stale-while-revalidate', // Show cached data immediately, fetch fresh data in background
    }
  );
}

export function useGradeLevel(id: string) {
  return useApi(() => apiClient.getGradeLevel(id), [id]);
}

export function useCreateGradeLevel() {
  return useMutation((data: any) => apiClient.createGradeLevel(data));
}

export function useUpdateGradeLevel() {
  return useMutation((id: string, data: any) => apiClient.updateGradeLevel(id, data));
}

export function useDeleteGradeLevel() {
  return useMutation((id: string) => apiClient.deleteGradeLevel(id));
}

// Learning Resources hooks
export function useLearningResources(options?: {
  type?: string;
  status?: string;
  subject_id?: string;
  grade_level_id?: string;
  is_public?: boolean;
  search?: string;
  tags?: string | string[];
  sort?: string;
  order?: string;
  per_page?: number;
  page?: number;
}) {
  // Extract individual option values for dependencies
  const type = options?.type;
  const status = options?.status;
  const subjectId = options?.subject_id;
  const gradeLevelId = options?.grade_level_id;
  const isPublic = options?.is_public;
  const search = options?.search;
  const tags = options?.tags;
  const sort = options?.sort;
  const order = options?.order;
  const perPage = options?.per_page;
  const page = options?.page;

  // Create stable cache key
  const cacheKey = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (type !== undefined) filterObj.type = type;
    if (status !== undefined) filterObj.status = status;
    if (subjectId !== undefined) filterObj.subject_id = subjectId;
    if (gradeLevelId !== undefined) filterObj.grade_level_id = gradeLevelId;
    if (isPublic !== undefined) filterObj.is_public = isPublic;
    if (search !== undefined) filterObj.search = search;
    if (tags !== undefined) filterObj.tags = tags;
    if (sort !== undefined) filterObj.sort = sort;
    if (order !== undefined) filterObj.order = order;
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    return learningResourcesListKey(filterObj);
  }, [type, status, subjectId, gradeLevelId, isPublic, search, tags, sort, order, perPage, page]);

  return useApi(
    () => apiClient.getLearningResources(options),
    [
      options?.type,
      options?.status,
      options?.subject_id,
      options?.grade_level_id,
      options?.is_public,
      options?.search,
      options?.tags,
      options?.sort,
      options?.order,
      options?.per_page,
      options?.page,
    ],
    true,
    true,
    {
      cacheKey,
      ttl: DEFAULT_CACHE_TTL,
      strategy: 'stale-while-revalidate', // Show cached data immediately, fetch fresh data in background
    }
  );
}

export function useLearningResource(id: string, enabled: boolean = true) {
  const shouldFetch = enabled && !!id && id !== 'undefined' && id !== 'null' && id !== '0';
  return useApi(() => apiClient.getLearningResource(id), [id], true, shouldFetch, shouldFetch ? {
    cacheKey: `learning-resource:${id}`,
    ttl: DEFAULT_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  } : undefined);
}

export function useCreateLearningResource() {
  return useMutation((data: FormData | {
    title: string;
    description?: string;
    type?: string;
    status?: string;
    subject_id?: string;
    grade_level_id?: string;
    topic?: string;
    tags?: string[];
    external_url?: string;
    is_public?: boolean;
    media_id?: string;
    file?: File;
  }) => apiClient.createLearningResource(data));
}

export function useUpdateLearningResource() {
  return useMutation(({ id, data }: {
    id: string; data: FormData | {
      title?: string;
      description?: string;
      type?: string;
      status?: string;
      subject_id?: string;
      grade_level_id?: string;
      topic?: string;
      tags?: string[];
      external_url?: string;
      is_public?: boolean;
      media_id?: string;
      file?: File;
    }
  }) => apiClient.updateLearningResource(id, data));
}

export function useDeleteLearningResource() {
  return useMutation((id: string) => apiClient.deleteLearningResource(id));
}

export function useUploadLearningResourceFile() {
  return useMutation((file: File) => apiClient.uploadLearningResourceFile(file));
}
