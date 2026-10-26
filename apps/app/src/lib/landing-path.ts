import type { User } from './api-config';

/**
 * Role-aware landing path used after login / on the app root.
 *
 * - Parents manage their children, so they land on the family portal.
 * - Everyone else (tutor/student/admin) lands on the shared dashboard.
 */
export function getLandingPath(user?: Pick<User, 'role'> | null): string {
  if (user?.role === 'parent') return '/family';
  return '/dashboard';
}
