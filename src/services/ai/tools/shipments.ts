import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Obtiene el recuento y detalle de todos los envíos actualmente demorados.
 * 
 * @param tenantId Identificador del comercio
 * @returns Promesa con detalle de los envíos demorados o un mensaje de estado
 */
export async function getDelayedShipments(tenantId: string) {
  const supabase = createAdminClient();
  const { data: shipments, error } = await supabase
    .from("shipments")
    .select("*, orders(meli_order_id, buyer_nickname)")
    .eq("tenant_id", tenantId)
    .eq("substatus", "delayed");

  if (error || !shipments || shipments.length === 0) {
    return { status: "No hay envíos demorados actualmente." };
  }

  return {
    delayed_count: shipments.length,
    delayed_shipments: shipments.map(s => ({
      order_id: s.orders?.meli_order_id,
      buyer: s.orders?.buyer_nickname,
      status: s.status,
      logistic_type: s.logistic_type,
      tracking_number: s.tracking_number,
      shipping_cost: s.shipping_cost
    }))
  };
}

/**
 * Calcula las estadísticas globales de cancelaciones, incluyendo dinero perdido 
 * y desglose por motivo.
 * 
 * @param tenantId Identificador del comercio
 * @returns Promesa con el total de cancelaciones, ingresos perdidos y motivos
 */
export async function getCancellationStats(tenantId: string) {
  const supabase = createAdminClient();
  const { data: cancellations, error } = await supabase
    .from("order_cancellations")
    .select("refund_amount, reason, date_cancelled")
    .eq("tenant_id", tenantId);

  if (error || !cancellations || cancellations.length === 0) {
    return { status: "No se encontraron cancelaciones registradas." };
  }

  const total = cancellations.length;
  const lostRevenue = cancellations.reduce((acc, c) => acc + (Number(c.refund_amount) || 0), 0);
  
  // Count by reason
  const reasonsMap: Record<string, number> = {};
  cancellations.forEach(c => {
    const r = c.reason || "Sin motivo";
    reasonsMap[r] = (reasonsMap[r] || 0) + 1;
  });

  return {
    total_cancellations: total,
    total_lost_revenue: lostRevenue,
    reasons_breakdown: reasonsMap
  };
}

/**
 * Analiza el historial de cancelaciones para identificar cuáles son los productos 
 * más frecuentemente cancelados.
 * 
 * @param tenantId Identificador del comercio
 * @returns Promesa con los productos más cancelados
 */
export async function getTopCancelledProducts(tenantId: string) {
  // We'll need to join order_cancellations with orders and order_items
  const supabase = createAdminClient();
  const { data: cancellations, error } = await supabase
    .from("order_cancellations")
    .select("order_id")
    .eq("tenant_id", tenantId);

  if (error || !cancellations || cancellations.length === 0) {
    return { status: "No hay cancelaciones." };
  }

  const orderIds = cancellations.map(c => c.order_id);
  
  const { data: items } = await supabase
    .from("order_items")
    .select("title, quantity")
    .in("order_id", orderIds);

  if (!items || items.length === 0) {
    return { status: "No se encontraron productos para las órdenes canceladas." };
  }

  const productCounts: Record<string, number> = {};
  items.forEach(item => {
    if (item.title) {
      productCounts[item.title] = (productCounts[item.title] || 0) + (item.quantity || 1);
    }
  });

  const sortedProducts = Object.entries(productCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(entry => ({ product: entry[0], cancelled_quantity: entry[1] }));

  return { top_cancelled_products: sortedProducts };
}
