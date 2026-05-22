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
    .select("title, sku, price, available_quantity, sold_quantity, status")
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
    .select("title, sku, price, cost")
    .eq("tenant_id", tenantId)
    .or(`sku.eq."${query}",meli_item_id.ilike."*${query}*",title.ilike."*${query}*"`)
    .limit(1);

  if (error || !data || data.length === 0) return { error: "Product not found" };

  const p = data[0];
  const margin = p.price - (p.cost || 0);

  return {
    title: p.title,
    price: p.price,
    cost: p.cost || "No configurado",
    margin: margin
  };
}

// ==========================================
// SPRINT 11: Meli Preparatory Actions
// ==========================================

export async function preparePriceUpdate(tenantId: string, query: string, newPrice?: number, percentageChange?: number) {
  const supabase = createAdminClient();
  const resolution = await resolveProduct(tenantId, query);

  if (resolution.type === 'not_found') {
    return { error: resolution.error };
  }

  if (resolution.type === 'multiple') {
    const list = resolution.products.map(p => `- ${p.title} (SKU: ${p.sku || 'N/A'}, Precio: $${p.price})`).join('\n');
    return { message: `Encontré varios productos parecidos. ¿Cuál querés modificar?\n\n${list}\n\nPor favor, respóndeme con el SKU exacto o el nombre completo del que quieres elegir.` };
  }

  const products = [resolution.product];

  const payload = products.map(p => {
    let finalPrice = newPrice;
    if (percentageChange) {
      finalPrice = p.price * (1 + (percentageChange / 100));
    }
    return {
      product_id: p.id,
      title: p.title,
      current_value: p.price,
      new_value: Math.round(finalPrice || p.price)
    };
  });

  const { data: action, error } = await supabase.from("ai_actions").insert({
    tenant_id: tenantId,
    action_type: "update_price",
    payload,
    status: "pending"
  }).select("id").single();

  if (error) return { error: "No pude preparar la acción en la base de datos." };

  return {
    action_id: action.id,
    message: `Encontré ${payload.length} producto(s) afectados.\nEl cambio estimado actualizará el precio.\n**IMPORTANTE:** Para ejecutar esto en Mercado Libre, por favor responde únicamente con la palabra: **CONFIRMO**`
  };
}

export async function prepareStockUpdate(tenantId: string, query: string, newQuantity: number, operation: 'set' | 'add' | 'subtract' = 'set') {
  const supabase = createAdminClient();
  const resolution = await resolveProduct(tenantId, query);

  if (resolution.type === 'not_found') {
    return { error: resolution.error };
  }

  if (resolution.type === 'multiple') {
    const list = resolution.products.map(p => `- ${p.title} (SKU: ${p.sku || 'N/A'}, Stock: ${p.available_quantity})`).join('\n');
    return { message: `Encontré varios productos parecidos. ¿Cuál querés modificar?\n\n${list}\n\nPor favor, respóndeme con el SKU exacto o el nombre completo del que quieres elegir.` };
  }

  const products = [resolution.product];

  const payload = products.map(p => {
    let finalQty = newQuantity;
    if (operation === 'add') finalQty = p.available_quantity + newQuantity;
    if (operation === 'subtract') finalQty = Math.max(0, p.available_quantity - newQuantity);

    return {
      product_id: p.id,
      title: p.title,
      current_value: p.available_quantity,
      new_value: finalQty
    };
  });

  const { data: action, error } = await supabase.from("ai_actions").insert({
    tenant_id: tenantId,
    action_type: "update_stock",
    payload,
    status: "pending"
  }).select("id").single();

  if (error) return { error: "No pude preparar la acción en la base de datos." };

  return {
    action_id: action.id,
    message: `Encontré ${payload.length} producto(s) afectados.\nEl stock será actualizado.\n**IMPORTANTE:** Para ejecutar esto en Mercado Libre, por favor responde únicamente con la palabra: **CONFIRMO**`
  };
}

export async function prepareStatusChange(tenantId: string, query: string, status: 'paused' | 'active') {
  const supabase = createAdminClient();
  const resolution = await resolveProduct(tenantId, query);

  if (resolution.type === 'not_found') {
    return { error: resolution.error };
  }

  if (resolution.type === 'multiple') {
    const list = resolution.products.map(p => `- ${p.title} (SKU: ${p.sku || 'N/A'}, Estado: ${p.status})`).join('\n');
    return { message: `Encontré varios productos parecidos. ¿Cuál querés modificar?\n\n${list}\n\nPor favor, respóndeme con el SKU exacto o el nombre completo del que quieres elegir.` };
  }

  const products = [resolution.product];

  const payload = products.map(p => ({
    product_id: p.id,
    title: p.title,
    current_value: p.status,
    new_value: status
  }));

  const { data: action, error } = await supabase.from("ai_actions").insert({
    tenant_id: tenantId,
    action_type: status === 'paused' ? 'pause_product' : 'activate_product',
    payload,
    status: "pending"
  }).select("id").single();

  if (error) return { error: "No pude preparar la acción en la base de datos." };

  return {
    action_id: action.id,
    message: `Encontré ${payload.length} producto(s).\nEstado nuevo: ${status}.\n**IMPORTANTE:** Para ejecutar esto en Mercado Libre, por favor responde únicamente con la palabra: **CONFIRMO**`
  };
}
