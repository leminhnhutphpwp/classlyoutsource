'use client';

import { apiClient } from '@/lib/api-client';
import { buildListKey } from '@/lib/cache-keys';
import {
  REPORT_CACHE_TTL,
} from '@/config/cache';
import type {
  ReportOverviewFilters,
  RevenueReportFilters,
  ReportStatisticsFilters,
  PaymentsReportFilters,
  AttendanceReportFilters,
  StudentsReportFilters,
  ClassesReportFilters,
  AssignmentsReportFilters,
} from '@/types/reports';
import { useApi } from './core';

/**
 * Shared builders for report cache keys. BOTH the report hooks and every
 * warm-up path (login bootstrap) must use these so their keys can never drift
 * apart — before this, the report hooks had no cacheKey at all, so every mount
 * hit the network and the bootstrap's prefetched reports were never read.
 */
export function reportOverviewKey(filters?: ReportOverviewFilters): string {
  return buildListKey('reports:overview', (filters ?? {}) as Record<string, any>);
}

export function revenueReportKey(filters?: RevenueReportFilters): string {
  return buildListKey('reports:revenue', (filters ?? {}) as Record<string, any>);
}

export function reportStatisticsKey(filters?: ReportStatisticsFilters): string {
  return buildListKey('reports:statistics', (filters ?? {}) as Record<string, any>);
}

function reportCacheOptions(key: string) {
  return {
    cacheKey: key,
    ttl: REPORT_CACHE_TTL,
    strategy: 'stale-while-revalidate' as const,
  };
}

// Reports hooks
export function useReportOverview(filters?: ReportOverviewFilters) {
  return useApi(
    () => apiClient.getReportOverview(filters),
    [filters?.date_from, filters?.date_to],
    true,
    true,
    reportCacheOptions(reportOverviewKey(filters))
  );
}

export function useRevenueReport(filters?: RevenueReportFilters) {
  return useApi(
    () => apiClient.getRevenueReport(filters),
    [filters?.date_from, filters?.date_to, filters?.payment_method],
    true,
    true,
    reportCacheOptions(revenueReportKey(filters))
  );
}

export function useReportStatistics(filters?: ReportStatisticsFilters) {
  return useApi(
    () => apiClient.getReportStatistics(filters),
    [filters?.date_from, filters?.date_to],
    true,
    true,
    reportCacheOptions(reportStatisticsKey(filters))
  );
}

export function usePaymentsReport(filters?: PaymentsReportFilters) {
  return useApi(
    () => apiClient.getPaymentsReport(filters),
    [filters?.date_from, filters?.date_to, filters?.payment_method, filters?.status],
    true,
    true,
    reportCacheOptions(buildListKey('reports:payments', (filters ?? {}) as Record<string, any>))
  );
}

export function useAttendanceReport(filters?: AttendanceReportFilters) {
  return useApi(
    () => apiClient.getAttendanceReport(filters),
    [filters?.date_from, filters?.date_to, filters?.class_id],
    true,
    true,
    reportCacheOptions(buildListKey('reports:attendance', (filters ?? {}) as Record<string, any>))
  );
}

export function useStudentsReport(filters?: StudentsReportFilters) {
  return useApi(
    () => apiClient.getStudentsReport(filters),
    [filters?.date_from, filters?.date_to, filters?.status, filters?.class_id],
    true,
    true,
    reportCacheOptions(buildListKey('reports:students', (filters ?? {}) as Record<string, any>))
  );
}

export function useClassesReport(filters?: ClassesReportFilters) {
  return useApi(
    () => apiClient.getClassesReport(filters),
    [filters?.date_from, filters?.date_to, filters?.status],
    true,
    true,
    reportCacheOptions(buildListKey('reports:classes', (filters ?? {}) as Record<string, any>))
  );
}

export function useAssignmentsReport(filters?: AssignmentsReportFilters) {
  return useApi(
    () => apiClient.getAssignmentsReport(filters),
    [filters?.date_from, filters?.date_to, filters?.status, filters?.class_id],
    true,
    true,
    reportCacheOptions(buildListKey('reports:assignments', (filters ?? {}) as Record<string, any>))
  );
}
