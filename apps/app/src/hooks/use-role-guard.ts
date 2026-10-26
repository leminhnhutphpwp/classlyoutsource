import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthorization } from "@/lib/authz";
import { useAuth } from "@/hooks/use-api";
import { hasCapability, isTutor } from "@/lib/permissions-utils";

/**
 * Hook to protect pages based on role
 * Redirects to /403 if user doesn't have required role
 */
export function useRoleGuard(options?: {
  allowedRoles?: string[];
  blockedRoles?: string[];
  redirectTo?: string;
}) {
  const router = useRouter();
  const { hasRole, user } = useAuthorization();
  const { allowedRoles, blockedRoles, redirectTo = "/403" } = options || {};

  useEffect(() => {
    if (!user) return;

    // Check blocked roles first
    if (blockedRoles && blockedRoles.length > 0) {
      const hasBlockedRole = blockedRoles.some(role => hasRole(role));
      if (hasBlockedRole) {
        router.replace(redirectTo);
        return;
      }
    }

    // Check allowed roles
    if (allowedRoles && allowedRoles.length > 0) {
      const hasAllowedRole = allowedRoles.some(role => hasRole(role));
      if (!hasAllowedRole) {
        router.replace(redirectTo);
        return;
      }
    }
  }, [user, hasRole, allowedRoles, blockedRoles, redirectTo, router]);

  // Calculate isBlocked: true if user is blocked OR if allowedRoles is set and user doesn't have any allowed role
  const isBlocked = useMemo(() => {
    if (blockedRoles && blockedRoles.length > 0) {
      return blockedRoles.some(role => hasRole(role));
    }
    if (allowedRoles && allowedRoles.length > 0) {
      return !allowedRoles.some(role => hasRole(role));
    }
    return false;
  }, [hasRole, allowedRoles, blockedRoles]);

  return {
    isBlocked,
    isAllowed: allowedRoles ? allowedRoles.some(role => hasRole(role)) : true,
  };
}

/**
 * Hook to protect pages for students
 * Redirects to /403 if user is a student
 */
export function useStudentGuard(redirectTo: string = "/403") {
  return useRoleGuard({
    blockedRoles: ["student"],
    redirectTo,
  });
}

/**
 * Hook to protect tutor-only management pages.
 * Blocks both `student` and `parent`; every staff account (tutor, admin, super_admin,
 * and org owner/manager/accountant — all of whom carry users.role = tutor) passes.
 * Use this instead of useStudentGuard on management surfaces so a parent cannot reach
 * them by typing the URL directly.
 */
export function useTutorGuard(redirectTo: string = "/403") {
  return useRoleGuard({
    blockedRoles: ["student", "parent"],
    redirectTo,
  });
}

/**
 * Hook to protect shared student/tutor pages (classes, grades, attendance, ...).
 * Blocks `parent` only — a student may reach their own data, and staff pass.
 * Parents use the dedicated Family portal instead of these management routes.
 */
export function useParentBlockGuard(redirectTo: string = "/403") {
  return useRoleGuard({
    blockedRoles: ["parent"],
    redirectTo,
  });
}

/**
 * Hook to protect pages based on capability
 * Redirects to /403 if user doesn't have required capability
 * 
 * @param capability Capability string (e.g., 'reports.view_basic')
 * @param redirectTo Redirect path if capability is missing (default: '/403')
 * @param requireTutor If true, also check if user is tutor (default: true) 
 */
export function useCapabilityGuard(
  capability: string,
  redirectTo: string = "/403",
  requireTutor: boolean = true
) {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Check if user is tutor (if required)
    if (requireTutor && !isTutor(user)) {
      router.replace("/403");
      return;
    }

    // Check capability
    if (!hasCapability(user, capability)) {
      router.replace(redirectTo);
      return;
    }
  }, [user, capability, redirectTo, requireTutor, router]);

  const hasCap = useMemo(() => {
    if (!user) return false;
    if (requireTutor && !isTutor(user)) return false;
    return hasCapability(user, capability);
  }, [user, capability, requireTutor]);

  return {
    hasCapability: hasCap,
    isBlocked: !hasCap,
  };
}

