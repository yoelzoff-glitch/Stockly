import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";

export async function checkAILimit(tenantId: string): Promise<boolean> {
  const supabase = createAdminClient();
  try {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan, status")
      .eq("tenant_id", tenantId)
      .single();

    if (sub?.plan === 'business' && sub?.status === 'active') return true;

    const { data: usage } = await supabase
      .from("subscription_usage")
      .select("ai_requests_used, ai_requests_limit")
      .eq("tenant_id", tenantId)
      .single();

    if (!usage) return true; // Fail open if no record yet

    return usage.ai_requests_used < usage.ai_requests_limit;
  } catch (error) {
    logger.error("Error checking AI limits", "BILLING");
    return true; // Fail open on db error
  }
}

export async function incrementAIUsage(tenantId: string) {
  const supabase = createAdminClient();
  try {
    const { data: usage } = await supabase
      .from("subscription_usage")
      .select("ai_requests_used")
      .eq("tenant_id", tenantId)
      .single();

    if (usage) {
      await supabase.from("subscription_usage").update({
        ai_requests_used: usage.ai_requests_used + 1
      }).eq("tenant_id", tenantId);
    }
  } catch (error) {
    logger.error("Error incrementing AI usage", "BILLING");
  }
}

export async function getUsageStats(tenantId: string) {
  const supabase = createAdminClient();
  const { data: usage } = await supabase
    .from("subscription_usage")
    .select("*")
    .eq("tenant_id", tenantId)
    .single();
    
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .single();

  return {
    usage: usage || { ai_requests_used: 0, ai_requests_limit: 500 },
    subscription: sub || { plan: 'starter', status: 'active' }
  };
}
