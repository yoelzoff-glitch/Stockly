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
  const { error } = await supabase
    .from("products")
    .update({ cost })
    .in("id", productIdsToUpdate);

  if (error) return { success: false, error: error.message };

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
