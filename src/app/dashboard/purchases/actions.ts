// src/app/dashboard/purchases/actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { calculateAverageCost } from "@/services/inventory/calculateAverageCost";
import { recalculateAllProductsByComponent } from "@/services/inventory/recalculateProductCostFromComponents";
import { normalizeSku } from "@/services/products/sku/normalizeSku";
import { revalidatePath } from "next/cache";

/**
 * Obtiene todas las órdenes de compra del tenant.
 */
export async function getPurchases() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) throw new Error("No tenant");

  const { data: orders, error } = await supabase
    .from("purchase_orders")
    .select(`
      *,
      purchase_order_items (
        *,
        inventory_items (
          sku,
          name
        )
      )
    `)
    .eq("tenant_id", profile.tenant_id)
    .order("purchase_date", { ascending: false });

  if (error) throw new Error(`Fetch purchases failed: ${error.message}`);
  return orders || [];
}

/**
 * Registra manualmente una compra desde el dashboard.
 */
export async function createManualPurchase(
  supplierName: string,
  items: { sku: string; quantity: number; unit_cost?: number }[],
  extraCosts: number = 0
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) throw new Error("No tenant");

  const tenantId = profile.tenant_id;

  // 1. Crear Purchase Order cabecera
  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .insert({
      tenant_id: tenantId,
      supplier_name: supplierName || null,
      extra_costs: extraCosts,
      status: "completed",
      source: "dashboard",
      created_by: user.id
    })
    .select("id")
    .single();

  if (poErr || !po) {
    throw new Error(`Failed to create purchase order: ${poErr?.message}`);
  }

  let totalAmount = 0;

  // 2. Procesar cada item comprado
  for (const item of items) {
    const skuNorm = normalizeSku(item.sku);
    const qty = Math.max(1, Math.round(item.quantity));
    const unitCost = item.unit_cost !== undefined && item.unit_cost !== null ? Number(item.unit_cost) : null;

    // Buscar o crear inventory_item
    let { data: invItem, error: fetchErr } = await supabase
      .from("inventory_items")
      .select("id, current_stock, average_cost")
      .eq("tenant_id", tenantId)
      .eq("sku_normalized", skuNorm)
      .single();

    if (fetchErr || !invItem) {
      const { data: newItem, error: createErr } = await supabase
        .from("inventory_items")
        .insert({
          tenant_id: tenantId,
          sku: item.sku,
          sku_normalized: skuNorm,
          current_stock: 0,
          unit_cost: null,
          average_cost: null,
          last_purchase_cost: null
        })
        .select("id, current_stock, average_cost")
        .single();

      if (createErr || !newItem) {
        throw new Error(`Failed to create missing inventory item for ${skuNorm}: ${createErr?.message}`);
      }
      invItem = newItem;
    }

    const oldStock = invItem.current_stock || 0;
    const oldAvgCost = invItem.average_cost !== null ? Number(invItem.average_cost) : null;
    const newStock = oldStock + qty;

    // 3. Recalcular costo promedio ponderado
    const { averageCost, lastPurchaseCost } = calculateAverageCost(
      oldStock,
      oldAvgCost,
      qty,
      unitCost
    );

    // 4. Actualizar item de inventario
    const { error: updateErr } = await supabase
      .from("inventory_items")
      .update({
        current_stock: newStock,
        average_cost: averageCost,
        last_purchase_cost: lastPurchaseCost,
        updated_at: new Date().toISOString()
      })
      .eq("id", invItem.id);

    if (updateErr) {
      throw new Error(`Failed to update inventory stock for ${skuNorm}: ${updateErr.message}`);
    }

    const totalItemCost = unitCost !== null ? unitCost * qty : null;
    if (totalItemCost !== null) {
      totalAmount += totalItemCost;
    }

    // 5. Crear movimiento de inventario
    await supabase.from("inventory_movements").insert({
      tenant_id: tenantId,
      inventory_item_id: invItem.id,
      movement_type: "purchase",
      quantity_delta: qty,
      previous_stock: oldStock,
      new_stock: newStock,
      unit_cost: unitCost,
      total_cost: totalItemCost,
      source: "dashboard",
      reference_id: po.id,
      notes: supplierName ? `Compra registrada de ${supplierName}` : "Compra manual desde dashboard",
      created_by: user.id
    });

    // 6. Crear Purchase Order Item
    await supabase.from("purchase_order_items").insert({
      tenant_id: tenantId,
      purchase_order_id: po.id,
      inventory_item_id: invItem.id,
      sku: item.sku,
      sku_normalized: skuNorm,
      quantity: qty,
      unit_cost: unitCost,
      total_cost: totalItemCost
    });

    // 7. Recalcular costos de productos ML vinculados
    await recalculateAllProductsByComponent(tenantId, invItem.id);
  }

  // 8. Actualizar monto total en la Purchase Order cabecera
  const finalTotalAmount = totalAmount + extraCosts;
  await supabase
    .from("purchase_orders")
    .update({ total_amount: finalTotalAmount })
    .eq("id", po.id);

  revalidatePath("/dashboard/purchases");
  revalidatePath("/dashboard/internal-stock");
  revalidatePath("/dashboard/products");

  return { success: true, purchase_order_id: po.id };
}

/**
 * Anula una compra registrada, aplicando movimiento inverso de stock y recalculando costos.
 */
export async function voidPurchase(purchaseOrderId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) throw new Error("No tenant");

  const tenantId = profile.tenant_id;

  // 1. Obtener la orden de compra y sus items
  const { data: po, error: fetchErr } = await supabase
    .from("purchase_orders")
    .select(`
      *,
      purchase_order_items (
        *
      )
    `)
    .eq("id", purchaseOrderId)
    .eq("tenant_id", tenantId)
    .single();

  if (fetchErr || !po) throw new Error("Purchase order not found");
  if (po.status === "voided") throw new Error("Purchase order is already voided");

  // 2. Ite sobre los items y aplicar movimiento inverso
  for (const poItem of po.purchase_order_items) {
    if (!poItem.inventory_item_id) continue;

    // Obtener stock actual del item
    const { data: invItem } = await supabase
      .from("inventory_items")
      .select("current_stock, average_cost")
      .eq("id", poItem.inventory_item_id)
      .eq("tenant_id", tenantId)
      .single();

    if (!invItem) continue;

    const oldStock = invItem.current_stock || 0;
    const qtyToSubtract = poItem.quantity;
    const newStock = Math.max(0, oldStock - qtyToSubtract);

    // 3. Actualizar stock (no recalculamos costo promedio al anular para evitar distorsiones históricas, solo revertimos cantidad física)
    await supabase
      .from("inventory_items")
      .update({
        current_stock: newStock,
        updated_at: new Date().toISOString()
      })
      .eq("id", poItem.inventory_item_id);

    // 4. Registrar movimiento inverso
    await supabase.from("inventory_movements").insert({
      tenant_id: tenantId,
      inventory_item_id: poItem.inventory_item_id,
      movement_type: "void_purchase",
      quantity_delta: -qtyToSubtract,
      previous_stock: oldStock,
      new_stock: newStock,
      unit_cost: poItem.unit_cost,
      total_cost: poItem.total_cost ? -poItem.total_cost : null,
      source: "dashboard",
      reference_id: po.id,
      notes: `Anulación de compra #${po.id.slice(0, 8)}`,
      created_by: user.id
    });

    // 5. Recalcular costos de productos ML vinculados
    await recalculateAllProductsByComponent(tenantId, poItem.inventory_item_id);
  }

  // 6. Marcar orden como anulada
  await supabase
    .from("purchase_orders")
    .update({ status: "voided" })
    .eq("id", purchaseOrderId)
    .eq("tenant_id", tenantId);

  revalidatePath("/dashboard/purchases");
  revalidatePath("/dashboard/internal-stock");
  revalidatePath("/dashboard/products");

  return { success: true };
}
