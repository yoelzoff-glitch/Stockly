import { createAdminClient } from "@/lib/supabase/admin";
import { resolveProduct } from "@/services/products/resolveProduct";

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
export * from './tools/finance';
