import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";

/**
 * Descuenta el stock físico interno de los componentes que conforman los productos de una orden de Mercado Libre.
 */
export async function decrementInternalStockFromOrder(tenantId: string, orderId: string) {
  const supabase = createAdminClient();

  // Obtener la orden y sus items
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(`
      id,
      meli_order_id,
      internal_stock_processed,
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

  if (order.internal_stock_processed) {
    return { success: true, message: "Internal stock already processed for this order" };
  }

  // Marcar orden como procesada de forma atómica para evitar race conditions
  const { data: updatedOrder, error: updateOrderError } = await supabase
    .from("orders")
    .update({ 
      internal_stock_processed: true, 
      internal_stock_processed_at: new Date().toISOString() 
    })
    .eq("id", order.id)
    .eq("tenant_id", tenantId)
    .eq("internal_stock_processed", false)
    .select("id");

  if (updateOrderError || !updatedOrder || updatedOrder.length === 0) {
    return { success: true, message: "Internal stock already processed or processing in another thread" };
  }

  const items = order.order_items || [];
  if (items.length === 0) return { success: true };

  let allMovements = [];

  for (const item of items) {
    if (!item.product_id) continue; // No mapeado a producto local

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

    if (!components || components.length === 0) continue; // Producto simple sin componentes registrados en interno

    for (const comp of components) {
      if (!comp.inventory_item_id) continue;

      const currentStock = (comp as any).inventory_items?.current_stock || 0;
      const compQtyRequired = comp.quantity || 1;
      const orderQty = item.quantity || 1;
      const requiredQty = compQtyRequired * orderQty;

      const newStock = currentStock - requiredQty;

      // Actualizar stock interno
      const { error: updateError } = await supabase
        .from("inventory_items")
        .update({ current_stock: newStock, updated_at: new Date().toISOString() })
        .eq("id", comp.inventory_item_id);

      if (updateError) {
        logger.error(`Error actualizando stock interno del componente ${comp.component_sku}: ${updateError.message}`, "INVENTORY_SYNC");
        continue;
      }

      // Crear movimiento de inventario
      await supabase.from("inventory_movements").insert({
        tenant_id: tenantId,
        inventory_item_id: comp.inventory_item_id,
        movement_type: "sale_confirmed",
        quantity_delta: -requiredQty,
        previous_stock: currentStock,
        new_stock: newStock,
        source: "mercadolibre_order",
        reference_id: order.id,
        notes: `Venta ML Orden #${order.meli_order_id} - Producto: ${item.title}`
      });

      allMovements.push({
        sku: comp.component_sku,
        previous: currentStock,
        new: newStock
      });

      if (newStock < 0) {
        logger.warn(`Stock interno negativo para ${comp.component_sku}. Revisá inventario.`, "INVENTORY_SYNC");
      }
    }
  }

  return { success: true, movements: allMovements };
}
