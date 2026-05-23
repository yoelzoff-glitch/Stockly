import { createAdminClient } from "@/lib/supabase/admin";
import { getShipment } from "./getShipment";

export async function syncShipments(tenantId: string) {
  const supabase = createAdminClient();

  // 1. Get orders with a shipment ID that don't have a final shipment status yet
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, meli_shipment_id, tenant_id")
    .eq("tenant_id", tenantId)
    .not("meli_shipment_id", "is", null);

  if (ordersError || !orders || orders.length === 0) {
    return 0;
  }

  let syncedCount = 0;
  const shipmentsToUpsert: any[] = [];

  // 2. Fetch each shipment
  for (const order of orders) {
    try {
      // getShipment now accepts tenantId directly and uses meliFetch
      const shipment = await getShipment(tenantId, order.meli_shipment_id);
      
      if (shipment) {
        shipmentsToUpsert.push({
          tenant_id: tenantId,
          order_id: order.id,
          meli_shipment_id: order.meli_shipment_id,
          status: shipment.status,
          substatus: shipment.substatus,
          logistic_type: shipment.logistic_type,
          mode: shipment.mode,
          tracking_number: shipment.tracking_number,
          tracking_method: shipment.tracking_method,
          shipping_cost: shipment.base_cost || 0,
          receiver_city: shipment.receiver_address?.city?.name,
          receiver_state: shipment.receiver_address?.state?.name,
          date_created: shipment.date_created,
          last_updated: shipment.last_updated,
          raw_data: shipment,
        });
      }
    } catch (e) {
      console.error(`Error fetching shipment ${order.meli_shipment_id}`, e);
    }
  }

  // 3. Upsert shipments safely
  if (shipmentsToUpsert.length > 0) {
    const orderIds = shipmentsToUpsert.map(s => s.order_id);
    
    // In chunks
    for (let i = 0; i < orderIds.length; i += 100) {
        const chunk = orderIds.slice(i, i + 100);
        await supabase.from("shipments").delete().in("order_id", chunk);
    }

    const { error: insertError } = await supabase.from("shipments").insert(shipmentsToUpsert);
    if (!insertError) {
        syncedCount = shipmentsToUpsert.length;
    } else {
        console.error("Error inserting shipments:", insertError);
    }
  }

  return syncedCount;
}
