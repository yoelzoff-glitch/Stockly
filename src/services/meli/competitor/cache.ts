import { CompetitorSnapshot } from "./types";

interface CacheEntry {
  snapshot: CompetitorSnapshot;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const cache = new Map<string, CacheEntry>();

function buildCacheKey(tenantId: string | undefined, identifier: string): string {
  const safeTenant = tenantId?.trim() || "anonymous";
  const safeId = identifier.trim().toUpperCase();
  return `${safeTenant}:${safeId}`;
}

/**
 * Gets a cached CompetitorSnapshot if still valid within TTL.
 */
export function getCachedCompetitorSnapshot(
  tenantId: string | undefined,
  identifier: string
): CompetitorSnapshot | null {
  const key = buildCacheKey(tenantId, identifier);
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.snapshot;
}

/**
 * Sets a CompetitorSnapshot in short-term memory cache.
 */
export function setCachedCompetitorSnapshot(
  tenantId: string | undefined,
  identifier: string,
  snapshot: CompetitorSnapshot,
  ttlMs: number = DEFAULT_TTL_MS
): void {
  const key = buildCacheKey(tenantId, identifier);
  cache.set(key, {
    snapshot,
    expiresAt: Date.now() + ttlMs,
  });

  // Keep cache small (max 500 entries)
  if (cache.size > 500) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
}

/**
 * Clears competitor cache (useful in test suites).
 */
export function clearCompetitorCache(): void {
  cache.clear();
}
