'use client';

import { useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/lib/api-config';
import type {
  PnlReport,
  TutorProfitabilityReport,
  CashflowReport,
  PayablesReport,
  PayableExpenseRow,
  ReceivablesReport,
  OrgExpense,
  CreateExpensePayload,
  ExpenseFilters,
  AiUsageReport,
} from '@/types/org-finance';
import { useApi, useMutation } from './core';

/**
 * Wave 5 — Tài chính trung tâm. Gọi backend qua BFF cùng-origin:
 * - Báo cáo: `/api/reports/finance/*` (org suy ra từ user đăng nhập).
 * - Chi phí & AI usage: `/api/organizations/{orgHash}/*`.
 * Route catch-all forward sang Laravel `/api/v1/...`. Không cần route handler riêng.
 */

const FIN_TTL = 60 * 1000; // 1 phút

function buildRange(dateFrom?: string, dateTo?: string): string {
  const qs = new URLSearchParams();
  if (dateFrom) qs.set('date_from', dateFrom);
  if (dateTo) qs.set('date_to', dateTo);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

type FinanceReport = 'pnl' | 'tutor-profitability' | 'cashflow' | 'payables' | 'receivables';

/** URL tải CSV (dùng cho DownloadButton). Trình duyệt gọi cùng-origin, cookie tự đính kèm. */
export function financeExportUrl(
  report: Exclude<FinanceReport, 'receivables'>,
  dateFrom?: string,
  dateTo?: string
): string {
  const qs = new URLSearchParams({ format: 'csv' });
  if (dateFrom) qs.set('date_from', dateFrom);
  if (dateTo) qs.set('date_to', dateTo);
  return `/api/reports/finance/${report}/export?${qs.toString()}`;
}

// ---- Report reads ----------------------------------------------------------

export function useFinancePnl(dateFrom?: string, dateTo?: string, enabled = true) {
  const call = useCallback(
    () => apiClient.makeRequest<PnlReport>(`/api/reports/finance/pnl${buildRange(dateFrom, dateTo)}`),
    [dateFrom, dateTo]
  );
  return useApi<PnlReport>(call, [dateFrom, dateTo], true, enabled, {
    cacheKey: `finance:pnl:${dateFrom || ''}:${dateTo || ''}`,
    ttl: FIN_TTL,
    strategy: 'stale-while-revalidate',
  });
}

export function useFinanceTutorProfitability(dateFrom?: string, dateTo?: string, enabled = true) {
  const call = useCallback(
    () =>
      apiClient.makeRequest<TutorProfitabilityReport>(
        `/api/reports/finance/tutor-profitability${buildRange(dateFrom, dateTo)}`
      ),
    [dateFrom, dateTo]
  );
  return useApi<TutorProfitabilityReport>(call, [dateFrom, dateTo], true, enabled, {
    cacheKey: `finance:tutor-profitability:${dateFrom || ''}:${dateTo || ''}`,
    ttl: FIN_TTL,
    strategy: 'stale-while-revalidate',
  });
}

export function useFinanceCashflow(dateFrom?: string, dateTo?: string, enabled = true) {
  const call = useCallback(
    () =>
      apiClient.makeRequest<CashflowReport>(
        `/api/reports/finance/cashflow${buildRange(dateFrom, dateTo)}`
      ),
    [dateFrom, dateTo]
  );
  return useApi<CashflowReport>(call, [dateFrom, dateTo], true, enabled, {
    cacheKey: `finance:cashflow:${dateFrom || ''}:${dateTo || ''}`,
    ttl: FIN_TTL,
    strategy: 'stale-while-revalidate',
  });
}

export function useFinancePayables(dateFrom?: string, dateTo?: string, enabled = true) {
  const call = useCallback(async (): Promise<ApiResponse<PayablesReport | null>> => {
    const res = await apiClient.makeRequest<PayablesReport>(
      `/api/reports/finance/payables${buildRange(dateFrom, dateTo)}`
    );
    if (!res.success || !res.data) return { ...res, data: null };
    // Chuẩn hoá `_id` → `id` cho danh sách chi phí.
    const rawExpenses = res.data.expenses as unknown as Record<string, unknown>[] | undefined;
    const expenses: PayableExpenseRow[] = Array.isArray(rawExpenses)
      ? rawExpenses.map((e) => ({
          id: (e.id as string) ?? (e._id as string) ?? '',
          category: (e.category as string) ?? 'other',
          amount: Number(e.amount ?? 0),
          expense_date: e.expense_date as string | undefined,
          description: e.description as string | undefined,
        }))
      : [];
    return { ...res, data: { ...res.data, expenses } };
  }, [dateFrom, dateTo]);
  return useApi<PayablesReport | null>(call, [dateFrom, dateTo], true, enabled, {
    cacheKey: `finance:payables:${dateFrom || ''}:${dateTo || ''}`,
    ttl: FIN_TTL,
    strategy: 'stale-while-revalidate',
  });
}

export function useFinanceReceivables(dateFrom?: string, dateTo?: string, enabled = true) {
  const call = useCallback(
    () =>
      apiClient.makeRequest<ReceivablesReport>(
        `/api/reports/finance/receivables${buildRange(dateFrom, dateTo)}`
      ),
    [dateFrom, dateTo]
  );
  return useApi<ReceivablesReport>(call, [dateFrom, dateTo], true, enabled, {
    cacheKey: `finance:receivables:${dateFrom || ''}:${dateTo || ''}`,
    ttl: FIN_TTL,
    strategy: 'stale-while-revalidate',
  });
}

// ---- Expenses --------------------------------------------------------------

function normalizeExpense(e: Record<string, unknown>): OrgExpense {
  return {
    id: (e.id as string) ?? (e._id as string) ?? '',
    category: (e.category as string) ?? 'other',
    amount: Number(e.amount ?? 0),
    expense_date: (e.expense_date as string) ?? '',
    description: (e.description as string | null) ?? null,
    class_id: (e.class_id as string | null) ?? null,
    tutor_id: (e.tutor_id as string | null) ?? null,
    payment_method: (e.payment_method as string | null) ?? null,
    created_at: e.created_at as string | undefined,
    updated_at: e.updated_at as string | undefined,
  };
}

export function useOrgExpenses(orgHash?: string, filters?: ExpenseFilters, enabled = true) {
  const { category, date_from, date_to } = filters ?? {};
  const call = useCallback(async (): Promise<ApiResponse<OrgExpense[]>> => {
    const qs = new URLSearchParams();
    if (category) qs.set('category', category);
    if (date_from) qs.set('date_from', date_from);
    if (date_to) qs.set('date_to', date_to);
    const q = qs.toString();
    const res = await apiClient.makeRequest<Record<string, unknown>[]>(
      `/api/organizations/${orgHash}/expenses${q ? `?${q}` : ''}`
    );
    const list = Array.isArray(res.data) ? res.data.map(normalizeExpense) : [];
    return { ...res, data: res.success ? list : [] };
  }, [orgHash, category, date_from, date_to]);

  return useApi<OrgExpense[]>(call, [orgHash, category, date_from, date_to], true, enabled && !!orgHash, {
    cacheKey: `org-expenses:${orgHash || 'none'}:${category || ''}:${date_from || ''}:${date_to || ''}`,
    ttl: FIN_TTL,
    strategy: 'stale-while-revalidate',
  });
}

export function useCreateOrgExpense() {
  return useMutation(
    (orgHash: string, payload: CreateExpensePayload): Promise<ApiResponse> =>
      apiClient.makeRequest(`/api/organizations/${orgHash}/expenses`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    { invalidateCachePrefixes: ['org-expenses:', 'finance:'] }
  );
}

export function useUpdateOrgExpense() {
  return useMutation(
    (orgHash: string, expenseId: string, payload: Partial<CreateExpensePayload>): Promise<ApiResponse> =>
      apiClient.makeRequest(`/api/organizations/${orgHash}/expenses/${expenseId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    { invalidateCachePrefixes: ['org-expenses:', 'finance:'] }
  );
}

export function useDeleteOrgExpense() {
  return useMutation(
    (orgHash: string, expenseId: string): Promise<ApiResponse> =>
      apiClient.makeRequest(`/api/organizations/${orgHash}/expenses/${expenseId}`, {
        method: 'DELETE',
      }),
    { invalidateCachePrefixes: ['org-expenses:', 'finance:'] }
  );
}

// ---- AI usage --------------------------------------------------------------

export function useOrgAiUsage(orgHash?: string, enabled = true) {
  const call = useCallback(
    () => apiClient.makeRequest<AiUsageReport>(`/api/organizations/${orgHash}/ai-usage`),
    [orgHash]
  );
  return useApi<AiUsageReport>(call, [orgHash], true, enabled && !!orgHash, {
    cacheKey: `org-ai-usage:${orgHash || 'none'}`,
    ttl: FIN_TTL,
    strategy: 'stale-while-revalidate',
  });
}
