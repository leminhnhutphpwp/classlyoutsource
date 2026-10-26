/**
 * Shared cache-key builders.
 *
 * Every list hook (useClasses, useStudents, …) and every prefetch/warm-up path
 * (login bootstrap, prefetch manager) must build the same cache key from the
 * same filters. The single sort+stringify normalization here guarantees that
 * key order in the filters object can never make two identical requests differ
 * (P1-C: a mismatch meant prefetched results were never read).
 *
 * Rule: always read a key via the exported builder of the hook that owns the
 * dataset (e.g. classesListKey), never hand-roll `prefix:${JSON.stringify(..)}`.
 */

export function buildListKey(prefix: string, filters: Record<string, any> = {}): string {
  const sortedKeys = Object.keys(filters).sort();
  const sortedFilters = sortedKeys.reduce((acc, key) => {
    acc[key] = filters[key];
    return acc;
  }, {} as Record<string, any>);
  return `${prefix}:${JSON.stringify(sortedFilters)}`;
}
