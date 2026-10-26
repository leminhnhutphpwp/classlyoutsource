// Types cho Wave 5 — Bảng lương trung tâm (compensation profiles, payroll periods,
// payslip items, adjustments, my-payslips). Backend dùng `_id` → chuẩn hoá `id` trong hook.

export type PayModel = "fixed_monthly" | "per_session" | "revenue_share";

export interface CompensationProfile {
  id: string; // chuẩn hoá từ `_id`
  tutor_id: string;
  tutor_name?: string;
  pay_model: PayModel;
  // Các trường rate tuỳ pay_model (đơn vị VND, hoặc % cho revenue_share).
  fixed_monthly_amount?: number | null;
  per_session_rate?: number | null;
  revenue_share_pct?: number | null;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UpsertCompensationProfilePayload {
  tutor_id: string;
  pay_model: PayModel;
  fixed_monthly_amount?: number | null;
  per_session_rate?: number | null;
  revenue_share_pct?: number | null;
}

// ---- Payroll periods -------------------------------------------------------
// State machine: draft → computing → computed → approved → paid (hoặc cancelled).
export type PayrollPeriodStatus =
  "draft" | "computing" | "computed" | "approved" | "paid" | "cancelled";

export interface PayrollPeriod {
  id: string; // chuẩn hoá từ `_id`
  label?: string;
  period_start?: string; // YYYY-MM-DD
  period_end?: string;
  month?: string; // YYYY-MM
  status: PayrollPeriodStatus;
  total_gross?: number;
  total_net?: number;
  items_count?: number;
  computed_at?: string | null;
  /**
   * Vòng đời tính lương server-side (App\Models\PayrollPeriod::CALC_*):
   * not_started → queued → computing → completed | failed. Job bị stale thì vẫn
   * có thể ở queued/computing mãi — UI tự xử lý (gợi ý kiểm tra queue worker).
   */
  calculation_status?:
    | "not_started"
    | "queued"
    | "computing"
    | "completed"
    | "failed"
    | string
    | null;
  calculation_error?: string | null;
  /** Worker NHẬN việc (queued→computing) — dùng để đo thời gian chạy/giờ cũ. */
  calculation_started_at?: string | null;
  approved_at?: string | null;
  paid_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePayrollPeriodPayload {
  label?: string;
  period_start: string;
  period_end: string;
}

// ---- Payslip items ---------------------------------------------------------
export interface PayslipBreakdownRow {
  label: string;
  amount: number;
  /**
   * Giá trị không phải tiền (số buổi, tỷ lệ %, khoảng thời gian). Có `text` thì hiển thị
   * `text`, không thì hiển thị `amount` dạng tiền. Cần vì một phiếu lương có cả dòng tiền
   * lẫn dòng thông số — ép tất cả về "đ" sẽ ra "35 đ" cho tỷ lệ 35%.
   */
  text?: string;
  [key: string]: unknown;
}

export interface PayrollItem {
  id: string; // chuẩn hoá từ `_id`
  tutor_id: string;
  tutor_name?: string;
  pay_model?: PayModel;
  gross: number;
  adjustments_total?: number;
  net?: number;
  breakdown?: PayslipBreakdownRow[];
  adjustments?: PayrollAdjustment[];
  created_at?: string;
}

export type AdjustmentType = "bonus" | "deduction";

export interface PayrollAdjustment {
  id: string; // chuẩn hoá từ `_id`
  type: AdjustmentType;
  amount: number;
  reason?: string | null;
  created_at?: string;
}

export interface CreateAdjustmentPayload {
  type: AdjustmentType;
  amount: number;
  reason?: string;
}

// ---- My payslips (member self-service) -------------------------------------
export interface MyPayslip {
  id: string; // chuẩn hoá từ `_id`
  period_label?: string;
  period_start?: string;
  period_end?: string;
  amount: number;
  breakdown?: PayslipBreakdownRow[];
  paid_at?: string | null;
  status?: PayrollPeriodStatus;
}
