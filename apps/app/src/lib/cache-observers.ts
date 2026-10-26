"use client";

import { invalidateClientCache, invalidateCacheByPrefix } from './client-cache';

/**
 * Cache Observer Pattern
 * Tự động invalidate cache khi có mutations (POST, PUT, PATCH, DELETE)
 * 
 * Cơ chế hoạt động:
 * 1. Đăng ký rules: endpoint pattern → cache keys/prefixes cần invalidate
 * 2. Khi có mutation (POST/PUT/PATCH/DELETE), Observer tự động match pattern
 * 3. Tự động invalidate cache keys/prefixes tương ứng
 * 
 * Lợi ích:
 * - Tăng cache TTL lên cao hơn (vì có auto-invalidation)
 * - Không cần invalidate thủ công trong code
 * - Tập trung logic cache invalidation ở một chỗ
 */

type HttpMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type CacheInvalidationRule = {
  keys?: string[];           // Specific cache keys to invalidate
  prefixes?: string[];        // Cache key prefixes to invalidate
  pattern?: RegExp;           // Endpoint pattern to match (optional, for documentation)
};

// Registry: Map endpoint patterns → cache keys/prefixes to invalidate
const CACHE_OBSERVER_REGISTRY: Map<RegExp, CacheInvalidationRule> = new Map();

/**
 * Register cache invalidation rules for endpoints
 * @param endpointPattern - Regex pattern hoặc string để match endpoint
 * @param rule - Cache invalidation rule
 */
export function registerCacheObserver(
  endpointPattern: RegExp | string,
  rule: CacheInvalidationRule
): void {
  const pattern = typeof endpointPattern === 'string' 
    ? new RegExp(endpointPattern) 
    : endpointPattern;
  CACHE_OBSERVER_REGISTRY.set(pattern, rule);
}

/**
 * Get cache invalidation rules for an endpoint
 */
function getInvalidationRules(endpoint: string): CacheInvalidationRule[] {
  const rules: CacheInvalidationRule[] = [];
  
  CACHE_OBSERVER_REGISTRY.forEach((rule, pattern) => {
    if (pattern.test(endpoint)) {
      rules.push(rule);
    }
  });
  
  return rules;
}

/**
 * Invalidate cache based on endpoint and method
 * Called automatically by ApiClient when mutations occur
 */
export function observeAndInvalidateCache(
  endpoint: string,
  method: HttpMethod
): void {
  // Only observe mutations
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return;
  }

  const rules = getInvalidationRules(endpoint);
  
  if (rules.length === 0) {
    return; // No rules matched
  }

  // Collect all keys and prefixes to invalidate
  const keysToInvalidate = new Set<string>();
  const prefixesToInvalidate = new Set<string>();
  
  rules.forEach(rule => {
    // Collect specific keys
    if (rule.keys && rule.keys.length > 0) {
      rule.keys.forEach(key => keysToInvalidate.add(key));
    }
    
    // Collect prefixes
    if (rule.prefixes && rule.prefixes.length > 0) {
      rule.prefixes.forEach(prefix => prefixesToInvalidate.add(prefix));
    }
  });

  // Invalidate specific keys
  if (keysToInvalidate.size > 0) {
    invalidateClientCache(Array.from(keysToInvalidate));
  }
  
  // Invalidate by prefixes
  prefixesToInvalidate.forEach(prefix => {
    invalidateCacheByPrefix(prefix);
  });
}

// ============================================================================
// CLASSES OBSERVERS
// ============================================================================

// Observer: Create/update/delete class
registerCacheObserver(
  /\/api\/classes$/,
  {
    prefixes: ['classes:list:', 'classes:']
  }
);

// Observer: Update/delete specific class
registerCacheObserver(
  /\/api\/classes\/\d+/,
  {
    prefixes: ['classes:', 'class:', 'classes:list:']
  }
);

// Observer: Enroll/unenroll student
registerCacheObserver(
  /\/api\/classes\/\d+\/students/,
  {
    prefixes: ['classes:', 'class:', 'students:', 'student:']
  }
);

// ============================================================================
// STUDENTS OBSERVERS
// ============================================================================

// Observer: Create/update/delete student
registerCacheObserver(
  /\/api\/students$/,
  {
    prefixes: ['students:list:', 'students:']
  }
);

// Observer: Update/delete specific student
registerCacheObserver(
  /\/api\/students\/\d+/,
  {
    prefixes: ['students:', 'student:']
  }
);

// ============================================================================
// SCHEDULES OBSERVERS
// ============================================================================

// Observer: Create/update/delete schedule
registerCacheObserver(
  /\/api\/schedules$/,
  {
    prefixes: ['schedules:', 'schedule:']
  }
);

// Observer: Update/delete specific schedule
registerCacheObserver(
  /\/api\/schedules\/\d+/,
  {
    prefixes: ['schedules:', 'schedule:']
  }
);

// Observer: Update/delete schedule session
registerCacheObserver(
  /\/api\/schedule-sessions\/\d+/,
  {
    prefixes: ['schedule:', 'schedules:']
  }
);

// ============================================================================
// ATTENDANCE OBSERVERS
// ============================================================================

// Observer: Create/update/delete attendance
registerCacheObserver(
  /\/api\/attendance/,
  {
    prefixes: ['attendance:', 'attendance:class:', 'attendance:student:']
  }
);

// ============================================================================
// ASSIGNMENTS OBSERVERS
// ============================================================================

// Observer: Create/update/delete assignment
registerCacheObserver(
  /\/api\/assignments$/,
  {
    prefixes: ['assignments:', 'assignment:']
  }
);

// Observer: Update/delete specific assignment
registerCacheObserver(
  /\/api\/assignments\/\d+/,
  {
    prefixes: ['assignments:', 'assignment:']
  }
);

// Observer: Create/update/delete assignment type
registerCacheObserver(
  /\/api\/assignment-types/,
  {
    prefixes: ['assignment-types:', 'assignment-type:']
  }
);

// Observer: Create/update submission
registerCacheObserver(
  /\/api\/submissions/,
  {
    prefixes: ['submissions:', 'submission:', 'assignment:']
  }
);

// ============================================================================
// GRADES OBSERVERS
// ============================================================================

// Observer: Create/update/delete grade
registerCacheObserver(
  /\/api\/grades/,
  {
    prefixes: ['grades:', 'grade:', 'grades:class:', 'grades:student:']
  }
);

// Observer: Create/update/delete grade type
registerCacheObserver(
  /\/api\/grade-types/,
  {
    prefixes: ['grade-types:', 'grade-type:']
  }
);

// ============================================================================
// PAYMENTS OBSERVERS
// ============================================================================

// Observer: Create/update/delete payment
registerCacheObserver(
  /\/api\/payments$/,
  {
    keys: ['payments:list'],
    prefixes: ['payment:', 'payments:']
  }
);

// Observer: Create/update/delete payment request
registerCacheObserver(
  /\/api\/classes\/\d+\/payment-requests/,
  {
    keys: ['payments:list'],
    prefixes: ['payment-request:', 'payment-requests:', 'classes:', 'class:']
  }
);

// Observer: Update/delete specific payment request
registerCacheObserver(
  /\/api\/payment-requests\/\d+/,
  {
    keys: ['payments:list'],
    prefixes: ['payment-request:', 'payment-requests:', 'payments:']
  }
);

// Observer: Payment actions (approve, reject, refund, etc.)
registerCacheObserver(
  /\/api\/payments\/\d+\/(approve|reject|refund|mark-failed)/,
  {
    keys: ['payments:list'],
    prefixes: ['payment:', 'payments:']
  }
);

// ============================================================================
// NOTIFICATIONS OBSERVERS
// ============================================================================

// Observer: Create/update/delete notification
registerCacheObserver(
  /\/api\/notifications/,
  {
    prefixes: ['notifications:', 'notification:']
  }
);

// Observer: Mark notification as read
registerCacheObserver(
  /\/api\/notifications\/\d+\/(read|mark-read)/,
  {
    prefixes: ['notifications:', 'notification:']
  }
);

// Observer: Notification preferences
registerCacheObserver(
  /\/api\/notification-preferences/,
  {
    prefixes: ['notification-preferences:', 'notification-preference:']
  }
);

// ============================================================================
// REFERENCE DATA OBSERVERS
// ============================================================================

// Observer: Subjects
registerCacheObserver(
  /\/api\/subjects/,
  {
    prefixes: ['subjects:', 'subject:']
  }
);

// Observer: Grade Levels
registerCacheObserver(
  /\/api\/grade-levels/,
  {
    prefixes: ['grade-levels:', 'grade-level:']
  }
);

// Observer: Learning Resources
registerCacheObserver(
  /\/api\/learning-resources/,
  {
    prefixes: ['learning-resources:', 'learning-resource:']
  }
);

// Observer: Lesson Notes
registerCacheObserver(
  /\/api\/lesson-notes/,
  {
    prefixes: ['lesson-notes:', 'lesson-note:']
  }
);

// ============================================================================
// REMINDERS OBSERVERS
// ============================================================================

// Observer: Create/update/delete reminder
registerCacheObserver(
  /\/api\/reminders/,
  {
    prefixes: ['reminders:', 'reminder:']
  }
);

// ============================================================================
// MEDIA OBSERVERS
// ============================================================================

// Observer: Upload/delete media
registerCacheObserver(
  /\/api\/media/,
  {
    prefixes: ['media:', 'media:upload']
  }
);

// ============================================================================
// REPORTS OBSERVERS
// ============================================================================

// Observer: Reports are read-only, but mutations from other modules will affect reports
// Reports cache sẽ được invalidate khi có mutations từ các modules khác
// (Classes, Students, Payments, Attendance, etc.)
// Các mutations này đã được đăng ký ở các observers trên

// ============================================================================
// IMPORT/EXPORT OBSERVERS
// ============================================================================

// Observer: Import operations (students, enrollments, attendance, grades, payments, etc.)
registerCacheObserver(
  /\/api\/import-export\/(students|enrollments|attendance|grades|payments|assignment-types|subjects|grade-levels|grade-types|settings|email-templates)\/import/,
  {
    prefixes: ['students:', 'student:', 'classes:', 'class:', 'attendance:', 'grades:', 'grade:', 'payments:', 'payment:', 'assignment-types:', 'subjects:', 'subject:', 'grade-levels:', 'grade-level:', 'grade-types:', 'grade-type:', 'settings:']
  }
);

// ============================================================================
// USERS OBSERVERS
// ============================================================================

// Observer: Create/update/delete user
registerCacheObserver(
  /\/api\/users/,
  {
    prefixes: ['users:', 'user:']
  }
);

// Observer: User actions (reset password, activate, deactivate)
registerCacheObserver(
  /\/api\/users\/\d+\/(reset-password|activate|deactivate)/,
  {
    prefixes: ['users:', 'user:']
  }
);

// Observer: Login history (students)
registerCacheObserver(
  /\/api\/login-activity\/students/,
  {
    prefixes: ['login-history:', 'login-activity:']
  }
);

// Observer: Student login history
registerCacheObserver(
  /\/api\/students\/\d+\/login-history/,
  {
    prefixes: ['login-history:', 'student:', 'students:']
  }
);

// ============================================================================
// AUTH & PROFILE OBSERVERS
// ============================================================================

// Observer: Update user profile
registerCacheObserver(
  /\/api\/auth\/(profile|change-password)/,
  {
    prefixes: ['user:', 'users:', 'auth:me']
  }
);

// Observer: Settings profile update
registerCacheObserver(
  /\/api\/settings\/profile/,
  {
    prefixes: ['user:', 'users:', 'settings:', 'auth:me']
  }
);

// Observer: Settings security (password, email)
registerCacheObserver(
  /\/api\/settings\/security/,
  {
    prefixes: ['settings:', 'user:', 'auth:me']
  }
);

// Observer: Settings payment (bank info)
registerCacheObserver(
  /\/api\/settings\/payment/,
  {
    prefixes: ['settings:', 'payment:']
  }
);

// Observer: Account deactivate/delete
registerCacheObserver(
  /\/api\/settings\/account\/(deactivate|delete)/,
  {
    keys: ['auth:me'],
    prefixes: ['user:', 'users:', 'settings:']
  }
);

// ============================================================================
// DASHBOARD OBSERVERS
// ============================================================================

// Observer: Any mutation might affect dashboard stats
// Dashboard cache sẽ được invalidate khi có mutations từ các modules khác
// (Classes, Students, Schedules, Payments, etc.)
// Các mutations này đã được đăng ký ở các observers trên

