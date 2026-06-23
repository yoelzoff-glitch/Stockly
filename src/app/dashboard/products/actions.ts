"use server"

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProductCost(productId: string, cost: number) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) return { success: false, error: "No tenant" };

  // 1. Get the current product's SKU
  const { data: product, error: fetchError } = await supabase
    .from("products")
    .select("sku")
    .eq("id", productId)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (fetchError || !product) {
    return { success: false, error: "Product not found or access denied" };
  }

  let productIdsToUpdate = [productId];

  // 2. Find all products with the same normalized SKU
  if (product.sku) {
    const { normalizeSku } = await import("@/services/products/sku/normalizeSku");
    const targetNormalized = normalizeSku(product.sku);

    const { data: allProducts } = await supabase
      .from("products")
      .select("id, sku")
      .eq("tenant_id", profile.tenant_id);

    if (allProducts) {
      const matchingIds = allProducts
        .filter(p => p.sku && normalizeSku(p.sku) === targetNormalized)
        .map(p => p.id);

      if (matchingIds.length > 0) {
        productIdsToUpdate = matchingIds;
      }
    }
  }

  // 3. Update all of them
  const { data: productsToUpdateData } = await supabase
    .from("products")
    .select("id, price, estimated_fee, estimated_shipping_cost, extra_fee_amount, promotion_discount_amount, estimated_tax")
    .in("id", productIdsToUpdate);

  if (productsToUpdateData) {
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("metadata")
      .eq("id", profile.tenant_id)
      .single();

    const tenantMetadata = (tenantData?.metadata as any) || {};
    const packagingCost = tenantMetadata.packaging_cost || 0;

    const { calculateRealProfitability } = await import("@/services/profitability/calculateRealProfitability");

    for (const p of productsToUpdateData) {
      const profitResult = calculateRealProfitability({
        price: p.price,
        cost: cost,
        estimated_fee: p.estimated_fee,
        extra_fee_amount: p.extra_fee_amount || 0,
        estimated_shipping_cost: p.estimated_shipping_cost,
        promotion_discount_amount: p.promotion_discount_amount || 0,
        estimated_tax: p.estimated_tax || 0,
        packaging_cost: packagingCost
      });

      const { error: updErr } = await supabase
        .from("products")
        .update({
          cost: cost,
          margin_amount: profitResult.margin_amount,
          margin_percent: profitResult.margin_percent,
          profit_real_estimated: profitResult.real_margin_amount,
          profit_real_margin: profitResult.real_margin_percent,
          profitability_status: profitResult.profitability_status,
          profit_last_calculated_at: new Date().toISOString()
        })
        .eq("id", p.id);

      if (updErr) {
        return { success: false, error: updErr.message };
      }
    }
  }

  // 3.5 Update the corresponding inventory_items average_cost
  const { data: components } = await supabase
    .from("product_components")
    .select("inventory_item_id, quantity")
    .in("product_id", productIdsToUpdate);

  if (components && components.length > 0) {
    for (const comp of components) {
      if (comp.inventory_item_id) {
        const qty = comp.quantity || 1;
        const compCost = cost / qty;
        
        await supabase
          .from("inventory_items")
          .update({ 
            average_cost: compCost,
            updated_at: new Date().toISOString()
          })
          .eq("id", comp.inventory_item_id)
          .eq("tenant_id", profile.tenant_id);
      }
    }
  }

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard");
  return { success: true };
}
