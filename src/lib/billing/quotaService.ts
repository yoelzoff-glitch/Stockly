import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";
import { resolveTenantEntitlements } from "./entitlements";
import * as Sentry from "@sentry/nextjs";

export type QuotaMetric = "ai_credits_used" | "whatsapp_messages_used" | "automation_actions_used";

export interface ConsumeQuotaParams {
  tenantId: string;
  metric: QuotaMetric;
  amount?: number;
  idempotencyKey?: string;
  source?: string;
  correlationId?: string;
}

export interface QuotaResult {
  allowed: boolean;
  currentUsage: number;
  limit: number;
  remaining: number;
  duplicate: boolean;
}

/**
 * Checks if billing_webhook_v2 flag is active for the tenant.
 */
export async function isBillingV2Enabled(tenantId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("tenant_feature_flags")
      .select("enabled")
      .eq("tenant_id", tenantId)
      .eq("flag_key", "billing_webhook_v2")
      .maybeSingle();

    return data?.enabled === true;
  } catch (_) {
    return false;
  }
}

/**
 * Consumes quota using atomic database RPC function `consume_tenant_quota`.
 * Supports shadow mode when `billing_webhook_v2` is disabled.
 */
export async function consumeQuota(params: ConsumeQuotaParams): Promise<QuotaResult> {
  const { tenantId, metric, amount = 1, idempotencyKey, source, correlationId } = params;
  const supabase = createAdminClient();

  try {
    const { data, error } = await supabase.rpc("consume_tenant_quota", {
      p_tenant_id: tenantId,
      p_metric: metric,
      p_amount: amount,
      p_idempotency_key: idempotencyKey || null,
      p_source: source || "api",
      p_correlation_id: correlationId || null,
    });

    if (error) {
      throw error;
    }

    const result = data as any;
    const allowed = result?.allowed === true;
    const currentUsage = Number(result?.current_usage || 0);
    const limit = Number(result?.limit || 0);
    const remaining = Number(result?.remaining || 0);
    const duplicate = result?.duplicate === true;

    // Check shadow mode
    const v2Active = await isBillingV2Enabled(tenantId);
    if (!v2Active) {
      logger.info({
        event: "BILLING_V2_SHADOW_MODE_EVALUATION",
        tenantId,
        metric,
        amount,
        allowed,
        currentUsage,
        limit,
        remaining,
        duplicate,
        correlationId,
      });
    }

    return {
      allowed,
      currentUsage,
      limit,
      remaining,
      duplicate,
    };
  } catch (err: any) {
    logger.error({
      event: "CONSUME_QUOTA_ERROR",
      tenantId,
      metric,
      amount,
      error: err?.message,
      correlationId,
    });
    Sentry.captureException(err, { extra: { tenantId, metric, amount, context: "consumeQuota" } });

    // Fallback: check entitlements without failing-open silently
    try {
      const entitlements = await resolveTenantEntitlements(tenantId);
      const metricLimitKey = metric === "ai_credits_used" ? "ai" : metric === "whatsapp_messages_used" ? "wa" : "auto";
      const limit = entitlements.limits[metricLimitKey] || 0;

      return {
        allowed: entitlements.accessMode === "active" || entitlements.accessMode === "grace",
        currentUsage: 0,
        limit,
        remaining: limit,
        duplicate: false,
      };
    } catch {
      return {
        allowed: false,
        currentUsage: 0,
        limit: 0,
        remaining: 0,
        duplicate: false,
      };
    }
  }
}
