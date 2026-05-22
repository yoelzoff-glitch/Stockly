import { createAdminClient } from "@/lib/supabase/admin";

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
    .select("title, price, available_quantity, sold_quantity, status")
    .eq("tenant_id", tenantId)
    .ilike("title", `%${query}%`)
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

export async function getProductProfitability(tenantId: string, productName: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("products")
    .select("title, price, cost")
    .eq("tenant_id", tenantId)
    .ilike("title", `%${productName}%`)
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
