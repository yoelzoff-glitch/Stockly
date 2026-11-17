import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { meliFetch } from "@/services/meli/client";
import { parseMeliVatSummary, type MeliVatEstimate } from "./meliVat";

export interface MeliVatData { estimate: MeliVatEstimate | null; error: string | null }

// Called only after resolving the authenticated user's tenant. Cache is isolated by account/month.
export async function getMeliVat(db: SupabaseClient, tenantId: string, month: string): Promise<MeliVatData> {
  try {
    if (!/^[2-9]\d{3}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Invalid month");
    const { data: account, error: accountError } = await db.from("meli_accounts")
      .select("id, site_id").eq("tenant_id", tenantId).maybeSingle();
    if (accountError || !account || account.site_id !== "MLA") {
      return { estimate: null, error: "Se necesita una cuenta de Mercado Libre Argentina conectada para calcular el IVA de comisiones y envíos." };
    }
    const { data: cached, error: cacheError } = await db.from("meli_vat_reports")
      .select("summary, fetched_at").eq("tenant_id", tenantId).eq("account_id", account.id).eq("month", month).maybeSingle();
    if (cacheError) throw cacheError;
    if (cached && Date.now() - Date.parse(cached.fetched_at) < 86400000) {
      return { estimate: parseMeliVatSummary(cached.summary, month, cached.fetched_at), error: null };
    }
    const raw = await meliFetch({ tenantId, meliAccountId: account.id,
      endpoint: `/billing/integration/periods/key/${month}-01/summary/details?group=ML`, maxRetries: 1, rejectPartialResponse: true });
    const fetchedAt = new Date().toISOString();
    const estimate = parseMeliVatSummary(raw, month, fetchedAt);
    // Persist only the billing fields needed for the calculation, not account/user information.
    const { error } = await createAdminClient().from("meli_vat_reports").upsert({
      tenant_id: tenantId, account_id: account.id, month,
      summary: { period: raw.period, bill_includes: raw.bill_includes, errors: [] }, fetched_at: fetchedAt,
    }, { onConflict: "tenant_id,account_id,month" });
    if (error) throw error;
    return { estimate, error: null };
  } catch (error) {
    console.error("Failed to load Mercado Libre VAT report", error);
    return { estimate: null, error: "No se pudo obtener el reporte completo de Mercado Libre. El saldo estimado queda pendiente, sin asumir crédito cero." };
  }
}
