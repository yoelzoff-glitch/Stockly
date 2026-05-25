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
  return items || [];
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
