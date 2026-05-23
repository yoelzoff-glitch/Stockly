// src/services/pricing/createPriceAdjustmentWorkflow.ts
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Crea un workflow pendiente que contiene la lista de ajustes aprobados.
 */
export async function createPriceAdjustmentWorkflow(
  tenantId: string,
  targetMarginPercent: number,
  adjustments: Array<{ productId: string; targetPrice: number }>,
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("price_adjustment_workflows").insert({
    tenant_id: tenantId,
    target_margin_percent: targetMarginPercent,
    status: "pending",
    created_at: new Date().toISOString(),
  }).select();
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("No data returned from insert");
  const workflowId = data[0].id;

  // Insertar cada ajuste como detalle
  const details = adjustments.map((adj) => ({
    workflow_id: workflowId,
    product_id: adj.productId,
    target_price: adj.targetPrice,
  }));
  const { error: dErr } = await supabase.from("price_adjustment_details").insert(details);
  if (dErr) throw dErr;
  return workflowId;
}
