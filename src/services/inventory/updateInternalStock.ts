import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Actualiza el stock interno de un componente en depósito y registra el movimiento de auditoría.
 */
export async function updateInternalStock(tenantId: string, inventoryItemId: string, newValue: number, source: string = 'ai_agent') {
  const supabase = createAdminClient();

  // Obtener stock previo
  const { data: item, error: fetchError } = await supabase
    .from("inventory_items")
    .select("current_stock")
    .eq("id", inventoryItemId)
    .eq("tenant_id", tenantId)
    .single();

  if (fetchError || !item) {
    throw new Error(`Inventory item no encontrado: ${inventoryItemId}`);
  }

  const previousStock = item.current_stock;
  const quantityDelta = newValue - previousStock;

  if (quantityDelta === 0) return { success: true, message: "Sin cambios" };

  // Actualizar stock
  const { error: updateError } = await supabase
    .from("inventory_items")
    .update({ current_stock: newValue, updated_at: new Date().toISOString() })
    .eq("id", inventoryItemId)
    .eq("tenant_id", tenantId);

  if (updateError) {
    throw new Error(`Error actualizando stock interno: ${updateError.message}`);
  }

  // Registrar movimiento
  await supabase
    .from("inventory_movements")
    .insert({
      tenant_id: tenantId,
      inventory_item_id: inventoryItemId,
      movement_type: "adjustment",
      quantity_delta: quantityDelta,
      previous_stock: previousStock,
      new_stock: newValue,
      source: source,
      notes: "Ajuste manual de stock por IA"
    });

  return { success: true, previous_stock: previousStock, new_stock: newValue };
}
