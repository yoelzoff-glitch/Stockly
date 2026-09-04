import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type FeatureFlagKey =
  | "strict_tenant_authorization"
  | "meli_client_v2"
  | "meli_webhook_queue_only"
  | "inventory_atomic_v2"
  | "strict_webhook_validation"
  | "billing_webhook_v2"
  | "api_rate_limits_v2"
  | "dashboard_aggregates_v2";

interface CachedFlagEntry {
  enabled: boolean;
  configuration: Record<string, any>;
  cachedAt: number;
}

// In-memory bounded cache: key format `${tenantId}:${flagKey}`
const flagCache = new Map<string, CachedFlagEntry>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds
const MAX_CACHE_SIZE = 1000;

function cleanCacheIfFull() {
  if (flagCache.size > MAX_CACHE_SIZE) {
    const now = Date.now();
    for (const [k, v] of flagCache.entries()) {
      if (now - v.cachedAt > CACHE_TTL_MS) {
        flagCache.delete(k);
      }
    }
    // If still oversized, clear half oldest
    if (flagCache.size > MAX_CACHE_SIZE) {
      let count = 0;
      for (const k of flagCache.keys()) {
        flagCache.delete(k);
        count++;
        if (count >= MAX_CACHE_SIZE / 2) break;
      }
    }
  }
}

/**
 * Invalidates the in-memory feature flags cache.
 * If tenantId is provided, only entries for that tenant are evicted.
 */
export function invalidateFeatureFlagCache(tenantId?: string): void {
  if (!tenantId) {
    flagCache.clear();
    return;
  }
  for (const key of flagCache.keys()) {
    if (key.startsWith(`${tenantId}:`)) {
      flagCache.delete(key);
    }
  }
}

/**
 * Retrieves whether a specific feature flag is enabled for a given tenant.
 * Safely defaults to `false` if the table does not exist, an error occurs, or the flag is absent.
 */
export async function isFeatureFlagEnabled(
  tenantId: string | null | undefined,
  flagKey: FeatureFlagKey,
  customClient?: any
): Promise<boolean> {
  if (!tenantId || !flagKey) {
    return false;
  }

  const cacheKey = `${tenantId}:${flagKey}`;
  const cached = flagCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached.enabled;
  }

  try {
    const supabase = customClient || createAdminClient();
    const { data, error } = await supabase
      .from("tenant_feature_flags")
      .select("enabled, configuration")
      .eq("tenant_id", tenantId)
      .eq("flag_key", flagKey)
      .maybeSingle();

    if (error) {
      // Return false on table not existing or query error without throwing
      return false;
    }

    const enabled = Boolean(data?.enabled);
    const configuration = (data?.configuration as Record<string, any>) || {};

    cleanCacheIfFull();
    flagCache.set(cacheKey, {
      enabled,
      configuration,
      cachedAt: now,
    });

    return enabled;
  } catch {
    // Non-blocking fallback
    return false;
  }
}

/**
 * Retrieves the JSON configuration object of a feature flag for a given tenant.
 */
export async function getFeatureFlagConfig<T = Record<string, any>>(
  tenantId: string | null | undefined,
  flagKey: FeatureFlagKey,
  customClient?: any
): Promise<T | null> {
  if (!tenantId || !flagKey) {
    return null;
  }

  const cacheKey = `${tenantId}:${flagKey}`;
  const cached = flagCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return (cached.configuration as T) || null;
  }

  try {
    const supabase = customClient || createAdminClient();
    const { data, error } = await supabase
      .from("tenant_feature_flags")
      .select("enabled, configuration")
      .eq("tenant_id", tenantId)
      .eq("flag_key", flagKey)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const enabled = Boolean(data.enabled);
    const configuration = (data.configuration as Record<string, any>) || {};

    cleanCacheIfFull();
    flagCache.set(cacheKey, {
      enabled,
      configuration,
      cachedAt: now,
    });

    return (configuration as T) || null;
  } catch {
    return null;
  }
}
