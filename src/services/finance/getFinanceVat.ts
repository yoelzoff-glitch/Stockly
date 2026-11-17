import type { SupabaseClient } from "@supabase/supabase-js";
import { getFinancialData } from "./getFinancialData";
import { getMidnightInTimezone } from "@/services/ai/tools/finance";
import { calculateFinanceVat, type FinanceVatData } from "./financeVat";

export async function getFinanceVat(db: SupabaseClient, tenantId: string, month: string): Promise<FinanceVatData> {
  try {
    if (!/^[2-9]\d{3}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Invalid month");
    const { data: tenant, error } = await db.from("tenants").select("timezone, metadata").eq("id", tenantId).single();
    if (error || !tenant) throw error || new Error("Missing tenant");
    const timezone = tenant.timezone || "America/Argentina/Buenos_Aires";
    const [year, monthNumber] = month.split("-").map(Number);
    const from = getMidnightInTimezone(new Date(Date.UTC(year, monthNumber - 1, 1, 12)), timezone);
    const until = getMidnightInTimezone(new Date(Date.UTC(year, monthNumber, 1, 12)), timezone);
    const ignored = tenant.metadata?.ignored_order_ids;
    const financials = await getFinancialData(db, tenantId, from, new Date(until.getTime() - 1),
      Number(tenant.metadata?.packaging_cost) || 0, Array.isArray(ignored) ? ignored.map(String) : [], true, timezone);
    return { estimate: calculateFinanceVat(financials), error: null };
  } catch (error) {
    console.error("Failed to calculate VAT from Finance", error);
    return { estimate: null, error: "No pudimos cargar los montos de Finanzas. Reintentá en unos momentos." };
  }
}
