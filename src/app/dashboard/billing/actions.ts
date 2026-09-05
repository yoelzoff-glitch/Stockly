"use server";

import { createSubscriptionPreference } from "@/integrations/mercadopago/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantContext, requireTenantRole } from "@/lib/security/tenantAuth";
import { assertTenantWritable } from "@/lib/demo/assert-demo-write-allowed";

export async function upgradePlan(plan: "starter" | "pro" | "ultra") {
  const context = await requireTenantContext();
  await requireTenantRole(["owner", "admin"]);
  await assertTenantWritable(context.tenantId);

  const adminSupabase = createAdminClient();
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", context.userId)
    .single();

  const email = profile?.email || "user@klyvo.com";
  const initPoint = await createSubscriptionPreference(context.tenantId, plan, email);
  return initPoint;
}

export async function scheduleDowngradeAction(targetPlan: "starter" | "pro") {
  const context = await requireTenantContext();
  await requireTenantRole(["owner", "admin"]);
  await assertTenantWritable(context.tenantId);

  const adminSupabase = createAdminClient();

  const { data: sub, error: subFetchError } = await adminSupabase
    .from("subscriptions")
    .select("*")
    .eq("tenant_id", context.tenantId)
    .single();

  if (subFetchError || !sub || !sub.mercadopago_subscription_id) {
    throw new Error("No hay suscripción activa para cancelar");
  }

  const { cancelSubscription } = await import("@/integrations/mercadopago/client");

  try {
    await cancelSubscription(sub.mercadopago_subscription_id);
  } catch (error: any) {
    // Si ya estaba cancelada en MP, continuamos
    if (!error.message?.includes("404") && !error.message?.includes("already")) {
      throw new Error("Error cancelando la suscripción en Mercado Pago");
    }
  }

  // Update DB via server-side admin client to register pending downgrade
  const { error: updateError } = await adminSupabase
    .from("subscriptions")
    .update({
      pending_plan: targetPlan,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id)
    .eq("tenant_id", context.tenantId);

  if (updateError) {
    throw new Error(`Error registrando downgrade en base de datos: ${updateError.message}`);
  }

  return { success: true };
}
