import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateSalesVat, type SalesVatOrder, type SalesVatSettings, type SalesVatSummary } from "./salesVat";

export interface SalesVatData {
  settings: SalesVatSettings;
  summary: SalesVatSummary | null;
  error: string | null;
}

export async function getSalesVat(
  db: SupabaseClient, tenantId: string, from: Date, until: Date, ignored: string[],
): Promise<SalesVatData> {
  let settings: SalesVatSettings = { enabled: false, rate: 21 };
  try {
    const result = await db.from("sales_vat_settings").select("enabled, rate")
      .eq("tenant_id", tenantId).maybeSingle();
    if (result.error) throw result.error;
    if (result.data) settings = { enabled: result.data.enabled, rate: Number(result.data.rate) };
    if (!settings.enabled) return { settings, summary: null, error: null };
    const orders: SalesVatOrder[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from("orders")
        .select("id, meli_order_id, total_amount, status, currency_id")
        .eq("tenant_id", tenantId)
        .gte("date_created", from.toISOString()).lt("date_created", until.toISOString())
        .order("date_created").order("id").range(offset, offset + 999);
      if (error) throw error;
      orders.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return { settings, summary: calculateSalesVat(orders, settings.rate, ignored), error: null };
  } catch (error) {
    console.error("Failed to load sales VAT", error);
    return { settings, summary: null, error: "No se pudo cargar el módulo de IVA. Intentá nuevamente." };
  }
}
