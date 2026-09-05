"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

import { assertTenantWritable } from "@/lib/demo/assert-demo-write-allowed";

export async function updateAccountAction(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "No autenticado" };

  const fullName = formData.get("fullName") as string;
  
  if (!fullName) return { error: "El nombre es obligatorio" };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id);

  if (error) return { error: "Error al actualizar el perfil" };

  revalidatePath("/dashboard/settings");
  return { success: "Perfil actualizado correctamente" };
}

export async function updateBusinessAction(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "No autenticado" };

  // Get tenant ID
  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
  if (!profile?.tenant_id) return { error: "Tenant no encontrado" };

  await assertTenantWritable(profile.tenant_id);

  const name = formData.get("name") as string;
  const currency = formData.get("currency") as string;
  
  if (!name || !currency) return { error: "Campos incompletos" };

  const { error } = await supabase
    .from("tenants")
    .update({ name, currency })
    .eq("id", profile.tenant_id);

  if (error) return { error: "Error al actualizar el negocio" };

  revalidatePath("/dashboard/settings");
  return { success: "Negocio actualizado correctamente" };
}

import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantContext } from "@/lib/security/tenantAuth";

export async function updatePreferencesAction(prevState: any, formData: FormData) {
  try {
    const context = await requireTenantContext();
    await assertTenantWritable(context.tenantId);
    const adminSupabase = createAdminClient();

    const { data: tenant } = await adminSupabase
      .from("tenants")
      .select("metadata")
      .eq("id", context.tenantId)
      .single();

    const minMargin = formData.get("minMargin") as string;
    const strategy = formData.get("strategy") as string;
    const autoSuggestions = formData.get("autoSuggestions") === "on";

    const newMetadata = {
      ...(tenant?.metadata as Record<string, any> || {}),
      ai_min_margin_percent: Number(minMargin),
      ai_pricing_strategy: strategy,
      auto_suggestions_enabled: autoSuggestions,
    };

    const { error } = await adminSupabase
      .from("tenants")
      .update({ metadata: newMetadata })
      .eq("id", context.tenantId);

    if (error) return { error: "Error al actualizar preferencias" };

    revalidatePath("/dashboard/settings");
    return { success: "Preferencias de IA actualizadas correctamente" };
  } catch (err: any) {
    return { error: err.message || "No autenticado" };
  }
}

export async function updateOperationalCostsAction(prevState: any, formData: FormData) {
  try {
    const context = await requireTenantContext();
    await assertTenantWritable(context.tenantId);
    const adminSupabase = createAdminClient();

    const { data: tenant } = await adminSupabase
      .from("tenants")
      .select("metadata")
      .eq("id", context.tenantId)
      .single();

    const packagingCost = formData.get("packagingCost") as string;

    const flexZones = [];
    for (let i = 1; i <= 4; i++) {
      const mlPays = formData.get(`flex_ml_${i}`) as string;
      const motoCosts = formData.get(`flex_moto_${i}`) as string;
      flexZones.push({
        zone: i,
        ml_pays: Number(mlPays) || 0,
        moto_costs: Number(motoCosts) || 0
      });
    }

    const newMetadata = {
      ...(tenant?.metadata as Record<string, any> || {}),
      packaging_cost: Number(packagingCost) || 0,
      flex_zones: flexZones,
    };

    const { error } = await adminSupabase
      .from("tenants")
      .update({ metadata: newMetadata })
      .eq("id", context.tenantId);

    if (error) return { error: "Error al actualizar costos operativos" };

    revalidatePath("/dashboard/settings");
    return { success: "Costos operativos actualizados correctamente" };
  } catch (err: any) {
    return { error: err.message || "No autenticado" };
  }
}
