/**
 * Cache configuration constants
 * Centralized cache TTL values for different data types
 */

// Default cache TTL: 1 phút
export const DEFAULT_CACHE_TTL = 60_000;

// Session cache TTL: 5 phút
// Sessions không thay đổi thường xuyên, nên cache lâu hơn để giảm API calls
export const SESSION_CACHE_TTL = 5 * 60_000;

// Schedule cache TTL: 10 phút
// Có Cache Observer tự động invalidate khi có mutations nên có thể cache lâu hơn
export const SCHEDULE_CACHE_TTL = 10 * 60_000;

// Class cache TTL: 15 phút
// Class data ít thay đổi hơn
// Có Cache Observer tự động invalidate khi có mutations nên có thể cache lâu hơn
export const CLASS_CACHE_TTL = 15 * 60_000;

// Student cache TTL: 10 phút
// Có Cache Observer tự động invalidate khi có mutations nên có thể cache lâu hơn
export const STUDENT_CACHE_TTL = 10 * 60_000;

// Assignment cache TTL: 10 phút
// Có Cache Observer tự động invalidate khi có mutations nên có thể cache lâu hơn
export const ASSIGNMENT_CACHE_TTL = 10 * 60_000;

// Report cache TTL: 5 phút
// Reports sẽ được invalidate tự động khi có mutations từ các modules khác
// Có Cache Observer tự động invalidate khi có mutations nên có thể cache lâu hơn
export const REPORT_CACHE_TTL = 5 * 60_000;

// Dashboard cache TTL: 5 phút
// Dashboard stats sẽ được invalidate tự động khi có mutations từ các modules khác
// Có Cache Observer tự động invalidate khi có mutations nên có thể cache lâu hơn
export const DASHBOARD_CACHE_TTL = 5 * 60_000;

// User profile cache TTL: 15 phút
// Có Cache Observer tự động invalidate khi có mutations nên có thể cache lâu hơn
export const USER_PROFILE_CACHE_TTL = 15 * 60_000;

// Reference data cache TTL: 15 phút (assignment types, subjects, etc.)
// Có Cache Observer tự động invalidate khi có mutations nên có thể cache lâu hơn
export const REFERENCE_DATA_CACHE_TTL = 15 * 60_000;

// Notification cache TTL: 5 phút
// Notifications có thể thay đổi thường xuyên (read status, new notifications)
// Có Cache Observer tự động invalidate khi có mutations nên có thể cache lâu hơn
export const NOTIFICATION_CACHE_TTL = 5 * 60_000;

// Settings cache TTL: 15 phút
// Settings data ít thay đổi, cache lâu hơn
// Có Cache Observer tự động invalidate khi có mutations nên có thể cache lâu hơn
export const SETTINGS_CACHE_TTL = 15 * 60_000;

// Login history cache TTL: 5 phút
// Login history có thể thay đổi thường xuyên
// Có Cache Observer tự động invalidate khi có mutations nên có thể cache lâu hơn
export const LOGIN_HISTORY_CACHE_TTL = 5 * 60_000;

// Attendance cache TTL: 10 phút
// Có Cache Observer tự động invalidate khi có mutations nên có thể cache lâu hơn
export const ATTENDANCE_CACHE_TTL = 10 * 60_000;

// Grades cache TTL: 10 phút
// Có Cache Observer tự động invalidate khi có mutations nên có thể cache lâu hơn
export const GRADES_CACHE_TTL = 10 * 60_000;

// Payments cache TTL: 10 phút
// Có Cache Observer tự động invalidate khi có mutations nên có thể cache lâu hơn
export const PAYMENTS_CACHE_TTL = 10 * 60_000;

