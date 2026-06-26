import { createAdminClient } from "@/lib/supabase/admin";
import { getShipment } from "./getShipment";

export async function syncShipments(tenantId: string, specificShipmentId?: string) {
  const supabase = createAdminClient();

  // 1. Fetch recent orders (last 30 days) with a shipment ID
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let query = supabase
    .from("orders")
    .select("id, meli_shipment_id, tenant_id")
    .eq("tenant_id", tenantId)
    .not("meli_shipment_id", "is", null);

  if (specificShipmentId) {
    query = query.eq("meli_shipment_id", specificShipmentId);
  } else {
    query = query.gte("date_created", thirtyDaysAgo.toISOString());
  }

  const { data: orders, error: ordersError } = await query;

  if (ordersError || !orders || orders.length === 0) {
    return 0;
  }

  // Filter out orders that already have a completed shipment status in our DB
  let ordersToSync = orders;
  if (!specificShipmentId) {
    const orderIds = orders.map(o => o.id);
    const { data: completedShipments } = await supabase
      .from("shipments")
      .select("order_id")
      .in("order_id", orderIds)
      .in("status", ["delivered", "cancelled", "returned"]);

    const completedOrderIds = new Set(completedShipments?.map(s => s.order_id) || []);
    ordersToSync = orders.filter(o => !completedOrderIds.has(o.id));
  }

  if (ordersToSync.length === 0) {
    return 0;
  }

  // 1.5 Fetch tenant metadata for flex zones
  const { data: tenantData } = await supabase
    .from("tenants")
    .select("metadata")
    .eq("id", tenantId)
    .single();

  const tenantMetadata = (tenantData?.metadata as any) || {};
  const flexZones = tenantMetadata.flex_zones || [];

  let syncedCount = 0;
  const shipmentsToUpsert: any[] = [];

  // 2. Fetch each shipment
  for (const order of ordersToSync) {
    try {
      // getShipment now accepts tenantId directly and uses meliFetch
      const shipment = await getShipment(tenantId, order.meli_shipment_id);
      
      if (shipment) {
        let shippingCost = shipment.shipping_option?.list_cost ?? shipment.base_cost ?? 0;

        if (shipment.logistic_type === "self_service") {
          const mlCost = shipment.base_cost || shipment.shipping_option?.list_cost || 0;
          let matchedZone = null;
          let minDiff = Infinity;

          for (const z of flexZones) {
            const configuredPays = Number(z.ml_pays) || 0;
            const candidates = [configuredPays];
            if (configuredPays < 1000) {
              candidates.push(configuredPays * 10);
            }
            for (const candidate of candidates) {
              const diff = Math.abs(candidate - mlCost);
              if (diff < minDiff) {
                minDiff = diff;
                matchedZone = z;
              }
            }
          }

          if (matchedZone) {
            let motoCost = Number(matchedZone.moto_costs) || 0;
            if (motoCost > 0 && motoCost < 1000) {
              motoCost = motoCost * 10;
            }
            shippingCost = motoCost;
          } else {
            shippingCost = flexZones.length > 0 ? (Number(flexZones[0].moto_costs) || 0) : 0;
            if (shippingCost > 0 && shippingCost < 1000) {
              shippingCost = shippingCost * 10;
            }
          }
        }

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
          shipping_cost: shippingCost,
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
