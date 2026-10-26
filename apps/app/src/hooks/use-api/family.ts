'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Parent portal data hooks.
 *
 * These call the BFF same-origin (`/api/parent/...`), which the generic
 * catch-all route proxies to Laravel `/api/v1/parent/...` with the parent's
 * HttpOnly auth cookie attached server-side. Kept as lightweight fetch hooks
 * (no shared client cache) since the parent surface is small and read-mostly.
 */

export type Child = {
  id: string;
  name: string;
  avatar?: string | null;
  tutor_name?: string | null;
  class_count?: number;
  outstanding_tuition?: number;
  portal_enabled?: boolean;
};

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type PendingTuition = {
  id: string;
  amount: number;
  due_date?: string | null;
  month?: string | null;
  class_name?: string | null;
  reference_code?: string | null;
};

export type TuitionSummary = {
  outstanding_total: number;
  pending: PendingTuition[];
};

export type PaymentIntent = {
  amount: number;
  reference_code: string;
  transfer_content: string;
  bank: {
    bank_name?: string;
    account_number?: string;
    account_name?: string;
    account_holder?: string;
    branch?: string | null;
    qr_code_url?: string | null;
    instructions?: string;
    transfer_content?: string;
  } | null;
  note?: string | null;
};

async function fetchJson(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { Accept: 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok || (json && json.success === false)) {
    throw new Error(json?.message || 'Không thể tải dữ liệu. Vui lòng thử lại.');
  }
  return json;
}

function buildQuery(params?: Record<string, unknown>): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.append(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/** List the signed-in parent's children. */
export function useChildren() {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await fetchJson('/api/parent/children');
      setChildren(json?.data?.children ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải danh sách học viên.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { children, loading, error, refetch: load };
}

/** Find a single child (from the parent's children list) by hashid. */
export function useChild(studentId?: string) {
  const { children, loading, error, refetch } = useChildren();
  const child = useMemo(
    () => children.find((c) => c.id === studentId) ?? null,
    [children, studentId]
  );
  return { child, loading, error, refetch };
}

/**
 * Generic paginated child resource:
 * grades | attendance | schedule | assignments.
 */
export function useChildResource<T = any>(
  studentId: string | undefined,
  resource: 'grades' | 'attendance' | 'schedule' | 'assignments',
  params?: Record<string, unknown>,
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled ?? true;
  const [data, setData] = useState<T[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => buildQuery(params), [params]);

  const load = useCallback(async () => {
    if (!enabled || !studentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const json = await fetchJson(`/api/parent/children/${studentId}/${resource}${query}`);
      setData(Array.isArray(json?.data) ? json.data : []);
      setMeta(json?.meta ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải dữ liệu.');
    } finally {
      setLoading(false);
    }
  }, [enabled, studentId, resource, query]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, meta, loading, error, refetch: load };
}

/** Child tuition summary: outstanding total + pending payments. */
export function useChildTuition(studentId: string | undefined, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const [data, setData] = useState<TuitionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !studentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const json = await fetchJson(`/api/parent/children/${studentId}/tuition`);
      setData({
        outstanding_total: json?.data?.outstanding_total ?? 0,
        pending: json?.data?.pending ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải thông tin học phí.');
    } finally {
      setLoading(false);
    }
  }, [enabled, studentId]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load };
}

/** Create a bank-transfer intent for a pending payment. */
export async function createParentPaymentIntent(paymentId: string): Promise<PaymentIntent> {
  const json = await fetchJson(`/api/parent/payments/${paymentId}/intent`, { method: 'POST' });
  return json.data as PaymentIntent;
}
