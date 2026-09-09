interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const adsCache = new Map<string, CacheEntry<any>>();

const DEFAULT_TTL_MS = 60 * 1000; // 60 seconds

export function getCachedAdsData<T>(tenantId: string, period: string): T | null {
  const key = `${tenantId}:${period}`;
  const entry = adsCache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    adsCache.delete(key);
    return null;
  }

  return entry.data as T;
}

export function setCachedAdsData<T>(tenantId: string, period: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  const key = `${tenantId}:${period}`;
  adsCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });

  // Simple eviction if map gets too large (> 1000 entries)
  if (adsCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of adsCache.entries()) {
      if (now > v.expiresAt) {
        adsCache.delete(k);
      }
    }
  }
}

export function clearAdsCacheForTenant(tenantId: string): void {
  for (const key of adsCache.keys()) {
    if (key.startsWith(`${tenantId}:`)) {
      adsCache.delete(key);
    }
  }
}

export function clearAllAdsCache(): void {
  adsCache.clear();
}
