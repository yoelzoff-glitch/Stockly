// src/services/pricing/priceAdjustmentSimulator.ts
import { calculateTargetPrice } from "./calculateTargetPrice";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Simula los ajustes de precio para alcanzar el margen objetivo.
 */
export async function simulatePriceAdjustment(
  tenantId: string,
  targetMarginPercent: number,
  filter?: { sku?: string; categoryId?: string },
) {
  const supabase = createAdminClient();
  // Construir query base
  let query = supabase
    .from("products")
    .select(
      "id, sku, name, price, cost_base, commission_rate, shipping_cost, tax_rate, promotion_discount"
    )
    .eq("tenant_id", tenantId);

  if (filter?.sku) query = query.eq("sku", filter.sku);
  if (filter?.categoryId) query = query.eq("category_id", filter.categoryId);

  const { data: products, error } = await query;
  if (error) throw error;

  const preview = [] as Array<{
    productId: string;
    sku: string;
    currentPrice: number;
    targetPrice: number;
    priceChangePercent: number;
    newMargin: number;
  }>;

  for (const p of products) {
    const target = calculateTargetPrice(
      {
        baseCost: p.cost_base,
        commissionRate: p.commission_rate,
        shippingCost: p.shipping_cost,
        taxRate: p.tax_rate,
        promotionDiscount: p.promotion_discount,
      },
      targetMarginPercent,
    );
    const changePct = ((target - p.price) / p.price) * 100;
    // Reglas de negocio
    if (targetMarginPercent < 1 || targetMarginPercent > 80) continue; // fuera de rango
    if (Math.abs(changePct) > 30) continue; // requerirá confirmación manual
    const newMargin = ((target - p.cost_base) / target) * 100;
    preview.push({
      productId: p.id,
      sku: p.sku,
      currentPrice: p.price,
      targetPrice: target,
      priceChangePercent: Number(changePct.toFixed(2)),
      newMargin: Number(newMargin.toFixed(2)),
    });
  }
  return preview;
}
