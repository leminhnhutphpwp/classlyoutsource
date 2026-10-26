'use client';

import { useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  DEFAULT_CACHE_TTL,
  STUDENT_CACHE_TTL,
  SETTINGS_CACHE_TTL,
  LOGIN_HISTORY_CACHE_TTL,
} from '@/config/cache';
import { useLockContext } from '@/contexts/lock-context';
import type { LoginHistoryEntry, LoginHistoryFilters, LoginHistoryResponse } from '@/types/login-history';
import { useApi, useMutation } from './core';

// Settings hooks - Profile
export function useProfileSettings(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  return useApi(() => apiClient.getProfileSettings(), [], true, enabled, {
    cacheKey: 'settings:profile',
    ttl: SETTINGS_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  });
}

export function useUpdateProfile() {
  return useMutation((profileData: { name?: string; phone?: string; address?: string; bio?: string; theme_key?: string; mode?: "light" | "dark" }) =>
    apiClient.updateProfile(profileData),
    {
      invalidateCacheKeys: ['settings:profile', 'user:profile'],
      getInvalidatePrefixes: () => ['user:', 'settings:'],
    }
  );
}

export function useUploadAvatar() {
  return useMutation((file: File) => apiClient.uploadAvatar(file), {
    invalidateCacheKeys: ['settings:profile', 'user:profile'],
    getInvalidatePrefixes: () => ['user:', 'settings:'],
  });
}

// Settings hooks - Security
export function useSecuritySettings() {
  return useApi(() => apiClient.getSecuritySettings(), [], true, true, {
    cacheKey: 'settings:security',
    ttl: SETTINGS_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  });
}

export function useChangePassword() {
  return useMutation((passwordData: { current_password: string; new_password: string; new_password_confirmation: string }) =>
    apiClient.changePassword(passwordData)
  );
}

export function useChangeEmail() {
  return useMutation((data: { new_email: string; password: string }) => apiClient.changeEmail(data), {
    invalidateCacheKeys: ['settings:security'],
    invalidateCachePrefixes: ['settings:', 'user:'], // Invalidate user cache as well
  });
}

export function useSendVerificationEmail() {
  return useMutation(() => apiClient.sendVerificationEmail(), {
    invalidateCacheKeys: ['settings:security'],
    invalidateCachePrefixes: ['settings:'],
  });
}

export function useVerifyEmail() {
  return useMutation((code: string) => apiClient.verifyEmail(code), {
    invalidateCacheKeys: ['settings:security'],
    invalidateCachePrefixes: ['settings:', 'user:'], // Invalidate user cache as well
  });
}

export function useLoginHistory(
  filters?: LoginHistoryFilters,
  options?: { enabled?: boolean }
) {
  // Extract individual filter values for dependencies
  const status = filters?.status;
  const fromDate = filters?.from_date;
  const toDate = filters?.to_date;
  const page = filters?.page;
  const perPage = filters?.per_page;

  const dependencies = [status, fromDate, toDate, page, perPage];

  // Create stable cache key
  const cacheKey = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (status !== undefined) filterObj.status = status;
    if (fromDate !== undefined) filterObj.from_date = fromDate;
    if (toDate !== undefined) filterObj.to_date = toDate;
    if (page !== undefined) filterObj.page = page;
    if (perPage !== undefined) filterObj.per_page = perPage;
    const sortedKeys = Object.keys(filterObj).sort();
    const sortedFilters = sortedKeys.reduce((acc, key) => {
      acc[key] = filterObj[key];
      return acc;
    }, {} as Record<string, any>);
    return `login-history:${JSON.stringify(sortedFilters)}`;
  }, [status, fromDate, toDate, page, perPage]);

  // Create stable filters object
  const stableFilters = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (status !== undefined) filterObj.status = status;
    if (fromDate !== undefined) filterObj.from_date = fromDate;
    if (toDate !== undefined) filterObj.to_date = toDate;
    if (page !== undefined) filterObj.page = page;
    if (perPage !== undefined) filterObj.per_page = perPage;
    return filterObj;
  }, [status, fromDate, toDate, page, perPage]);

  // Memoize apiCall to prevent it from being recreated on every render
  const memoizedApiCall = useCallback(() => apiClient.getLoginHistory(stableFilters), [stableFilters]);

  const result = useApi<LoginHistoryResponse>(
    memoizedApiCall,
    dependencies,
    true,
    options?.enabled ?? true,
    {
      cacheKey,
      ttl: LOGIN_HISTORY_CACHE_TTL,
      strategy: 'stale-while-revalidate',
    }
  );

  const entries = (result.data?.items ?? []) as LoginHistoryEntry[];
  const meta = result.data?.meta || result.meta || null;

  return {
    ...result,
    data: entries,
    entries,
    meta,
  };
}

export function useAllStudentsLoginHistory(
  filters?: LoginHistoryFilters,
  options?: { enabled?: boolean }
) {
  // Extract individual filter values for dependencies
  const status = filters?.status;
  const fromDate = filters?.from_date;
  const toDate = filters?.to_date;
  const page = filters?.page;
  const perPage = filters?.per_page;

  const dependencies = [status, fromDate, toDate, page, perPage];

  // Create stable cache key
  const cacheKey = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (status !== undefined) filterObj.status = status;
    if (fromDate !== undefined) filterObj.from_date = fromDate;
    if (toDate !== undefined) filterObj.to_date = toDate;
    if (page !== undefined) filterObj.page = page;
    if (perPage !== undefined) filterObj.per_page = perPage;
    const sortedKeys = Object.keys(filterObj).sort();
    const sortedFilters = sortedKeys.reduce((acc, key) => {
      acc[key] = filterObj[key];
      return acc;
    }, {} as Record<string, any>);
    return `all-students-login-history:${JSON.stringify(sortedFilters)}`;
  }, [status, fromDate, toDate, page, perPage]);

  // Create stable filters object
  const stableFilters = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (status !== undefined) filterObj.status = status;
    if (fromDate !== undefined) filterObj.from_date = fromDate;
    if (toDate !== undefined) filterObj.to_date = toDate;
    if (page !== undefined) filterObj.page = page;
    if (perPage !== undefined) filterObj.per_page = perPage;
    return filterObj;
  }, [status, fromDate, toDate, page, perPage]);

  // Memoize apiCall to prevent it from being recreated on every render
  const memoizedApiCall = useCallback(() => apiClient.getAllStudentsLoginHistory(stableFilters), [stableFilters]);

  const result = useApi<LoginHistoryResponse>(
    memoizedApiCall,
    dependencies,
    true,
    options?.enabled ?? true,
    {
      cacheKey,
      ttl: LOGIN_HISTORY_CACHE_TTL,
      strategy: 'stale-while-revalidate',
    }
  );

  const entries = (result.data?.items ?? []) as LoginHistoryEntry[];
  const meta = result.data?.meta || result.meta || null;

  return {
    ...result,
    data: entries,
    entries,
    meta,
  };
}

export function useStudentLoginHistory(
  studentId: string,
  filters?: LoginHistoryFilters,
  options?: { enabled?: boolean }
) {
  // Extract individual filter values for dependencies
  const status = filters?.status;
  const fromDate = filters?.from_date;
  const toDate = filters?.to_date;
  const page = filters?.page;
  const perPage = filters?.per_page;

  const dependencies = [studentId, status, fromDate, toDate, page, perPage];

  // Create stable cache key
  const cacheKey = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (status !== undefined) filterObj.status = status;
    if (fromDate !== undefined) filterObj.from_date = fromDate;
    if (toDate !== undefined) filterObj.to_date = toDate;
    if (page !== undefined) filterObj.page = page;
    if (perPage !== undefined) filterObj.per_page = perPage;
    const sortedKeys = Object.keys(filterObj).sort();
    const sortedFilters = sortedKeys.reduce((acc, key) => {
      acc[key] = filterObj[key];
      return acc;
    }, {} as Record<string, any>);
    return `student:${studentId}:login-history:${JSON.stringify(sortedFilters)}`;
  }, [studentId, status, fromDate, toDate, page, perPage]);

  // Create stable filters object
  const stableFilters = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (status !== undefined) filterObj.status = status;
    if (fromDate !== undefined) filterObj.from_date = fromDate;
    if (toDate !== undefined) filterObj.to_date = toDate;
    if (page !== undefined) filterObj.page = page;
    if (perPage !== undefined) filterObj.per_page = perPage;
    return filterObj;
  }, [status, fromDate, toDate, page, perPage]);

  // Memoize apiCall to prevent it from being recreated on every render
  const memoizedApiCall = useCallback(() => apiClient.getStudentLoginHistory(studentId, stableFilters), [studentId, stableFilters]);

  const result = useApi<LoginHistoryResponse>(
    memoizedApiCall,
    dependencies,
    true,
    (!!studentId && studentId.trim() !== '' && (options?.enabled ?? true)),
    {
      cacheKey,
      ttl: STUDENT_CACHE_TTL,
      strategy: 'stale-while-revalidate',
    }
  );

  const entries = (result.data?.items ?? []) as LoginHistoryEntry[];
  const meta = result.data?.meta || result.meta || null;
  const student = result.data?.student || null;

  return {
    ...result,
    data: entries,
    entries,
    meta,
    student,
  };
}

// Data Jobs hooks (Import/Export History)
export function useDataJobs(
  filters?: {
    module?: string;
    type?: 'import' | 'export';
    status?: 'processing' | 'success' | 'partial' | 'failed';
    date_from?: string;
    date_to?: string;
    per_page?: number;
    page?: number;
  },
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled ?? true;
  const { actionsLocked } = useLockContext();

  // Extract individual filter values for dependencies
  const dataModule = filters?.module;
  const type = filters?.type;
  const status = filters?.status;
  const dateFrom = filters?.date_from;
  const dateTo = filters?.date_to;
  const perPage = filters?.per_page;
  const page = filters?.page;

  const dependencies = useMemo(() => [
    dataModule,
    type,
    status,
    dateFrom,
    dateTo,
    perPage,
    page,
  ], [dataModule, type, status, dateFrom, dateTo, perPage, page]);

  const cacheKey = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (dataModule !== undefined) filterObj.module = dataModule;
    if (type !== undefined) filterObj.type = type;
    if (status !== undefined) filterObj.status = status;
    if (dateFrom !== undefined) filterObj.date_from = dateFrom;
    if (dateTo !== undefined) filterObj.date_to = dateTo;
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    const sortedKeys = Object.keys(filterObj).sort();
    const sortedFilters = sortedKeys.reduce((acc, key) => {
      acc[key] = filterObj[key];
      return acc;
    }, {} as Record<string, any>);
    return `data-jobs:${JSON.stringify(sortedFilters)}`;
  }, [dataModule, type, status, dateFrom, dateTo, perPage, page]);

  const stableFilters = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (dataModule !== undefined) filterObj.module = dataModule;
    if (type !== undefined) filterObj.type = type;
    if (status !== undefined) filterObj.status = status;
    if (dateFrom !== undefined) filterObj.date_from = dateFrom;
    if (dateTo !== undefined) filterObj.date_to = dateTo;
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    return filterObj;
  }, [dataModule, type, status, dateFrom, dateTo, perPage, page]);
  const memoizedApiCall = useCallback(() => apiClient.getDataJobs(stableFilters), [stableFilters]);

  const result = useApi(
    memoizedApiCall,
    dependencies,
    true,
    (!actionsLocked && enabled),
    {
      cacheKey,
      ttl: DEFAULT_CACHE_TTL,
      strategy: 'stale-while-revalidate',
    }
  );

  const jobs = (result.data?.items ?? []) as any[];
  const meta = result.data?.meta || null;

  return {
    ...result,
    data: jobs,
    jobs,
    meta,
  };
}

export function useDataJob(id: string | number | null, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const { actionsLocked } = useLockContext();

  return useApi(
    () => apiClient.getDataJob(id!),
    [id],
    true,
    (!!id && !actionsLocked && enabled),
    {
      cacheKey: `data-job:${id}`,
      ttl: DEFAULT_CACHE_TTL,
      strategy: 'stale-while-revalidate',
    }
  );
}

// Settings hooks - Notifications
export function useNotificationSettings(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  return useApi(() => apiClient.getNotificationSettings(), [], true, enabled, {
    cacheKey: 'settings:notifications',
    ttl: SETTINGS_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  });
}

// Settings hooks - Payment
export function useBankInfo(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  return useApi(() => apiClient.getBankInfo(), [], true, enabled, {
    cacheKey: 'settings:bank-info',
    ttl: SETTINGS_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  });
}

export function useUpdateBankInfo() {
  return useMutation((data: any) => apiClient.updateBankInfo(data), {
    invalidateCacheKeys: ['settings:bank-info'],
  });
}

// Settings hooks - Account Management
export function useDeactivateAccount() {
  return useMutation((data: { password: string; reason?: string }) => apiClient.deactivateAccount(data));
}

export function useDeleteAccount() {
  return useMutation((data: { password: string; confirmation_text: string; reason?: string }) => apiClient.deleteAccount(data));
}
