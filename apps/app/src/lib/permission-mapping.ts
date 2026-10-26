/**
 * Permission Mapping - Maps resource/action patterns to specific permissions
 * 
 * This file provides a centralized mapping between resource-based permissions
 * (used by useAuthorization) and specific permissions (used by hasPermission)
 */

/**
 * Map resource and action to specific permission string
 * 
 * @param action - Action (create, update, delete, view, view_any)
 * @param resource - Resource name (assignment, payment::request, etc.)
 * @returns Specific permission string or null if not found
 * 
 * @example
 * mapToPermission('create', 'payment::request') // returns 'create_payment::request'
 * mapToPermission('create', 'assignment') // returns 'create_assignment'
 */
export function mapToPermission(action: string, resource: string): string | null {
  // Handle resources with double colon (already in correct format)
  if (resource.includes('::')) {
    return `${action}_${resource}`;
  }
  
  // Map common resource names to their permission format
  const resourceMapping: Record<string, string> = {
    'assignment_type': 'assignment::type',
    'grade_type': 'grade::type',
    'grade_level': 'grade::level',
    'login_activity': 'login::activity',
    'student_login_activity': 'student_login::activity',
    'payment_request': 'payment::request',
    'lesson_note': 'lesson::note',
    'reminder': 'reminder', // Maps to view_reminder permission
  };
  
  const mappedResource = resourceMapping[resource] || resource;
  return `${action}_${mappedResource}`;
}

/**
 * Get permission for create action
 */
export function getCreatePermission(resource: string): string | null {
  return mapToPermission('create', resource);
}

/**
 * Get permission for update action
 */
export function getUpdatePermission(resource: string): string | null {
  return mapToPermission('update', resource);
}

/**
 * Get permission for delete action
 */
export function getDeletePermission(resource: string): string | null {
  return mapToPermission('delete', resource);
}

/**
 * Get permission for view action
 */
export function getViewPermission(resource: string): string | null {
  return mapToPermission('view', resource);
}

