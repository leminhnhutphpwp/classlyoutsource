/**
 * Permission Guards - Helper functions for route protection and permission checks
 * 
 * Provides reusable patterns for checking permissions before allowing access to create/edit pages
 */

import { useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User } from "./api-config";
import { isStudent } from "./permissions-utils";
import { hasPermission as checkUserPermission } from "./permissions-utils";
import { mapToPermission } from "./permission-mapping";

/**
 * Hook to protect a route based on a specific permission
 * Redirects to 403 if student, or to a fallback route if permission is missing
 * 
 * @param user - Current user from useAuthContext
 * @param permission - Required permission (e.g., 'create_payment::request')
 * @param fallbackRoute - Route to redirect to if permission is missing (default: '/403')
 * @param options - Additional options
 * @returns Object with `hasAccess` boolean and `isChecking` boolean
 * 
 * @example
 * const { hasAccess } = usePermissionGuard(user, 'create_payment::request', `/classes/${classId}`);
 * if (!hasAccess) return null;
 */
export function usePermissionGuard(
  user: User | null | undefined,
  // Accepts null/undefined so callers (e.g. useResourceGuard) can pass the result
  // of a mapping that may fail WITHOUT calling this hook conditionally. A null
  // permission means "deny, but don't redirect" — the caller renders its own denial.
  permission: string | null | undefined,
  fallbackRoute: string = '/403',
  options?: {
    allowStudents?: boolean;
    checkAfterLoad?: boolean;
    loaded?: boolean;
  }
) {
  const router = useRouter();
  const { allowStudents = false, checkAfterLoad = false, loaded = true } = options || {};
  
  // Memoize permission checks to avoid unnecessary recalculations
  const userHasPermission = useMemo(() => {
    return user && permission ? checkUserPermission(user, permission) : false;
  }, [user, permission]);
  
  const isStudentUser = useMemo(() => {
    return user ? isStudent(user) : false;
  }, [user]);
  
  // Calculate shouldBlock based on options
  const shouldBlock = useMemo(() => {
    if (!permission) return true; // invalid/unmapped permission → deny
    return checkAfterLoad 
      ? (loaded && !userHasPermission) || (!allowStudents && isStudentUser)
      : !userHasPermission || (!allowStudents && isStudentUser);
  }, [permission, checkAfterLoad, loaded, userHasPermission, allowStudents, isStudentUser]);

  // Memoize redirect callback to avoid recreating on every render
  const handleRedirect = useCallback((route: string) => {
    router.replace(route);
  }, [router]);

  // Always call useEffect (no conditional hooks)
  useEffect(() => {
    if (!user) return; // Wait for user to load
    if (!permission) return; // Unmapped permission → deny without redirect
    
    if (!allowStudents && isStudentUser) {
      handleRedirect('/403');
      return;
    }
    
    if (checkAfterLoad && !loaded) return; // Wait for data to load
    
    if (!userHasPermission) {
      handleRedirect(fallbackRoute);
    }
  }, [user, permission, userHasPermission, isStudentUser, fallbackRoute, handleRedirect, allowStudents, checkAfterLoad, loaded]);

  return {
    hasAccess: !shouldBlock,
    // A null permission is a terminal deny, not a "still checking" state.
    isChecking: !!permission && (!user || (checkAfterLoad && !loaded)),
  };
}

/**
 * Check if user has permission to perform an action
 * Returns true if user has the permission, false otherwise
 * 
 * @param user - Current user
 * @param permission - Required permission
 * @returns boolean
 */
export function checkPermission(user: User | null | undefined, permission: string): boolean {
  if (!user) return false;
  return checkUserPermission(user, permission);
}

/**
 * Get permission-based redirect route
 * Returns the appropriate route based on user role and permission
 * 
 * @param user - Current user
 * @param permission - Required permission
 * @param fallbackRoute - Route to redirect to if permission is missing
 * @returns string - Route to redirect to
 */
export function getPermissionRedirectRoute(
  user: User | null | undefined,
  permission: string,
  fallbackRoute: string = '/403'
): string {
  if (!user) return fallbackRoute;
  if (isStudent(user)) return '/403';
  if (!checkUserPermission(user, permission)) return fallbackRoute;
  return ''; // No redirect needed
}

/**
 * Hook to protect a route based on resource/action pattern
 * Maps resource/action to permission and uses usePermissionGuard
 * 
 * @param user - Current user from useAuthContext
 * @param action - Action (create, update, delete)
 * @param resource - Resource name (assignment, payment::request, etc.)
 * @param fallbackRoute - Route to redirect to if permission is missing
 * @param options - Additional options
 * @returns Object with `hasAccess` boolean and `isChecking` boolean
 * 
 * @example
 * const { hasAccess } = useResourceGuard(user, 'create', 'payment::request', `/classes/${classId}`);
 * if (!hasAccess) return null;
 */
export function useResourceGuard(
  user: User | null | undefined,
  action: string,
  resource: string,
  fallbackRoute: string = '/403',
  options?: {
    allowStudents?: boolean;
    checkAfterLoad?: boolean;
    loaded?: boolean;
  }
) {
  // Map may fail (unmapped action/resource). Pass the (possibly null) result
  // straight through — usePermissionGuard now treats null as a terminal deny —
  // so the hook is ALWAYS called unconditionally (no rules-of-hooks violation).
  const permission = mapToPermission(action, resource);
  return usePermissionGuard(user, permission, fallbackRoute, options);
}

