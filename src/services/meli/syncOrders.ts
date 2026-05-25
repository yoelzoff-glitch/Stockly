import { createAdminClient } from "@/lib/supabase/admin";
import { getOrders } from "./getOrders";
import { decrementInternalStockFromOrder } from "../inventory/decrementInternalStockFromOrder";

export async function syncOrders(tenantId: string) {
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

  // 2. Fetch orders from Meli API (incremental sync: last 48 hours only, passing tenantId)
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const rawOrders = await getOrders(tenantId, meli_user_id, twoDaysAgo.toISOString());

  if (rawOrders.length === 0) {
    return 0; // No orders to sync
  }

  // 3. Get all existing products for this tenant to map order_items properly
  const { data: localProducts, error: productsError } = await supabase
    .from("products")
    .select("id, meli_item_id")
    .eq("tenant_id", tenantId);

  // Map of meli_item_id -> local product UUID
  const productMap: Record<string, string> = {};
  if (!productsError && localProducts) {
    localProducts.forEach(p => {
      productMap[p.meli_item_id] = p.id;
    });
  }

  // 4. Map Orders to DB Schema (including last_seen_at)
  const syncTimestamp = new Date().toISOString();
  const ordersToUpsert = rawOrders.map((order: any) => ({
    tenant_id: tenantId,
    meli_account_id: meli_account_id,
    meli_order_id: order.id.toString(),
    status: order.status,
    buyer_nickname: order.buyer?.nickname,
    buyer_id: order.buyer?.id?.toString(),
    total_amount: order.total_amount,
    paid_amount: order.paid_amount,
    currency_id: order.currency_id,
    date_created: order.date_created,
    date_closed: order.date_closed,
    raw_data: order,
    meli_shipment_id: order.shipping?.id?.toString(),
    last_seen_at: syncTimestamp,
    updated_at: syncTimestamp
  }));

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

    order.order_items.forEach((item: any) => {
      const meliItemId = item.item?.id;
      const localProductId = meliItemId ? productMap[meliItemId] : undefined;

      orderItemsToUpsert.push({
        tenant_id: tenantId,
        order_id: localOrderId,
        product_id: localProductId,
        meli_item_id: meliItemId,
        title: item.item?.title,
        sku: item.item?.seller_sku,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price,
        estimated_fee: item.sale_fee,
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

  return ordersToUpsert.length;
}
