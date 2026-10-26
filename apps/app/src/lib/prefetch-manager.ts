"use client";

import { apiClient } from './api-client';
import { getCachedValue, setCachedValue } from './client-cache';
import type { ApiResponse } from './api-config';
import { API_CONFIG } from './api-config';
import { classesListKey } from '@/hooks/use-api/classes';
import { studentsListKey } from '@/hooks/use-api/students';
import { assignmentsListKey } from '@/hooks/use-api/assignments';
import { attendanceListKey } from '@/hooks/use-api/attendance';
import { gradesListKey } from '@/hooks/use-api/grades';
import {
  DEFAULT_CACHE_TTL,
  DASHBOARD_CACHE_TTL,
  CLASS_CACHE_TTL,
  STUDENT_CACHE_TTL,
} from '@/config/cache';

/**
 * Prefetch Manager
 * Prefetch dữ liệu cho các pages có thể truy cập tiếp theo
 * Dựa trên navigation patterns và user behavior
 */
type PrefetchConfig = {
  endpoint: string;
  cacheKey: string;
  ttl?: number;
  priority?: 'high' | 'medium' | 'low';
};

class PrefetchManager {
  private prefetchQueue: Map<string, Promise<ApiResponse<any>>> = new Map();
  // Browsers allow ~6 parallel connections per origin; the dashboard prefetch
  // warms 6 endpoints so the cap matches the real concurrency ceiling.
  private readonly MAX_CONCURRENT_PREFETCHES = 6;

  /**
   * Prefetch một endpoint
   * @param config Prefetch configuration
   * @returns Promise với response (không await, chạy background)
   */
  prefetch(config: PrefetchConfig): void {
    const { endpoint, cacheKey, ttl = DEFAULT_CACHE_TTL } = config;

    // Kiểm tra cache trước
    const cached = getCachedValue(cacheKey);
    if (cached) {
      // Đã có cache, không cần prefetch
      return;
    }

    // Kiểm tra xem đã có prefetch đang chạy chưa
    if (this.prefetchQueue.has(cacheKey)) {
      // Đã có prefetch đang chạy, không cần prefetch lại
      return;
    }

    // Tạo prefetch promise
    const prefetchPromise: Promise<ApiResponse<any>> = apiClient
      .makeRequest(endpoint, { method: 'GET' })
      .then((response) => {
        if (response.success && response.data) {
          setCachedValue(cacheKey, response.data, ttl);
        }
        this.prefetchQueue.delete(cacheKey);
        return response;
      })
      .catch((error) => {
        this.prefetchQueue.delete(cacheKey);
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Prefetch failed',
        } as ApiResponse<any>;
      });

    // Lưu vào queue
    this.prefetchQueue.set(cacheKey, prefetchPromise);
  }

  /**
   * Prefetch multiple endpoints
   * @param configs Array of prefetch configs
   */
  prefetchMultiple(configs: PrefetchConfig[]): void {
    // Chỉ prefetch tối đa MAX_CONCURRENT_PREFETCHES requests đồng thời
    const highPriority = configs.filter((c) => c.priority === 'high');
    const mediumPriority = configs.filter((c) => c.priority === 'medium');
    const lowPriority = configs.filter((c) => c.priority === 'low' || !c.priority);

    // Prefetch theo thứ tự ưu tiên
    [...highPriority, ...mediumPriority, ...lowPriority]
      .slice(0, this.MAX_CONCURRENT_PREFETCHES)
      .forEach((config) => {
        this.prefetch(config);
      });
  }

  /**
   * Prefetch dữ liệu cho dashboard page
   * (keys khớp chính xác với những gì các hook dashboard đọc — xem buildBootstrapSteps)
   */
  prefetchDashboard(): void {
    this.prefetchMultiple([
      {
        endpoint: API_CONFIG.ENDPOINTS.DASHBOARD.INDEX,
        cacheKey: 'dashboard:overview',
        ttl: DASHBOARD_CACHE_TTL,
        priority: 'high',
      },
      {
        endpoint: API_CONFIG.ENDPOINTS.CLASSES.LIST,
        // Dùng chung builder với useClasses (empty filters trên first paint)
        cacheKey: classesListKey(),
        ttl: CLASS_CACHE_TTL,
        priority: 'medium',
      },
      {
        endpoint: API_CONFIG.ENDPOINTS.STUDENTS.LIST,
        cacheKey: studentsListKey(),
        ttl: STUDENT_CACHE_TTL,
        priority: 'medium',
      },
      {
        endpoint: API_CONFIG.ENDPOINTS.ATTENDANCE.LIST,
        cacheKey: attendanceListKey(),
        ttl: DEFAULT_CACHE_TTL,
        priority: 'low',
      },
      {
        endpoint: API_CONFIG.ENDPOINTS.GRADES.LIST,
        cacheKey: gradesListKey(),
        ttl: DEFAULT_CACHE_TTL,
        priority: 'low',
      },
    ]);
  }

  /**
   * Prefetch dữ liệu cho classes page
   */
  prefetchClasses(): void {
    this.prefetch({
      endpoint: API_CONFIG.ENDPOINTS.CLASSES.LIST,
      // Dùng chung builder với useClasses (empty filters trên first paint)
      cacheKey: classesListKey(),
      ttl: CLASS_CACHE_TTL,
      priority: 'high',
    });
  }

  /**
   * Prefetch dữ liệu cho students page
   */
  prefetchStudents(): void {
    this.prefetch({
      endpoint: API_CONFIG.ENDPOINTS.STUDENTS.LIST,
      // Dùng chung builder với useStudents (empty filters trên first paint)
      cacheKey: studentsListKey(),
      ttl: STUDENT_CACHE_TTL,
      priority: 'high',
    });
  }

  /**
   * Prefetch dữ liệu cho assignments (dashboard chart + /assignments page)
   */
  prefetchAssignments(): void {
    this.prefetch({
      endpoint: API_CONFIG.ENDPOINTS.ASSIGNMENTS.LIST,
      // Dùng chung builder với useAssignments (empty filters trên first paint)
      cacheKey: assignmentsListKey(),
      ttl: DEFAULT_CACHE_TTL,
      priority: 'high',
    });
  }

  /**
   * Prefetch dữ liệu cho một class detail
   * @param classId Class ID
   */
  prefetchClassDetail(classId: string | number): void {
    this.prefetch({
      endpoint: API_CONFIG.ENDPOINTS.CLASSES.SHOW(String(classId)),
      cacheKey: `class:${classId}`,
      ttl: CLASS_CACHE_TTL,
      priority: 'high',
    });
  }

  /**
   * Prefetch dữ liệu cho một student detail
   * @param studentId Student ID
   */
  prefetchStudentDetail(studentId: string | number): void {
    this.prefetch({
      endpoint: API_CONFIG.ENDPOINTS.STUDENTS.SHOW(String(studentId)),
      cacheKey: `student:${studentId}`,
      ttl: STUDENT_CACHE_TTL,
      priority: 'high',
    });
  }

  /**
   * Prefetch dữ liệu dựa trên current page
   * @param pathname Current pathname
   */
  prefetchForPage(pathname: string): void {
    // Prefetch dữ liệu liên quan dựa trên page hiện tại
    if (pathname === '/dashboard') {
      // Đã ở dashboard: prefetch các pages/widgets có thể truy cập tiếp theo
      // (chart keys dùng filter rỗng — khớp với những gì dashboard đọc).
      this.prefetchDashboard();
    } else if (pathname.startsWith('/classes')) {
      // Đang ở classes page, prefetch students và assignments
      this.prefetchStudents();
      this.prefetchAssignments();
    } else if (pathname.startsWith('/students')) {
      // Đang ở students page, prefetch classes
      this.prefetchClasses();
    }
  }

  /**
   * Clear prefetch queue
   */
  clear(): void {
    this.prefetchQueue.clear();
  }

  /**
   * Lấy số lượng prefetches đang chạy
   */
  getActivePrefetchCount(): number {
    return this.prefetchQueue.size;
  }
}

// Export singleton instance
export const prefetchManager = new PrefetchManager();

