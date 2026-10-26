/**
 * Utility functions để check permissions từ API response và user permissions
 * 
 * Dựa trên:
 * - PERMISSIONS-SYSTEM-GUIDE.md: Permissions được sync tự động từ plan capabilities
 * - API-RESPONSE-PERMISSIONS.md: List endpoints trả về permissions object
 * - PLAN-CAPABILITIES-AND-ROLES.md: Role-based UI và capabilities
 */

import type { ApiPermissions, User, PermissionGroup, PermissionCapability } from './api-config';

/**
 * Type alias cho permissions từ API response (list endpoints)
 */
export type ApiResponsePermissions = ApiPermissions;

/**
 * Check permissions từ API response (list endpoints)
 * 
 * @param permissions Permissions object từ API response
 * @param key Permission key (can_manage, can_send_custom, etc.)
 * @returns true nếu có permission, false nếu không có hoặc undefined
 * 
 * @example
 * const { permissions } = useNotifications();
 * const canManage = hasApiPermission(permissions, 'can_manage');
 */
export function hasApiPermission(
  permissions: ApiResponsePermissions | undefined,
  key: keyof ApiResponsePermissions
): boolean {
  if (!permissions) return false;
  return permissions[key] === true;
}

/**
 * Check xem user có permission không (từ /api/v1/auth/me)
 * 
 * @param user User object từ useAuth
 * @param permission Permission string (ví dụ: 'create_class::room')
 * @returns true nếu có permission, false nếu không có
 * 
 * @example
 * const { user } = useAuth();
 * const canCreateClass = hasPermission(user, 'create_class::room');
 */
export function hasPermission(
  user: User | null | undefined,
  permission: string
): boolean {
  if (!user) return false;
  return user.permissions?.includes(permission) ?? false;
}

/**
 * Check xem user có capability không (dựa trên permissions)
 * 
 * Mapping capabilities với permissions theo PERMISSIONS-SYSTEM-GUIDE.md:
 * - classes.manage → create_class::room, update_class::room, delete_class::room
 * - students.manage → create_student, update_student, delete_student
 * - assignments.manage → create_assignment, update_assignment, delete_assignment
 * - attendance.manage → create_attendance, update_attendance, delete_attendance
 * - grades.manage → create_grade, update_grade, delete_grade
 * - reports.view_basic → view_report
 * - reports.view_advanced → view_report, view_advanced_report
 * - notifications.manage → create_notification, update_notification, delete_notification
 * - notifications.send_custom → create_notification (hoặc permission riêng)
 * - login_activity.view → view_login::activity
 * 
 * @param user User object từ useAuth
 * @param capability Capability string (ví dụ: 'classes.manage')
 * @returns true nếu có ít nhất 1 permission liên quan đến capability
 * 
 * @example
 * const { user } = useAuth();
 * const canManageClasses = hasCapability(user, 'classes.manage');
 */
export function hasCapability(
  user: User | null | undefined,
  capability: string
): boolean {
  if (!user) return false;

  // Ưu tiên kiểm tra theo permissions_organized nếu có
  const groups = user.permissions_organized as PermissionGroup[] | undefined;
  if (Array.isArray(groups) && groups.length > 0) {
    return groups.some(group =>
      Array.isArray(group.capabilities) &&
      group.capabilities.some(cap => cap?.key === capability)
    );
  }

  // Fallback: mapping capability sang flat permissions (tương thích cũ)
  const capabilityPermissions: Record<string, string[]> = {
    'classes.manage': ['create_class::room', 'update_class::room', 'delete_class::room'],
    'students.manage': ['create_student', 'update_student', 'delete_student'],
    'assignments.manage': ['create_assignment', 'update_assignment', 'delete_assignment'],
    'attendance.manage': ['create_attendance', 'update_attendance', 'delete_attendance'],
    'grades.manage': ['create_grade', 'update_grade', 'delete_grade'],
    'reports.view_basic': ['view_report'],
    'reports.view_advanced': ['view_report', 'view_advanced_report'],
    'notifications.manage': ['create_notification', 'update_notification', 'delete_notification'],
    'notifications.send_custom': ['create_notification'],
    'login_activity.view': ['view_login::activity'],
    'learning_resources.manage': ['create_learning::resource', 'update_learning::resource', 'delete_learning::resource'],
    'lesson_notes.manage': ['create_lesson::note', 'update_lesson::note', 'delete_lesson::note'],
    'payments.manage': ['create_payment', 'update_payment', 'delete_payment'],
    'payment_requests.manage': ['create_payment_request', 'update_payment_request', 'delete_payment_request'],
    'notification_preferences.manage': ['update_notification_preference'],
    'user_lock.use': ['update_user'],
    'reminders.use': ['view_reminder'],
    'data.import': ['import_data'],
    'data.export': ['export_data'],
  };

  const requiredPermissions = capabilityPermissions[capability] || [];
  return requiredPermissions.some(permission => hasPermission(user, permission));
}

/**
 * Helper functions để check permissions từ API response
 */
export const apiPermissions = {
  /**
   * Check can_manage permission
   */
  canManage: (permissions: ApiResponsePermissions | undefined): boolean => {
    return hasApiPermission(permissions, 'can_manage');
  },

  /**
   * Check can_send_custom permission
   */
  canSendCustom: (permissions: ApiResponsePermissions | undefined): boolean => {
    return hasApiPermission(permissions, 'can_send_custom');
  },

  /**
   * Check can_view_basic permission
   */
  canViewBasic: (permissions: ApiResponsePermissions | undefined): boolean => {
    return hasApiPermission(permissions, 'can_view_basic');
  },

  /**
   * Check can_view_advanced permission
   */
  canViewAdvanced: (permissions: ApiResponsePermissions | undefined): boolean => {
    return hasApiPermission(permissions, 'can_view_advanced');
  },

  /**
   * Check can_use permission
   */
  canUse: (permissions: ApiResponsePermissions | undefined): boolean => {
    return hasApiPermission(permissions, 'can_use');
  },

  /**
   * Check can_view permission
   */
  canView: (permissions: ApiResponsePermissions | undefined): boolean => {
    return hasApiPermission(permissions, 'can_view') ?? true; // Default true cho view
  },

  /**
   * Check can_manage_students permission
   */
  canManageStudents: (permissions: ApiResponsePermissions | undefined): boolean => {
    return hasApiPermission(permissions, 'can_manage_students');
  },

  /**
   * Check can_manage_class permission
   */
  canManageClass: (permissions: ApiResponsePermissions | undefined): boolean => {
    return hasApiPermission(permissions, 'can_manage_class');
  },
};

/**
 * Check xem user có phải là tutor không
 * 
 * @param user User object
 * @returns true nếu là tutor, admin, hoặc super_admin
 */
export function isTutor(user: User | null | undefined): boolean {
  if (!user) return false;

  // Priority: use is_tutor field if available (from backend)
  if (user.is_tutor !== undefined) {
    return user.is_tutor === true;
  }

  // Fallback: check role
  return ['tutor', 'admin', 'super_admin'].includes(user.role);
}

/**
 * Check xem user có phải là student không
 * 
 * @param user User object
 * @returns true nếu là student
 */
export function isStudent(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'student';
}

// ============================================================================
// Helper functions for permissions_organized
// ============================================================================

/**
 * Get all organized permission groups from user
 * 
 * @param user User object
 * @returns Array of PermissionGroup objects
 * 
 * @example
 * const groups = getOrganizedGroups(user);
 * groups.forEach(group => {
 *   // process group
 * });
 */
export function getOrganizedGroups(user: User | null | undefined): PermissionGroup[] {
  return (user?.permissions_organized ?? []) as PermissionGroup[];
}

/**
 * Get permissions of a specific group
 * 
 * @param user User object
 * @param groupKey Group key ('core', 'advanced', 'billing', etc.)
 * @returns PermissionGroup object or undefined if not found
 * 
 * @example
 * const coreGroup = getPermissionsByGroup(user, 'core');
 * const corePermissions = coreGroup?.permissions ?? [];
 */
export function getPermissionsByGroup(user: User | null | undefined, groupKey: string): PermissionGroup | undefined {
  const groups = getOrganizedGroups(user);
  return groups.find(g => g.group_key === groupKey);
}

/**
 * Get all capabilities from organized permissions
 * 
 * @param user User object
 * @returns Array of capability objects with key and label
 * 
 * @example
 * const allCapabilities = getAllCapabilities(user);
 * // Process capabilities...
 */
export function getAllCapabilities(user: User | null | undefined): PermissionCapability[] {
  const groups = getOrganizedGroups(user);
  return groups.flatMap(group => group.capabilities ?? []);
}

/**
 * List all capability keys from organized permissions
 * 
 * @param user User object
 * @returns Array of unique capability keys
 * 
 * @example
 * const capabilityKeys = listAllCapabilities(user);
 * // Process capability keys...
 */
export function listAllCapabilities(user: User | null | undefined): string[] {
  const groups = getOrganizedGroups(user);
  const caps = groups.flatMap(g => (Array.isArray(g.capabilities) ? g.capabilities : []));
  const keys = caps.map(c => c.key).filter(Boolean) as string[];
  return Array.from(new Set(keys));
}

/**
 * Check if user has any permission in a specific group
 * 
 * @param user User object
 * @param groupKey Group key ('core', 'advanced', 'billing', etc.)
 * @returns true if user has at least one permission in the group
 * 
 * @example
 * const hasCorePermissions = hasAnyPermissionInGroup(user, 'core');
 * const hasBillingPermissions = hasAnyPermissionInGroup(user, 'billing');
 */
export function hasAnyPermissionInGroup(
  user: User | null | undefined,
  groupKey: string
): boolean {
  const group = getPermissionsByGroup(user, groupKey);
  return (group?.permissions.length ?? 0) > 0;
}

/**
 * Get group that contains a specific capability
 * 
 * @param user User object
 * @param capabilityKey Capability key (e.g., 'classes.manage')
 * @returns PermissionGroup that contains the capability, or undefined
 * 
 * @example
 * const classesGroup = getGroupByCapability(user, 'classes.manage');
 * if (classesGroup) {
 *   // Process group...
 * }
 */
export function getGroupByCapability(
  user: User | null | undefined,
  capabilityKey: string
): PermissionGroup | undefined {
  const groups = getOrganizedGroups(user);
  return groups.find(group =>
    group.capabilities?.some(cap => cap.key === capabilityKey)
  );
}

/**
 * Count permissions by group
 * 
 * @param user User object
 * @returns Record mapping group keys to permission counts
 * 
 * @example
 * const counts = getPermissionCountsByGroup(user);
 * // Process counts...
 * // Output: { core: 15, role_based: 20, billing: 5, ... }
 */
export function getPermissionCountsByGroup(user: User | null | undefined): Record<string, number> {
  const groups = getOrganizedGroups(user);
  const counts: Record<string, number> = {};
  groups.forEach(group => {
    counts[group.group_key] = group.permissions.length;
  });
  return counts;
}

/**
 * Check if user has a specific capability (from organized permissions)
 * This is an improved version that uses permissions_organized first
 * 
 * @param user User object
 * @param capabilityKey Capability key (e.g., 'classes.manage')
 * @returns true if user has the capability
 * 
 * @example
 * const canManageClasses = hasCapabilityFromOrganized(user, 'classes.manage');
 */
export function hasCapabilityFromOrganized(
  user: User | null | undefined,
  capabilityKey: string
): boolean {
  if (!user) return false;

  const groups = getOrganizedGroups(user);
  return groups.some(group =>
    group.capabilities?.some(cap => cap.key === capabilityKey)
  );
}

/**
 * Get permissions array from a specific group
 * 
 * @param user User object
 * @param groupKey Group key ('core', 'advanced', 'billing', etc.)
 * @returns Array of permission strings
 * 
 * @example
 * const corePermissions = getPermissionsArrayByGroup(user, 'core');
 * const roleBasedPermissions = getPermissionsArrayByGroup(user, 'role_based');
 */
export function getPermissionsArrayByGroup(
  user: User | null | undefined,
  groupKey: string
): string[] {
  const group = getPermissionsByGroup(user, groupKey);
  return group?.permissions ?? [];
}

// ============================================================================
// Student-Tutor Permission Checks
// ============================================================================

/**
 * Check if student can access a feature based on their tutor's permissions
 * 
 * Logic: Nếu học viên truy cập một tính năng, cần check xem giáo viên của họ có permission không.
 * Nếu giáo viên không có permission thì học viên cũng không được truy cập.
 * 
 * Note: Backend đã xử lý logic này trong /api/v1/auth/me - permissions của học viên
 * đã được filter dựa trên permissions của giáo viên. Frontend chỉ cần check
 * user.permissions là đủ.
 * 
 * Tuy nhiên, nếu cần check permissions của giáo viên cụ thể (trong context của một lớp),
 * có thể sử dụng function này với tutor object.
 * 
 * @param studentUser Student user object
 * @param permission Permission string to check
 * @param tutorUser Optional: Tutor user object (nếu có context của lớp cụ thể)
 * @returns true nếu học viên có permission (tức là giáo viên cũng có)
 * 
 * @example
 * // Check permission của học viên (đã được filter bởi backend)
 * const canView = canStudentAccess(studentUser, 'view_assignment');
 * 
 * // Check permission với context của giáo viên cụ thể
 * const canViewInClass = canStudentAccess(studentUser, 'view_assignment', classTutor);
 */
export function canStudentAccess(
  studentUser: User | null | undefined,
  permission: string,
  tutorUser?: User | null | undefined
): boolean {
  // Nếu không phải học viên, check bình thường
  if (!isStudent(studentUser)) {
    return hasPermission(studentUser, permission);
  }

  // Nếu có tutor context, check permission của giáo viên
  if (tutorUser) {
    return hasPermission(tutorUser, permission);
  }

  // Nếu không có tutor context, check permission của học viên
  // (Backend đã filter permissions của học viên dựa trên permissions của giáo viên)
  return hasPermission(studentUser, permission);
}

/**
 * Check if student can access a feature in a specific class
 * based on the class tutor's permissions
 * 
 * @param studentUser Student user object
 * @param permission Permission string to check
 * @param classRoom Class room object (có tutor hoặc tutor_id)
 * @returns true nếu học viên có thể truy cập (tức là giáo viên của lớp có permission)
 * 
 * @example
 * const canViewAssignments = canStudentAccessInClass(
 *   studentUser,
 *   'view_assignment',
 *   classRoom
 * );
 */
export function canStudentAccessInClass(
  studentUser: User | null | undefined,
  permission: string,
  classRoom: { tutor?: User; tutor_id?: number } | null | undefined
): boolean {
  // Nếu không phải học viên, check bình thường
  if (!isStudent(studentUser)) {
    return hasPermission(studentUser, permission);
  }

  // Nếu không có class context, fallback về check permission của học viên
  if (!classRoom) {
    return hasPermission(studentUser, permission);
  }

  // Nếu có tutor object trong class, check permission của giáo viên
  if (classRoom.tutor) {
    return hasPermission(classRoom.tutor, permission);
  }

  // Fallback for tutor (legacy tutor field)
  if (classRoom.tutor_id) {
    // Không thể check permission với tutor_id (number) - cần fetch tutor info
    // Fallback về check permission của học viên (backend đã filter dựa trên permissions của giáo viên)
    return hasPermission(studentUser, permission);
  }

  // Nếu chỉ có tutor_id, không thể check được (cần fetch tutor info)
  // Fallback về check permission của học viên (backend đã filter)
  return hasPermission(studentUser, permission);
}
