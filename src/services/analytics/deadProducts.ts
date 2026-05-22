import { createAdminClient } from "@/lib/supabase/admin";

export async function detectDeadProducts(tenantId: string) {
  const supabase = createAdminClient();

  // Definition of a dead product: No sales in the last 60 days
  const thresholdDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  // First, get products
  const { data: products } = await supabase
    .from("products")
    .select("id, title, status, permalink")
    .eq("tenant_id", tenantId)
    .eq("status", "active");

  if (!products || products.length === 0) return [];

  // Get orders in last 60 days
  const { data: recentOrders } = await supabase
    .from("orders")
    .select("id")
    .eq("tenant_id", tenantId)
    .gt("date_created", thresholdDate);

  const orderIds = recentOrders?.map(o => o.id) || [];
  
  const soldProductIds = new Set<string>();

  if (orderIds.length > 0) {
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("product_id")
      .in("order_id", orderIds);
      
    orderItems?.forEach(item => {
      if (item.product_id) soldProductIds.add(item.product_id);
    });
  }

  // Dead products are active products not in the soldProductIds set
  const deadProducts = products.filter(p => !soldProductIds.has(p.id));

  return deadProducts.map(p => ({
    product_id: p.id,
    title: p.title,
    permalink: p.permalink,
    reason: "Sin ventas en 60 días",
    action: "Pausar publicación o aplicar descuento"
  }));
}
