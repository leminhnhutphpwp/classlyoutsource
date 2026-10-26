import type { MediaFile as BaseMediaFile } from "./media-optimization-utils";

// Extended MediaFile for LearningResource with order property
interface MediaFileWithOrder extends BaseMediaFile {
  order?: number;
}

// API Configuration
export const API_CONFIG = {
  BASE_URL: '', // Use Next.js API routes
  ENDPOINTS: {
    // Auth endpoints - Next.js API routes
    AUTH: {
      LOGIN: '/api/auth/login',
      LOGOUT: '/api/auth/logout',
      REFRESH: '/api/auth/refresh',
      ME: '/api/auth/me',
      UPDATE_PROFILE: '/api/auth/profile',
      CHANGE_PASSWORD: '/api/auth/change-password',
      LOGIN_HISTORY: '/api/auth/login-history',
      FORGOT_PASSWORD: '/api/auth/forgot-password',
      VERIFY_CODE: '/api/auth/verify-code',
      RESET_PASSWORD: '/api/auth/reset-password',
      // Two-factor (TOTP)
      TWO_FACTOR_VERIFY: '/api/auth/2fa/verify', // login step 2 (bespoke BFF route, sets cookies)
      TWO_FACTOR_ENABLE: '/api/auth/2fa/enable', // via catch-all BFF
      TWO_FACTOR_CONFIRM: '/api/auth/2fa/confirm',
      TWO_FACTOR_DISABLE: '/api/auth/2fa/disable',
      TWO_FACTOR_RECOVERY_REGENERATE: '/api/auth/2fa/recovery-codes/regenerate',
    },
    // Login Activity endpoints - Next.js API routes
    LOGIN_ACTIVITY: {
      STUDENTS: '/api/login-activity/students',
    },
    // Settings endpoints - Next.js API routes
    SETTINGS: {
      // Profile Settings
      PROFILE: '/api/settings/profile',
      PROFILE_AVATAR: '/api/settings/profile/avatar',
      // Security Settings
      SECURITY: '/api/settings/security',
      SECURITY_CHANGE_PASSWORD: '/api/settings/security/change-password',
      SECURITY_CHANGE_EMAIL: '/api/settings/security/change-email',
      SECURITY_SEND_VERIFICATION_EMAIL: '/api/auth/send-verification-email',
      SECURITY_VERIFY_EMAIL: '/api/auth/verify-email',
      // Notification Settings
      NOTIFICATIONS: '/api/settings/notifications',
      // Payment Settings
      PAYMENT_BANK_INFO: '/api/settings/payment/bank-info',
      // Account Management
      ACCOUNT_DEACTIVATE: '/api/settings/account/deactivate',
      ACCOUNT_DELETE: '/api/settings/account/delete',
    },
    // Dashboard - Next.js API routes
    DASHBOARD: {
      INDEX: '/api/dashboard',
      STATISTICS: '/api/dashboard/statistics',
      RECENT_ACTIVITY: '/api/dashboard/recent-activity',
    },
    // Reminders - Next.js API routes
    REMINDERS: {
      INDEX: '/api/reminders',
    },
    // Classes - Next.js API routes
    CLASSES: {
      LIST: '/api/classes',
      CREATE: '/api/classes',
      SHOW: (id: string) => `/api/classes/${id}`,
      UPDATE: (id: string) => `/api/classes/${id}`,
      DELETE: (id: string) => `/api/classes/${id}`,
      STUDENTS: (id: string) => `/api/classes/${id}/students`,
      ENROLL_STUDENT: (id: string) => `/api/classes/${id}/students`,
      UNENROLL_STUDENT: (classId: string, studentId: string) => `/api/classes/${classId}/students/${studentId}`,
      PAUSE_STUDENT: (classId: string, studentId: string) => `/api/classes/${classId}/students/${studentId}/pause`,
      RESUME_STUDENT: (classId: string, studentId: string) => `/api/classes/${classId}/students/${studentId}/resume`,
      SCHEDULES: (id: string) => `/api/classes/${id}/schedules`,
      ASSIGNMENTS: (id: string) => `/api/classes/${id}/assignments`,
    },
    // Students - Next.js API routes
    STUDENTS: {
      LIST: '/api/students',
      CREATE: '/api/students',
      SHOW: (id: string) => `/api/students/${id}`,
      UPDATE: (id: string) => `/api/students/${id}`,
      DELETE: (id: string) => `/api/students/${id}`,
      LOCK: (id: string) => `/api/students/${id}/lock`,
      UNLOCK: (id: string) => `/api/students/${id}/unlock`,
      RESET_PASSWORD: (id: string) => `/api/students/${id}/reset-password`,
      CLASSES: (id: string) => `/api/students/${id}/classes`,
      ASSIGNMENTS: (id: string) => `/api/students/${id}/assignments`,
      ATTENDANCE: (id: string) => `/api/students/${id}/attendance`,
      GRADES: (id: string) => `/api/students/${id}/grades`,
      RECENT_ACTIVITY: (id: string) => `/api/students/${id}/recent-activity`,
      STATISTICS: (id: string) => `/api/students/${id}/statistics`,
      LOGIN_HISTORY: (id: string) => `/api/students/${id}/login-history`,
    },
    // Schedules - Next.js API routes
    SCHEDULES: {
      LIST: '/api/schedules',
      CREATE: '/api/schedules',
      SHOW: (id: string) => `/api/schedules/${id}`,
      UPDATE: (id: string) => `/api/schedules/${id}`,
      DELETE: (id: string) => `/api/schedules/${id}`,
      GENERATE_SESSIONS: (id: string) => `/api/schedules/${id}/generate-sessions`,
      SESSIONS: (id: string) => `/api/schedules/${id}/sessions`,
      TOGGLE_MODE: (id: string) => `/api/schedules/${id}/toggle-mode`,
    },
    // Schedule Sessions - Next.js API routes
    SCHEDULE_SESSIONS: {
      SHOW: (id: string) => `/api/schedule-sessions/${id}`,
      UPDATE: (id: string) => `/api/schedule-sessions/${id}`,
      DELETE: (id: string) => `/api/schedule-sessions/${id}`,
      COMPLETE: (id: string) => `/api/schedule-sessions/${id}/complete`,
      CANCEL: (id: string) => `/api/schedule-sessions/${id}/cancel`,
      RESCHEDULE: (id: string) => `/api/schedule-sessions/${id}/reschedule`,
      // QR attendance
      ATTENDANCE_START: (id: string) => `/api/schedule-sessions/${id}/attendance/start`,
      ATTENDANCE_TOKEN: (id: string) => `/api/schedule-sessions/${id}/attendance/token`,
      ATTENDANCE_LIVE: (id: string) => `/api/schedule-sessions/${id}/attendance/live`,
    },
    // Attendance - Next.js API routes
    ATTENDANCE: {
      LIST: '/api/attendance',
      CREATE: '/api/attendance',
      SHOW: (id: string) => `/api/attendance/${id}`,
      UPDATE: (id: string) => `/api/attendance/${id}`,
      DELETE: (id: string) => `/api/attendance/${id}`,
      BY_CLASS: (classId: string) => `/api/attendance/class/${classId}`,
      BY_STUDENT: (studentId: string) => `/api/attendance/student/${studentId}`,
      BULK_UPDATE: '/api/attendance/bulk-update',
      STATUS_OPTIONS: '/api/attendance/status-options',
      CHECK_IN: '/api/attendance/check-in',
    },
    // Assignments - Next.js API routes
    ASSIGNMENTS: {
      LIST: '/api/assignments',
      CREATE: '/api/assignments',
      SHOW: (id: string) => `/api/assignments/${id}`,
      UPDATE: (id: string) => `/api/assignments/${id}`,
      DELETE: (id: string) => `/api/assignments/${id}`,
      SUBMISSIONS: (id: string) => `/api/assignments/${id}/submissions`,
      // Tutor dashboard: per-skill (section_type) earned/possible aggregation per student.
      SKILL_REPORT: (id: string) => `/api/assignments/${id}/skill-report`,
      BY_CLASS: (classId: string) => `/api/assignments/class/${classId}`,
      QUIZ_SCHEMA: (id: string) => `/api/assignments/${id}/quiz/schema`,
      QUIZ_TAKE: (id: string) => `/api/assignments/${id}/quiz/take`,
      // AI (Pro): generate quiz questions for review (nothing is saved server-side).
      AI_GENERATE_QUESTIONS: (id: string) => `/api/assignments/${id}/ai-generate-questions`,
    },
    // Assignment Types - Next.js API routes
    ASSIGNMENT_TYPES: {
      LIST: '/api/assignment-types',
      CREATE: '/api/assignment-types',
      SHOW: (id: string) => `/api/assignment-types/${id}`,
      UPDATE: (id: string) => `/api/assignment-types/${id}`,
      DELETE: (id: string) => `/api/assignment-types/${id}`,
    },
    // Grade Types - Next.js API routes
    GRADE_TYPES: {
      LIST: '/api/grade-types',
      CREATE: '/api/grade-types',
      SHOW: (id: string) => `/api/grade-types/${id}`,
      UPDATE: (id: string) => `/api/grade-types/${id}`,
      DELETE: (id: string) => `/api/grade-types/${id}`,
    },
    // Subjects - Next.js API routes
    SUBJECTS: {
      LIST: '/api/subjects',
      CREATE: '/api/subjects',
      SHOW: (id: string) => `/api/subjects/${id}`,
      UPDATE: (id: string) => `/api/subjects/${id}`,
      DELETE: (id: string) => `/api/subjects/${id}`,
    },
    // Grade Levels - Next.js API routes
    GRADE_LEVELS: {
      LIST: '/api/grade-levels',
      CREATE: '/api/grade-levels',
      SHOW: (id: string) => `/api/grade-levels/${id}`,
      UPDATE: (id: string) => `/api/grade-levels/${id}`,
      DELETE: (id: string) => `/api/grade-levels/${id}`,
    },
    // Learning Resources - Next.js API routes
    LEARNING_RESOURCES: {
      LIST: '/api/learning-resources',
      CREATE: '/api/learning-resources',
      SHOW: (id: string) => `/api/learning-resources/${id}`,
      UPDATE: (id: string) => `/api/learning-resources/${id}`,
      DELETE: (id: string) => `/api/learning-resources/${id}`,
      UPLOAD: '/api/learning-resources/upload',
      DOWNLOAD: (id: string) => `/api/learning-resources/${id}/download`,
    },
    // Media - Next.js API routes
    MEDIA: {
      UPLOAD: '/api/media/upload',
    },
    // Submissions - Next.js API routes
    SUBMISSIONS: {
      LIST: '/api/submissions',
      CREATE: '/api/submissions',
      SHOW: (id: string) => `/api/submissions/${id}`,
      UPDATE: (id: string) => `/api/submissions/${id}`,
      DELETE: (id: string) => `/api/submissions/${id}`,
      GRADE: (id: string) => `/api/submissions/${id}/grade`,
      // Full paper review: sections + questions + the student's answers (+ answer key for staff).
      REVIEW: (id: string) => `/api/submissions/${id}/review`,
      // AI (Pro): advisory grading suggestion for free-text/short-answer (never sets the real score).
      AI_GRADE: (id: string) => `/api/submissions/${id}/ai-grade`,
      // AI (Pro): accept the AI suggestion as the official grade (optionally with edited score/feedback).
      AI_GRADE_ACCEPT: (id: string) => `/api/submissions/${id}/ai-grade/accept`,
      LATEST: (assignmentId: string) => `/api/submissions/assignment/${assignmentId}/latest`,
      HISTORY: (assignmentId: string) => `/api/submissions/assignment/${assignmentId}/history`,
    },
    // Grades - Next.js API routes
    GRADES: {
      LIST: '/api/grades',
      CREATE: '/api/grades',
      SHOW: (id: string) => `/api/grades/${id}`,
      UPDATE: (id: string) => `/api/grades/${id}`,
      DELETE: (id: string) => `/api/grades/${id}`,
      BY_CLASS: (classId: string) => `/api/grades/class/${classId}`,
      BY_STUDENT: (studentId: string) => `/api/grades/student/${studentId}`,
      // Whole-class grid + bulk upsert + printable report card.
      // Routed through the generic /api/* catch-all → /api/v1/* (no bespoke BFF handler needed).
      BULK: '/api/grades/bulk',
      GRADEBOOK: (classId: string) => `/api/classes/${classId}/gradebook`,
      REPORT_CARD: (classId: string, studentId: string) =>
        `/api/classes/${classId}/students/${studentId}/report-card`,
    },
    // Lesson Notes - Next.js API routes
    LESSON_NOTES: {
      LIST: '/api/lesson-notes',
      CREATE: '/api/lesson-notes',
      SHOW: (id: string) => `/api/lesson-notes/${id}`,
      UPDATE: (id: string) => `/api/lesson-notes/${id}`,
      DELETE: (id: string) => `/api/lesson-notes/${id}`,
      BY_CLASS: (classId: string) => `/api/lesson-notes/class/${classId}`,
    },
    // Payments - Next.js API routes
    PAYMENTS: {
      LIST: '/api/payments',
      CREATE: '/api/payments',
      SHOW: (id: string) => `/api/payments/${id}`,
      UPDATE: (id: string) => `/api/payments/${id}`,
      DELETE: (id: string) => `/api/payments/${id}`,
      BY_STUDENT: (studentId: string) => `/api/payments/student/${studentId}`,
      STATISTICS: '/api/payments/statistics',
      DECODE_TOKEN: '/api/payments/decode-token', // POST body { token }
      APPROVE: (id: string) => `/api/payments/${id}/approve`,
      REJECT: (id: string) => `/api/payments/${id}/reject`,
      REFUND: (id: string) => `/api/payments/${id}/refund`,
      MARK_FAILED: (id: string) => `/api/payments/${id}/mark-failed`,
    },
    // Payment Requests - Next.js API routes
    PAYMENT_REQUESTS: {
      LIST: (classId: string) => `/api/classes/${classId}/payment-requests`,
      CREATE: (classId: string) => `/api/classes/${classId}/payment-requests`,
      BULK_CREATE: (classId: string) => `/api/classes/${classId}/payment-requests/bulk`,
      SHOW: (id: string) => `/api/payment-requests/${id}`,
      UPDATE: (id: string) => `/api/payment-requests/${id}`,
      DELETE: (id: string) => `/api/payment-requests/${id}`,
      STATISTICS: (id: string) => `/api/payment-requests/${id}/statistics`,
    },
    // Notifications - Next.js API routes
    NOTIFICATIONS: {
      LIST: '/api/notifications',
      CREATE: '/api/notifications',
      SHOW: (id: string) => `/api/notifications/${id}`,
      UPDATE: (id: string) => `/api/notifications/${id}`,
      DELETE: (id: string) => `/api/notifications/${id}`,
      SEND: (id: string) => `/api/notifications/${id}/send`,
      UNREAD: '/api/notifications/unread',
      MARK_READ: (id: string) => `/api/notifications/${id}/mark-read`,
    },
    // Notification Preferences - Next.js API routes
    NOTIFICATION_PREFERENCES: {
      LIST: '/api/notification-preferences',
      AVAILABLE_CHANNELS: '/api/notification-preferences/available-channels',
      BULK_UPDATE: '/api/notification-preferences/bulk-update',
      SHOW: (type: string) => `/api/notification-preferences/${type}`,
      UPDATE: (type: string) => `/api/notification-preferences/${type}`,
    },
    // Users Management - Next.js API routes
    USERS: {
      LIST: '/api/users',
      CREATE: '/api/users',
      SHOW: (id: string) => `/api/users/${id}`,
      UPDATE: (id: string) => `/api/users/${id}`,
      DELETE: (id: string) => `/api/users/${id}`,
      RESET_PASSWORD: (id: string) => `/api/users/${id}/reset-password`,
      ACTIVATE: (id: string) => `/api/users/${id}/activate`,
      DEACTIVATE: (id: string) => `/api/users/${id}/deactivate`,
    },
    // Reports - Next.js API routes
    REPORTS: {
      OVERVIEW: '/api/reports/overview',
      REVENUE: '/api/reports/revenue',
      // ADDONS: '/api/reports/addons', // DEPRECATED - Removed in tutor-only system
      STATISTICS: '/api/reports/statistics',
      PAYMENTS: '/api/reports/payments',
      ATTENDANCE: '/api/reports/attendance',
      STUDENTS: '/api/reports/students',
      CLASSES: '/api/reports/classes',
      ASSIGNMENTS: '/api/reports/assignments',
      // Export endpoints
      EXPORT_OVERVIEW: '/api/reports/overview/export',
      EXPORT_REVENUE: '/api/reports/revenue/export',
      // EXPORT_ADDONS: '/api/reports/addons/export', // DEPRECATED - Removed in tutor-only system
      EXPORT_PAYMENTS: '/api/reports/payments/export',
      EXPORT_ATTENDANCE: '/api/reports/attendance/export',
      EXPORT_STUDENTS: '/api/reports/students/export',
      EXPORT_CLASSES: '/api/reports/classes/export',
      EXPORT_ASSIGNMENTS: '/api/reports/assignments/export',
      EXPORT_PAYMENT_REQUESTS: '/api/reports/payment-requests/export',
      EXPORT_LOGIN_ACTIVITIES: '/api/reports/login-activities/export',
    },
    // Import/Export - Next.js API routes
    IMPORT_EXPORT: {
      // Import endpoints
      IMPORT_STUDENTS: '/api/import-export/students/import',
      IMPORT_ENROLLMENTS: '/api/import-export/enrollments/import',
      IMPORT_ATTENDANCE: '/api/import-export/attendance/import',
      IMPORT_GRADES: '/api/import-export/grades/import',
      IMPORT_PAYMENTS: '/api/import-export/payments/import',
      // New import endpoints for master data
      IMPORT_ASSIGNMENT_TYPES: '/api/import-export/assignment-types/import',
      IMPORT_SUBJECTS: '/api/import-export/subjects/import',
      IMPORT_GRADE_LEVELS: '/api/import-export/grade-levels/import',
      IMPORT_GRADE_TYPES: '/api/import-export/grade-types/import',
      // Export DATA endpoints
      EXPORT_STUDENTS: '/api/import-export/students/export',
      EXPORT_ASSIGNMENT_TYPES: '/api/import-export/assignment-types/export',
      EXPORT_SUBJECTS: '/api/import-export/subjects/export',
      EXPORT_GRADE_LEVELS: '/api/import-export/grade-levels/export',
      EXPORT_GRADE_TYPES: '/api/import-export/grade-types/export',
      // REPORT endpoints
      EXPORT_ATTENDANCE: '/api/import-export/reports/attendance/export',
      EXPORT_GRADES: '/api/import-export/reports/grades/export',
      EXPORT_PAYMENTS: '/api/import-export/reports/payments/export',
      EXPORT_OVERVIEW: '/api/import-export/reports/overview/export',
      EXPORT_REVENUE: '/api/import-export/reports/revenue/export',
      EXPORT_PAYMENT_REQUESTS: '/api/import-export/reports/payment-requests/export',
      EXPORT_CLASSES: '/api/import-export/reports/classes/export',
      EXPORT_ASSIGNMENTS: '/api/import-export/reports/assignments/export',
      EXPORT_LOGIN_ACTIVITIES: '/api/import-export/reports/login-activities/export',
      // Settings & Templates
      EXPORT_SETTINGS: '/api/import-export/settings/export',
      IMPORT_SETTINGS: '/api/import-export/settings/import',
      EXPORT_EMAIL_TEMPLATES: '/api/import-export/email-templates/export',
      IMPORT_EMAIL_TEMPLATES: '/api/import-export/email-templates/import',
    },
    // Data Jobs (Import/Export History) - Next.js API routes
    DATA_JOBS: {
      LIST: '/api/data-jobs',
      SHOW: (id: string) => `/api/data-jobs/${id}`,
    },
  }
};

// API Response Permissions Types
export interface ApiPermissions {
  can_manage?: boolean;
  can_send_custom?: boolean;
  can_view_basic?: boolean;
  can_view_advanced?: boolean;
  can_use?: boolean;
  can_view?: boolean;
  can_manage_students?: boolean;
  can_manage_class?: boolean;
  [key: string]: boolean | undefined;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
  code?: string;
  details?: Record<string, any>;
  meta?: {
    current_page?: number;
    per_page?: number;
    total?: number;
    last_page?: number;
    from?: number;
    to?: number;
  };
  permissions?: ApiPermissions;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

// Permissions Types (organized groups)
export interface PermissionCapability {
  key: string;
  label: string;
}

export interface PermissionGroup {
  group_key: string;
  group_label: string;
  permissions: string[];
  capabilities: PermissionCapability[];
}

// User Types
export interface User {
  id: string;
  name: string;
  email: string;
  email_verified?: boolean; // Email verification status
  pending_email?: string;
  phone?: string;
  role: 'tutor' | 'student' | 'parent' | 'admin' | 'super_admin';
  avatar?: string;
  // Optional media object returned by backend for avatar
  avatar_media?: {
    url?: string;
    thumb_url?: string;
  };
  // Optional theme key for UI theme preference
  theme_key?: string;
  address?: string;
  bio?: string;
  status: 'active' | 'inactive';
  is_tutor?: boolean; // True if user is a tutor
  roles?: string[]; // Array of roles
  permissions?: string[]; // Flat permissions for quick checks
  permissions_organized?: PermissionGroup[]; // Organized by groups with capabilities
  created_at: string;
  updated_at: string;
  // Lock status fields
  is_locked?: boolean; // True if user account is locked
  lock_type?: 'login' | 'actions' | 'all' | null; // Type of lock if locked
  lock_reason?: string | null; // Reason for lock
  lock_start_at?: string | null; // Lock start time
  lock_end_at?: string | null; // Lock end time (null = unlimited)
  // Student relationship (for student users)
  student_id?: string;
}

// Class Types
export interface ClassRoom {
  id: string;
  name: string;
  description?: string;
  tutor_id: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  tutor?: User;
  students?: Student[];
}

export interface Enrollment {
  enrolled_at?: string;
  status: 'active' | 'inactive' | 'completed' | 'dropped';
  notes?: string | null;
}

export interface UserLock {
  id: string;
  type: 'login' | 'actions' | 'all';
  type_label: string;
  status: 'scheduled' | 'active' | 'done' | 'cancelled';
  status_label: string;
  reason?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  created_at: string;
}

export interface Student {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  classes?: (ClassRoom & { enrollment?: Enrollment })[];
  // Lock information
  is_locked?: boolean;
  user_locks?: UserLock[];
}

// Schedule Types
export interface Schedule {
  id: string;
  class_id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  days_of_week?: number[];
  time_slots: string[];
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  class?: ClassRoom;
}

// Attendance Status Info
export interface AttendanceStatusInfo {
  value: 'present' | 'absent' | 'late' | 'excused';
  label: string;
  label_en: string;
  color: 'success' | 'danger' | 'warning' | 'info';
  icon: string;
  description?: string;
}

// Attendance
export interface Attendance {
  id: string;
  class_id: string;
  student_id: string;
  tutor_id?: string;
  date: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  status: 'present' | 'absent' | 'late' | 'excused';
  status_info?: AttendanceStatusInfo;
  note?: string | null;
  created_at: string;
  updated_at: string;
  class?: ClassRoom;
  student?: Student;
  tutor?: User;
  // Legacy fields for backward compatibility
  notes?: string;
}

export interface QuizSettings {
  auto_grade: boolean;
  shuffle_questions: boolean;
  show_correct_answers: boolean;
  show_score_to_student: boolean;
  time_limit_minutes?: number | null;
}

export type QuizQuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'short_answer'
  | 'true_false_not_given'
  | 'matching'
  | 'ordering'
  | 'gap_fill';

/** Section types an exam assignment may use (mirrors config/assignments.php). */
export type QuizSectionType = 'general' | 'listening' | 'reading' | 'writing' | 'speaking';

/** Answer shape sent to POST /submissions — varies by question type (see question-types registry). */
export type QuizAnswerPayload =
  | { question_id: string; option_id?: string | null }
  | { question_id: string; selected_option_id?: string | null }
  | { question_id: string; selected_option_ids?: string[] }
  | { question_id: string; text?: string }
  | { question_id: string; response?: Record<string, unknown> };

// Media attached to a quiz question/option. Returned by the backend on read
// (`media`) alongside the numeric `media_id` we send on write. `url` is ready to
// use directly in <img>/<audio>. `type` drives how it renders ('image' | 'audio').
export interface QuizMedia {
  id: string;
  url: string;
  type: string;
  name?: string;
  ext?: string;
}

export interface QuizQuestionOption {
  id?: string;
  /** Hashid from backend payloads (quiz/take, review) — getObjId prefers _id. */
  _id?: string;
  label: string;
  content: string;
  is_correct: boolean | null;
  media_id?: number | null;
  media?: QuizMedia | null;
}

export interface QuizQuestion {
  id?: string;
  /** Hashid from backend payloads (quiz/take, review) — getObjId prefers _id. */
  _id?: string;
  title: string;
  points: number;
  question_type: QuizQuestionType;
  options: QuizQuestionOption[];
  media_id?: number | null;
  media?: QuizMedia | null;
  section_id?: string | null;
  settings?: Record<string, unknown> | null;
  // Matching: item rows (left column) + choice pool (right column).
  items?: Array<{ _id?: string; label?: string | null; content?: string | null; media?: QuizMedia | null }>;
  pool?: string[];
  // Ordering: items in the order the student must arrange (stable-shuffled for students).
  sequence_items?: Array<{ _id?: string; content?: string | null; media?: QuizMedia | null }>;
  // Gap fill: gap numbers found in the text ({{1}}, {{2}}...) and the text itself.
  gap_numbers?: number[];
  text_with_gaps?: string;
  // TFNG: the three fixed choices.
  choices?: string[];
}

export interface AssignmentQuizPayload {
  question_count?: number;
  total_points?: number;
  settings?: QuizSettings;
  questions?: QuizQuestion[];
  sections?: QuizSection[];
}

/** An exam section (IELTS Listening Part, Reading Passage...). */
export interface QuizSection {
  _id: string;
  section_type: QuizSectionType;
  title: string;
  instruction?: string | null;
  media_id?: number | null;
  media?: QuizMedia | null;
  order: number;
  settings?: Record<string, unknown> | null;
}

/** Builder-side section draft (client temp `_key` resolves against backend sections.*._key). */
export interface QuizSectionDraft {
  _key: string;
  section_type: QuizSectionType;
  title: string;
  instruction?: string;
  media_id?: number | null;
  media?: QuizMedia | null;
  order?: number;
  settings?: Record<string, unknown> | null;
}

/** Student's stored answer for one question (from the review endpoint). */
export interface QuizReviewResponse {
  question_id: string;
  selected_option_id?: string | null;
  selected_option_ids?: string[];
  text_answer?: string | null;
  response?: Record<string, unknown> | null;
  is_correct: boolean;
  score: number | null; // null = the row exists without a score yet (manual grading pending)
  max_points?: number | null;
  meta?: Record<string, unknown> | null;
}

export interface QuizReviewPayload {
  submission: Submission;
  assignment: Assignment;
  sections: QuizSection[];
  questions: QuizQuestion[];
  responses: QuizReviewResponse[];
  expose_correct: boolean;
}

// Tutor skill-report shapes (GET /assignments/{id}/skill-report)
export interface SkillReportSkill {
  type: string; // section_type bucket: listening | reading | writing | speaking | general
  earned: number;
  possible: number;
  percent: number;
}

export interface SkillReportStudent {
  student_id: string;
  student_name: string;
  skills: SkillReportSkill[];
  earned: number;
  possible: number;
  percent: number;
  attempt_count: number;
}

export interface SkillReportPayload {
  assignment_id: string;
  students: SkillReportStudent[];
  skills_present: string[];
  section_count: number;
}

// A single rubric criterion the AI assessed (name + partial score + short comment).
export interface AiGradeCriterion {
  name: string;
  score: number;
  comment?: string;
}

// AI grading suggestion (Pro). Advisory only — the tutor still submits the real grade.
export interface AiGradeSuggestion {
  score: number;
  is_correct: boolean;
  feedback: string;
  max_points: number;
  // Newer fields: model confidence (0..1) and a per-criterion rubric breakdown.
  confidence?: number;
  criteria?: AiGradeCriterion[];
}

export interface AiGradeResult {
  suggestion: AiGradeSuggestion;
  submission: Submission;
}

// AI question generation (Pro). Questions are NOT saved — the tutor reviews then adds them.
export interface AiGeneratedOption {
  content: string;
  is_correct: boolean;
  feedback?: string;
}

export interface AiGeneratedQuestion {
  question_type: QuizQuestionType;
  title: string;
  points: number;
  options: AiGeneratedOption[];
  explanation?: string;
  // Exam shapes (matching / ordering / gap_fill):
  items?: Array<{ label?: string | null; content: string }>;
  distractors?: string[];
  text_with_gaps?: string | null;
}

export interface AiGenerateQuestionsResult {
  count: number;
  questions: AiGeneratedQuestion[];
}

export interface AiGenerateQuestionsRequest {
  topic: string;
  count: number;
  question_type: QuizQuestionType;
  source?: string;
}

// Assignment Types
export interface Assignment {
  id: string;
  class_id: string;
  tutor_id?: string;
  assignment_type_id?: string;
  title: string;
  description?: string;
  instructions?: string;
  max_score: number;
  assigned_date?: string;
  due_date?: string;
  deadline?: string;
  allow_late_submission?: boolean;
  status: 'draft' | 'published' | 'closed';
  learning_resources?: LearningResource[];
  assignment_type?: AssignmentType;
  created_at: string;
  updated_at: string;
  class?: ClassRoom;
  tutor?: User;
  mode?: 'standard' | 'quiz';
  allowed_submission_types?: string[];
  quiz_settings?: QuizSettings | null;
  quiz?: AssignmentQuizPayload | null;
  max_attempts?: number | null;
  submissions_count?: number;
  graded_submissions_count?: number;
  pending_submissions_count?: number;
  average_score?: number;
  latest_submission?: Submission | null;
  // Legacy fields for backward compatibility
  max_points?: number;
}

export interface AssignmentType {
  id: string;
  name: string;
  code?: string;              // Mã viết tắt (e.g., "HOMEWORK")
  description?: string;        // Mô tả loại bài tập
  is_active?: boolean;        // Trạng thái kích hoạt
  order?: number;             // Thứ tự hiển thị
  display_name?: string;      // Tên hiển thị đã format (name + code)
}

export interface Subject {
  id: string;
  name: string;
  code?: string;
  description?: string;
  is_active?: boolean;
  order?: number;
}

export interface GradeLevel {
  id: string;
  name: string;
  code?: string;
  description?: string;
  is_active?: boolean;
  order?: number;
}

export interface LearningResource {
  _id?: string | number;
  id: string;
  title: string;
  description?: string;
  type?: string;
  type_label?: string;            // Label hiển thị (e.g., "Tài liệu", "Video")
  external_url?: string | null;   // URL bên ngoài (YouTube, Google Drive, etc.)
  file_url?: string | null;       // URL file upload (deprecated, use media.download_url instead)
  file_size?: string | null;      // Kích thước file (e.g., "2.5 MB")
  media_id?: string | null;       // ID của media file
  subject_id?: string | null;
  subject?: string;
  subject_model?: Subject;         // Full subject model
  topic?: string;
  grade_level_id?: string | null;
  grade_level?: string;
  grade_level_model?: GradeLevel;  // Full grade level model
  tags?: string[];                // Array of tags
  downloads?: number;             // Số lượt download
  views?: number;                 // Số lượt xem
  is_public?: boolean;            // Công khai hay không
  status?: 'active' | 'archived';
  tutor_id?: string | null;
  tutor?: User;                 // Tutor who created the resource
  media?: {                       // Media file details
    id: string;
    name: string | null;           // File name (có thể null)
    url?: string;                 // Direct storage URL (deprecated, use download_url instead)
    download_url?: string;         // Secure download endpoint: /api/v1/learning-resources/{id}/download
    size: number | null;           // File size in bytes (có thể null)
    size_formatted?: string | null; // Formatted file size (e.g., "1.00 MB") (có thể null)
    type: string | null;           // File type (có thể null)
    ext?: string | null;           // File extension (e.g., "pdf") (có thể null)
    mime_type?: string;            // MIME type
  };
  media_files?: MediaFileWithOrder[];      // Multiple media files (for image galleries)
  order?: number;                 // Thứ tự hiển thị (when used in assignment)
  created_at?: string;
  updated_at?: string;
}

// Submission Types
export interface SubmissionAttemptInfo {
  current: number;
  max: number;
  remaining: number;
  limit_reached: boolean;
  unlimited: boolean;
}

export interface SubmissionQuizBreakdownDetail {
  question_id: string;
  option_id: string | null;
  option_label?: string | null;
  is_correct: boolean | null;
  points?: number | null;
  max_points?: number | null;
}

export interface SubmissionQuizBreakdown {
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count?: number;
  score?: number | null;
  max_score?: number | null;
  details?: SubmissionQuizBreakdownDetail[];
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  content?: string | null;
  media_id?: string | null;
  external_url?: string | null;
  submitted_at?: string;
  graded_at?: string | null;
  score?: number | null;
  feedback?: string | null;
  // AI grading is advisory only — a suggestion the tutor reviews, never the final score.
  ai_suggested_score?: number | null;
  ai_feedback?: string | null;
  ai_graded_at?: string | null;
  status: 'pending' | 'submitted' | 'graded' | 'returned';
  created_at: string;
  updated_at: string;
  submission_type?: 'standard' | 'quiz' | string;
  attempt_number?: number;
  attempts_info?: SubmissionAttemptInfo;
  quiz_breakdown?: SubmissionQuizBreakdown | null;
  assignment?: Assignment;
  student?: Student;
}

// Grade Types
export interface GradeType {
  id: string;
  created_by?: string;
  name: string;
  code?: string;
  description?: string;
  is_active: boolean;
  order: number;
  created_at?: string;
  updated_at?: string;
  display_name?: string;
}

export interface Grade {
  id: string;
  class_id: string;
  student_id: string;
  tutor_id: string;
  assignment_id?: number;
  grade_type_id?: number;
  title: string;
  score: number;
  max_score: number;
  comments?: string;
  grade_date?: string;
  semester?: string;
  percentage?: number;
  grade_letter?: string;
  is_passing?: boolean;
  created_at: string;
  updated_at: string;
  class?: ClassRoom;
  student?: Student;
  tutor?: User;
  assignment?: Assignment;
  grade_type?: GradeType;
  // Legacy fields for backward compatibility
  grade?: number;
  max_points?: number;
  notes?: string;
  status?: string;
}

// Payment Types
export interface Payment {
  id: string;
  customer_id: string;
  invoice_number?: string;
  month?: string;
  amount: number;
  payment_date: string;
  due_date?: string;
  payment_method: 'cash' | 'bank' | 'other';
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  note?: string;
  created_at: string;
  updated_at: string;
  student?: Student;
  // Legacy fields for backward compatibility
  student_id?: number;
  notes?: string;
  collector_id?: number;
  collector?: User;
}

// Notification Types
export interface Notification {
  id: string;
  created_by: number;
  title: string;
  content: string;
  type: 'announcement' | 'reminder' | 'payment' | 'attendance' | 'grade' | 'other';
  target: 'student' | 'parent' | 'all';
  channel: 'email' | 'zalo' | 'sms' | 'in_app';
  scheduled_at?: string;
  sent_at?: string;
  sent_count?: number;
  failed_count?: number;
  status: 'draft' | 'scheduled' | 'processing' | 'sent' | 'failed';
  recipient_ids?: number[];
  recipient_classes?: number[];
  recipient_students?: number[];
  created_at: string;
  updated_at: string;
  creator?: User;
  // Legacy fields for backward compatibility
  channels?: string[];
  message?: string;
}

export interface NotificationRecipientLog {
  id: string;
  notification_id: string;
  recipient_user_id?: number;
  recipient_student_id?: number;
  email?: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  sent_at?: string;
  attempt?: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
  student?: Student;
  recipient_user?: User;
}

// Dashboard Types
export interface DashboardStats {
  user_type: 'personal_tutor' | 'institution_tutor';
  statistics: {
    total_classes: number;
    active_classes: number;
    total_students: number;
    active_students?: number;
    total_tutors?: number;
    attendance_this_month: number;
    assignments_this_month?: number;
    revenue_this_month?: number;
  };
}

// Report Types
export interface ReportOverview {
  total_revenue: number;
  total_classes: number;
  total_students: number;
  total_tutors: number;
  revenue_growth: number;
  student_growth: number;
  class_growth: number;
}

export interface RevenueReport {
  period: string;
  revenue: number;
  growth_rate: number;
}

// Lesson Note Types
export interface LessonNote {
  id: string;
  class_id: string;
  tutor_id: string;
  lesson_date: string;
  topic?: string | null;
  content: string;
  observations?: string | null;
  homework?: string;
  student_notes?: StudentNote[];
  student_notes_count?: number;
  learning_resources?: LearningResource[];
  learning_resources_count?: number;
  rating?: number;
  rating_stars?: string;
  attachments?: Attachment[];
  attachments_count?: number;
  has_homework?: boolean;
  has_attachments?: boolean;
  created_at: string;
  updated_at: string;
  class?: ClassRoom;
  tutor?: User;
  // Legacy fields for backward compatibility
  title?: string;
  objectives?: string;
  materials?: string;
  student_performance?: string;
  notes?: string;
  date?: string;
}

export interface StudentNote {
  student_id: string;
  student?: Student;
  behavior: 'excellent' | 'good' | 'average' | 'poor';
  behavior_label?: string;
  note?: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  mime_type?: string;
}

