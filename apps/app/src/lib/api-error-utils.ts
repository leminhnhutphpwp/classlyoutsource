import type { ApiResponse } from './api-config';

/**
 * Extract error message from API response for notification popup
 * Uses the general message field, not field-specific errors
 */
export function extractErrorMessage(
  response: ApiResponse,
  defaultMessage: string = 'Có lỗi xảy ra'
): string {
  // Chỉ lấy message chung, không lấy từ errors object
  // Field errors sẽ được hiển thị riêng dưới các input
  return response.message || defaultMessage;
}

/**
 * Extract field errors from API response
 * Returns Record<fieldName, errorMessage>
 */
export function extractFieldErrors(
  response: ApiResponse
): Record<string, string> {
  const errors: Record<string, string> = {};
  
  if (response.errors && typeof response.errors === 'object') {
    for (const [field, messages] of Object.entries(response.errors)) {
      if (Array.isArray(messages) && messages.length > 0) {
        errors[field] = messages[0];
      } else if (typeof messages === 'string') {
        errors[field] = messages;
      }
    }
  }
  
  return errors;
}

/**
 * Extract limit error details from API response
 * Returns max_allowed and current_count from errors object (for LIMIT_EXCEEDED errors)
 */
export function extractLimitErrorDetails(
  response: ApiResponse
): { max_allowed?: number; current_count?: number; requested?: number } | null {
  if (!response.errors || typeof response.errors !== 'object') {
    return null;
  }

  const errors = response.errors as any;
  const details: { max_allowed?: number; current_count?: number; requested?: number } = {};

  if (typeof errors.max_allowed === 'number') {
    details.max_allowed = errors.max_allowed;
  }
  if (typeof errors.current_count === 'number') {
    details.current_count = errors.current_count;
  }
  if (typeof errors.requested === 'number') {
    details.requested = errors.requested;
  }

  return Object.keys(details).length > 0 ? details : null;
}

/**
 * Extract storage limit error details from API response
 * Returns storage limit details from details object (for STORAGE_LIMIT_EXCEEDED errors)
 */
export function extractStorageLimitErrorDetails(
  response: ApiResponse
): {
  plan_limit?: string;
  current_usage?: string;
  pending_release?: string;
  available?: string;
  file_size?: string;
  file_size_mb?: number;
  available_mb?: number;
  cooldown_days?: number;
} | null {
  if (response.code !== 'STORAGE_LIMIT_EXCEEDED' || !response.details || typeof response.details !== 'object') {
    return null;
  }

  const details = response.details as any;
  return {
    plan_limit: details.plan_limit,
    current_usage: details.current_usage,
    pending_release: details.pending_release,
    available: details.available,
    file_size: details.file_size,
    file_size_mb: details.file_size_mb,
    available_mb: details.available_mb,
    cooldown_days: details.cooldown_days,
  };
}

