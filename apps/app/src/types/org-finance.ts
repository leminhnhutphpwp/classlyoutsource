// Types cho Wave 5 — Tài chính trung tâm (finance reports + expenses).
// Backend trả envelope { success, message, data }. Tất cả số tiền là VND (number).
// Chi phí (expense) dùng khoá `_id` ở backend → chuẩn hoá `id` trong hook.

import type { OrgRole } from "./organization";

// ---- P&L ------------------------------------------------------------------
export interface PnlSummary {
  total_revenue: number;
  total_expenses: number;
  tutor_cost: number;
  net_profit: number;
  margin_pct: number;
}

export interface PnlByMonthRow {
  month: string; // YYYY-MM
  revenue: number;
  expenses: number;
  net_profit: number;
  margin_pct: number;
}

export interface ExpenseByCategoryRow {
  category: string;
  total: number;
}

export interface PnlReport {
  basis?: string;
  payroll_available?: boolean;
  period?: { date_from?: string; date_to?: string };
  summary: PnlSummary;
  by_month: PnlByMonthRow[];
  expenses_by_category: ExpenseByCategoryRow[];
}

// ---- Tutor profitability ---------------------------------------------------
export interface TutorProfitabilityRow {
  tutor_id: string;
  tutor_name: string;
  org_role?: OrgRole;
  revenue: number;
  payroll_cost: number;
  attributed_expenses: number;
  margin: number;
  margin_pct: number;
}

export interface TutorProfitabilityReport {
  summary: {
    revenue?: number;
    payroll_cost?: number;
    attributed_expenses?: number;
    margin?: number;
    margin_pct?: number;
    [key: string]: unknown;
  };
  tutors: TutorProfitabilityRow[];
}

// ---- Cashflow --------------------------------------------------------------
export interface CashflowSummary {
  total_in: number;
  total_out: number;
  expense_out: number;
  payroll_out: number;
  net_flow: number;
}

export interface CashflowByMonthRow {
  month: string;
  money_in: number;
  money_out: number;
  expense_out: number;
  payroll_out: number;
  net_flow: number;
}

export interface CashflowReport {
  summary: CashflowSummary;
  by_month: CashflowByMonthRow[];
}

// ---- Payables --------------------------------------------------------------
export interface PayablePayrollRow {
  tutor_id: string;
  tutor_name: string;
  amount: number;
}

export interface PayableExpenseRow {
  id: string; // chuẩn hoá từ `_id`
  category: string;
  amount: number;
  expense_date?: string;
  description?: string;
}

export interface PayablesReport {
  payroll_available?: boolean;
  summary: {
    total_payable: number;
    payroll_payable: number;
    expense_payable: number;
  };
  payroll: PayablePayrollRow[];
  expenses: PayableExpenseRow[];
}

// ---- Receivables (Wave 2, aged buckets) ------------------------------------
/** Khoá nhóm tuổi nợ do backend sinh ra (FinanceReportsController::agingBucket). */
export type AgingBucketKey =
  "current" | "d1_30" | "d31_60" | "d61_90" | "d90_plus";

/** Dạng đã chuẩn hoá để render bảng — KHÔNG phải dạng backend trả về. */
export interface ReceivablesAgingBucket {
  bucket: string;
  amount: number;
  count?: number;
}

export interface ReceivablesRequestRow {
  _id?: string;
  class_name?: string | null;
  period_name?: string | null;
  due_date?: string | null;
  days_overdue?: number;
  aging_bucket?: AgingBucketKey;
  outstanding?: number;
  [key: string]: unknown;
}

export interface ReceivablesReport {
  basis?: string;
  summary?: {
    /** Tên trường THẬT của backend. Trước đây khai là total_receivable nên luôn hiện 0 đ. */
    total_outstanding?: number;
    open_requests?: number;
    [key: string]: unknown;
  };
  /**
   * Backend trả về MỘT OBJECT khoá-theo-nhóm ({current: 0, d1_30: 31900000, ...}),
   * KHÔNG phải mảng. Khai sai thành mảng chính là nguyên nhân `buckets.map is not a
   * function` làm sập cả trang tài chính.
   */
  aging?: Partial<Record<AgingBucketKey, number>>;
  requests?: ReceivablesRequestRow[];
  [key: string]: unknown;
}

// ---- Expenses (CRUD) -------------------------------------------------------
export type ExpenseCategory =
  | "rent"
  | "utilities"
  | "salary"
  | "marketing"
  | "equipment"
  | "supplies"
  | "maintenance"
  | "software"
  | "tax"
  | "other";

export type ExpensePaymentMethod =
  "cash" | "bank_transfer" | "card" | "ewallet" | "other";

export interface OrgExpense {
  id: string; // chuẩn hoá từ `_id`
  category: ExpenseCategory | string;
  amount: number;
  expense_date: string; // YYYY-MM-DD
  description?: string | null;
  class_id?: string | null;
  tutor_id?: string | null;
  payment_method?: ExpensePaymentMethod | string | null; // null = chưa chi
  created_at?: string;
  updated_at?: string;
}

export interface CreateExpensePayload {
  category: string;
  amount: number;
  expense_date: string;
  description?: string;
  class_id?: string | null;
  tutor_id?: string | null;
  payment_method?: string | null;
}

export interface ExpenseFilters {
  category?: string;
  date_from?: string;
  date_to?: string;
}

// ---- AI usage --------------------------------------------------------------
export interface AiUsageBucket {
  used: number;
  limit: number | null; // null = không giới hạn
  remaining: number | null;
}

export interface AiUsageBreakdownRow {
  tutor_id?: string;
  tutor_name?: string;
  calls?: number;
  generate?: number;
  [key: string]: unknown;
}

export interface AiUsageReport {
  pool: {
    calls: AiUsageBucket;
    generate: AiUsageBucket;
  };
  breakdown: AiUsageBreakdownRow[];
}
