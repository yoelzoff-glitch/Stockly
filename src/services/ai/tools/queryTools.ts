// src/services/ai/tools/queryTools.ts
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeSku } from "@/services/products/sku/normalizeSku";
import { parseCompositeSku } from "@/services/products/sku/parseCompositeSku";

/**
 * Obtiene el stock físico real de un componente específico en el depósito.
 */
export async function getComponentStock(tenantId: string, sku: string) {
  const supabase = createAdminClient();
  const normSku = normalizeSku(sku);

  const { data: item, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("sku_normalized", normSku)
    .single();

  if (error || !item) {
    return { message: `No encontré ningún componente con SKU "${sku}" en el depósito.` };
  }

  const alert = item.minimum_stock && item.current_stock < item.minimum_stock
    ? `⚠️ ALERTA: El stock (${item.current_stock}) está por debajo del mínimo de seguridad (${item.minimum_stock}).`
    : "";

  return {
    sku: item.sku,
    sku_normalized: item.sku_normalized,
    name: item.name || "Componente sin nombre",
    current_stock: item.current_stock,
    minimum_stock: item.minimum_stock,
    average_cost: item.average_cost ? `$${Number(item.average_cost).toLocaleString()}` : "No cargado",
    last_purchase_cost: item.last_purchase_cost ? `$${Number(item.last_purchase_cost).toLocaleString()}` : "No cargado",
    alert
  };
}

/**
 * Calcula cuántos combos (publicación compuesta) se pueden armar a partir del stock real disponible de sus componentes.
 */
export async function getComboStock(tenantId: string, query: string) {
  const supabase = createAdminClient();
  
  // Buscar el producto
  const normQuery = normalizeSku(query);
  const { data: products, error } = await supabase
    .from("products")
    .select("id, title, sku, available_quantity")
    .eq("tenant_id", tenantId)
    .or(`sku.eq.${query},sku.eq.${normQuery},title.ilike.%${query}%`)
    .limit(5);

  if (error || !products || products.length === 0) {
    // Si no es un producto cargado, intentamos parsearlo directamente como un SKU compuesto crudo
    const parsed = parseCompositeSku(query);
    if (parsed.components.length > 0) {
      const compCounts: Record<string, number> = {};
      for (const comp of parsed.components) {
        compCounts[comp] = (compCounts[comp] || 0) + 1;
      }

      const uniqueComps = Object.keys(compCounts);
      const { data: items } = await supabase
        .from("inventory_items")
        .select("sku_normalized, current_stock")
        .eq("tenant_id", tenantId)
        .in("sku_normalized", uniqueComps);

      const stockMap = new Map<string, number>();
      items?.forEach(i => stockMap.set(i.sku_normalized, i.current_stock));

      let maxComboStock = Infinity;
      const details = [];

      for (const [comp, reqQty] of Object.entries(compCounts)) {
        const available = stockMap.get(comp) || 0;
        const potential = Math.floor(available / reqQty);
        if (potential < maxComboStock) maxComboStock = potential;
        details.push({
          component: comp,
          required: reqQty,
          available,
          potential
        });
      }

      const finalComboStock = maxComboStock === Infinity ? 0 : maxComboStock;

      return {
        is_raw_sku: true,
        sku_parsed: query,
        components_found: details,
        available_combo_stock: finalComboStock,
        message: `El combo analizado "${query}" tiene componentes para fabricar **${finalComboStock}** unidad(es) en depósito.`
      };
    }

    return { error: `No encontré el producto o combo "${query}".` };
  }

  if (products.length > 1) {
    const list = products.map(p => `- ${p.title} (SKU: ${p.sku || 'N/A'})`).join('\n');
    return { message: `Encontré varios combos parecidos. ¿De cuál querés calcular el stock de depósito?\n\n${list}` };
  }

  const product = products[0];

  // Buscar componentes del producto
  const { data: components } = await supabase
    .from("product_components")
    .select(`
      quantity,
      component_normalized,
      inventory_items (
        current_stock
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("product_id", product.id);

  if (!components || components.length === 0) {
    return {
      product_id: product.id,
      title: product.title,
      sku: product.sku,
      meli_stock: product.available_quantity,
      available_combo_stock: 0,
      message: `El producto "${product.title}" no está configurado con componentes en Stockly. Su stock publicado en Mercado Libre es de ${product.available_quantity} unidades.`
    };
  }

  let maxComboStock = Infinity;
  const details = [];

  for (const comp of components) {
    const itemStock = (comp as any).inventory_items?.current_stock || 0;
    const reqQty = comp.quantity || 1;
    const potential = Math.floor(itemStock / reqQty);
    if (potential < maxComboStock) maxComboStock = potential;

    details.push({
      component: comp.component_normalized,
      required: reqQty,
      available: itemStock,
      potential
    });
  }

  const finalComboStock = maxComboStock === Infinity ? 0 : maxComboStock;

  let alertMsg = "";
  if (finalComboStock < product.available_quantity) {
    alertMsg = `⚠️ ALERTA: Tienes ${product.available_quantity} disponibles en Mercado Libre, pero en tu depósito físico solo cuentas con componentes para armar **${finalComboStock}** combos. ¡Riesgo de quiebre de stock real!`;
  }

  return {
    product_id: product.id,
    title: product.title,
    sku: product.sku,
    meli_stock: product.available_quantity,
    available_combo_stock: finalComboStock,
    details,
    alert: alertMsg,
    message: `La publicación "${product.title}" (SKU: ${product.sku || 'N/A'}) tiene stock en Mercado Libre de ${product.available_quantity} unidades, pero según el depósito físico puedes armar **${finalComboStock}** combos.`
  };
}

/**
 * Obtiene qué publicaciones de Mercado Libre contienen o usan un determinado componente interno.
 */
export async function getProductsUsingComponent(tenantId: string, sku: string) {
  const supabase = createAdminClient();
  const normSku = normalizeSku(sku);

  const { data: mappings, error } = await supabase
    .from("product_components")
    .select(`
      product_id,
      quantity,
      products (
        title,
        sku,
        price,
        available_quantity
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("component_normalized", normSku);

  if (error || !mappings || mappings.length === 0) {
    return { message: `Ninguna publicación de Mercado Libre está vinculada con el componente "${sku}".` };
  }

  const list = mappings.map((m: any) => {
    const p = m.products;
    return `- **${p?.title || "Sin título"}** (SKU: ${p?.sku || "N/A"}) - Requiere: ${m.quantity} unidad(es) - Stock ML: ${p?.available_quantity || 0}`;
  }).join("\n");

  return {
    component: sku,
    component_normalized: normSku,
    affected_count: mappings.length,
    list,
    message: `Encontré **${mappings.length}** publicación(es) que usan el componente "${sku}":\n\n${list}`
  };
}

/**
 * Obtiene qué componentes internos del depósito están faltantes o en quiebre de stock,
 * impidiendo la fabricación o entrega de combos.
 */
export async function getOutOfStockComponents(tenantId: string) {
  const supabase = createAdminClient();

  // Buscar componentes con stock <= minimum_stock o stock = 0
  const { data: items, error } = await supabase
    .from("inventory_items")
    .select("id, sku, sku_normalized, current_stock, minimum_stock")
    .eq("tenant_id", tenantId)
    .or("current_stock.eq.0,current_stock.lt.minimum_stock");

  if (error || !items || items.length === 0) {
    return { message: "✅ ¡Excelente! No tienes componentes faltantes o por debajo del stock mínimo en tu depósito." };
  }

  const details = [];
  for (const item of items) {
    // Buscar qué publicaciones dependen de este componente
    const { data: mappings } = await supabase
      .from("product_components")
      .select("product_id")
      .eq("tenant_id", tenantId)
      .eq("inventory_item_id", item.id);

    const affectedCount = mappings ? mappings.length : 0;

    details.push({
      sku: item.sku,
      current_stock: item.current_stock,
      minimum_stock: item.minimum_stock || 0,
      affected_publications: affectedCount
    });
  }

  const list = details.map(d => 
    `- **${d.sku}**: Stock actual: **${d.current_stock}** (Mínimo: ${d.minimum_stock}) - Afecta a **${d.affected_publications}** publicación(es)`
  ).join("\n");

  return {
    items: details,
    list,
    message: `⚠️ Encontré **${details.length}** componentes en depósito con stock crítico o faltantes:\n\n${list}`
  };
}

/**
 * Obtiene el detalle de costeo y componentes de un combo.
 */
export async function getProductComponentsCostDetail(tenantId: string, query: string) {
  const supabase = createAdminClient();
  const normQuery = normalizeSku(query);

  const { data: products, error } = await supabase
    .from("products")
    .select("id, title, sku, price, cost, raw_data")
    .eq("tenant_id", tenantId)
    .or(`sku.eq.${query},sku.eq.${normQuery},title.ilike.%${query}%`)
    .limit(5);

  if (error || !products || products.length === 0) {
    return { error: `No encontré el producto o combo "${query}".` };
  }

  if (products.length > 1) {
    const list = products.map(p => `- ${p.title} (SKU: ${p.sku || 'N/A'})`).join('\n');
    return { message: `Encontré varios combos parecidos. ¿De cuál querés ver el detalle de costo?\n\n${list}` };
  }

  const product = products[0];
  const breakdown = product.raw_data?.cost_breakdown;

  if (!breakdown) {
    return {
      product_id: product.id,
      title: product.title,
      sku: product.sku,
      price: product.price,
      cost: product.cost || "No configurado",
      message: `El producto "${product.title}" no tiene desglose de costos de componentes calculado aún. Su costo base configurado es $${product.cost || 0}.`
    };
  }

  let compsText = "";
  if (breakdown.components && breakdown.components.length > 0) {
    compsText = "📦 **Componentes:**\n" + breakdown.components.map((c: any) => 
      `- ${c.sku}: ${c.qty} unidad(es) x $${c.unit_cost?.toLocaleString()} = **$${c.total?.toLocaleString()}**`
    ).join("\n");
  } else {
    compsText = "📦 Sin componentes asociados.";
  }

  let extrasText = "";
  if (breakdown.extra_costs && breakdown.extra_costs.length > 0) {
    extrasText = "\n\n💸 **Costos extra:**\n" + breakdown.extra_costs.map((e: any) => 
      `- ${e.name}: **$${e.amount?.toLocaleString()}**`
    ).join("\n");
  }

  const commission = product.raw_data?.fees?.commission_amount || 0;
  const shipping = product.raw_data?.fees?.shipping_cost || 0;
  const profit = product.price - breakdown.total_cost - commission - shipping;
  const margin = product.price > 0 ? (profit / product.price) * 100 : 0;

  const summary = `\n\n💰 **Rentabilidad Real Estimada:**
- Precio de venta: **$${product.price?.toLocaleString()}**
- Costo calculado total: **$${breakdown.total_cost?.toLocaleString()}**
- Comisión ML: **$${commission?.toLocaleString()}**
- Envío ML: **$${shipping?.toLocaleString()}**
- **Ganancia Neta:** **$${profit?.toLocaleString()}**
- **Margen Real:** **${margin.toFixed(1)}%**`;

  return {
    product_id: product.id,
    title: product.title,
    sku: product.sku,
    breakdown,
    message: `Aquí tienes el detalle del costo real calculado para **"${product.title}"** (SKU: ${product.sku || 'N/A'}):\n\n${compsText}${extrasText}${summary}`
  };
}

/**
 * Muestra las publicaciones donde Mercado Libre tiene más stock publicado que el stock interno disponible en depósito.
 */
export async function getStockInconsistencies(tenantId: string) {
  const supabase = createAdminClient();

  const { data: products, error } = await supabase
    .from("products")
    .select("id, title, sku, available_quantity")
    .eq("tenant_id", tenantId)
    .gt("available_quantity", 0);

  if (error || !products || products.length === 0) {
    return { message: "No hay productos con stock en Mercado Libre para analizar." };
  }

  const inconsistencies = [];

  for (const product of products) {
    // Buscar componentes
    const { data: components } = await supabase
      .from("product_components")
      .select(`quantity, component_normalized, inventory_items ( current_stock )`)
      .eq("tenant_id", tenantId)
      .eq("product_id", product.id);

    if (!components || components.length === 0) continue;

    let maxComboStock = Infinity;
    for (const comp of components) {
      const itemStock = (comp as any).inventory_items?.current_stock || 0;
      const reqQty = comp.quantity || 1;
      const potential = Math.floor(itemStock / reqQty);
      if (potential < maxComboStock) maxComboStock = potential;
    }

    const finalComboStock = maxComboStock === Infinity ? 0 : maxComboStock;

    if (product.available_quantity > finalComboStock) {
      inconsistencies.push({
        title: product.title,
        sku: product.sku,
        meli_stock: product.available_quantity,
        internal_stock: finalComboStock
      });
    }
  }

  if (inconsistencies.length === 0) {
    return { message: "✅ ¡Excelente! Tu stock publicado en Mercado Libre no excede la capacidad de tu depósito físico." };
  }

  const list = inconsistencies.map(i => 
    `- **${i.title}** (SKU: ${i.sku || 'N/A'})\n  Stock ML: **${i.meli_stock}** vs Stock Interno Posible: **${i.internal_stock}**`
  ).join("\n\n");

  return {
    inconsistencies,
    message: `⚠️ Encontré **${inconsistencies.length}** publicación(es) donde estás ofreciendo más stock en Mercado Libre del que realmente tienes en el depósito:\n\n${list}\n\nTe sugiero ajustar el stock en Mercado Libre para evitar quiebres.`
  };
}
