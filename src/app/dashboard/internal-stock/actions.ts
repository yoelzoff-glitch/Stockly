// src/app/dashboard/internal-stock/actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { normalizeSku } from "@/services/products/sku/normalizeSku";
import { recalculateAllProductsByComponent } from "@/services/inventory/recalculateProductCostFromComponents";
import { revalidatePath } from "next/cache";

/**
 * Obtiene los items del inventario de depósito para el tenant autenticado.
 */
export async function getInventoryItems() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) throw new Error("No tenant");

  const { data: items, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .order("sku_normalized", { ascending: true });

  if (error) throw new Error(`Failed to fetch inventory: ${error.message}`);
  if (!items || items.length === 0) return [];

  // Calculate aggregated sales velocity and restock recommendations
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentOrders } = await supabase
    .from("orders")
    .select("id")
    .eq("tenant_id", profile.tenant_id)
    .gt("date_created", thirtyDaysAgo);

  const orderIds = recentOrders?.map(o => o.id) || [];
  let salesPerComponent: Record<string, number> = {};

  if (orderIds.length > 0) {
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("product_id, quantity")
      .in("order_id", orderIds);

    const productIds = Array.from(new Set(orderItems?.map(item => item.product_id).filter(Boolean))) as string[];

    if (productIds.length > 0) {
      const { data: productComponents } = await supabase
        .from("product_components")
        .select("product_id, inventory_item_id, quantity")
        .in("product_id", productIds);

      orderItems?.forEach(item => {
        if (!item.product_id) return;
        const components = productComponents?.filter(c => c.product_id === item.product_id) || [];
        components.forEach(comp => {
          if (comp.inventory_item_id) {
            const qtyUsed = (item.quantity || 1) * (comp.quantity || 1);
            salesPerComponent[comp.inventory_item_id] = (salesPerComponent[comp.inventory_item_id] || 0) + qtyUsed;
          }
        });
      });
    }
  }

  // Enhance items with calculations
  const enhancedItems = items.map(item => {
    const salesLast30 = salesPerComponent[item.id] || 0;
    const targetStock = Math.ceil(salesLast30 * 1.2); // 30 days + 20% safety
    const currentStock = item.current_stock || 0;
    const recommended_restock = Math.max(0, targetStock - currentStock);
    
    return {
      ...item,
      sales_last_30_days: salesLast30,
      recommended_restock: salesLast30 > 0 ? recommended_restock : 0
    };
  });

  return enhancedItems;
}

/**
 * Ajusta manualmente el stock de un item de inventario en depósito.
 */
export async function adjustInventoryStock(
  itemId: string,
  newStock: number,
  notes: string = "Ajuste manual desde el dashboard"
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

  // 1. Obtener stock actual
  const { data: item, error: fetchErr } = await supabase
    .from("inventory_items")
    .select("current_stock, sku_normalized")
    .eq("id", itemId)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (fetchErr || !item) throw new Error("Item not found");

  const oldStock = item.current_stock || 0;
  const delta = newStock - oldStock;

  if (delta === 0) return { success: true };

  // 2. Actualizar stock
  const { error: updateErr } = await supabase
    .from("inventory_items")
    .update({
      current_stock: newStock,
      updated_at: new Date().toISOString()
    })
    .eq("id", itemId)
    .eq("tenant_id", profile.tenant_id);

  if (updateErr) throw new Error(`Update stock failed: ${updateErr.message}`);

  // 3. Registrar movimiento
  await supabase.from("inventory_movements").insert({
    tenant_id: profile.tenant_id,
    inventory_item_id: itemId,
    movement_type: "adjustment",
    quantity_delta: delta,
    previous_stock: oldStock,
    new_stock: newStock,
    source: "dashboard",
    notes,
    created_by: user.id
  });

  // 4. Recalcular costos de publicaciones relacionadas
  await recalculateAllProductsByComponent(profile.tenant_id, itemId);

  revalidatePath("/dashboard/internal-stock");
  revalidatePath("/dashboard/products");
  return { success: true };
}

/**
 * Edita el costo promedio u otros parámetros de un item de inventario.
 */
export async function updateInventoryItemParams(
  itemId: string,
  params: {
    name?: string;
    category?: string;
    average_cost?: number;
    minimum_stock?: number;
  }
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

  const updatePayload: any = {
    updated_at: new Date().toISOString()
  };

  if (params.name !== undefined) updatePayload.name = params.name;
  if (params.category !== undefined) updatePayload.category = params.category;
  if (params.average_cost !== undefined) updatePayload.average_cost = params.average_cost;
  if (params.minimum_stock !== undefined) updatePayload.minimum_stock = params.minimum_stock;

  const { error } = await supabase
    .from("inventory_items")
    .update(updatePayload)
    .eq("id", itemId)
    .eq("tenant_id", profile.tenant_id);

  if (error) throw new Error(`Update params failed: ${error.message}`);

  // Recalcular costos si cambia el costo promedio del componente
  if (params.average_cost !== undefined) {
    await recalculateAllProductsByComponent(profile.tenant_id, itemId);
  }

  revalidatePath("/dashboard/internal-stock");
  revalidatePath("/dashboard/products");
  return { success: true };
}

/**
 * Obtiene los movimientos de inventario de un componente.
 */
export async function getInventoryMovements(itemId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) throw new Error("No tenant");

  const { data: movements, error } = await supabase
    .from("inventory_movements")
    .select("*")
    .eq("inventory_item_id", itemId)
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Fetch movements failed: ${error.message}`);
  return movements || [];
}

/**
 * Elimina un item de inventario de depósito si no está vinculado a ninguna publicación.
 */
export async function deleteInventoryItem(itemId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) throw new Error("No tenant");

  // 1. Verificar si tiene vinculación activa en product_components
  const { data: activeComps, error: compErr } = await supabase
    .from("product_components")
    .select("product_id, products(title)")
    .eq("inventory_item_id", itemId)
    .limit(1);

  if (compErr) throw new Error(`Verification failed: ${compErr.message}`);

  if (activeComps && activeComps.length > 0) {
    const prodTitle = (activeComps[0] as any)?.products?.title || "desconocido";
    throw new Error(
      `No se puede eliminar el componente porque está vinculado a publicaciones activas (ej: "${prodTitle}").`
    );
  }

  // 2. Eliminar movimientos históricos
  const { error: moveErr } = await supabase
    .from("inventory_movements")
    .delete()
    .eq("inventory_item_id", itemId)
    .eq("tenant_id", profile.tenant_id);

  if (moveErr) throw new Error(`Failed to clear history: ${moveErr.message}`);

  // 3. Eliminar item
  const { error: deleteErr } = await supabase
    .from("inventory_items")
    .delete()
    .eq("id", itemId)
    .eq("tenant_id", profile.tenant_id);

  if (deleteErr) throw new Error(`Delete failed: ${deleteErr.message}`);

  revalidatePath("/dashboard/internal-stock");
  return { success: true };
}

/**
 * Realiza una actualización masiva de componentes a partir de los datos parseados de Excel.
 */
export async function bulkUpdateInventoryFromExcel(
  updates: Array<{
    sku: string;
    name?: string;
    category?: string;
    current_stock?: number;
    average_cost?: number;
    last_purchase_cost?: number;
    minimum_stock?: number;
  }>
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

  // Traer todos los items existentes del tenant
  const { data: existingItems, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("tenant_id", tenantId);

  if (error) throw new Error(`Failed to fetch existing items: ${error.message}`);
  
  const existingMap = new Map<string, any>();
  existingItems?.forEach(item => {
    existingMap.set(item.sku_normalized.toLowerCase(), item);
  });

  let updatedCount = 0;
  let skippedCount = 0;
  const componentsToRecalculate = new Set<string>();

  for (const update of updates) {
    if (!update.sku) {
      skippedCount++;
      continue;
    }
    const normalizedSku = update.sku.trim().toLowerCase();
    const dbItem = existingMap.get(normalizedSku);

    if (!dbItem) {
      skippedCount++;
      continue;
    }

    const itemId = dbItem.id;
    const oldStock = dbItem.current_stock || 0;
    const newStock = update.current_stock !== undefined ? update.current_stock : oldStock;
    const stockChanged = newStock !== oldStock;

    const oldAverageCost = dbItem.average_cost || 0;
    const newAverageCost = update.average_cost !== undefined ? update.average_cost : oldAverageCost;
    const costChanged = newAverageCost !== oldAverageCost;

    const oldName = dbItem.name || "";
    const newName = update.name !== undefined ? update.name.trim() : oldName;

    const oldCategory = dbItem.category || "";
    const newCategory = update.category !== undefined ? update.category.trim() : oldCategory;

    const oldLastPurchaseCost = dbItem.last_purchase_cost || 0;
    const newLastPurchaseCost = update.last_purchase_cost !== undefined ? update.last_purchase_cost : oldLastPurchaseCost;

    const oldMinStock = dbItem.minimum_stock || 0;
    const newMinStock = update.minimum_stock !== undefined ? update.minimum_stock : oldMinStock;

    // Verificar si algo cambió
    const anythingChanged = 
      newName !== oldName ||
      newCategory !== oldCategory ||
      stockChanged ||
      costChanged ||
      newLastPurchaseCost !== oldLastPurchaseCost ||
      newMinStock !== oldMinStock;

    if (!anythingChanged) {
      continue;
    }

    // Construir objeto de actualización
    const updatePayload: any = {
      updated_at: new Date().toISOString()
    };
    if (newName !== oldName) updatePayload.name = newName;
    if (newCategory !== oldCategory) updatePayload.category = newCategory;
    if (stockChanged) updatePayload.current_stock = newStock;
    if (costChanged) updatePayload.average_cost = newAverageCost;
    if (newLastPurchaseCost !== oldLastPurchaseCost) updatePayload.last_purchase_cost = newLastPurchaseCost;
    if (newMinStock !== oldMinStock) updatePayload.minimum_stock = newMinStock;

    // Actualizar en base de datos
    const { error: updateErr } = await supabase
      .from("inventory_items")
      .update(updatePayload)
      .eq("id", itemId)
      .eq("tenant_id", tenantId);

    if (updateErr) {
      console.error(`Error updating item ${update.sku}:`, updateErr.message);
      continue;
    }

    // Si cambió el stock, registrar el movimiento
    if (stockChanged) {
      const delta = newStock - oldStock;
      await supabase.from("inventory_movements").insert({
        tenant_id: tenantId,
        inventory_item_id: itemId,
        movement_type: "adjustment",
        quantity_delta: delta,
        previous_stock: oldStock,
        new_stock: newStock,
        source: "dashboard",
        notes: "Ajuste masivo por importación de Excel",
        created_by: user.id
      });
    }

    // Agregar a la lista para recalcular costos
    if (costChanged || stockChanged) {
      componentsToRecalculate.add(itemId);
    }

    updatedCount++;
  }

  // Recalcular costos para productos afectados
  if (componentsToRecalculate.size > 0) {
    for (const itemId of componentsToRecalculate) {
      try {
        await recalculateAllProductsByComponent(tenantId, itemId);
      } catch (recalcErr: any) {
        console.error(`Failed to recalculate costs for component ${itemId}:`, recalcErr.message);
      }
    }
  }

  revalidatePath("/dashboard/internal-stock");
  revalidatePath("/dashboard/products");

  return {
    success: true,
    updatedCount,
    skippedCount
  };
}
