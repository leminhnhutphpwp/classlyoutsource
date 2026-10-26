import { useAuthContext } from "@/contexts/auth-context";
import { mapToPermission } from "./permission-mapping";
import { isStudent, isTutor } from "./permissions-utils";
import type { User } from "./api-config";
import { getObjId, idsEqual } from "./id-utils";

export type ResourceAction = "view" | "view_any" | "create" | "update" | "delete";

export function useAuthorization() {
  const { user } = useAuthContext();

  /**
   * Check if user can perform an action on a resource
   * 
   * Note: Đối với học viên, backend đã filter permissions dựa trên permissions của giáo viên
   * trong /api/v1/auth/me. Vì vậy, nếu học viên có permission trong user.permissions
   * thì có nghĩa là giáo viên của họ cũng có permission đó.
   * 
   * Nếu cần check permissions của giáo viên cụ thể (trong context của một lớp),
   * sử dụng canWithTutor() thay vì can().
   */
  function can(action: ResourceAction | string, resource: string) {
    const a = String(action);
    // Use centralized permission mapping
    const permission = mapToPermission(a, resource);
    if (!permission) return false;

    // Check for direct permission or any permission
    // Build any permission: action_resource -> action_any_resource
    const parts = permission.split('_');
    const resourcePart = parts.slice(1).join('_'); // Everything after action
    const anyPermission = `${a}_any_${resourcePart}`;
    const userPermissions = user?.permissions ?? [];
    return userPermissions.includes(permission) || userPermissions.includes(anyPermission);
  }

  /**
   * Check if user can perform an action on a resource with tutor context
   * 
   * Đối với học viên: Check permission của giáo viên cụ thể (trong context của một lớp)
   * Đối với giáo viên/admin: Check permission bình thường
   * 
   * @param action Action to check
   * @param resource Resource to check
   * @param tutorUser Optional: Tutor user object (nếu có context của lớp cụ thể)
   * @returns true nếu có permission
   * 
   * @example
   * // Check permission với context của giáo viên cụ thể
   * const canView = canWithTutor('view', 'assignment', classRoom.tutor);
   */
  function canWithTutor(
    action: ResourceAction | string,
    resource: string,
    tutorUser?: User | null | undefined
  ): boolean {
    // Nếu không phải học viên, check bình thường
    if (!isStudent(user)) {
      return can(action, resource);
    }

    // Nếu là học viên và có tutor context, check permission của giáo viên
    if (tutorUser) {
      const a = String(action);
      const permission = mapToPermission(a, resource);
      if (!permission) return false;

      const parts = permission.split('_');
      const resourcePart = parts.slice(1).join('_');
      const anyPermission = `${a}_any_${resourcePart}`;

      const tutorPermissions = tutorUser?.permissions ?? [];
      return tutorPermissions.includes(permission) || tutorPermissions.includes(anyPermission);
    }

    // Nếu không có tutor context, fallback về check permission của học viên
    // (Backend đã filter permissions của học viên dựa trên permissions của giáo viên)
    return can(action, resource);
  }

  function canAny(action: ResourceAction | string, resources: string[]) {
    return resources.some((res) => can(action, res));
  }

  function hasRole(role: string) {
    return (user?.roles ?? []).includes(role);
  }

  return { can, canWithTutor, canAny, hasRole, user };
}

/**
 * Check if user can manage classes (edit, delete, add students, etc.)
 * Only tutors and admins can manage classes in tutor-only system
 * Students can only view
 */
export function canManageClass(user: any): boolean {
  if (!user) return false;

  // Check if user is tutor (including legacy 'tutor' role)
  if (isTutor(user)) return true;

  const allowedRoles = ['admin', 'super_admin'];
  return allowedRoles.includes(user.role);
}

// Re-export isStudent and isTutor from permissions-utils for backward compatibility
export { isStudent, isTutor };

/**
 * Check if user can manage learning resource (edit/delete)
 * @param user Current user
 * @param resource Learning resource object
 * @returns true if user can manage the resource
 */
export function canManageLearningResource(user: any, resource: any): { canUpdate: boolean; canDelete: boolean } {
  if (!user || !resource) {
    return { canUpdate: false, canDelete: false };
  }

  // Get tutor ID from resource (check tutor_id and tutor.getObjId)
  const tutorId = resource.tutor_id || getObjId(resource.tutor);

  // Check ownership
  const isOwner = tutorId != null && getObjId(user) != null &&
    idsEqual(tutorId, user);

  // Check if user is admin
  const isAdmin = ['admin', 'super_admin'].includes(user.role);

  // Can manage if: is owner OR is admin
  const canManage = isOwner || isAdmin;

  return {
    canUpdate: canManage,
    canDelete: canManage,
  };
}
