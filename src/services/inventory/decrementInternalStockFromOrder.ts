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
        title,
        sku
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

  const items = order.order_items || [];
  if (items.length === 0) {
    return { success: false, error: "No items found in database for this order yet" };
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

  try {

    let allMovements = [];

    for (const item of items) {
      let components: Array<{ quantity: number; inventory_item_id: string; component_sku: string; current_stock?: number }> = [];

      // 1. Si existe product_id, intentar buscar en product_components
      if (item.product_id) {
        const { data: existingComps } = await supabase
          .from("product_components")
          .select(`
            quantity,
            inventory_item_id,
            component_sku,
            inventory_items ( current_stock )
          `)
          .eq("tenant_id", tenantId)
          .eq("product_id", item.product_id);

        if (existingComps && existingComps.length > 0) {
          components = existingComps.map(c => ({
            quantity: c.quantity,
            inventory_item_id: c.inventory_item_id,
            component_sku: c.component_sku,
            current_stock: (c as any).inventory_items?.current_stock || 0
          }));
        }
      }

      // 2. Si no hay componentes en product_components, hacer resolución DIRECTA por SKU (Fail-Safe en caliente)
      if (components.length === 0 && item.sku) {
        const { parseCompositeSku } = await import("../products/sku/parseCompositeSku");
        const parsed = parseCompositeSku(item.sku);

        if (parsed.components.length > 0) {
          const { data: invItems } = await supabase
            .from("inventory_items")
            .select("id, sku_normalized, current_stock")
            .eq("tenant_id", tenantId)
            .in("sku_normalized", parsed.components);

          if (invItems && invItems.length > 0) {
            const itemMap = new Map(invItems.map(i => [i.sku_normalized, i]));
            const compCounts: Record<string, number> = {};
            for (const comp of parsed.components) {
              compCounts[comp] = (compCounts[comp] || 0) + 1;
            }

            const newCompsToInsert = [];
            for (const [compSku, qty] of Object.entries(compCounts)) {
              const matchedInv = itemMap.get(compSku);
              if (matchedInv) {
                components.push({
                  quantity: qty,
                  inventory_item_id: matchedInv.id,
                  component_sku: compSku,
                  current_stock: matchedInv.current_stock || 0
                });

                if (item.product_id) {
                  newCompsToInsert.push({
                    tenant_id: tenantId,
                    product_id: item.product_id,
                    inventory_item_id: matchedInv.id,
                    component_sku: compSku,
                    component_normalized: compSku,
                    quantity: qty
                  });
                }
              }
            }

            // Auto-guardar la vinculación en product_components para dejar sincronizada la UI
            if (newCompsToInsert.length > 0 && item.product_id) {
              const { error: insErr } = await supabase.from("product_components").insert(newCompsToInsert);
              if (insErr) {
                logger.warn(`Could not auto-insert product_components: ${insErr.message}`, "INVENTORY_SYNC");
              }
            }
          }
        }
      }

      if (components.length === 0) continue; // No hay equivalencia de inventario interno para este ítem

      for (const comp of components) {
        if (!comp.inventory_item_id) continue;

        const currentStock = comp.current_stock !== undefined 
          ? comp.current_stock 
          : ((comp as any).inventory_items?.current_stock || 0);
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

    if (allMovements.length === 0) {
      // Revertir marca de procesado ya que no se creó ningún descuento real (ej: producto sin componentes mapeados en ese momento)
      await supabase
        .from("orders")
        .update({
          internal_stock_processed: false,
          internal_stock_processed_at: null
        })
        .eq("id", order.id);
      return { success: false, error: "No inventory component movements created for this order" };
    }

    return { success: true, movements: allMovements };
  } catch (err: any) {
    // Revertir el estado de procesado en caso de error crítico
    await supabase
      .from("orders")
      .update({
        internal_stock_processed: false,
        internal_stock_processed_at: null
      })
      .eq("id", order.id);
    logger.error(`Error procesando decremento de stock, revertido estado de orden: ${err.message}`, "INVENTORY_SYNC");
    throw err;
  }
}
