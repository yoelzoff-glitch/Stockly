import type { SupabaseClient } from "@supabase/supabase-js";
import { vatReconciliationSchema, type VatReconciliationRecord } from "./vatReconciliation";

export interface VatReconciliationData { record: VatReconciliationRecord | null; error: string | null }

export async function getVatReconciliation(db: SupabaseClient, tenantId: string, month: string): Promise<VatReconciliationData> {
  try {
    const { data, error } = await db.from("vat_reconciliations")
      .select("values, revision, updated_at").eq("tenant_id", tenantId).eq("month", month).maybeSingle();
    if (error) throw error;
    if (!data) return { record: null, error: null };
    const values = vatReconciliationSchema.parse(data.values);
    if (values.month !== month) throw new Error("VAT period mismatch");
    return { record: { values, revision: data.revision, updatedAt: data.updated_at }, error: null };
  } catch (error) {
    console.error("Failed to load VAT reconciliation", error);
    return { record: null, error: "No se pudo cargar la conciliación de IVA. Recargá la página para reintentar." };
  }
}
