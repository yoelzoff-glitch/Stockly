"use server"

import { createSubscriptionPreference } from "@/integrations/mercadopago/client";
import { createClient } from "@/lib/supabase/server";

export async function upgradePlan(plan: 'starter' | 'pro' | 'ultra') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
  if (!profile?.tenant_id) throw new Error("No se encontró tenant");

  const initPoint = await createSubscriptionPreference(profile.tenant_id, plan, user.email || "user@klyvo.com");
  return initPoint;
}

export async function scheduleDowngradeAction(targetPlan: 'starter' | 'pro') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
  if (!profile?.tenant_id) throw new Error("No se encontró tenant");

  const { data: sub } = await supabase.from("subscriptions").select("*").eq("tenant_id", profile.tenant_id).single();
  
  if (!sub || !sub.mercadopago_subscription_id) {
    throw new Error("No hay suscripción activa para cancelar");
  }

  // Import dynamically to avoid circular issues or just use the existing import
  const { cancelSubscription } = await import("@/integrations/mercadopago/client");
  
  try {
    await cancelSubscription(sub.mercadopago_subscription_id);
  } catch (error: any) {
    // Si ya estaba cancelada en MP, continuamos
    if (!error.message.includes("404") && !error.message.includes("already")) {
      throw new Error("Error cancelando la suscripción en Mercado Pago");
    }
  }

  // Update DB to register pending downgrade
  await supabase.from("subscriptions").update({
    pending_plan: targetPlan
  }).eq("id", sub.id);

  return { success: true };
}
