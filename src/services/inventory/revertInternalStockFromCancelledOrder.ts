import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";

/**
 * Revierte el stock físico interno de los componentes cuando una orden es cancelada,
 * siempre y cuando el stock haya sido procesado previamente.
 */
export async function revertInternalStockFromCancelledOrder(tenantId: string, orderId: string) {
  const supabase = createAdminClient();

  // Obtener la orden y sus items
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(`
      id,
      meli_order_id,
      internal_stock_processed,
      internal_stock_reverted,
      order_items (
        product_id,
        quantity,
        title
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    logger.error(`No se encontró la orden ${orderId}`, "INVENTORY_SYNC");
    return { success: false, error: "Order not found" };
  }

  // Si no se procesó, no hay nada que revertir. Si ya se revirtió, no se hace dos veces.
  if (!order.internal_stock_processed || order.internal_stock_reverted) {
    return { success: true, message: "No action needed (not processed or already reverted)" };
  }

  const items = order.order_items || [];
  if (items.length === 0) return { success: true };

  let allMovements = [];

  for (const item of items) {
    if (!item.product_id) continue;

    // Obtener componentes del producto
    const { data: components } = await supabase
      .from("product_components")
      .select(`
        quantity,
        inventory_item_id,
        component_sku,
        inventory_items ( current_stock )
      `)
      .eq("tenant_id", tenantId)
      .eq("product_id", item.product_id);

    if (!components || components.length === 0) continue;

    for (const comp of components) {
      if (!comp.inventory_item_id) continue;

      const currentStock = (comp as any).inventory_items?.current_stock || 0;
      const compQtyRequired = comp.quantity || 1;
      const orderQty = item.quantity || 1;
      const returnQty = compQtyRequired * orderQty;

      const newStock = currentStock + returnQty;

      // Actualizar stock interno
      const { error: updateError } = await supabase
        .from("inventory_items")
        .update({ current_stock: newStock, updated_at: new Date().toISOString() })
        .eq("id", comp.inventory_item_id);

      if (updateError) {
        logger.error(`Error revirtiendo stock interno del componente ${comp.component_sku}: ${updateError.message}`, "INVENTORY_SYNC");
        continue;
      }

      // Crear movimiento de inventario
      await supabase.from("inventory_movements").insert({
        tenant_id: tenantId,
        inventory_item_id: comp.inventory_item_id,
        movement_type: "return",
        quantity_delta: returnQty,
        previous_stock: currentStock,
        new_stock: newStock,
        source: "mercadolibre_order_cancellation",
        reference_id: order.id,
        notes: `Devolución/Cancelación ML Orden #${order.meli_order_id} - Producto: ${item.title}`
      });

      allMovements.push({
        sku: comp.component_sku,
        previous: currentStock,
        new: newStock
      });
    }
  }

  // Marcar orden como revertida
  await supabase
    .from("orders")
    .update({ internal_stock_reverted: true, internal_stock_reverted_at: new Date().toISOString() })
    .eq("id", order.id);

  return { success: true, movements: allMovements };
}
