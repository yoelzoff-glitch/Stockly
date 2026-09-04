import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";
import { isFeatureFlagEnabled } from "@/lib/safety/featureFlags";

export type RateLimitCategory =
  | "ai_chat"
  | "sync_manual"
  | "profitability_calc"
  | "workflows_exec"
  | "sales_export"
  | "meli_write";

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

export const RATE_LIMIT_CONFIGS: Record<RateLimitCategory, RateLimitConfig> = {
  ai_chat: { maxRequests: 30, windowSeconds: 60 }, // 30 requests / min
  sync_manual: { maxRequests: 5, windowSeconds: 60 }, // 5 manual syncs / min
  profitability_calc: { maxRequests: 10, windowSeconds: 60 }, // 10 recalculations / min
  workflows_exec: { maxRequests: 20, windowSeconds: 60 }, // 20 workflow executions / min
  sales_export: { maxRequests: 6, windowSeconds: 60 }, // 6 exports / min
  meli_write: { maxRequests: 60, windowSeconds: 60 }, // 60 writes / min
};

export interface RateLimitCheckResult {
  allowed: boolean;
  wouldBlock: boolean;
  current: number;
  limit: number;
  remaining: number;
  retryAfter: number;
  resetInSeconds: number;
  isShadowMode: boolean;
}

/**
 * Checks distributed rate limits for a given tenant and category.
 * Respects `api_rate_limits_v2` feature flag: runs in shadow mode if disabled.
 */
export async function checkRateLimit(
  tenantId: string,
  category: RateLimitCategory,
  cost: number = 1,
  customClient?: any
): Promise<RateLimitCheckResult> {
  const config = RATE_LIMIT_CONFIGS[category];
  const supabase = customClient || createAdminClient();

  // Check if feature flag is active
  const isEnforced = await isFeatureFlagEnabled(tenantId, "api_rate_limits_v2");
  const isShadowMode = !isEnforced;

  try {
    const { data, error } = await supabase.rpc("check_rate_limit_bucket", {
      p_tenant_id: tenantId,
      p_bucket_key: category,
      p_max_requests: config.maxRequests,
      p_window_seconds: config.windowSeconds,
      p_cost: cost,
    });

    if (error || !data) {
      logger.warn({
        event: "RATE_LIMIT_CHECK_ERROR",
        tenantId,
        category,
        error: error?.message,
      });
      // Fail-open for availability with monitoring log
      return {
        allowed: true,
        wouldBlock: false,
        current: 0,
        limit: config.maxRequests,
        remaining: config.maxRequests,
        retryAfter: 0,
        resetInSeconds: config.windowSeconds,
        isShadowMode,
      };
    }

    const wouldBlock = !Boolean(data.allowed);
    const allowed = isShadowMode ? true : Boolean(data.allowed);

    if (wouldBlock) {
      logger.warn({
        event: isShadowMode ? "RATE_LIMIT_SHADOW_WOULD_BLOCK" : "RATE_LIMIT_EXCEEDED",
        tenantId,
        category,
        current: data.current,
        limit: data.limit,
        retryAfter: data.retry_after,
        isShadowMode,
      });
    }

    return {
      allowed,
      wouldBlock,
      current: Number(data.current),
      limit: Number(data.limit),
      remaining: Number(data.remaining),
      retryAfter: Number(data.retry_after),
      resetInSeconds: Number(data.reset_in_seconds),
      isShadowMode,
    };
  } catch (err: any) {
    logger.error({
      event: "RATE_LIMIT_CHECK_EXCEPTION",
      tenantId,
      category,
      error: err?.message,
    });
    return {
      allowed: true,
      wouldBlock: false,
      current: 0,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      retryAfter: 0,
      resetInSeconds: config.windowSeconds,
      isShadowMode,
    };
  }
}
