import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTenantEntitlements, getDynamicPlanLimits, PlanLimits } from "@/lib/billing/entitlements";
import { consumeQuota, QuotaMetric } from "@/lib/billing/quotaService";
import { logger } from "@/lib/errors/logger";
import * as Sentry from "@sentry/nextjs";

export const PLAN_LIMITS = {
  starter: { ai: 500, auto: 250, wa: 300, pub: 100 },
  pro: { ai: 1500, auto: 800, wa: 1500, pub: 400 },
  ultra: { ai: 5000, auto: 1500, wa: 5000, pub: 1000 },
};

export async function getPlanLimits(): Promise<Record<string, PlanLimits>> {
  return await getDynamicPlanLimits();
}

export async function checkAILimit(tenantId: string): Promise<boolean> {
  const stats = await getUsageStats(tenantId);
  if (!stats) return true;
  return stats.usage.ai_credits_used < stats.limits.ai;
}

export async function checkWhatsAppLimit(tenantId: string): Promise<boolean> {
  const stats = await getUsageStats(tenantId);
  if (!stats) return true;
  return stats.usage.whatsapp_messages_used < stats.limits.wa;
}

export async function checkAutomationLimit(tenantId: string): Promise<boolean> {
  const stats = await getUsageStats(tenantId);
  if (!stats) return true;
  return stats.usage.automation_actions_used < stats.limits.auto;
}

export async function checkPublicationsLimit(tenantId: string): Promise<boolean> {
  const stats = await getUsageStats(tenantId);
  if (!stats) return true;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("products")
    .select("id, sku")
    .eq("tenant_id", tenantId)
    .neq("status", "deleted_from_meli");

  const skus = data?.map((p, idx) => p.sku || `no-sku-${idx}`) || [];
  const uniqueSkuCount = new Set(skus).size;

  return uniqueSkuCount < stats.limits.pub;
}

/**
 * Atomically increments usage using the database ledger RPC function.
 */
export async function incrementUsage(
  tenantId: string,
  type: QuotaMetric,
  amount: number = 1,
  idempotencyKey?: string,
  source?: string
) {
  try {
    const res = await consumeQuota({
      tenantId,
      metric: type,
      amount,
      idempotencyKey,
      source,
    });

    if (res.allowed && res.limit > 0 && res.currentUsage === Math.floor(res.limit * 0.8)) {
      const supabase = createAdminClient();
      await supabase.from("alerts").insert({
        tenant_id: tenantId,
        type: "warning",
        title: "Límite de uso cercano",
        message: `Te queda poco uso disponible para ${type.replace(/_/g, " ")}. Estás al 80% de tu plan.`,
        is_read: false,
      });
    }

    return res;
  } catch (error) {
    Sentry.captureException(error, { extra: { context: "INCREMENT_USAGE", tenantId, type, amount } });
    logger.error("Error incrementing usage atomically", "BILLING");
    return { allowed: true, currentUsage: 0, limit: 0, remaining: 0, duplicate: false };
  }
}

// Retro-compatibilidad
export async function incrementAIUsage(tenantId: string, amount: number = 1, idempotencyKey?: string) {
  return incrementUsage(tenantId, "ai_credits_used", amount, idempotencyKey, "ai_agent");
}

export async function getUsageStats(tenantId: string) {
  const supabase = createAdminClient();
  const currentMonth = new Date().toISOString().slice(0, 7) + "-01";

  const { data: usage } = await supabase
    .from("subscription_usage")
    .select("id, tenant_id, month, ai_credits_used, whatsapp_messages_used, automation_actions_used")
    .eq("tenant_id", tenantId)
    .eq("month", currentMonth)
    .maybeSingle();

  const entitlements = await resolveTenantEntitlements(tenantId);

  return {
    usage: usage || { ai_credits_used: 0, whatsapp_messages_used: 0, automation_actions_used: 0 },
    subscription: {
      plan: entitlements.plan,
      status: entitlements.status,
      expires_at: entitlements.expiresAt,
      pending_plan: entitlements.pendingPlan,
      access_mode: entitlements.accessMode,
      reason: entitlements.reason,
    },
    limits: entitlements.limits,
  };
}
