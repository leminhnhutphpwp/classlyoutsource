/**
 * Constants for Reports Page
 * Centralized labels and mappings to avoid duplication
 * 
 * NOTE: These are FALLBACK labels only. Always prioritize using {field}_label from API responses.
 * These constants should only be used when API doesn't provide labels (e.g., aggregated data, legacy endpoints).
 */

export const STATUS_LABELS: Record<string, Record<string, string>> = {
  students: {
    active: 'Đang học',
    inactive: 'Đã nghỉ',
    graduated: 'Đã tốt nghiệp',
  },
  classes: {
    active: 'Đang dạy',
    inactive: 'Tạm dừng',
    completed: 'Đã hoàn thành',
  },
  assignments: {
    published: 'Đang giao',
    draft: 'Sắp giao',
    closed: 'Đã kết thúc',
  },
  payments: {
    paid: 'Đã thanh toán',
    pending: 'Chờ thanh toán',
    failed: 'Thất bại',
    refunded: 'Đã hoàn tiền',
  },
};

/**
 * Payment method labels - FALLBACK only.
 * Always use payment_method_label from API when available.
 */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank: 'Chuyển khoản',
  bank_transfer: 'Chuyển khoản',
  cash: 'Tiền mặt',
  other: 'Khác',
};

export const GRADE_COLORS: Record<string, string> = {
  A: 'bg-primary-pastel text-primary',
  B: 'bg-primary-pastel/40 text-primary',
  C: 'bg-primary-pastel/60 text-primary-light',
  D: 'bg-primary-pastel/60 text-primary-light',
  F: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
};

export const GRADE_DEFAULT_COLOR = 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';

