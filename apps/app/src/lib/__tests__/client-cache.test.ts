import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCachedValue,
  setCachedValue,
  invalidateClientCache,
  getCacheStats,
  setCacheUser,
} from '@/lib/client-cache';

describe('client-cache', () => {
  beforeEach(() => {
    // Reset shared module state between tests.
    setCacheUser(null);
    invalidateClientCache();
    try {
      sessionStorage.clear();
    } catch {
      /* noop */
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('P1-D: per-user namespacing (no cross-user bleed)', () => {
    it('does not return user A value when switched to user B', () => {
      setCacheUser('A');
      setCachedValue('classes:list:{}', 'valueForA', 60_000);
      expect(getCachedValue('classes:list:{}')).toBe('valueForA');

      // Switch to user B: A's entry must be invisible.
      setCacheUser('B');
      expect(getCachedValue('classes:list:{}')).toBeNull();

      // B writes its own value; A's is untouched.
      setCachedValue('classes:list:{}', 'valueForB', 60_000);
      expect(getCachedValue('classes:list:{}')).toBe('valueForB');

      // Switch back to A: original value still readable.
      setCacheUser('A');
      expect(getCachedValue('classes:list:{}')).toBe('valueForA');
    });
  });

  describe('P2-C: bounded size with LRU eviction', () => {
    it('caps the store and evicts the oldest entries on insert past the cap', () => {
      setCacheUser('cap');
      const TOTAL = 260;
      for (let i = 0; i < TOTAL; i++) {
        setCachedValue(`key:${i}`, i, 60_000);
      }

      // Stays bounded at the 200-entry cap.
      expect(getCacheStats().size).toBe(200);

      // Oldest inserted entry evicted, most recent retained (LRU).
      expect(getCachedValue('key:0')).toBeNull();
      expect(getCachedValue(`key:${TOTAL - 1}`)).toBe(TOTAL - 1);
    });
  });

  describe('TTL expiry still works', () => {
    it('returns null after the entry expires', () => {
      const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000);
      setCacheUser('ttl');
      setCachedValue('short', 'value', 1_000); // expiry = 1000 + 1000 = 2000

      expect(getCachedValue('short')).toBe('value');

      // Advance past expiry.
      nowSpy.mockReturnValue(5_000);
      expect(getCachedValue('short')).toBeNull();
    });
  });
});
