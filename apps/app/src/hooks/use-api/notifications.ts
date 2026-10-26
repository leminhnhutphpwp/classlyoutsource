'use client';

import { useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import { buildListKey } from '@/lib/cache-keys';
import {
  NOTIFICATION_CACHE_TTL,
} from '@/config/cache';
import { useApi, useMutation } from './core';

/**
 * Shared builder for the notifications list cache key. BOTH the useNotifications
 * hook and every warm-up path (login bootstrap, prefetch manager) must use this
 * so their keys can never drift apart.
 */
export function notificationsListKey(filters: Record<string, any> = {}): string {
  return buildListKey('notifications:list', filters);
}

// Notifications hooks
export function useNotifications(filters?: {
  per_page?: number;
  page?: number;
  type?: string;
  status?: string;
  target?: string;
  search?: string;
  read?: boolean;
  unread?: boolean;
}) {
  // Extract individual filter values for dependencies
  const perPage = filters?.per_page;
  const page = filters?.page;
  const type = filters?.type;
  const status = filters?.status;
  const target = filters?.target;
  const search = filters?.search;
  const read = filters?.read;
  const unread = filters?.unread;

  // Create stable cache key
  const cacheKey = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    if (type !== undefined) filterObj.type = type;
    if (status !== undefined) filterObj.status = status;
    if (target !== undefined) filterObj.target = target;
    if (search !== undefined) filterObj.search = search;
    if (read !== undefined) filterObj.read = read;
    if (unread !== undefined) filterObj.unread = unread;
    return notificationsListKey(filterObj);
  }, [perPage, page, type, status, target, search, read, unread]);

  // Create stable filters object
  const stableFilters = useMemo(() => {
    const filterObj: Record<string, any> = {};
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    if (type !== undefined) filterObj.type = type;
    if (status !== undefined) filterObj.status = status;
    if (target !== undefined) filterObj.target = target;
    if (search !== undefined) filterObj.search = search;
    if (read !== undefined) filterObj.read = read;
    if (unread !== undefined) filterObj.unread = unread;
    return filterObj;
  }, [perPage, page, type, status, target, search, read, unread]);

  // Memoize apiCall to prevent it from being recreated on every render
  const memoizedApiCall = useCallback(() => apiClient.getNotifications(stableFilters), [stableFilters]);

  return useApi(
    memoizedApiCall,
    [perPage, page, type, status, target, search, read, unread],
    true,
    true,
    {
      cacheKey,
      ttl: NOTIFICATION_CACHE_TTL,
      strategy: 'stale-while-revalidate', // Show cached data immediately, fetch fresh data in background
    }
  );
}

export function useNotification(id: string) {
  return useApi(
    () => apiClient.getNotification(id),
    [id],
    true,
    !!id && id.trim() !== '',
    {
      cacheKey: `notification:${id}`,
      ttl: NOTIFICATION_CACHE_TTL,
      strategy: 'stale-while-revalidate',
    }
  );
}

export function useUnreadNotifications() {
  return useApi(() => apiClient.getUnreadNotifications(), [], true, true, {
    cacheKey: 'notifications:unread',
    ttl: NOTIFICATION_CACHE_TTL,
    strategy: 'stale-while-revalidate',
  });
}

export function useMarkNotificationAsRead() {
  return useMutation((id: string) => apiClient.markNotificationAsRead(id), {
    invalidateCacheKeys: ['notifications:list', 'notifications:unread'],
    getInvalidateKeys: (id: string) => [`notification:${id}`],
    invalidateCachePrefixes: ['notification:'],
  });
}

// Notification Preferences hooks
export function useNotificationPreferences() {
  return useApi(() => apiClient.getNotificationPreferences());
}

export function useAvailableChannels() {
  return useApi(() => apiClient.getAvailableChannels());
}

export function useNotificationPreference(type: string) {
  return useApi(() => apiClient.getNotificationPreference(type), [type]);
}

export function useCreateNotification() {
  return useMutation((notificationData: any) => apiClient.createNotification(notificationData), {
    invalidateCacheKeys: ['notifications:list'],
  });
}

export function useUpdateNotification() {
  return useMutation((id: string, notificationData: any) => apiClient.updateNotification(id, notificationData), {
    invalidateCacheKeys: ['notifications:list'],
  });
}

export function useDeleteNotification() {
  return useMutation((id: string) => apiClient.deleteNotification(id), {
    invalidateCacheKeys: ['notifications:list'],
  });
}

export function useSendNotification() {
  return useMutation((id: string) => apiClient.sendNotification(id), {
    invalidateCacheKeys: ['notifications:list'],
  });
}

// Email batch notifications (new)
export function useNotificationRecipients(
  id: string,
  filters?: { status?: 'pending' | 'sent' | 'failed' | 'skipped'; per_page?: number; page?: number }
) {
  const status = filters?.status;
  const perPage = filters?.per_page;
  const page = filters?.page;

  const cacheKey = useMemo(() => {
    if (!id) return '';
    const filterObj: Record<string, any> = {};
    if (status !== undefined) filterObj.status = status;
    if (perPage !== undefined) filterObj.per_page = perPage;
    if (page !== undefined) filterObj.page = page;
    const sortedKeys = Object.keys(filterObj).sort();
    const sortedFilters = sortedKeys.reduce((acc, key) => {
      acc[key] = filterObj[key];
      return acc;
    }, {} as Record<string, any>);
    return `notification:${id}:recipients:${JSON.stringify(sortedFilters)}`;
  }, [id, status, perPage, page]);

  return useApi(
    () => apiClient.getNotificationRecipients(id, filters),
    [id, filters?.status, filters?.per_page, filters?.page],
    true,
    !!id,
    {
      cacheKey,
      ttl: NOTIFICATION_CACHE_TTL,
      strategy: 'stale-while-revalidate',
    }
  );
}

export function useSendNotificationEmailBatch() {
  return useMutation((id: string, data?: { recipient_ids?: string[]; recipient_student_ids?: string[] }) =>
    apiClient.sendNotificationEmailBatch(id, data)
    , {
      invalidateCacheKeys: ['notifications:list'],
    });
}

export function useResendFailedNotificationEmails() {
  return useMutation((id: string, data?: { batch_size?: number }) =>
    apiClient.resendFailedNotificationEmails(id, data)
    , {
      invalidateCacheKeys: ['notifications:list'],
    });
}

export function useBulkUpdateNotificationPreferences() {
  return useMutation((preferences: { preferences: Array<{ notification_type: string; channels: string[]; is_enabled: boolean }> }) => apiClient.updateNotificationPreferences(preferences), {
    invalidateCacheKeys: ['settings:notifications'],
  });
}

export function useUpdateNotificationPreference() {
  return useMutation((type: string, preferenceData: any) => apiClient.updateNotificationPreference(type, preferenceData));
}
