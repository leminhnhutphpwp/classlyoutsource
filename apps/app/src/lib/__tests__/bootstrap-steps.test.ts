import { describe, expect, it } from 'vitest';
import { buildBootstrapSteps } from '@/hooks/use-initial-bootstrap';
import type { User } from '@/lib/api-config';

/**
 * Role-correctness of the login bootstrap. Before the rewrite the step list was
 * filtered by matching step labels against a display config that had dead
 * entries and lacked super_admin, so tutors saw wrong step names, super_admin
 * silently lost students/reports/system steps, and parents waited through a
 * dozen teacher-data requests they never use.
 */
describe('bootstrap steps per role', () => {
  it('tutor: full staff workspace (charts, reference, pages)', () => {
    const steps = buildBootstrapSteps(makeUser({ role: 'tutor', reminders: true }));
    const keys = steps.map((s) => s.stepKey);
    expect(keys).toContain('classes:list:{}');
    expect(keys).toContain('students:list:{}');
    expect(keys).toContain('assignments:list:{}');
    expect(keys).toContain('attendance:list:{}');
    expect(keys).toContain('grades:list:{}');
    expect(keys).toContain('reports:revenue');
    expect(keys).toContain('reports:overview');
    expect(keys).toContain('assignment-types:list');
    expect(keys).toContain('grade-types:list');
    expect(keys).toContain('grade-levels:list');
    expect(keys).toContain('payments:list');
    expect(keys).toContain('classes:list:page');
    expect(keys).toContain('students:list:page');
    expect(keys).toContain('assignments:list:page');
    expect(keys).toContain('schedules:list:page');
    expect(keys).toContain('schedules:list:calendar');
    expect(keys).toContain('reminders:all:1:1:2:all');
    expect(keys).toContain('reminders:all:10:1:7:all');
    expect(keys).toContain('dashboard:overview');
    expect(keys).toContain('dashboard:recent-activity:10');
  });

  it('admin and super_admin get the same full workspace as tutor', () => {
    for (const role of ['admin', 'super_admin'] as const) {
      const keys = buildBootstrapSteps(makeUser({ role, reminders: true })).map((s) => s.stepKey);
      // Regression: super_admin used to lose these steps because the display
      // config roles arrays only listed tutor/manager/admin.
      expect(keys).toContain('students:list:{}');
      expect(keys).toContain('reports:overview');
      expect(keys).toContain('dashboard:overview');
      expect(keys).toContain('attendance:list:{}');
    }
  });

  it('manager: staff workspace (tutor steps included)', () => {
    // NOTE: User['role'] type has no 'manager' — the bootstrap's isStaff() also
    // accepts the raw string, matching how the backend org_role surfaces it.
    const user = makeUser({ role: 'manager' as User['role'], reminders: true });
    const keys = buildBootstrapSteps(user as unknown as User).map((s) => s.stepKey);
    expect(keys).toContain('assignment-types:list');
    expect(keys).toContain('students:list:{}');
    expect(keys).toContain('payments:list');
  });

  it('student: no teacher charts/reports, but own pages + dashboard basics', () => {
    const steps = buildBootstrapSteps(makeUser({ role: 'student', reminders: true }));
    const keys = steps.map((s) => s.stepKey);
    // Student dashboard = reminders widget + recent activity (+ header).
    expect(keys).toContain('dashboard:overview');
    expect(keys).toContain('dashboard:recent-activity:10');
    expect(keys).toContain('reminders:all:1:1:2:all');
    // Their own list pages.
    expect(keys).toContain('classes:list:page');
    expect(keys).toContain('assignments:list:page');
    expect(keys).toContain('schedules:list:page');
    expect(keys).toContain('schedules:list:calendar');
    expect(keys).toContain('subjects:list');
    // Explicitly NOT teacher data.
    expect(keys).not.toContain('classes:list:{}');
    expect(keys).not.toContain('students:list:{}');
    expect(keys).not.toContain('attendance:list:{}');
    expect(keys).not.toContain('grades:list:{}');
    expect(keys).not.toContain('reports:revenue');
    expect(keys).not.toContain('reports:overview');
    expect(keys).not.toContain('payments:list');
    expect(keys).not.toContain('assignment-types:list');
  });

  it('parent: only notifications/unread — everything else is teacher data it never reads', () => {
    const steps = buildBootstrapSteps(makeUser({ role: 'parent', reminders: true }));
    const keys = steps.map((s) => s.stepKey);
    expect(keys).toEqual(['notifications:unread', 'notifications']);
  });

  it('no reminders capability → reminder steps are skipped', () => {
    const steps = buildBootstrapSteps(makeUser({ role: 'tutor', reminders: false }));
    const keys = steps.map((s) => s.stepKey);
    expect(keys).not.toContain('reminders:all:1:1:2:all');
    expect(keys).not.toContain('reminders:all:10:1:7:all');
  });
});

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
