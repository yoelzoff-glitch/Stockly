import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";
import * as Sentry from "@sentry/nextjs";

export const PLAN_LIMITS = {
  starter: { ai: 500, auto: 250, wa: 300 },
  pro: { ai: 1500, auto: 500, wa: 1500 },
  ultra: { ai: 5000, auto: 2000, wa: 5000 },
};

export async function checkAILimit(tenantId: string): Promise<boolean> {
  const stats = await getUsageStats(tenantId);
  if (!stats) return true;
  return stats.usage.ai_credits_used < stats.limits.ai;
}

export async function incrementUsage(
  tenantId: string, 
  type: "ai_credits_used" | "whatsapp_messages_used" | "automation_actions_used"
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

    let newValue = 1;
    if (!currentUsage) {
      await supabase.from("subscription_usage").insert({
        tenant_id: tenantId,
        month: currentMonth,
        [type]: 1
      });
    } else {
      newValue = currentUsage[type] + 1;
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
    let plan = (planRaw as keyof typeof PLAN_LIMITS) || "starter";
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
    
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
export async function incrementAIUsage(tenantId: string) {
  return incrementUsage(tenantId, "ai_credits_used");
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
  let plan = (planRaw as keyof typeof PLAN_LIMITS) || "starter";
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;

  return {
    usage: usage || { ai_credits_used: 0, whatsapp_messages_used: 0, automation_actions_used: 0 },
    subscription: sub || { plan: 'starter', status: 'active' },
    limits
  };
}
