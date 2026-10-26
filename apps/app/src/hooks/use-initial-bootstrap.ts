'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { setCachedValue, getCachedValue } from '@/lib/client-cache';
import type { ApiResponse } from '@/lib/api-config';
import { useAuthContext } from '@/contexts/auth-context';
import { isTutor, hasCapability } from '@/lib/permissions-utils';
import {
  DEFAULT_CACHE_TTL,
  SCHEDULE_CACHE_TTL,
  DASHBOARD_CACHE_TTL,
  CLASS_CACHE_TTL,
  ASSIGNMENT_CACHE_TTL,
  REPORT_CACHE_TTL,
  REFERENCE_DATA_CACHE_TTL,
  NOTIFICATION_CACHE_TTL,
  STUDENT_CACHE_TTL,
} from '@/config/cache';
import { classesListKey } from '@/hooks/use-api/classes';
import { studentsListKey } from '@/hooks/use-api/students';
import { assignmentsListKey } from '@/hooks/use-api/assignments';
import { attendanceListKey } from '@/hooks/use-api/attendance';
import { gradesListKey } from '@/hooks/use-api/grades';
import { schedulesListKey } from '@/hooks/use-api/schedules';
import { paymentsListKey } from '@/hooks/use-api/payments';
import { notificationsListKey } from '@/hooks/use-api/notifications';
import {
  assignmentTypesListKey,
  gradeLevelsListKey,
  gradeTypesListKey,
  subjectsListKey,
  learningResourcesListKey,
} from '@/hooks/use-api/reference';
import { reportOverviewKey, revenueReportKey } from '@/hooks/use-api/reports';
import { BOOTSTRAP_STEP_META } from '@/config/bootstrap';
import type { User } from '@/lib/api-config';

export type BootstrapProgress = {
  progress: number; // 0-100
  total: number;
  current: number;
  /** Stable key of the step currently running ('' while initializing). */
  currentKey: string;
  /** Ordered list of every step that will run, for the UI timeline. */
  steps: { key: string; title: string; desc: string }[];
};

type BootstrapResult = {
  success: boolean;
  error?: string;
  skipped?: boolean;
  /** Titles of steps that failed but didn't abort the bootstrap. */
  failedSteps?: string[];
};

type BootstrapStep = {
  /** Stable step id — used for the UI timeline and BOOTSTRAP_STEP_META lookup. */
  stepKey: string;
  /** The actual client-cache key this step writes (built via the shared builders). */
  key: string;
  label: string;
  apiCall: () => Promise<ApiResponse<any>>;
  ttl?: number;
  /** Whether this step applies to the given user. Role rules live HERE (single source of truth). */
  applies: (user: User) => boolean;
};

// Concurrency limit to avoid overwhelming the server
const CONCURRENCY_LIMIT = 4;

/**
 * Role helpers. `isTutor()` accepts tutor/admin/super_admin (or the is_tutor
 * flag); the bootstrap explicitly adds manager so every staff role gets the
 * same workspace warm-up.
 */
function isStaff(user: User | null | undefined): boolean {
  if (!user) return false;
  if (isTutor(user)) return true;
  return ['manager', 'admin', 'super_admin', 'tutor'].includes(user.role);
}

function isStudentRole(user: User | null | undefined): boolean {
  return user?.role === 'student';
}

function isParentRole(user: User | null | undefined): boolean {
  return user?.role === 'parent';
}

/** Current calendar month as [firstDay, lastDay] ISO strings. */
function currentMonthRange(): { date_from: string; date_to: string } {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  return { date_from: firstDay, date_to: lastDay };
}

/** ISO date `days` days ago (mirrors RevenueChart's default 30-day window). */
function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Build the ordered bootstrap step list for a user.
 *
 * Order matters: dashboard/landing data comes first so the first chunk of
 * parallel requests covers what the destination page paints immediately.
 *
 * Exported (pure) so role behavior is unit-testable without rendering.
 */
export function buildBootstrapSteps(user: User): BootstrapStep[] {
  // Data every role consumes right after login (header + notifications pages).
  const baseSteps: BootstrapStep[] = [
    {
      stepKey: 'notifications:unread',
      key: 'notifications:unread',
      label: 'Thông báo chưa đọc',
      apiCall: () => apiClient.getUnreadNotifications(),
      ttl: NOTIFICATION_CACHE_TTL,
      applies: () => true,
    },
    {
      stepKey: 'notifications',
      key: notificationsListKey({ page: 1, per_page: 10 }),
      label: 'Thông báo',
      apiCall: () => apiClient.getNotifications({ page: 1, per_page: 10 }),
      ttl: NOTIFICATION_CACHE_TTL,
      applies: () => true,
    },
  ];

  // Dashboard landing data (tutor/student land here; parent is redirected to /family).
  const dashboardSteps: BootstrapStep[] = [
    {
      stepKey: 'dashboard:overview',
      key: 'dashboard:overview',
      label: 'Hệ thống',
      apiCall: () => apiClient.getDashboard(),
      ttl: DASHBOARD_CACHE_TTL,
      applies: (u) => !isParentRole(u),
    },
    {
      stepKey: 'dashboard:recent-activity:10',
      key: 'dashboard:recent-activity:10',
      label: 'Hoạt động',
      apiCall: () => apiClient.getRecentActivity(10),
      ttl: DEFAULT_CACHE_TTL,
      applies: (u) => !isParentRole(u),
    },
    {
      stepKey: 'reminders:all:1:1:2:all',
      key: 'reminders:all:1:1:2:all',
      label: 'Nhắc nhở (Dashboard)',
      apiCall: () => apiClient.getReminders({ type: 'all', limit: 1, page: 1, days_ahead: 2 }),
      ttl: 5 * 60 * 1000,
      applies: (u) => hasCapability(u, 'reminders.use') && !isParentRole(u),
    },
  ];

  // Dashboard analytics charts (staff only — student dashboard renders only
  // the reminders widget + recent activity).
  const chartSteps: BootstrapStep[] = [
    {
      stepKey: 'classes:list:{}',
      key: classesListKey(),
      label: 'Lớp học',
      apiCall: () => apiClient.getClasses({}),
      ttl: CLASS_CACHE_TTL,
      applies: (u) => isStaff(u),
    },
    {
      stepKey: 'students:list:{}',
      key: studentsListKey(),
      label: 'Danh sách học viên',
      apiCall: () => apiClient.getStudents({}),
      ttl: STUDENT_CACHE_TTL,
      applies: (u) => isStaff(u),
    },
    {
      stepKey: 'assignments:list:{}',
      key: assignmentsListKey(),
      label: 'Bài tập',
      apiCall: () => apiClient.getAssignments({}),
      ttl: ASSIGNMENT_CACHE_TTL,
      applies: (u) => isStaff(u),
    },
    {
      stepKey: 'attendance:list:{}',
      key: attendanceListKey(),
      label: 'Điểm danh',
      apiCall: () => apiClient.getAttendance({}),
      ttl: DEFAULT_CACHE_TTL,
      applies: (u) => isStaff(u),
    },
    {
      stepKey: 'grades:list:{}',
      key: gradesListKey(),
      label: 'Điểm số',
      apiCall: () => apiClient.getGrades({}),
      ttl: DEFAULT_CACHE_TTL,
      applies: (u) => isStaff(u),
    },
    {
      stepKey: 'reports:revenue',
      key: revenueReportKey({ date_from: isoDaysAgo(29), date_to: isoDaysAgo(0) }),
      label: 'Doanh thu',
      apiCall: () =>
        apiClient.getRevenueReport({ date_from: isoDaysAgo(29), date_to: isoDaysAgo(0) }),
      ttl: REPORT_CACHE_TTL,
      applies: (u) => isStaff(u),
    },
    {
      stepKey: 'reports:overview',
      key: reportOverviewKey(currentMonthRange()),
      label: 'Báo cáo',
      apiCall: () => apiClient.getReportOverview(currentMonthRange()),
      ttl: REPORT_CACHE_TTL,
      applies: (u) => isStaff(u),
    },
  ];

  // Reference data for forms and filter dropdowns (staff; subjects also for
  // students since their /classes page uses the same dropdown).
  const referenceSteps: BootstrapStep[] = [
    {
      stepKey: 'subjects:list',
      key: subjectsListKey(),
      label: 'Môn học',
      apiCall: () => apiClient.getSubjects({}),
      ttl: REFERENCE_DATA_CACHE_TTL,
      applies: (u) => isStaff(u) || isStudentRole(u),
    },
    {
      stepKey: 'assignment-types:list',
      key: assignmentTypesListKey({ is_active: true }),
      label: 'Loại bài tập',
      apiCall: () => apiClient.getAssignmentTypes({ is_active: true }),
      ttl: REFERENCE_DATA_CACHE_TTL,
      applies: (u) => isStaff(u),
    },
    {
      stepKey: 'grade-types:list',
      key: gradeTypesListKey({ is_active: true }),
      label: 'Loại điểm',
      apiCall: () => apiClient.getGradeTypes({ is_active: true }),
      ttl: REFERENCE_DATA_CACHE_TTL,
      applies: (u) => isStaff(u),
    },
    {
      stepKey: 'grade-levels:list',
      key: gradeLevelsListKey({ is_active: true, sort: 'order', order: 'asc' }),
      label: 'Khối lớp',
      apiCall: () => apiClient.getGradeLevels({ is_active: true, sort: 'order', order: 'asc' }),
      ttl: REFERENCE_DATA_CACHE_TTL,
      applies: (u) => isStaff(u),
    },
    {
      stepKey: 'learning-resources:list',
      key: learningResourcesListKey({ page: 1, per_page: 10, status: 'active' }),
      label: 'Tài liệu bài học',
      apiCall: () => apiClient.getLearningResources({ page: 1, per_page: 10, status: 'active' }),
      ttl: DEFAULT_CACHE_TTL,
      applies: (u) => isStaff(u) || isStudentRole(u),
    },
  ];

  // List pages the user is likely to open next (non-staff still get their own
  // classes/assignments/schedules pages; parents have their own family surface).
  const pageSteps: BootstrapStep[] = [
    {
      stepKey: 'reminders:all:10:1:7:all',
      key: 'reminders:all:10:1:7:all',
      label: 'Nhắc nhở (Danh sách)',
      apiCall: () => apiClient.getReminders({ type: 'all', limit: 10, page: 1, days_ahead: 7 }),
      ttl: 5 * 60 * 1000,
      applies: (u) => hasCapability(u, 'reminders.use') && !isParentRole(u),
    },
    {
      stepKey: 'classes:list:page',
      key: classesListKey({ page: 1, per_page: 10 }),
      label: 'Danh sách lớp',
      apiCall: () => apiClient.getClasses({ page: 1, per_page: 10 }),
      ttl: CLASS_CACHE_TTL,
      applies: (u) => isStaff(u) || isStudentRole(u),
    },
    {
      stepKey: 'students:list:page',
      key: studentsListKey({ page: 1, per_page: 10 }),
      label: 'Danh sách học viên',
      apiCall: () => apiClient.getStudents({ page: 1, per_page: 10 }),
      ttl: STUDENT_CACHE_TTL,
      applies: (u) => isStaff(u),
    },
    {
      stepKey: 'assignments:list:page',
      key: assignmentsListKey({ page: 1, per_page: 10 }),
      label: 'Danh sách bài tập',
      apiCall: () => apiClient.getAssignments({ page: 1, per_page: 10 }),
      ttl: ASSIGNMENT_CACHE_TTL,
      applies: (u) => isStaff(u) || isStudentRole(u),
    },
    {
      stepKey: 'schedules:list:page',
      key: schedulesListKey({ page: 1, per_page: 10 }),
      label: 'Lịch dạy',
      apiCall: () => apiClient.getSchedules({ page: 1, per_page: 10 }),
      ttl: SCHEDULE_CACHE_TTL,
      applies: (u) => isStaff(u) || isStudentRole(u),
    },
    {
      stepKey: 'schedules:list:calendar',
      key: schedulesListKey({ page: 1, per_page: 200 }),
      label: 'Lịch học',
      apiCall: () => apiClient.getSchedules({ page: 1, per_page: 200 }),
      ttl: SCHEDULE_CACHE_TTL,
      applies: (u) => isStaff(u) || isStudentRole(u),
    },
    {
      stepKey: 'payments:list',
      key: paymentsListKey({ page: 1, per_page: 10, sort: 'created_at', order: 'desc' }),
      label: 'Thanh toán',
      apiCall: () =>
        apiClient.getPayments({ page: 1, per_page: 10, sort: 'created_at', order: 'desc' }),
      ttl: DEFAULT_CACHE_TTL,
      applies: (u) => isStaff(u),
    },
  ];

  const allSteps = [
    ...baseSteps,
    ...dashboardSteps,
    ...chartSteps,
    ...referenceSteps,
    ...pageSteps,
  ];

  return allSteps.filter((step) => step.applies(user));
}

export function useInitialBootstrap() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<BootstrapProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthContext();

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const bootstrap = useCallback(async (): Promise<BootstrapResult> => {
    setError(null);

    // 1. Wait for AuthContext to populate user data if needed
    if (!userRef.current && typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
      await new Promise<void>((resolve) => {
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          if (userRef.current || attempts >= 20) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });
    }

    const currentUser = userRef.current;
    if (!currentUser) {
      return { success: false, error: 'Không thể xác thực người dùng' };
    }

    // 2. Build the role-aware step list
    const steps = buildBootstrapSteps(currentUser);

    // 3. Filter steps that need loading
    const stepsToLoad = steps.filter((step) => getCachedValue(step.key) === null);

    if (stepsToLoad.length === 0) {
      return { success: true, skipped: true };
    }

    setLoading(true);
    let completedCount = 0;
    const totalToLoad = stepsToLoad.length;
    const failedTitles: string[] = [];

    const timeline = stepsToLoad.map((step) => {
      const meta = BOOTSTRAP_STEP_META[step.stepKey];
      return {
        key: step.stepKey,
        title: meta?.title || step.label,
        desc: meta?.desc || '',
      };
    });

    const updateProgress = (step: BootstrapStep) => {
      completedCount++;
      const percent = Math.round((completedCount / totalToLoad) * 100);
      setProgress({
        progress: percent,
        total: totalToLoad,
        current: completedCount,
        currentKey: step.stepKey,
        steps: timeline,
      });
    };

    setProgress({
      progress: 0,
      total: totalToLoad,
      current: 0,
      currentKey: '',
      steps: timeline,
    });

    try {
      // 4. Parallel execution with concurrency limit
      const executeStep = async (step: BootstrapStep) => {
        try {
          const response = await step.apiCall();
          if (response.success && response.data) {
            setCachedValue(step.key, response.data, step.ttl || DEFAULT_CACHE_TTL);
          } else {
            // API answered but failed (e.g. 403/404 for this role) — count as
            // a soft failure so the UI can tell the user something was skipped.
            failedTitles.push(step.label);
            console.warn(`Bootstrap step failed: ${step.label}`, response.message);
          }
        } catch (e) {
          failedTitles.push(step.label);
          console.error(`Bootstrap step failed: ${step.label}`, e);
        } finally {
          updateProgress(step);
        }
      };

      // Run in chunks (barrier between chunks keeps the server from being
      // flooded; dashboard-first ordering means the first chunk is the landing
      // page's data).
      for (let i = 0; i < stepsToLoad.length; i += CONCURRENCY_LIMIT) {
        const chunk = stepsToLoad.slice(i, i + CONCURRENCY_LIMIT);
        await Promise.all(chunk.map(executeStep));
      }

      setProgress({
        progress: 100,
        total: totalToLoad,
        current: totalToLoad,
        currentKey: '',
        steps: timeline,
      });

      return { success: true, failedSteps: failedTitles.length > 0 ? failedTitles : undefined };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi hệ thống';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, []);

  return { bootstrap, loading, progress, error };
}
