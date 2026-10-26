"use client";

type CacheEntry<T> = {
  data: T | null;
  expiry: number;
  /** Epoch ms when this entry was written — used to skip background revalidation
   *  right after the login bootstrap wrote it (see useApi). */
  writtenAt: number;
};

const cacheStore = new Map<string, CacheEntry<any>>();
const STORAGE_PREFIX = 'clientCache:';

// P2-C: Cap the in-memory cache to avoid unbounded growth. Every distinct
// filter/search combo creates a new entry, so without a cap the Map (and the
// sessionStorage mirror, which has a ~5MB quota) grows forever. We evict the
// least-recently-used entry once we exceed the cap.
const MAX_CACHE_ENTRIES = 200;

// P1-D: Namespace every cache key by the current user id so that user B can
// never read an entry written for user A, regardless of how the session was
// established. The auth flow calls setCacheUser() on login/logout.
const USER_ID_KEY = 'cache:user_id';
let activeCacheUserId: string | null = null;

function getNamespaceUserId(): string {
  if (activeCacheUserId !== null) return activeCacheUserId;
  const stored = getCurrentUserId();
  return stored !== null ? stored : 'anon';
}

/**
 * Namespaced key used for both the in-memory Map and sessionStorage.
 * A read for user B therefore targets a different physical key than user A.
 */
function nsKey(key: string): string {
  return `u:${getNamespaceUserId()}:${key}`;
}

const withStorage = <T>(fn: (storage: Storage) => T): T | null => {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    return fn(window.sessionStorage);
  } catch {
    return null;
  }
};

function readFromStorage<T>(key: string): CacheEntry<T> | null {
  return withStorage((storage) => {
    const raw = storage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as CacheEntry<T>;
      if (Date.now() > parsed.expiry) {
        storage.removeItem(`${STORAGE_PREFIX}${key}`);
        return null;
      }
      // Rehydrate in-memory store for faster subsequent lookups
      touch(key, parsed);
      return parsed;
    } catch {
      storage.removeItem(`${STORAGE_PREFIX}${key}`);
      return null;
    }
  });
}

function writeToStorage<T>(key: string, entry: CacheEntry<T>) {
  withStorage((storage) => {
    storage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(entry));
  });
}

function removeFromStorage(key: string) {
  withStorage((storage) => {
    storage.removeItem(`${STORAGE_PREFIX}${key}`);
  });
}

/**
 * Insert/refresh an entry and mark it as most-recently-used.
 * Map preserves insertion order, so deleting + re-setting moves the key to the
 * end; the first key returned by keys() is therefore the LRU entry.
 */
function touch<T>(key: string, entry: CacheEntry<T>) {
  cacheStore.delete(key);
  cacheStore.set(key, entry);
  enforceLimit();
}

function enforceLimit() {
  while (cacheStore.size > MAX_CACHE_ENTRIES) {
    const oldest = cacheStore.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    cacheStore.delete(oldest);
    removeFromStorage(oldest);
  }
}

export function getCachedValue<T>(key: string): T | null {
  const k = nsKey(key);
  const entry = cacheStore.get(k) || readFromStorage<T>(k);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cacheStore.delete(k);
    removeFromStorage(k);
    return null;
  }
  // Mark as recently used for LRU ordering.
  touch(k, entry);
  return entry.data as T;
}

export function setCachedValue<T>(key: string, data: T | null, ttlMs: number) {
  const k = nsKey(key);
  const entry: CacheEntry<T> = {
    data,
    expiry: Date.now() + Math.max(ttlMs, 1000),
    writtenAt: Date.now(),
  };
  touch(k, entry);
  writeToStorage(k, entry);
}

/**
 * True if a cache entry exists and was written within `maxAgeMs`. Used to skip
 * background revalidation for data the login bootstrap just fetched — the
 * entry is by definition current, so refetching it on the landing page only
 * duplicates work (the old code refired 14–28 dashboard requests on mount).
 */
export function isCacheEntryFresh(key: string, maxAgeMs: number = 60_000): boolean {
  const k = nsKey(key);
  const entry = cacheStore.get(k) || readFromStorage<unknown>(k);
  if (!entry) return false;
  return Date.now() - entry.writtenAt <= maxAgeMs;
}

export function invalidateClientCache(keys?: string | string[]) {
  if (!keys) {
    cacheStore.clear();
    withStorage((storage) => {
      Object.keys(storage)
        .filter((k) => k.startsWith(STORAGE_PREFIX))
        .forEach((k) => storage.removeItem(k));
    });
    return;
  }

  const keyList = Array.isArray(keys) ? keys : [keys];
  keyList.forEach((key) => {
    const k = nsKey(key);
    cacheStore.delete(k);
    removeFromStorage(k);
  });
}

export function invalidateCacheByPrefix(prefix: string) {
  const normalizedPrefix = nsKey(prefix.trim());
  cacheStore.forEach((_, key) => {
    if (key.startsWith(normalizedPrefix)) {
      cacheStore.delete(key);
      removeFromStorage(key);
    }
  });
  withStorage((storage) => {
    Object.keys(storage)
      .filter((k) => k.startsWith(`${STORAGE_PREFIX}${normalizedPrefix}`))
      .forEach((k) => storage.removeItem(k));
  });
}

export function getCacheStats() {
  return {
    size: cacheStore.size,
    keys: Array.from(cacheStore.keys()),
  };
}

/**
 * Lưu user_id hiện tại để so sánh khi login
 */
export function setCurrentUserId(userId: string | number | null) {
  if (typeof window === 'undefined') return;
  try {
    if (userId === null) {
      sessionStorage.removeItem(USER_ID_KEY);
    } else {
      sessionStorage.setItem(USER_ID_KEY, String(userId));
    }
  } catch {
    // Silent fail
  }
}

/**
 * Lấy user_id hiện tại từ cache
 */
export function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(USER_ID_KEY);
  } catch {
    return null;
  }
}

/**
 * Set the user that all subsequent cache keys are namespaced under.
 * Called by the auth flow on login (with the user id) and logout (with null).
 * Passing null falls back to the "anon" namespace.
 */
export function setCacheUser(userId: string | number | null) {
  activeCacheUserId = userId !== null && userId !== undefined ? String(userId) : null;
  setCurrentUserId(userId);
}

/**
 * Kiểm tra và xóa cache nếu user_id thay đổi
 * Chỉ xóa cache khi user_id thay đổi, không xóa khi logout
 */
export function checkAndClearCacheIfUserChanged(newUserId: string | number | null): boolean {
  const currentUserId = getCurrentUserId();
  const newUserIdStr = newUserId ? String(newUserId) : null;

  // Nếu user_id thay đổi, xóa toàn bộ cache
  if (currentUserId !== null && currentUserId !== newUserIdStr) {
    invalidateClientCache();
    setCacheUser(newUserIdStr);
    return true; // Cache đã bị xóa
  }

  // Cập nhật user_id mới (đồng thời set namespace hiện tại)
  setCacheUser(newUserIdStr);
  return false; // Cache không bị xóa
}
