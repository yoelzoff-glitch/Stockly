// src/services/inventory/recalculateProductCostFromComponents.ts
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Recalcula el costo total de un producto de Mercado Libre a partir de sus componentes de inventario
 * y los costos extra activos (embalaje, bolsas, comisiones fijas, etc.).
 * 
 * Regla:
 * products.cost = sum(component_average_cost * quantity) + extra_costs
 * 
 * Almacena el desglose detallado en products.raw_data.cost_breakdown.
 * 
 * @param tenantId Identificador único del comercio (tenant)
 * @param productId Identificador del producto en Mercado Libre a recalcular
 */
export async function recalculateProductCostFromComponents(tenantId: string, productId: string) {
  const supabase = createAdminClient();

  // 1. Obtener el producto
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, sku, title, price, category_id, raw_data")
    .eq("tenant_id", tenantId)
    .eq("id", productId)
    .single();

  if (productError || !product) {
    throw new Error(`Product not found: ${productId}`);
  }

  // 2. Obtener los componentes del producto e inventory_items relacionados
  const { data: components, error: componentsError } = await supabase
    .from("product_components")
    .select(`
      id,
      component_sku,
      component_normalized,
      quantity,
      inventory_item_id,
      inventory_items (
        average_cost
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("product_id", productId);

  if (componentsError) {
    throw new Error(`Error fetching product components: ${componentsError.message}`);
  }

  // 3. Obtener todos los costos extra activos
  const { data: extraCosts, error: extraCostsError } = await supabase
    .from("product_extra_costs")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (extraCostsError) {
    throw new Error(`Error fetching extra costs: ${extraCostsError.message}`);
  }

  // 4. Calcular el costo por componentes
  let componentsTotalCost = 0;
  const componentsBreakdown = [];

  for (const comp of (components || [])) {
    const inventoryItem = (comp as any).inventory_items;
    const unitCost = inventoryItem?.average_cost ? Number(inventoryItem.average_cost) : 0;
    const qty = comp.quantity || 1;
    const totalCompCost = unitCost * qty;

    componentsTotalCost += totalCompCost;

    // Actualizar el unit_cost y total_component_cost en product_components para mantener consistencia
    await supabase
      .from("product_components")
      .update({
        unit_cost: unitCost,
        total_component_cost: totalCompCost,
        updated_at: new Date().toISOString()
      })
      .eq("id", comp.id);

    componentsBreakdown.push({
      sku: comp.component_normalized,
      qty,
      unit_cost: unitCost,
      total: totalCompCost
    });
  }

  // 5. Filtrar y sumar costos extra activos
  let extraCostsTotal = 0;
  const extraCostsBreakdown = [];

  const productPrice = product.price || 0;

  for (const cost of (extraCosts || [])) {
    let applies = false;

    if (cost.applies_to === "all") {
      applies = true;
    } else if (cost.applies_to === "product" && cost.product_id === productId) {
      applies = true;
    } else if (cost.applies_to === "category" && product.category_id) {
      // Si aplica a categoría, puede coincidir por el nombre de la categoría o si coincide en metadata
      // de forma simple comparamos el name del costo extra o si coincide con el id de categoría
      if (cost.name.toLowerCase() === product.category_id.toLowerCase() || 
          (cost.metadata && cost.metadata.category_id === product.category_id)) {
        applies = true;
      }
    }

    if (applies) {
      let costAmount = 0;
      if (cost.cost_type === "fixed") {
        costAmount = Number(cost.amount);
      } else if (cost.cost_type === "percent") {
        costAmount = (Number(cost.amount) * productPrice) / 100;
      }

      extraCostsTotal += costAmount;
      extraCostsBreakdown.push({
        name: cost.name,
        amount: costAmount,
        type: cost.cost_type,
        rate: cost.amount
      });
    }
  }

  // 6. Costo total
  const totalCost = Number((componentsTotalCost + extraCostsTotal).toFixed(2));

  // 7. Guardar en raw_data y actualizar el producto
  const rawData = product.raw_data || {};
  const costBreakdown = {
    components: componentsBreakdown,
    extra_costs: extraCostsBreakdown,
    total_cost: totalCost,
    calculated_at: new Date().toISOString()
  };

  const updatedRawData = {
    ...rawData,
    cost_breakdown: costBreakdown
  };

  // Calcular el nuevo margen si es posible
  let marginAmount = undefined;
  let marginPercent = undefined;
  let profitReal = undefined;
  let profitRealMargin = undefined;

  const commission = product.raw_data?.fees?.commission_amount || 0;
  const shipping = product.raw_data?.fees?.shipping_cost || 0;

  marginAmount = productPrice - totalCost;
  marginPercent = productPrice > 0 ? (marginAmount / productPrice) * 100 : 0;

  // Rentabilidad real
  profitReal = productPrice - totalCost - commission - shipping;
  profitRealMargin = productPrice > 0 ? (profitReal / productPrice) * 100 : 0;

  const { error: updateError } = await supabase
    .from("products")
    .update({
      cost: totalCost,
      margin_amount: marginAmount,
      margin_percent: marginPercent,
      raw_data: updatedRawData
    })
    .eq("tenant_id", tenantId)
    .eq("id", productId);

  if (updateError) {
    throw new Error(`Failed to update product cost: ${updateError.message}`);
  }

  return costBreakdown;
}

/**
 * Recalcula los costos de todos los productos vinculados a un componente de inventario específico.
 * Útil tras registrar una compra de insumos/componentes para actualizar todas las publicaciones compuestas.
 * 
 * @param tenantId Identificador único del comercio
 * @param inventoryItemId Identificador del componente del inventario
 */
export async function recalculateAllProductsByComponent(tenantId: string, inventoryItemId: string) {
  const supabase = createAdminClient();

  const { data: relatedComps, error } = await supabase
    .from("product_components")
    .select("product_id")
    .eq("tenant_id", tenantId)
    .eq("inventory_item_id", inventoryItemId);

  if (error || !relatedComps) return [];

  const results = [];
  for (const rc of relatedComps) {
    try {
      const breakdown = await recalculateProductCostFromComponents(tenantId, rc.product_id);
      results.push({ product_id: rc.product_id, success: true, breakdown });
    } catch (e: any) {
      console.error(`Failed to recalculate cost for product ${rc.product_id}:`, e.message);
      results.push({ product_id: rc.product_id, success: false, error: e.message });
    }
  }

  return results;
}
