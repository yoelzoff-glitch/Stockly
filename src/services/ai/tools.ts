import { createAdminClient } from "@/lib/supabase/admin";
import { resolveProduct } from "@/services/products/resolveProduct";

/**
 * Obtiene el total facturado y la cantidad de órdenes del día de hoy.
 * 
 * @param tenantId Identificador del comercio
 * @returns Promesa con las ventas y cantidad de órdenes del día
 */
export async function getTodaySales(tenantId: string) {
  const supabase = createAdminClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("orders")
    .select("total_amount")
    .eq("tenant_id", tenantId)
    .gte("date_created", today.toISOString());

  if (error) throw error;

  const total = data.reduce((acc, order) => acc + (Number(order.total_amount) || 0), 0);
  return { sales: total, count: data.length };
}

/**
 * Obtiene el total facturado y la cantidad de órdenes de los últimos 7 días.
 * 
 * @param tenantId Identificador del comercio
 * @returns Promesa con las ventas y cantidad de órdenes de la última semana
 */
export async function getWeeklySales(tenantId: string) {
  const supabase = createAdminClient();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("orders")
    .select("total_amount")
    .eq("tenant_id", tenantId)
    .gte("date_created", weekAgo.toISOString());

  if (error) throw error;

  const total = data.reduce((acc, order) => acc + (Number(order.total_amount) || 0), 0);
  return { sales: total, count: data.length };
}

/**
 * Obtiene el total facturado y la cantidad de órdenes de los últimos N días.
 * 
 * @param tenantId Identificador del comercio
 * @param days Cantidad de días a analizar
 * @returns Promesa con las ventas y cantidad de órdenes del período
 */
export async function getSalesByDays(tenantId: string, days: number) {
  const supabase = createAdminClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("orders")
    .select("total_amount")
    .eq("tenant_id", tenantId)
    .gte("date_created", startDate.toISOString());

  if (error) throw error;

  const total = data.reduce((acc, order) => acc + (Number(order.total_amount) || 0), 0);
  return { sales: total, count: data.length, days };
}

/**
 * Recupera la lista de productos cuyo stock disponible es crítico (5 unidades o menos).
 * 
 * @param tenantId Identificador del comercio
 * @returns Promesa con los productos con stock bajo
 */
export async function getLowStockProducts(tenantId: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("products")
    .select("title, available_quantity")
    .eq("tenant_id", tenantId)
    .lte("available_quantity", 5)
    .order("available_quantity", { ascending: true });

  if (error) throw error;

  return data;
}

/**
 * Busca productos en la base de datos coincidiendo parcialmente por título, SKU o Item ID de ML.
 * 
 * @param tenantId Identificador del comercio
 * @param query Término de búsqueda
 * @returns Promesa con hasta 5 productos coincidentes
 */
export async function searchProductByName(tenantId: string, query: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("products")
    .select("id, title, sku, price, available_quantity, sold_quantity, status")
    .eq("tenant_id", tenantId)
    .or(`sku.eq."${query}",meli_item_id.ilike."*${query}*",title.ilike."*${query}*"`)
    .limit(5);

  if (error) throw error;

  return data;
}

/**
 * Obtiene los productos más vendidos del comercio.
 * 
 * @param tenantId Identificador del comercio
 * @param limit Cantidad máxima de productos a devolver (por defecto 5)
 * @returns Promesa con los productos top en ventas
 */
export async function getTopProducts(tenantId: string, limit: number = 5) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("products")
    .select("title, sold_quantity")
    .eq("tenant_id", tenantId)
    .order("sold_quantity", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data;
}

/**
 * Compara las ventas de dos períodos consecutivos de igual duración.
 * Útil para ver el crecimiento o caída de ventas respecto al período anterior.
 * 
 * @param tenantId Identificador del comercio
 * @param currentDays Cantidad de días del período actual
 * @param previousDays Cantidad de días adicionales del período anterior
 * @returns Promesa con la comparación de ventas
 */
export async function compareSalesPeriods(tenantId: string, currentDays: number, previousDays: number) {
  const supabase = createAdminClient();
  const now = new Date();
  
  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - currentDays);
  
  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - previousDays);

  const { data: currentData } = await supabase
    .from("orders")
    .select("total_amount")
    .eq("tenant_id", tenantId)
    .gte("date_created", currentStart.toISOString());

  const { data: previousData } = await supabase
    .from("orders")
    .select("total_amount")
    .eq("tenant_id", tenantId)
    .gte("date_created", previousStart.toISOString())
    .lt("date_created", currentStart.toISOString());

  const currentTotal = currentData?.reduce((acc, order) => acc + (Number(order.total_amount) || 0), 0) || 0;
  const previousTotal = previousData?.reduce((acc, order) => acc + (Number(order.total_amount) || 0), 0) || 0;

  return {
    currentPeriodSales: currentTotal,
    previousPeriodSales: previousTotal,
    difference: currentTotal - previousTotal,
  };
}

/**
 * Recupera y detalla el análisis de rentabilidad unitaria de un producto específico, 
 * desglosando comisiones, envíos e impuestos adicionales.
 * 
 * @param tenantId Identificador del comercio
 * @param query Término de búsqueda para resolver el producto
 * @returns Promesa con el análisis detallado de rentabilidad del producto
 */
export async function getProductProfitability(tenantId: string, query: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("products")
    .select("id, title, sku, price, cost, estimated_fee, estimated_shipping_cost, margin_amount, margin_percent, profit_real_estimated, profit_real_margin, extra_fee_amount, promotion_discount_amount, profitability_status")
    .eq("tenant_id", tenantId)
    .or(`sku.eq."${query}",meli_item_id.ilike."*${query}*",title.ilike."*${query}*"`)
    .limit(1);

  if (error || !data || data.length === 0) return { error: "Product not found" };

  const p = data[0];
  
  if (p.cost === null || p.cost === undefined) {
    return {
      title: p.title,
      price: p.price,
      cost: "No definido",
      status: "Falta costo para calcular rentabilidad"
    };
  }

  return {
    product_id: p.id,
    title: p.title,
    sku: p.sku,
    price: p.price,
    cost: p.cost,
    estimated_fee: p.estimated_fee !== null ? p.estimated_fee : "Desconocida",
    estimated_shipping: p.estimated_shipping_cost !== null ? p.estimated_shipping_cost : "Desconocido",
    gross_profit_amount: p.margin_amount !== null ? p.margin_amount : "Incompleto",
    gross_margin_percentage: p.margin_percent !== null ? `${p.margin_percent}%` : "Incompleto",
    cost_installments_campaigns: p.extra_fee_amount,
    cost_promotions_coupons: p.promotion_discount_amount,
    net_real_profit_amount: p.profit_real_estimated !== null ? p.profit_real_estimated : (p.margin_amount !== null ? p.margin_amount : "Incompleto"),
    net_real_margin_percentage: p.profit_real_margin !== null ? `${p.profit_real_margin}%` : (p.margin_percent !== null ? `${p.margin_percent}%` : "Incompleto"),
    profitability_status: p.profitability_status
  };
}

// ==========================================
// SPRINT 11 & 12: Meli Preparatory Actions & Limits
// ==========================================

function calculateRisk(count: number, maxChangePct: number = 0, isPause: boolean = false): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (isPause && count > 5) return 'HIGH';
  if (isPause && count > 2) return 'MEDIUM';
  if (count > 10 || maxChangePct > 0.2) return 'HIGH';
  if (count > 5 || maxChangePct > 0.1) return 'MEDIUM';
  return 'LOW';
}

/**
 * Prepara (sin ejecutar en Mercado Libre) una actualización de precio de uno o múltiples productos.
 * Evalúa el riesgo del cambio e inserta una acción pendiente en la base de datos para confirmación.
 * 
 * @param tenantId Identificador del comercio
 * @param query Término de búsqueda del producto(s)
 * @param newPrice Nuevo precio fijo (opcional)
 * @param percentageChange Porcentaje de variación de precio (opcional)
 * @param allowMultiple Permite la afectación masiva de productos (por defecto falso)
 * @returns Promesa con el id de la acción pendiente y un mensaje de resumen
 */
export async function preparePriceUpdate(tenantId: string, query: string, newPrice?: number, percentageChange?: number, allowMultiple: boolean = false) {
  const supabase = createAdminClient();
  const resolution = await resolveProduct(tenantId, query);

  if (resolution.type === 'not_found') {
    return { error: resolution.error };
  }

  let products = [];
  if (resolution.type === 'multiple') {
    if (!allowMultiple) {
      const list = resolution.products.map(p => `- ${p.title} (SKU: ${p.sku || 'N/A'}, Precio: $${p.price})`).join('\n');
      return { message: `Encontré varios productos parecidos. ¿Cuál querés modificar?\n\n${list}\n\nPor favor, respóndeme con el SKU exacto o el nombre completo del que quieres elegir.` };
    }
    products = resolution.products;
  } else {
    products = [resolution.product];
  }

  if (products.length > 50) {
    return { error: "Cambio masivo excedido (>50 productos). Esta acción requiere revisión manual." };
  }

  let maxChange = 0;
  let previewList = "";

  const payload = products.map(p => {
    let finalPrice = newPrice;
    if (percentageChange) {
      finalPrice = p.price * (1 + (percentageChange / 100));
    }
    const finalV = Math.round(finalPrice || p.price);
    
    if (p.price > 0) {
      const changePct = Math.abs((finalV - p.price) / p.price);
      if (changePct > maxChange) maxChange = changePct;
    }

    previewList += `- ${p.title} (SKU: ${p.sku || 'N/A'})\n  Precio actual: $${p.price} -> Nuevo: $${finalV}\n`;

    return {
      product_id: p.id,
      title: p.title,
      current_value: p.price,
      new_value: finalV
    };
  });

  if (maxChange > 0.3) {
    return { error: `Cambio de precio excede el límite del 30% (${Math.round(maxChange * 100)}%). Esta acción requiere revisión manual.` };
  }

  const risk = calculateRisk(products.length, maxChange);

  const { data: action, error } = await supabase.from("ai_actions").insert({
    tenant_id: tenantId,
    action_type: "update_price",
    title: "Actualización de precio",
    payload: { items: payload, risk_score: risk },
    status: "pending"
  }).select("id").single();

  if (error) return { error: "No pude preparar la acción en la base de datos." };

  return {
    action_id: action.id,
    product_id: products[0].id,
    message: `Encontré ${payload.length} producto(s) afectados. Riesgo: ${risk}\n\n**PREVISUALIZACIÓN DE CAMBIOS:**\n${previewList}\nImpacto esperado: Actualización de precio en Mercado Libre.\n\n**IMPORTANTE:** Para ejecutar esto, por favor responde únicamente con la palabra: **CONFIRMO**`
  };
}

/**
 * Prepara (sin ejecutar en Mercado Libre) una actualización o modificación de stock de uno o múltiples productos.
 * Evalúa el riesgo del cambio e inserta una acción pendiente en la base de datos para confirmación.
 * 
 * @param tenantId Identificador del comercio
 * @param query Término de búsqueda del producto(s)
 * @param newQuantity Cantidad de stock a afectar
 * @param operation Tipo de operación ('set' fijo, 'add' sumar, 'subtract' restar)
 * @param allowMultiple Permite la afectación masiva de productos (por defecto falso)
 * @returns Promesa con el id de la acción pendiente y un mensaje de resumen
 */
export async function prepareStockUpdate(tenantId: string, query: string, newQuantity: number, operation: 'set' | 'add' | 'subtract' = 'set', allowMultiple: boolean = false) {
  const supabase = createAdminClient();
  const resolution = await resolveProduct(tenantId, query);

  if (resolution.type === 'not_found') {
    return { error: resolution.error };
  }

  let products = [];
  if (resolution.type === 'multiple') {
    if (!allowMultiple) {
      const list = resolution.products.map(p => `- ${p.title} (SKU: ${p.sku || 'N/A'}, Stock: ${p.available_quantity})`).join('\n');
      return { message: `Encontré varios productos parecidos. ¿Cuál querés modificar?\n\n${list}\n\nPor favor, respóndeme con el SKU exacto o el nombre completo del que quieres elegir.` };
    }
    products = resolution.products;
  } else {
    products = [resolution.product];
  }

  if (products.length > 50) {
    return { error: "Cambio masivo excedido (>50 productos). Esta acción requiere revisión manual." };
  }

  let maxChange = 0;
  let previewList = "";
  let hasNegativeStock = false;

  const payload = products.map(p => {
    let finalQty = newQuantity;
    if (operation === 'add') finalQty = p.available_quantity + newQuantity;
    if (operation === 'subtract') finalQty = Math.max(0, p.available_quantity - newQuantity);

    if (finalQty < 0) hasNegativeStock = true;

    if (p.available_quantity > 0) {
      const changePct = Math.abs((finalQty - p.available_quantity) / p.available_quantity);
      if (changePct > maxChange) maxChange = changePct;
    } else if (finalQty > 0) {
      maxChange = 1; // 100% change if going from 0 to something
    }

    previewList += `- ${p.title} (SKU: ${p.sku || 'N/A'})\n  Stock actual: ${p.available_quantity} -> Nuevo: ${finalQty}\n`;

    return {
      product_id: p.id,
      title: p.title,
      current_value: p.available_quantity,
      new_value: finalQty
    };
  });

  if (hasNegativeStock) {
    return { error: "El stock resultante no puede ser negativo. Esta acción requiere revisión manual." };
  }

  const risk = calculateRisk(products.length, maxChange);

  const { data: action, error } = await supabase.from("ai_actions").insert({
    tenant_id: tenantId,
    action_type: "update_stock",
    title: "Actualización de stock",
    payload: { items: payload, risk_score: risk },
    status: "pending"
  }).select("id").single();

  if (error) return { error: "No pude preparar la acción en la base de datos." };

  return {
    action_id: action.id,
    product_id: products[0].id,
    message: `Encontré ${payload.length} producto(s) afectados. Riesgo: ${risk}\n\n**PREVISUALIZACIÓN DE CAMBIOS:**\n${previewList}\nImpacto esperado: Actualización de stock en Mercado Libre.\n\n**IMPORTANTE:** Para ejecutar esto, por favor responde únicamente con la palabra: **CONFIRMO**`
  };
}

/**
 * Prepara (sin ejecutar en Mercado Libre) un cambio de estado (Pausar o Activar) de uno o múltiples productos.
 * Evalúa el riesgo del cambio e inserta una acción pendiente en la base de datos para confirmación.
 * 
 * @param tenantId Identificador del comercio
 * @param query Término de búsqueda del producto(s)
 * @param status Nuevo estado ('paused' o 'active')
 * @param allowMultiple Permite la afectación masiva de productos (por defecto falso)
 * @returns Promesa con el id de la acción pendiente y un mensaje de resumen
 */
export async function prepareStatusChange(tenantId: string, query: string, status: 'paused' | 'active', allowMultiple: boolean = false) {
  const supabase = createAdminClient();
  const resolution = await resolveProduct(tenantId, query);

  if (resolution.type === 'not_found') {
    return { error: resolution.error };
  }

  let products = [];
  if (resolution.type === 'multiple') {
    if (!allowMultiple) {
      const list = resolution.products.map(p => `- ${p.title} (SKU: ${p.sku || 'N/A'}, Estado: ${p.status})`).join('\n');
      return { message: `Encontré varios productos parecidos. ¿Cuál querés modificar?\n\n${list}\n\nPor favor, respóndeme con el SKU exacto o el nombre completo del que quieres elegir.` };
    }
    products = resolution.products;
  } else {
    products = [resolution.product];
  }

  if (products.length > 50) {
    return { error: "Cambio masivo excedido (>50 productos). Esta acción requiere revisión manual." };
  }

  if (status === 'paused' && products.length > 20) {
    return { error: "Pausa masiva excedida (>20 productos). Esta acción requiere revisión manual." };
  }

  let previewList = "";

  const payload = products.map(p => {
    previewList += `- ${p.title} (SKU: ${p.sku || 'N/A'})\n  Estado actual: ${p.status} -> Nuevo: ${status}\n`;

    return {
      product_id: p.id,
      title: p.title,
      current_value: p.status,
      new_value: status
    };
  });

  const risk = calculateRisk(products.length, 0, status === 'paused');

  const { data: action, error } = await supabase.from("ai_actions").insert({
    tenant_id: tenantId,
    action_type: status === 'paused' ? 'pause_product' : 'activate_product',
    title: status === 'paused' ? 'Pausar publicación' : 'Activar publicación',
    payload: { items: payload, risk_score: risk },
    status: "pending"
  }).select("id").single();

  if (error) return { error: "No pude preparar la acción en la base de datos." };

  return {
    action_id: action.id,
    product_id: products[0].id,
    message: `Encontré ${payload.length} producto(s). Riesgo: ${risk}\n\n**PREVISUALIZACIÓN DE CAMBIOS:**\n${previewList}\nImpacto esperado: Cambio de estado a ${status} en Mercado Libre.\n\n**IMPORTANTE:** Para ejecutar esto, por favor responde únicamente con la palabra: **CONFIRMO**`
  };
}

export * from './tools/shipments';
export * from './tools/market_insights';
export * from './tools/finance';
export * from './tools/promotions';
