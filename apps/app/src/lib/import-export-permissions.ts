/**
 * Import/Export Permissions Helper
 * 
 * Theo docs: admin/docs/frontend/api/IMPORT-EXPORT-PERMISSIONS.md
 * - Import cần: data.import + module capability
 * - Export cần: data.export (trừ một số chỉ Super Admin)
 * - Super Admin có tất cả quyền
 * 
 * Note: Permissions được sync từ plan capabilities thành các permissions cụ thể:
 * - import_student, import_enrollment, import_attendance, import_grade, import_payment
 * - export_student, export_class, export_attendance, export_grade, export_payment, export_report, export_login::activity
 */

import { User } from './api-config';
import { hasPermission } from './permissions-utils';

/**
 * Check if user can import data (generic check)
 * Check xem có ít nhất 1 import permission
 */
export function canImportData(user: User | null | undefined): boolean {
  if (!user) return false;
  
  // Super Admin có tất cả quyền
  if (user.role === 'super_admin') return true;
  
  // Check xem có ít nhất 1 import permission
  const importPermissions = [
    'import_student',
    'import_enrollment',
    'import_attendance',
    'import_grade',
    'import_payment',
  ];
  
  return importPermissions.some(permission => hasPermission(user, permission));
}

/**
 * Check if user can export data (generic check)
 * Check xem có ít nhất 1 export permission
 */
export function canExportData(user: User | null | undefined): boolean {
  if (!user) return false;
  
  // Super Admin có tất cả quyền
  if (user.role === 'super_admin') return true;
  
  // Check xem có ít nhất 1 export permission
  const exportPermissions = [
    'export_student',
    'export_class',
    'export_attendance',
    'export_grade',
    'export_payment',
    'export_report',
    'export_login::activity',
  ];
  
  return exportPermissions.some(permission => hasPermission(user, permission));
}

/**
 * Check if user can import specific type
 * Requires: specific import permission (import_student, import_enrollment, etc.)
 */
export function canImportType(
  user: User | null | undefined,
  type:
    | 'students'
    | 'enrollments'
    | 'attendance'
    | 'grades'
    | 'payments'
    | 'assignment-types'
    | 'subjects'
    | 'grade-levels'
    | 'grade-types'
): boolean {
  if (!user) return false;
  
  // Super Admin có tất cả quyền
  if (user.role === 'super_admin') return true;
  
  // Map type to specific import permission
  const permissionMap: Record<string, string> = {
    students: 'import_student',
    enrollments: 'import_enrollment',
    attendance: 'import_attendance',
    grades: 'import_grade',
    payments: 'import_payment',
  };
  
  const requiredPermission = permissionMap[type];
  // Với các loại import mới (assignment-types, subjects, grade-levels, grade-types)
  // chưa có permission riêng, fallback về check generic data.import
  if (!requiredPermission) {
    return canImportData(user);
  }
  
  return hasPermission(user, requiredPermission);
}

/**
 * Check if user can export specific type
 * Requires: specific export permission (export_student, export_class, etc.)
 */
export function canExportType(
  user: User | null | undefined,
  type:
    | 'students'
    | 'attendance'
    | 'grades'
    | 'payments'
    | 'overview'
    | 'revenue'
    | 'payment-requests'
    | 'classes'
    | 'assignments'
    | 'login-activities'
    | 'assignment-types'
    | 'subjects'
    | 'grade-levels'
    | 'grade-types'
): boolean {
  if (!user) return false;
  
  // Super Admin có tất cả quyền
  if (user.role === 'super_admin') return true;
  
  // Map type to specific export permission
  const permissionMap: Record<string, string> = {
    students: 'export_student',
    attendance: 'export_attendance',
    grades: 'export_grade',
    payments: 'export_payment',
    overview: 'export_report',
    revenue: 'export_report',
    'payment-requests': 'export_report',
    classes: 'export_class',
    assignments: 'export_report',
    'login-activities': 'export_login::activity',
  };
  
  const requiredPermission = permissionMap[type];
  if (!requiredPermission) {
    // Với các export DATA mới (assignment-types, subjects, grade-levels, grade-types)
    // fallback về generic data.export
    return canExportData(user);
  }
  
  // Login activities cần thêm view_login::activity permission
  if (type === 'login-activities') {
    return hasPermission(user, 'export_login::activity') && hasPermission(user, 'view_login::activity');
  }
  
  return hasPermission(user, requiredPermission);
}

/**
 * Check if user can import/export settings (Super Admin only)
 */
export function canManageSettings(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'super_admin';
}

/**
 * Check if user can import/export email templates (Super Admin only)
 */
export function canManageEmailTemplates(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'super_admin';
}

