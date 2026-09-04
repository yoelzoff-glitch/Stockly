import { createAdminClient } from "@/lib/supabase/admin";

export type PlanKey = "starter" | "pro" | "ultra";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "cancelled" | "expired";
export type AccessMode = "active" | "grace" | "read_only" | "blocked";

export interface PlanLimits {
  ai: number;
  auto: number;
  wa: number;
  pub: number;
}

export interface TenantEntitlements {
  tenantId: string;
  plan: PlanKey;
  status: SubscriptionStatus;
  expiresAt: string | null;
  pendingPlan: PlanKey | null;
  limits: PlanLimits;
  accessMode: AccessMode;
  reason: string;
}

export const STATIC_PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  starter: { ai: 500, auto: 250, wa: 300, pub: 100 },
  pro: { ai: 1500, auto: 800, wa: 1500, pub: 400 },
  ultra: { ai: 5000, auto: 1500, wa: 5000, pub: 1000 },
};

let cachedPlansConfig: Record<string, PlanLimits> | null = null;
let lastConfigCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getDynamicPlanLimits(): Promise<Record<string, PlanLimits>> {
  const now = Date.now();
  if (cachedPlansConfig && now - lastConfigCacheTime < CACHE_TTL_MS) {
    return cachedPlansConfig;
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("plans_config")
      .select("plan_key, ai_credits_limit, automation_limit, whatsapp_limit, sku_limit, is_active")
      .eq("is_active", true);

    if (!error && data && data.length > 0) {
      const limits: Record<string, PlanLimits> = {};
      for (const row of data) {
        limits[row.plan_key] = {
          ai: row.ai_credits_limit,
          auto: row.automation_limit,
          wa: row.whatsapp_limit,
          pub: row.sku_limit,
        };
      }
      cachedPlansConfig = limits;
      lastConfigCacheTime = now;
      return limits;
    }
  } catch (_) {}

  return STATIC_PLAN_LIMITS;
}

export function normalizePlanKey(rawPlan?: string | null): PlanKey {
  if (!rawPlan) return "starter";
  const normalized = rawPlan.toLowerCase().trim();
  if (normalized === "ultra" || normalized === "business") return "ultra";
  if (normalized === "pro") return "pro";
  return "starter";
}

/**
 * Single source of truth resolver for Tenant Entitlements and access modes.
 */
export async function resolveTenantEntitlements(tenantId: string): Promise<TenantEntitlements> {
  const supabase = createAdminClient();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, tenant_id, plan, status, expires_at, pending_plan")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const plan = normalizePlanKey(sub?.plan);
  const status: SubscriptionStatus = (sub?.status as SubscriptionStatus) || "active";
  const expiresAt = sub?.expires_at || null;
  const pendingPlan = sub?.pending_plan ? normalizePlanKey(sub.pending_plan) : null;

  const allLimits = await getDynamicPlanLimits();
  const limits = allLimits[plan] || STATIC_PLAN_LIMITS[plan] || STATIC_PLAN_LIMITS.starter;

  // Compute accessMode based on status and expires_at
  const now = new Date();
  let accessMode: AccessMode = "active";
  let reason = "Suscripción activa";

  if (status === "active" || status === "trialing") {
    if (expiresAt) {
      const expDate = new Date(expiresAt);
      const diffMs = expDate.getTime() - now.getTime();
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

      if (diffMs < 0) {
        if (Math.abs(diffMs) <= threeDaysMs) {
          accessMode = "grace";
          reason = "Suscripción en período de gracia (3 días)";
        } else {
          accessMode = "blocked";
          reason = "Suscripción vencida. Renueva tu plan en Facturación.";
        }
      }
    }
  } else if (status === "past_due") {
    accessMode = "grace";
    reason = "Pago pendiente en Mercado Pago. En período de reintento.";
  } else if (status === "cancelled") {
    if (expiresAt && new Date(expiresAt) > now) {
      accessMode = "active";
      reason = "Suscripción cancelada pero activa hasta fin de período.";
    } else {
      accessMode = "read_only";
      reason = "Suscripción finalizada. Modo solo lectura.";
    }
  } else if (status === "expired") {
    accessMode = "blocked";
    reason = "Suscripción expirada. Reactiva tu cuenta en Facturación.";
  }

  return {
    tenantId,
    plan,
    status,
    expiresAt,
    pendingPlan,
    limits,
    accessMode,
    reason,
  };
}
