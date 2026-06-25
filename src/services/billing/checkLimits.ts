import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";
import * as Sentry from "@sentry/nextjs";

export const PLAN_LIMITS = {
  starter: { ai: 500, auto: 250, wa: 300, pub: 100 },
  pro: { ai: 1500, auto: 800, wa: 1500, pub: 400 },
  ultra: { ai: 5000, auto: 1500, wa: 5000, pub: 1000 },
};

// Memory Cache for Database Plan Limits to avoid hammering Supabase on every request
let cachedPlanLimits: Record<string, { ai: number; auto: number; wa: number; pub: number }> | null = null;
let lastCacheUpdate = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

export async function getPlanLimits(): Promise<Record<string, { ai: number; auto: number; wa: number; pub: number }>> {
  const now = Date.now();
  if (cachedPlanLimits && (now - lastCacheUpdate < CACHE_TTL_MS)) {
    return cachedPlanLimits;
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("plans_config")
      .select("*")
      .eq("is_active", true);

    if (error) throw error;

    if (data && data.length > 0) {
      const limits: Record<string, { ai: number; auto: number; wa: number; pub: number }> = {};
      for (const row of data) {
        limits[row.plan_key] = {
          ai: row.ai_credits_limit,
          auto: row.automation_limit,
          wa: row.whatsapp_limit,
          pub: row.publications_limit
        };
      }
      cachedPlanLimits = limits;
      lastCacheUpdate = now;
      return limits;
    }
  } catch (err) {
    console.error("[Billing CheckLimits] Failed to load plans_config from database, falling back to static limits:", err);
  }

  // Fallback to static defaults
  if (!cachedPlanLimits) {
    cachedPlanLimits = PLAN_LIMITS;
    lastCacheUpdate = now;
  }
  return PLAN_LIMITS;
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
    
  return uniqueSkuCount < (stats.limits as any).pub;
}

export async function incrementUsage(
  tenantId: string, 
  type: "ai_credits_used" | "whatsapp_messages_used" | "automation_actions_used",
  amount: number = 1
) {
  const supabase = createAdminClient();
  const currentMonth = new Date().toISOString().slice(0, 7) + "-01"; // YYYY-MM-01

  try {
    const { data: currentUsage } = await supabase
      .from("subscription_usage")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("month", currentMonth)
      .maybeSingle();

    let newValue = amount;
    if (!currentUsage) {
      await supabase.from("subscription_usage").insert({
        tenant_id: tenantId,
        month: currentMonth,
        [type]: amount
      });
    } else {
      newValue = currentUsage[type] + amount;
      await supabase.from("subscription_usage").update({
        [type]: newValue
      }).eq("id", currentUsage.id).eq("tenant_id", tenantId);
    }

    // Check 80% limit
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("tenant_id", tenantId)
      .single();
    
    let planRaw = sub?.plan || "starter";
    if (planRaw === 'business') planRaw = 'ultra';
    const plan = (planRaw as string) || "starter";
    const allPlanLimits = await getPlanLimits();
    const limits = allPlanLimits[plan] || allPlanLimits.starter;
    
    let limit = 0;
    if (type === "ai_credits_used") limit = limits.ai;
    if (type === "whatsapp_messages_used") limit = limits.wa;
    if (type === "automation_actions_used") limit = limits.auto;

    if (limit > 0 && newValue === Math.floor(limit * 0.8)) {
      await supabase.from("alerts").insert({
        tenant_id: tenantId,
        type: "warning",
        title: "Límite de uso cercano",
        message: `Te queda poco uso disponible para ${type.replace(/_/g, " ")}. Estás al 80% de tu plan.`,
        is_read: false
      });
    }
  } catch (error) {
    Sentry.captureException(error, { extra: { context: "INCREMENT_USAGE" } });
    logger.error("Error incrementing usage", "BILLING");
  }
}

// Retro-compatibilidad
export async function incrementAIUsage(tenantId: string, amount: number = 1) {
  return incrementUsage(tenantId, "ai_credits_used", amount);
}

export async function getUsageStats(tenantId: string) {
  const supabase = createAdminClient();
  const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
  
  const { data: usage } = await supabase
    .from("subscription_usage")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("month", currentMonth)
    .maybeSingle();
    
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .single();

  let planRaw = sub?.plan || "starter";
  if (planRaw === 'business') planRaw = 'ultra';
  const plan = (planRaw as string) || "starter";
  const allPlanLimits = await getPlanLimits();
  const limits = allPlanLimits[plan] || allPlanLimits.starter;

  return {
    usage: usage || { ai_credits_used: 0, whatsapp_messages_used: 0, automation_actions_used: 0 },
    subscription: sub || { plan: 'starter', status: 'active' },
    limits
  };
}
