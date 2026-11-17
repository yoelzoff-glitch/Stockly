"use server";

import { createClient } from "@/lib/supabase/server";
import { assertTenantWritable } from "@/lib/demo/assert-demo-write-allowed";
import { SALES_VAT_RATES, type SalesVatSettings } from "@/services/finance/salesVat";
import { revalidatePath } from "next/cache";
import { vatReconciliationSchema } from "@/services/finance/vatReconciliation";
import { getMeliVat } from "@/services/finance/getMeliVat";

export async function saveSalesVatSettings(settings: SalesVatSettings) {
  if (!settings || typeof settings.enabled !== "boolean" ||
      !SALES_VAT_RATES.some(rate => rate === settings.rate)) {
    return { error: "Configuración de IVA inválida." };
  }
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: "Iniciá sesión para continuar." };
  const { data: profile, error } = await db.from("profiles")
    .select("tenant_id, role, is_active").eq("id", user.id).single();
  if (error || !profile?.tenant_id || profile.is_active !== true ||
      !["owner", "admin"].includes(profile.role)) {
    return { error: "Solo el propietario o un administrador puede configurar el IVA." };
  }
  await assertTenantWritable(profile.tenant_id);
  const { error: writeError } = await db.from("sales_vat_settings").upsert({
    tenant_id: profile.tenant_id, enabled: settings.enabled, rate: settings.rate,
  }, { onConflict: "tenant_id" });
  if (writeError) return { error: "No se pudo guardar la configuración de IVA." };
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/finance");
  return { error: null };
}

export async function saveVatReconciliation(input: unknown, revision: number) {
  const parsed = vatReconciliationSchema.safeParse(input);
  if (!parsed.success || !Number.isSafeInteger(revision) || revision < 0) {
    return { error: "Revisá los importes (positivos, con hasta dos decimales), el período y la referencia de ARCA." };
  }
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: "Iniciá sesión para continuar." };
  const { data: profile, error } = await db.from("profiles")
    .select("tenant_id, role, is_active").eq("id", user.id).single();
  if (error || !profile?.tenant_id || profile.is_active !== true || !["owner", "admin"].includes(profile.role)) {
    return { error: "Solo el propietario o un administrador puede guardar la conciliación." };
  }
  await assertTenantWritable(profile.tenant_id);
  const { data: settings, error: settingsError } = await db.from("sales_vat_settings")
    .select("enabled").eq("tenant_id", profile.tenant_id).maybeSingle();
  if (settingsError || !settings?.enabled) return { error: "Activá el módulo de IVA antes de guardar la conciliación." };
  const ml = await getMeliVat(db, profile.tenant_id, parsed.data.month);
  if (!ml.estimate) return { error: ml.error || "Falta el reporte de Mercado Libre." };
  if (ml.estimate.fetchedAt !== parsed.data.mlFetchedAt) {
    return { error: "El reporte de Mercado Libre se actualizó. Recargá la página para revisar los nuevos importes." };
  }
  parsed.data.commissionVat = ml.estimate.commissionVat;
  parsed.data.shippingVat = ml.estimate.shippingVat;
  const payload = { values: parsed.data, updated_by: user.id, updated_at: new Date().toISOString(), revision: revision + 1 };
  const query = revision === 0
    ? db.from("vat_reconciliations").insert({ ...payload, tenant_id: profile.tenant_id, month: parsed.data.month })
    : db.from("vat_reconciliations").update(payload).eq("tenant_id", profile.tenant_id)
      .eq("month", parsed.data.month).eq("revision", revision);
  const { data, error: writeError } = await query.select("revision").maybeSingle();
  if (writeError?.code === "23505" || (!writeError && !data)) {
    return { error: "Otra persona modificó este mes. Recargá la página antes de volver a guardar." };
  }
  if (writeError) return { error: "No se pudo guardar la conciliación de IVA." };
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/finance");
  return { error: null };
}
