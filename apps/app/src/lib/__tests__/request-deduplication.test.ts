import { beforeEach, describe, expect, it } from 'vitest';
import { requestDeduplicationManager } from '@/lib/request-deduplication';
import type { ApiResponse } from '@/lib/api-config';

describe('request-deduplication', () => {
  beforeEach(() => {
    requestDeduplicationManager.clearAll();
  });

  it('dedups two concurrent identical GETs into one in-flight promise', async () => {
    let calls = 0;
    let resolveFn: ((v: ApiResponse<number>) => void) | undefined;
    const requestFn = () => {
      calls++;
      return new Promise<ApiResponse<number>>((resolve) => {
        resolveFn = resolve;
      });
    };

    const p1 = requestDeduplicationManager.request('/classes', requestFn, { method: 'GET' });
    const p2 = requestDeduplicationManager.request('/classes', requestFn, { method: 'GET' });

    // Only one underlying request executed; both callers share it.
    expect(calls).toBe(1);
    expect(requestDeduplicationManager.getPendingCount()).toBe(1);

    resolveFn?.({ success: true, data: 42 });
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual(r2);
    expect(r1.data).toBe(42);
  });

  it('does NOT dedup two concurrent identical POSTs (non-idempotent writes execute separately)', async () => {
    let calls = 0;
    const requestFn = () => {
      calls++;
      return Promise.resolve<ApiResponse<number>>({ success: true, data: calls });
    };

    const body = JSON.stringify({ name: 'Class A' });
    const p1 = requestDeduplicationManager.request('/classes', requestFn, { method: 'POST', body });
    const p2 = requestDeduplicationManager.request('/classes', requestFn, { method: 'POST', body });

    // Both intentional creates ran; the second was NOT silently dropped.
    expect(calls).toBe(2);
    // POSTs bypass the pending map entirely.
    expect(requestDeduplicationManager.getPendingCount()).toBe(0);

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.data).toBe(1);
    expect(r2.data).toBe(2);
  });
});
