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

export async function updateProductComponents(
  productId: string,
  componentMappings: Array<{ inventory_item_id: string; quantity: number }>
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) return { success: false, error: "No tenant" };
  const tenantId = profile.tenant_id;

  // 1. Fetch current product to get its SKU and find all sibling products
  const { data: currentProduct, error: prodErr } = await supabase
    .from("products")
    .select("id, sku")
    .eq("id", productId)
    .eq("tenant_id", tenantId)
    .single();

  if (prodErr || !currentProduct) {
    return { success: false, error: "Product not found" };
  }

  let targetProductIds = [productId];

  if (currentProduct.sku) {
    const { normalizeSku } = await import("@/services/products/sku/normalizeSku");
    const targetNormSku = normalizeSku(currentProduct.sku);

    if (targetNormSku) {
      const { data: allProds } = await supabase
        .from("products")
        .select("id, sku")
        .eq("tenant_id", tenantId);

      if (allProds) {
        const matchingIds = allProds
          .filter(p => p.sku && normalizeSku(p.sku) === targetNormSku)
          .map(p => p.id);

        if (matchingIds.length > 0) {
          targetProductIds = Array.from(new Set([...matchingIds, productId]));
        }
      }
    }
  }

  // 2. Delete existing mappings for all target sibling products
  const { error: deleteError } = await supabase
    .from("product_components")
    .delete()
    .in("product_id", targetProductIds)
    .eq("tenant_id", tenantId);

  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  // 3. Insert new mappings for all target sibling products if any
  if (componentMappings.length > 0) {
    const itemIds = componentMappings.map(m => m.inventory_item_id);
    const { data: items, error: itemsError } = await supabase
      .from("inventory_items")
      .select("id, sku, sku_normalized")
      .in("id", itemIds)
      .eq("tenant_id", tenantId);

    if (itemsError) {
      return { success: false, error: itemsError.message };
    }

    const itemsMap = new Map(items?.map(i => [i.id, i]));
    const rowsToInsert: any[] = [];

    for (const pId of targetProductIds) {
      for (const m of componentMappings) {
        const item = itemsMap.get(m.inventory_item_id);
        if (!item) continue;
        rowsToInsert.push({
          tenant_id: tenantId,
          product_id: pId,
          inventory_item_id: m.inventory_item_id,
          component_sku: item.sku,
          component_normalized: item.sku_normalized,
          quantity: m.quantity
        });
      }
    }

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("product_components")
        .insert(rowsToInsert);

      if (insertError) {
        return { success: false, error: insertError.message };
      }
    }
  }

  // 4. Recalculate cost for all target sibling products
  try {
    const { recalculateMultipleProductsCost } = await import(
      "@/services/inventory/recalculateProductCostFromComponents"
    );
    await recalculateMultipleProductsCost(tenantId, targetProductIds);
  } catch (e: any) {
    console.error("Error recalculating costs for sibling products:", e.message);
  }

  // 5. Automatically reprocess recent sales for these products to catch any missed deductions
  try {
    await reprocessProductOrdersStock(productId);
  } catch (e: any) {
    console.error("Error auto-reprocessing stock for updated components:", e.message);
  }

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard");
  return { success: true, updatedProductsCount: targetProductIds.length };
}

export async function reprocessProductOrdersStock(productId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) return { success: false, error: "No tenant" };
  const tenantId = profile.tenant_id;

  // 1. Resolve product and sibling product IDs
  const { data: currentProduct, error: prodErr } = await supabase
    .from("products")
    .select("id, sku")
    .eq("id", productId)
    .eq("tenant_id", tenantId)
    .single();

  if (prodErr || !currentProduct) {
    return { success: false, error: "Product not found" };
  }

  let targetProductIds = [productId];

  if (currentProduct.sku) {
    const { normalizeSku } = await import("@/services/products/sku/normalizeSku");
    const targetNormSku = normalizeSku(currentProduct.sku);

    if (targetNormSku) {
      const { data: allProds } = await supabase
        .from("products")
        .select("id, sku")
        .eq("tenant_id", tenantId);

      if (allProds) {
        const matchingIds = allProds
          .filter(p => p.sku && normalizeSku(p.sku) === targetNormSku)
          .map(p => p.id);

        if (matchingIds.length > 0) {
          targetProductIds = Array.from(new Set([...matchingIds, productId]));
        }
      }
    }
  }

  // 2. Fetch paid orders for this tenant in the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, meli_order_id, internal_stock_processed")
    .eq("tenant_id", tenantId)
    .eq("status", "paid")
    .gt("date_created", sevenDaysAgo);

  if (ordersError) {
    return { success: false, error: ordersError.message };
  }

  const orderIds = orders?.map(o => o.id) || [];
  if (orderIds.length === 0) {
    return { success: true, message: "No orders found in the last 7 days." };
  }

  // 3. Filter orders that contain any of the target sibling product IDs
  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("order_id")
    .in("order_id", orderIds)
    .in("product_id", targetProductIds);

  if (itemsError) {
    return { success: false, error: itemsError.message };
  }

  const candidateOrderIds = Array.from(new Set(items?.map(item => item.order_id)));
  if (candidateOrderIds.length === 0) {
    return { success: true, message: "No sales found for this product (or its siblings) in the last 7 days." };
  }

  // 4. For each order containing these products, check if it has any movements
  const { data: movements } = await supabase
    .from("inventory_movements")
    .select("reference_id")
    .in("reference_id", candidateOrderIds);

  const ordersWithMovements = new Set(movements?.map(m => m.reference_id));
  const ordersToReprocess = candidateOrderIds.filter(id => !ordersWithMovements.has(id));

  if (ordersToReprocess.length === 0) {
    return { success: true, message: "All sales for this product and its siblings already have stock movements." };
  }

  // 5. Reset internal_stock_processed to false and call decrementInternalStockFromOrder
  const { decrementInternalStockFromOrder } = await import(
    "@/services/inventory/decrementInternalStockFromOrder"
  );

  let successCount = 0;
  for (const orderId of ordersToReprocess) {
    await supabase
      .from("orders")
      .update({
        internal_stock_processed: false,
        internal_stock_processed_at: null
      })
      .eq("id", orderId);

    const result = await decrementInternalStockFromOrder(tenantId, orderId);
    if (result.success) {
      successCount++;
    }
  }

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard");
  return { success: true, reprocessedCount: successCount };
}
