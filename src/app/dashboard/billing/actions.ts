"use server"

import { createSubscriptionPreference } from "@/integrations/mercadopago/client";
import { createClient } from "@/lib/supabase/server";

export async function upgradePlan(plan: 'pro' | 'business') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
  if (!profile?.tenant_id) throw new Error("No se encontró tenant");

  const initPoint = await createSubscriptionPreference(profile.tenant_id, plan, user.email || "user@stockly.com");
  return initPoint;
}
