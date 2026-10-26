"use client";

import { useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import type { ApiResponse } from "@/lib/api-config";
import type {
  CompensationProfile,
  UpsertCompensationProfilePayload,
  PayrollPeriod,
  CreatePayrollPeriodPayload,
  PayrollItem,
  PayslipBreakdownRow,
  CreateAdjustmentPayload,
  MyPayslip,
} from "@/types/org-payroll";
import { useApi, useMutation } from "./core";

/**
 * Wave 5 — Bảng lương trung tâm. BFF cùng-origin:
 * `/api/organizations/{orgHash}/compensation-profiles|payroll-periods|payroll-items|my-payslips`.
 * Backend dùng `_id` → chuẩn hoá `id`.
 */

const PAYROLL_TTL = 30 * 1000;

function idOf(o: Record<string, unknown>): string {
  return (o.id as string) ?? (o._id as string) ?? "";
}

// ---- Compensation profiles -------------------------------------------------

function normalizeProfile(p: Record<string, unknown>): CompensationProfile {
  return {
    id: idOf(p),
    tutor_id: (p.tutor_id as string) ?? "",
    tutor_name: p.tutor_name as string | undefined,
    pay_model:
      (p.pay_model as CompensationProfile["pay_model"]) ?? "fixed_monthly",
    fixed_monthly_amount: (p.fixed_monthly_amount as number | null) ?? null,
    per_session_rate: (p.per_session_rate as number | null) ?? null,
    revenue_share_pct: (p.revenue_share_pct as number | null) ?? null,
    active: (p.active as boolean) ?? true,
    created_at: p.created_at as string | undefined,
    updated_at: p.updated_at as string | undefined,
  };
}

export function useCompensationProfiles(orgHash?: string, enabled = true) {
  const call = useCallback(async (): Promise<
    ApiResponse<CompensationProfile[]>
  > => {
    const res = await apiClient.makeRequest<Record<string, unknown>[]>(
      `/api/organizations/${orgHash}/compensation-profiles`,
    );
    const list = Array.isArray(res.data) ? res.data.map(normalizeProfile) : [];
    return { ...res, data: res.success ? list : [] };
  }, [orgHash]);

  return useApi<CompensationProfile[]>(
    call,
    [orgHash],
    true,
    enabled && !!orgHash,
    {
      cacheKey: `comp-profiles:${orgHash || "none"}`,
      ttl: PAYROLL_TTL,
      strategy: "stale-while-revalidate",
    },
  );
}

/** POST/PUT hồ sơ lương (upsert theo tutor). Backend chấp nhận POST tạo/cập nhật. */
export function useUpsertCompensationProfile() {
  return useMutation(
    (
      orgHash: string,
      payload: UpsertCompensationProfilePayload,
    ): Promise<ApiResponse> =>
      apiClient.makeRequest(
        `/api/organizations/${orgHash}/compensation-profiles`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      ),
    { invalidateCachePrefixes: ["comp-profiles:"] },
  );
}

// ---- Payroll periods -------------------------------------------------------

function normalizePeriod(p: Record<string, unknown>): PayrollPeriod {
  return {
    id: idOf(p),
    label: p.label as string | undefined,
    period_start: p.period_start as string | undefined,
    period_end: p.period_end as string | undefined,
    month: p.month as string | undefined,
    status: (p.status as PayrollPeriod["status"]) ?? "draft",
    // Backend trả `total_amount` (xem PayrollPeriodResource). Giữ fallback sang
    // total_gross/total_net cho tương thích ngược — thiếu dòng này thì cả 3 kỳ lương
    // đều hiện "Tổng chi 0 đ" dù calculator đã tính đúng.
    total_gross: (p.total_gross ?? p.total_amount) as number | undefined,
    total_net: (p.total_net ?? p.total_amount) as number | undefined,
    items_count: p.items_count as number | undefined,
    computed_at: (p.computed_at as string | null) ?? null,
    calculation_status: (p.calculation_status ?? p.calculation_state) as PayrollPeriod["calculation_status"],
    calculation_error: (p.calculation_error as string | null) ?? null,
    calculation_started_at: (p.calculation_started_at as string | null) ?? null,
    approved_at: (p.approved_at as string | null) ?? null,
    paid_at: (p.paid_at as string | null) ?? null,
    created_at: p.created_at as string | undefined,
    updated_at: p.updated_at as string | undefined,
  };
}

export function usePayrollPeriods(orgHash?: string, enabled = true) {
  const call = useCallback(async (): Promise<ApiResponse<PayrollPeriod[]>> => {
    const res = await apiClient.makeRequest<Record<string, unknown>[]>(
      `/api/organizations/${orgHash}/payroll-periods`,
    );
    const list = Array.isArray(res.data) ? res.data.map(normalizePeriod) : [];
    return { ...res, data: res.success ? list : [] };
  }, [orgHash]);

  return useApi<PayrollPeriod[]>(call, [orgHash], true, enabled && !!orgHash, {
    cacheKey: `payroll-periods:${orgHash || "none"}`,
    ttl: PAYROLL_TTL,
    strategy: "stale-while-revalidate",
  });
}

export function usePayrollPeriod(
  orgHash?: string,
  periodId?: string,
  enabled = true,
) {
  const call = useCallback(async (): Promise<
    ApiResponse<PayrollPeriod | null>
  > => {
    const res = await apiClient.makeRequest<Record<string, unknown>>(
      `/api/organizations/${orgHash}/payroll-periods/${periodId}`,
    );
    return {
      ...res,
      data: res.success && res.data ? normalizePeriod(res.data) : null,
    };
  }, [orgHash, periodId]);

  return useApi<PayrollPeriod | null>(
    call,
    [orgHash, periodId],
    true,
    enabled && !!orgHash && !!periodId,
    {
      cacheKey: `payroll-period:${orgHash || "none"}:${periodId || "none"}`,
      ttl: PAYROLL_TTL,
      strategy: "stale-while-revalidate",
    },
  );
}

const PAY_MODEL_BASE_LABEL: Record<string, string> = {
  fixed_monthly: "Lương cố định tháng",
  per_session: "Thành tiền theo buổi",
  revenue_share: "Thành tiền chia doanh thu",
};

function dmy(d?: unknown): string | null {
  if (typeof d !== "string" || !d.includes("-")) return null;
  const [y, m, day] = d.split("-");
  return y && m && day ? `${day}/${m}/${y}` : null;
}

/**
 * Dựng các dòng chi tiết tính lương từ `computation_breakdown`.
 *
 * Backend trả về MỘT OBJECT mô tả cách tính ({pay_model, window, base_salary} hoặc
 * {rate_per_session, sessions_count}...), KHÔNG phải mảng. Code cũ chỉ nhận mảng nên
 * Array.isArray() luôn false và breakdown thành [] — kết quả là bung phiếu lương ra thì
 * TRỐNG TRƠN, dù dữ liệu tính lương có đủ. Thấy rõ nhất ở kỳ đã trả: lúc đó form điều
 * chỉnh cũng bị ẩn nên chẳng còn gì trong panel.
 *
 * Mỗi mô hình lương có bộ trường riêng, nên phải diễn giải theo pay_model chứ không thể
 * đổ chung.
 */
function breakdownRows(
  raw: unknown,
  item: Record<string, unknown>,
): PayslipBreakdownRow[] {
  if (Array.isArray(raw)) return raw as PayslipBreakdownRow[];
  if (!raw || typeof raw !== "object") return [];

  const b = raw as Record<string, unknown>;
  const model = String(b.pay_model ?? item.pay_model ?? "");
  const rows: PayslipBreakdownRow[] = [];

  const win = b.window as Record<string, unknown> | undefined;
  const from = dmy(win?.from);
  const to = dmy(win?.to);
  if (from && to) {
    rows.push({ label: "Kỳ tính lương", amount: 0, text: `${from} – ${to}` });
  }

  if (model === "fixed_monthly") {
    rows.push({
      label: PAY_MODEL_BASE_LABEL.fixed_monthly,
      amount: Number(b.base_salary ?? item.base_amount ?? 0),
    });
  } else if (model === "per_session") {
    const count = Number(b.sessions_count ?? item.sessions_count ?? 0);
    rows.push({
      label: "Số buổi đã dạy",
      amount: count,
      text: `${count} buổi`,
    });
    rows.push({
      label: "Đơn giá mỗi buổi",
      amount: Number(b.rate_per_session ?? 0),
    });
    rows.push({
      label: PAY_MODEL_BASE_LABEL.per_session,
      amount: Number(item.sessions_amount ?? 0),
    });
  } else if (model === "revenue_share") {
    rows.push({
      label: "Doanh thu cơ sở",
      amount: Number(b.revenue_base ?? item.revenue_base ?? 0),
    });
    const pct = Number(b.revenue_share_pct ?? 0);
    rows.push({ label: "Tỷ lệ chia", amount: pct, text: `${pct}%` });
    rows.push({
      label: PAY_MODEL_BASE_LABEL.revenue_share,
      amount: Number(item.revenue_amount ?? 0),
    });
  }

  return rows;
}

function normalizeItem(it: Record<string, unknown>): PayrollItem {
  const adjustments = Array.isArray(it.adjustments)
    ? (it.adjustments as Record<string, unknown>[]).map((a) => ({
        id: idOf(a),
        type: (a.type as "bonus" | "deduction") ?? "bonus",
        amount: Number(a.amount ?? 0),
        reason: (a.reason as string | null) ?? null,
        created_at: a.created_at as string | undefined,
      }))
    : [];
  // Backend (PayrollItemResource) trả user_id / user_name / gross_amount / computation_breakdown.
  // Không map các tên này thì phiếu lương hiện KHÔNG CÓ TÊN giáo viên và Lương gộp / Thực nhận = 0 đ.
  const grossAmount = Number(it.gross ?? it.gross_amount ?? 0);
  const adjustments_total = Number(it.adjustments_total ?? 0);

  return {
    id: idOf(it),
    tutor_id: (it.tutor_id as string) ?? (it.user_id as string) ?? "",
    tutor_name: (it.tutor_name ?? it.user_name) as string | undefined,
    pay_model: it.pay_model as PayrollItem["pay_model"],
    gross: grossAmount,
    adjustments_total,
    // API chưa trả `net`; thực nhận = lương gộp (gross_amount đã cộng điều chỉnh trong calculator).
    net: (it.net as number | undefined) ?? grossAmount,
    breakdown: breakdownRows(it.breakdown ?? it.computation_breakdown, it),
    adjustments,
    created_at: it.created_at as string | undefined,
  };
}

export function usePayrollItems(
  orgHash?: string,
  periodId?: string,
  enabled = true,
) {
  const call = useCallback(async (): Promise<ApiResponse<PayrollItem[]>> => {
    const res = await apiClient.makeRequest<Record<string, unknown>[]>(
      `/api/organizations/${orgHash}/payroll-periods/${periodId}/items`,
    );
    const list = Array.isArray(res.data) ? res.data.map(normalizeItem) : [];
    return { ...res, data: res.success ? list : [] };
  }, [orgHash, periodId]);

  return useApi<PayrollItem[]>(
    call,
    [orgHash, periodId],
    true,
    enabled && !!orgHash && !!periodId,
    {
      cacheKey: `payroll-items:${orgHash || "none"}:${periodId || "none"}`,
      ttl: PAYROLL_TTL,
      strategy: "stale-while-revalidate",
    },
  );
}

// ---- Period mutations ------------------------------------------------------

export function useCreatePayrollPeriod() {
  return useMutation(
    (
      orgHash: string,
      payload: CreatePayrollPeriodPayload,
    ): Promise<ApiResponse> =>
      apiClient.makeRequest(`/api/organizations/${orgHash}/payroll-periods`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    { invalidateCachePrefixes: ["payroll-periods:"] },
  );
}

function periodAction(action: "compute" | "approve" | "mark-paid" | "cancel") {
  return (orgHash: string, periodId: string): Promise<ApiResponse> =>
    apiClient.makeRequest(
      `/api/organizations/${orgHash}/payroll-periods/${periodId}/${action}`,
      { method: "POST" },
    );
}

export function useComputePayrollPeriod() {
  return useMutation(periodAction("compute"), {
    invalidateCachePrefixes: ["payroll-period", "payroll-items:"],
  });
}
export function useApprovePayrollPeriod() {
  return useMutation(periodAction("approve"), {
    invalidateCachePrefixes: ["payroll-period", "payroll-items:"],
  });
}
export function useMarkPayrollPeriodPaid() {
  return useMutation(periodAction("mark-paid"), {
    invalidateCachePrefixes: ["payroll-period", "payroll-items:"],
  });
}
export function useCancelPayrollPeriod() {
  return useMutation(
    (orgHash: string, periodId: string): Promise<ApiResponse> =>
      apiClient.makeRequest(`/api/organizations/${orgHash}/payroll-periods/${periodId}`, {
        method: "DELETE",
      }),
    { invalidateCachePrefixes: ["payroll-period", "payroll-items:"] },
  );
}

// ---- Adjustments -----------------------------------------------------------

export function useCreatePayrollAdjustment() {
  return useMutation(
    (
      orgHash: string,
      itemId: string,
      payload: CreateAdjustmentPayload,
    ): Promise<ApiResponse> =>
      apiClient.makeRequest(
        `/api/organizations/${orgHash}/payroll-items/${itemId}/adjustments`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      ),
    { invalidateCachePrefixes: ["payroll-items:", "payroll-period"] },
  );
}

// ---- My payslips (member self-service) -------------------------------------

export function useMyPayslips(orgHash?: string, enabled = true) {
  const call = useCallback(async (): Promise<ApiResponse<MyPayslip[]>> => {
    const res = await apiClient.makeRequest<Record<string, unknown>[]>(
      `/api/organizations/${orgHash}/my-payslips`,
    );
    const list = Array.isArray(res.data)
      ? res.data.map((p) => ({
          id: idOf(p),
          period_label: p.period_label as string | undefined,
          period_start: p.period_start as string | undefined,
          period_end: p.period_end as string | undefined,
          amount: Number(p.amount ?? 0),
          breakdown: Array.isArray(p.breakdown)
            ? (p.breakdown as MyPayslip["breakdown"])
            : [],
          paid_at: (p.paid_at as string | null) ?? null,
          status: p.status as MyPayslip["status"],
        }))
      : [];
    return { ...res, data: res.success ? list : [] };
  }, [orgHash]);

  return useApi<MyPayslip[]>(call, [orgHash], true, enabled && !!orgHash, {
    cacheKey: `my-payslips:${orgHash || "none"}`,
    ttl: PAYROLL_TTL,
    strategy: "stale-while-revalidate",
  });
}
