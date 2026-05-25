// src/services/ai/actions/registerPurchaseAction.ts
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateAverageCost } from "@/services/inventory/calculateAverageCost";
import { recalculateAllProductsByComponent } from "@/services/inventory/recalculateProductCostFromComponents";

/**
 * Ejecuta el registro definitivo de una compra interna confirmada.
 * Crea la orden de compra, incrementa stock físico, recalcula costos promedio,
 * genera movimientos de inventario y gatilla el recálculo de costos de las publicaciones.
 * 
 * @param tenantId Identificador del comercio
 * @param payload Objeto con items, supplier_name y extra_costs de la compra
 */
export async function executeRegisterPurchase(tenantId: string, payload: any) {
  const supabase = createAdminClient();

  if (!payload || !payload.items || payload.items.length === 0) {
    throw new Error("No purchase items found in payload.");
  }

  // 1. Crear Purchase Order cabecera
  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .insert({
      tenant_id: tenantId,
      supplier_name: payload.supplier_name || null,
      extra_costs: payload.extra_costs || 0,
      status: "completed",
      source: "ai",
      raw_input: null,
      created_by: null
    })
    .select("id")
    .single();

  if (poErr || !po) {
    throw new Error(`Failed to create purchase order: ${poErr?.message}`);
  }

  let totalAmount = 0;

  // 2. Procesar cada item comprado
  for (const item of payload.items) {
    const skuNorm = item.sku_normalized;
    const qty = Number(item.quantity);
    const unitCost = item.unit_cost !== null && item.unit_cost !== undefined ? Number(item.unit_cost) : null;

    // Buscar o crear inventory_item
    let { data: invItem, error: fetchErr } = await supabase
      .from("inventory_items")
      .select("id, current_stock, average_cost")
      .eq("tenant_id", tenantId)
      .eq("sku_normalized", skuNorm)
      .single();

    if (fetchErr || !invItem) {
      // Si no existe (caso raro porque se valida en prepare, pero por seguridad), lo creamos
      const { data: newItem, error: createErr } = await supabase
        .from("inventory_items")
        .insert({
          tenant_id: tenantId,
          sku: item.sku || skuNorm,
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
    const { error: movErr } = await supabase
      .from("inventory_movements")
      .insert({
        tenant_id: tenantId,
        inventory_item_id: invItem.id,
        movement_type: "purchase",
        quantity_delta: qty,
        previous_stock: oldStock,
        new_stock: newStock,
        unit_cost: unitCost,
        total_cost: totalItemCost,
        source: "ai",
        reference_id: po.id,
        notes: payload.supplier_name ? `Compra registrada de ${payload.supplier_name}` : "Compra registrada por IA"
      });

    if (movErr) {
      console.error("Error creating inventory movement:", movErr.message);
    }

    // 6. Crear Purchase Order Item
    const { error: poItemErr } = await supabase
      .from("purchase_order_items")
      .insert({
        tenant_id: tenantId,
        purchase_order_id: po.id,
        inventory_item_id: invItem.id,
        sku: item.sku || skuNorm,
        sku_normalized: skuNorm,
        quantity: qty,
        unit_cost: unitCost,
        total_cost: totalItemCost
      });

    if (poItemErr) {
      console.error("Error creating purchase order item:", poItemErr.message);
    }

    // 7. Recalcular costos de productos ML que usan este componente
    try {
      await recalculateAllProductsByComponent(tenantId, invItem.id);
    } catch (recalcErr: any) {
      console.error(`Failed to recalculate products for component ${skuNorm}:`, recalcErr.message);
    }
  }

  // 8. Actualizar monto total en la Purchase Order cabecera
  const finalTotalAmount = totalAmount + (payload.extra_costs || 0);
  await supabase
    .from("purchase_orders")
    .update({ total_amount: finalTotalAmount })
    .eq("id", po.id);

  return { success: true, purchase_order_id: po.id };
}
