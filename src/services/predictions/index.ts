import { createAdminClient } from "@/lib/supabase/admin";

export async function predictStockOut(tenantId: string) {
  const supabase = createAdminClient();

  // Get products
  const { data: products } = await supabase
    .from("products")
    .select("id, title, available_quantity, sold_quantity")
    .eq("tenant_id", tenantId)
    .gt("available_quantity", 0);

  if (!products) return [];

  // Very simplified prediction model
  // Assumption: 'sold_quantity' is total sold. We assume the total sold happened over ~90 days for this naive estimation.
  // In a real app we'd look at 'order_items' over the last 30 days. Let's do that instead if possible.
  
  const { data: recentOrders } = await supabase
    .from("orders")
    .select("id, date_created")
    .eq("tenant_id", tenantId)
    .gt("date_created", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  const orderIds = recentOrders?.map(o => o.id) || [];
  
  let salesPerProduct: Record<string, number> = {};

  if (orderIds.length > 0) {
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("product_id, quantity")
      .in("order_id", orderIds);
      
    orderItems?.forEach(item => {
      if (item.product_id) {
        salesPerProduct[item.product_id] = (salesPerProduct[item.product_id] || 0) + item.quantity;
      }
    });
  }

  const predictions = products.map(product => {
    const salesLast30 = salesPerProduct[product.id] || 0;
    const dailySales = salesLast30 / 30;
    
    let daysToStockOut = -1; // Infinite
    if (dailySales > 0) {
      daysToStockOut = Math.round(product.available_quantity / dailySales);
    }

    return {
      product_id: product.id,
      title: product.title,
      current_stock: product.available_quantity,
      sales_last_30_days: salesLast30,
      estimated_days_remaining: daysToStockOut,
      critical: daysToStockOut >= 0 && daysToStockOut <= 7 // Less than a week
    };
  });

  return predictions.filter(p => p.critical).sort((a, b) => a.estimated_days_remaining - b.estimated_days_remaining);
}
