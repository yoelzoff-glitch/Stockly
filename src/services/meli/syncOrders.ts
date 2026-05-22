import { createAdminClient } from "@/lib/supabase/admin";
import { getOrders } from "./getOrders";

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

  // 1b. Validate and refresh token
  const { refreshMeliToken } = await import("./refreshToken");
  const access_token = await refreshMeliToken(tenantId);

  // 2. Fetch orders from Meli API
  const rawOrders = await getOrders(access_token, meli_user_id);

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

  // 4. Map Orders to DB Schema
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
    updated_at: new Date().toISOString()
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

      // Un order_item en Meli puede no tener un ID único explícito por item vendido a veces,
      // usaremos el order_id + meli_item_id como base para el upsert o crearemos registros simples.
      // Ya que no tenemos un constraint único claro definido para order_items, insertaremos/actualizaremos
      // basado en order_id y meli_item_id asumiendo que un ítem específico aparece una vez por orden.

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
    // Or we just rely on standard insert if there's no conflict key.
    // For safety, we will clear items for the updated orders and re-insert.
    
    // We get a list of unique local order IDs
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
    }
  }

  return ordersToUpsert.length;
}
