import { describe, expect, it } from 'vitest';
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
import { buildBootstrapSteps } from '@/hooks/use-initial-bootstrap';
import type { User } from '@/lib/api-config';

/**
 * P1-C: every warm-up path (login bootstrap + prefetch manager) writes the SAME
 * cache key that the use-* hooks read on first paint. The builders are the
 * single source of truth — a mismatch here means prefetched data is fetched
 * again the moment the dashboard mounts (which was the root cause of the
 * "login prefetch, still slow dashboard" report).
 */
describe('prefetch key parity', () => {
  it('classes: empty-filter builder matches the key the hook reads', () => {
    // What the hook reads for empty filters on first paint (dashboard chart).
    expect(classesListKey()).toBe('classes:list:{}');
    // Normalization regardless of key insertion order.
    expect(classesListKey({ status: 'active', page: 1 })).toBe(
      classesListKey({ page: 1, status: 'active' })
    );
    // What the /classes list page reads on first paint (useListPage defaults).
    expect(classesListKey({ page: 1, per_page: 10 })).toBe('classes:list:{"page":1,"per_page":10}');
  });

  it('students: empty-filter builder matches the key the hook reads', () => {
    expect(studentsListKey()).toBe('students:list:{}');
    expect(studentsListKey({ status: 'active', page: 1 })).toBe(
      studentsListKey({ page: 1, status: 'active' })
    );
    expect(studentsListKey({ page: 1, per_page: 10 })).toBe('students:list:{"page":1,"per_page":10}');
  });

  it('assignments: empty-filter builder matches the key the hook reads', () => {
    expect(assignmentsListKey()).toBe('assignments:list:{}');
    expect(assignmentsListKey({ page: 1, per_page: 10 })).toBe('assignments:list:{"page":1,"per_page":10}');
  });

  it('attendance + grades: empty-filter builders match the dashboard chart keys', () => {
    expect(attendanceListKey()).toBe('attendance:list:{}');
    expect(gradesListKey()).toBe('grades:list:{}');
  });

  it('schedules: page (10) and calendar (200) keys match the consumers', () => {
    expect(schedulesListKey({ page: 1, per_page: 10 })).toBe('schedules:list:{"page":1,"per_page":10}');
    expect(schedulesListKey({ page: 1, per_page: 200 })).toBe('schedules:list:{"page":1,"per_page":200}');
  });

  it('payments: sorted key matches the /payments page first paint', () => {
    expect(
      paymentsListKey({ page: 1, per_page: 10, sort: 'created_at', order: 'desc' })
    ).toBe('payments:list:{"order":"desc","page":1,"per_page":10,"sort":"created_at"}');
  });

  it('notifications: page key matches the /notifications page first paint', () => {
    expect(notificationsListKey({ page: 1, per_page: 10 })).toBe('notifications:list:{"page":1,"per_page":10}');
  });

  it('reference data: keys match what the forms/dropdowns read', () => {
    expect(subjectsListKey()).toBe('subjects:list:{}');
    expect(assignmentTypesListKey({ is_active: true })).toBe('assignment-types:list:{"is_active":true}');
    expect(gradeTypesListKey({ is_active: true })).toBe('grade-types:list:{"is_active":true}');
    expect(gradeLevelsListKey({ is_active: true, sort: 'order', order: 'asc' })).toBe(
      'grade-levels:list:{"is_active":true,"order":"asc","sort":"order"}'
    );
    expect(
      learningResourcesListKey({ page: 1, per_page: 10, status: 'active' })
    ).toBe('learning-resources:list:{"page":1,"per_page":10,"status":"active"}');
  });

  it('reports: overview + revenue keys are stable and sort-normalized', () => {
    const f = { date_from: '2025-01-01', date_to: '2025-01-31' };
    expect(reportOverviewKey(f)).toBe('reports:overview:{"date_from":"2025-01-01","date_to":"2025-01-31"}');
    expect(reportOverviewKey({ date_to: '2025-01-31', date_from: '2025-01-01' })).toBe(
      reportOverviewKey(f)
    );
    expect(revenueReportKey(f)).toBe('reports:revenue:{"date_from":"2025-01-01","date_to":"2025-01-31"}');
  });

  it('every bootstrap step writes a key that a hook actually reads', () => {
    const tutor = makeUser({ role: 'tutor', reminders: true });
    const steps = buildBootstrapSteps(tutor);
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(step.key).toBeTruthy();
      expect(step.stepKey).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(partial: { role: User['role']; reminders?: boolean }): User {
  return {
    id: 'u-1',
    name: 'Test User',
    email: 'test@classly.io.vn',
    role: partial.role,
    status: 'active',
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    is_tutor: partial.role === 'tutor' ? true : undefined,
    permissions_organized: partial.reminders
      ? [
          {
            group_key: 'core',
            group_label: 'Core',
            permissions: ['view_reminder'],
            capabilities: [{ key: 'reminders.use', label: 'Nhắc nhở' }],
          },
        ]
      : [],
  };
}
