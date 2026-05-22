"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

export async function updatePreferencesAction(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "No autenticado" };

  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
  if (!profile?.tenant_id) return { error: "Tenant no encontrado" };

  // Fetch current metadata to merge
  const { data: tenant } = await supabase.from("tenants").select("metadata").eq("id", profile.tenant_id).single();
  
  const minMargin = formData.get("minMargin") as string;
  const strategy = formData.get("strategy") as string;
  const autoSuggestions = formData.get("autoSuggestions") === "on";

  const newMetadata = {
    ...(tenant?.metadata as Record<string, any> || {}),
    ai_min_margin_percent: Number(minMargin),
    ai_pricing_strategy: strategy,
    auto_suggestions_enabled: autoSuggestions,
  };

  const { error } = await supabase
    .from("tenants")
    .update({ metadata: newMetadata })
    .eq("id", profile.tenant_id);

  if (error) return { error: "Error al actualizar preferencias" };

  revalidatePath("/dashboard/settings");
  return { success: "Preferencias de IA actualizadas correctamente" };
}
