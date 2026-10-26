'use client';

import { useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  DEFAULT_CACHE_TTL,
} from '@/config/cache';
import { useApi, useMutation } from './core';

// Users Management hooks
export function useUsers(filters?: { per_page?: number; page?: number; role?: string; status?: string; search?: string }) {
  // Extract individual filter values for dependencies
  const perPage = filters?.per_page;
  const page = filters?.page;
  const role = filters?.role;
  const status = filters?.status;
  const search = filters?.search;

  // Create stable cache key
  const cacheKey = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    if (role !== undefined) filterObj.role = role;
    if (status !== undefined) filterObj.status = status;
    if (search !== undefined) filterObj.search = search;
    const sortedKeys = Object.keys(filterObj).sort();
    const sortedFilters = sortedKeys.reduce((acc, key) => {
      acc[key] = filterObj[key];
      return acc;
    }, {} as Record<string, any>);
    return `users:list:${JSON.stringify(sortedFilters)}`;
  }, [perPage, page, role, status, search]);

  // Create stable filters object
  const stableFilters = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    if (role !== undefined) filterObj.role = role;
    if (status !== undefined) filterObj.status = status;
    if (search !== undefined) filterObj.search = search;
    return filterObj;
  }, [perPage, page, role, status, search]);

  // Memoize apiCall to prevent it from being recreated on every render
  const memoizedApiCall = useCallback(() => apiClient.getUsers(stableFilters), [stableFilters]);

  return useApi(
    memoizedApiCall,
    [perPage, page, role, status, search],
    true,
    true,
    {
      cacheKey,
      ttl: DEFAULT_CACHE_TTL,
      strategy: 'stale-while-revalidate', // Show cached data immediately, fetch fresh data in background
    }
  );
}

export function useUser(id: string) {
  return useApi(() => apiClient.getUser(id), [id]);
}

export function useCreateUser() {
  return useMutation((userData: any) => apiClient.createUser(userData));
}

export function useUpdateUser() {
  return useMutation((id: string, userData: any) => apiClient.updateUser(id, userData));
}

export function useDeleteUser() {
  return useMutation((id: string) => apiClient.deleteUser(id));
}

export function useResetUserPassword() {
  return useMutation((id: string, data: { password: string; password_confirmation: string }) =>
    apiClient.resetUserPassword(id, data)
  );
}

export function useActivateUser() {
  return useMutation((id: string) => apiClient.activateUser(id));
}

export function useDeactivateUser() {
  return useMutation((id: string) => apiClient.deactivateUser(id));
}
