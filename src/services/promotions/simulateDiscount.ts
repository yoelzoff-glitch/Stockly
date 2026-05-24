import { createAdminClient } from "@/lib/supabase/admin";

export interface SimulateDiscountArgs {
  tenantId: string;
  productId: string;
  discountPercent?: number;
  discountAmount?: number;
  duration?: string;
  targetAudience?: string;
}

export async function simulateDiscount({
  tenantId,
  productId,
  discountPercent,
  discountAmount,
  duration,
  targetAudience
}: SimulateDiscountArgs) {
  const supabase = createAdminClient();
  const { data: product } = await supabase
    .from("products")
    .select("id, title, price, cost, estimated_fee, estimated_shipping_cost, extra_fee_amount, promotion_discount_amount")
    .eq("id", productId)
    .eq("tenant_id", tenantId)
    .single();

  if (!product) {
    throw new Error("Producto no encontrado.");
  }

  const currentPrice = Number(product.price) || 0;
  const cost = Number(product.cost);
  const fee = Number(product.estimated_fee) || 0;
  const shipping = Number(product.estimated_shipping_cost) || 0;
  const extraFee = Number(product.extra_fee_amount) || 0;
  
  let newPrice = currentPrice;
  if (discountPercent) {
    newPrice = currentPrice * (1 - (discountPercent / 100));
  } else if (discountAmount) {
    newPrice = currentPrice - discountAmount;
  }
  
  // Si es un cupón el precio de la publi se mantiene, pero el descuento impacta en el net_profit.
  // Asumiremos que el descuento lo absorbe 100% el vendedor.

  const oldNetProfit = currentPrice - (cost || 0) - fee - shipping - extraFee;
  const newNetProfit = newPrice - (cost || 0) - fee - shipping - extraFee;
  
  const oldMargin = currentPrice > 0 ? (oldNetProfit / currentPrice) * 100 : 0;
  const newMargin = newPrice > 0 ? (newNetProfit / newPrice) * 100 : 0;

  return {
    product_title: product.title,
    current_price: currentPrice,
    discounted_price: newPrice,
    cost: cost || "No definido",
    estimated_fee: fee,
    estimated_shipping: shipping,
    extra_fee_amount: extraFee,
    old_net_profit: oldNetProfit,
    new_net_profit: newNetProfit,
    old_margin_percent: Number(oldMargin.toFixed(1)),
    new_margin_percent: Number(newMargin.toFixed(1)),
    low_precision: !product.cost,
    duration: duration || "No especificada",
    audience: targetAudience || "Público general"
  };
}
