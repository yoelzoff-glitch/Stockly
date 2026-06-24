import { createAdminClient } from "@/lib/supabase/admin";
import { getOrders } from "./getOrders";
import { decrementInternalStockFromOrder } from "../inventory/decrementInternalStockFromOrder";
import { syncShipments } from "./syncShipments";

export async function syncOrders(tenantId: string, specificMeliOrderId?: string, dateFrom?: string) {
  const supabase = createAdminClient();

  // 1. Get the Meli account for this tenant
  const { data: meliAccount, error: accountError } = await supabase
    .from("meli_accounts")
    .select("id, access_token, meli_user_id")
    .eq("tenant_id", tenantId)
    .single();

  if (accountError || !meliAccount) {
    throw new Error("Mercado Libre account not connected for this tenant.");
  }

  const { meli_user_id, id: meli_account_id } = meliAccount;

  // 1.5 Get tenant metadata for operational costs
  const { data: tenantData } = await supabase
    .from("tenants")
    .select("metadata")
    .eq("id", tenantId)
    .single();
  
  const tenantMetadata = (tenantData?.metadata as any) || {};
  const packagingCost = tenantMetadata.packaging_cost || 0;
  const flexZones = tenantMetadata.flex_zones || [];

  // 2. Fetch orders from Meli API
  let rawOrders: any[] = [];
  if (specificMeliOrderId) {
    const { meliFetch } = await import("./client");
    try {
      const orderData = await meliFetch({
        tenantId,
        endpoint: `/orders/${specificMeliOrderId}`,
        method: "GET"
      });
      if (orderData) {
        rawOrders = [orderData];
      }
    } catch (err: any) {
      console.error(`Failed to fetch specific order ${specificMeliOrderId}:`, err.message);
      return 0;
    }
  } else {
    // Incremental sync: custom dateFrom or last 7 days only
    let startIso: string;
    if (dateFrom) {
      startIso = dateFrom;
    } else {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      startIso = sevenDaysAgo.toISOString();
    }
    rawOrders = await getOrders(tenantId, meli_user_id, startIso);
  }

  if (rawOrders.length === 0) {
    return 0; // No orders to sync
  }

  // 3. Get all existing products for this tenant to map order_items properly
  const { data: localProducts, error: productsError } = await supabase
    .from("products")
    .select("id, meli_item_id, cost")
    .eq("tenant_id", tenantId);

  // Map of meli_item_id -> local product info
  const productMap: Record<string, { id: string; cost: number | null }> = {};
  if (!productsError && localProducts) {
    localProducts.forEach(p => {
      productMap[p.meli_item_id] = { id: p.id, cost: p.cost };
    });
  }

  // 2.5 Fetch shipment details using multiget to resolve flex zones
  const shipmentIds = rawOrders
    .map((o: any) => o.shipping?.id)
    .filter((id: any) => id); // get all non-null shipment ids

  const shipmentsMap: Record<string, any> = {};
  if (shipmentIds.length > 0) {
    const { meliFetch } = await import("./client");
    // ML allows up to 50 ids per multiget request
    for (let i = 0; i < shipmentIds.length; i += 50) {
      const chunk = shipmentIds.slice(i, i + 50);
      const endpoint = `/shipments?ids=${chunk.join(",")}`;
      try {
        const shipmentsData = await meliFetch({
          tenantId,
          endpoint,
          method: "GET"
        });
        
        if (Array.isArray(shipmentsData)) {
          for (const s of shipmentsData) {
            if (s.code === 200 && s.body) {
              shipmentsMap[s.body.id.toString()] = s.body;
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch shipments for flex zones:", err);
      }
    }
  }

  // 4. Map Orders to DB Schema (including last_seen_at)
  const syncTimestamp = new Date().toISOString();
  const ordersToUpsert = rawOrders.map((order: any) => {
    let orderFlexCost = 0;
    
    const shipmentId = order.shipping?.id?.toString();
    const shipmentData = shipmentId ? shipmentsMap[shipmentId] : null;

    if (shipmentData && shipmentData.logistic_type === 'self_service') {
      const mlCost = shipmentData.base_cost || shipmentData.shipping_option?.list_cost || 0;
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
        orderFlexCost = motoCost;
      } else {
        orderFlexCost = flexZones.length > 0 ? (Number(flexZones[0].moto_costs) || 0) : 0;
        if (orderFlexCost > 0 && orderFlexCost < 1000) {
          orderFlexCost = orderFlexCost * 10;
        }
      }
    }
    
    // Inject calculated costs into raw_data
    const enrichedRawData = {
      ...order,
      klyvo_operational_costs: {
        packaging_cost: packagingCost,
        flex_cost: orderFlexCost,
        total_operational_cost: packagingCost + orderFlexCost
      }
    };

    const couponAmount = Number(order.coupon?.amount) || (order.payments && order.payments.length > 0 ? Number(order.payments[0].coupon_amount) : 0) || 0;
    const netTotalAmount = Math.max(0, (Number(order.total_amount) || 0) - couponAmount);
    const netPaidAmount = Math.max(0, (Number(order.paid_amount) || 0) - couponAmount);

    return {
      tenant_id: tenantId,
      meli_account_id: meli_account_id,
      meli_order_id: order.id.toString(),
      status: order.status,
      buyer_nickname: order.buyer?.nickname,
      buyer_id: order.buyer?.id?.toString(),
      total_amount: netTotalAmount,
      paid_amount: netPaidAmount,
      currency_id: order.currency_id,
      date_created: order.date_created,
      date_closed: order.date_closed,
      raw_data: enrichedRawData,
      meli_shipment_id: order.shipping?.id?.toString(),
      last_seen_at: syncTimestamp,
      updated_at: syncTimestamp
    };
  });

  // 5. Upsert Orders
  const { data: upsertedOrders, error: upsertError } = await supabase
    .from("orders")
    .upsert(ordersToUpsert, {
      onConflict: "tenant_id, meli_order_id",
    })
    .select("id, meli_order_id");

  if (upsertError) {
    console.error("Error upserting orders to DB:", upsertError);
    throw new Error("Failed to save synced orders to database.");
  }

  // Map of meli_order_id -> local order UUID
  const orderMap: Record<string, string> = {};
  if (upsertedOrders) {
    upsertedOrders.forEach(o => {
      orderMap[o.meli_order_id] = o.id;
    });
  }

  // 6. Map Order Items
  const orderItemsToUpsert: any[] = [];
  
  rawOrders.forEach((order: any) => {
    const localOrderId = orderMap[order.id.toString()];
    if (!localOrderId || !order.order_items) return;

    const couponAmount = Number(order.coupon?.amount) || (order.payments && order.payments.length > 0 ? Number(order.payments[0].coupon_amount) : 0) || 0;
    const orderTotalAmount = Number(order.total_amount) || 0;

    order.order_items.forEach((item: any) => {
      const meliItemId = item.item?.id;
      const productInfo = meliItemId ? productMap[meliItemId] : undefined;
      const localProductId = productInfo?.id;
      const unitCost = productInfo?.cost ?? null;

      // Distribute coupon amount proportionally
      let netUnitPrice = Number(item.unit_price) || 0;
      if (couponAmount > 0 && orderTotalAmount > 0) {
        const itemTotalOriginal = (Number(item.unit_price) || 0) * (Number(item.quantity) || 1);
        const itemShare = itemTotalOriginal / orderTotalAmount;
        const itemDiscountTotal = couponAmount * itemShare;
        const itemDiscountPerUnit = itemDiscountTotal / (Number(item.quantity) || 1);
        netUnitPrice = Math.max(0, (Number(item.unit_price) || 0) - itemDiscountPerUnit);
      }

      orderItemsToUpsert.push({
        tenant_id: tenantId,
        order_id: localOrderId,
        product_id: localProductId,
        meli_item_id: meliItemId,
        title: item.item?.title,
        sku: item.item?.seller_sku,
        quantity: item.quantity,
        unit_price: netUnitPrice,
        estimated_fee: item.sale_fee,
        unit_cost: unitCost,
      });
    });
  });

  if (orderItemsToUpsert.length > 0) {
    // Delete existing items for these orders to avoid duplicates, then insert
    const localOrderIds = Array.from(new Set(Object.values(orderMap)));
    
    // In chunks of 100 to avoid limits
    for (let i = 0; i < localOrderIds.length; i += 100) {
      const chunk = localOrderIds.slice(i, i + 100);
      await supabase
        .from("order_items")
        .delete()
        .in("order_id", chunk);
    }

    // Insert all items
    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItemsToUpsert);
      
      if (itemsError) {
        console.error("Error inserting order items:", itemsError);
      } else {
        // --- SPRINT 35: Descuento automático de stock interno ---
        const paidOrders = ordersToUpsert.filter(o => o.status === 'paid');
        for (const order of paidOrders) {
           const localOrderId = orderMap[order.meli_order_id];
           if (localOrderId) {
             await decrementInternalStockFromOrder(tenantId, localOrderId).catch(err => {
               console.error(`Error decrementando stock interno para orden ${localOrderId}:`, err);
             });
           }
        }
      }
  }

  // --- SPRINT 36: Sincronización automática de envíos ---
  await syncShipments(tenantId).catch((err) => {
    console.error(`Failed to sync shipments during syncOrders for tenant ${tenantId}:`, err);
  });

  // --- SPRINT 37: Sincronización automática de cancelaciones ---
  const { syncCancellations } = await import("./syncCancellations");
  await syncCancellations(tenantId).catch((err) => {
    console.error(`Failed to sync cancellations during syncOrders for tenant ${tenantId}:`, err);
  });

  return ordersToUpsert.length;
}
