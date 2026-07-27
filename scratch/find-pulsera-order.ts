import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const tenantId = '198b6356-4bbf-43d8-ae0e-3cc406f66f87';

async function main() {
  // Find products matching the title or SKU "P 304"
  const { data: products } = await supa
    .from("products")
    .select("id, title, sku, cost, estimated_fee, estimated_shipping_cost, extra_fee_amount, promotion_discount_amount")
    .eq("tenant_id", tenantId)
    .ilike("title", "%Pulsera Plata 925 Con Dijes Pediatra%");

  console.log("Products:");
  console.log(products);

  // Find order items in July 2026 matching this title
  const { data: orderItems } = await supa
    .from("order_items")
    .select("id, order_id, title, quantity, total_price, estimated_fee, estimated_shipping_cost, sku, unit_cost")
    .ilike("title", "%Pulsera Plata 925 Con Dijes Pediatra%");

  console.log("\nOrder Items:");
  console.log(orderItems);

  if (orderItems && orderItems.length > 0) {
    const orderIds = orderItems.map(item => item.order_id);
    const { data: orders } = await supa
      .from("orders")
      .select("id, total_amount, status, date_created, meli_order_id, raw_data")
      .in("id", orderIds);

    console.log("\nOrders:");
    for (const order of (orders || [])) {
      console.log(`Order ID: ${order.id}, Meli Order ID: ${order.meli_order_id}, Total Amount: ${order.total_amount}`);
      console.log(`Raw Payments / Fees in raw_data:`);
      const raw = order.raw_data as any;
      console.log(JSON.stringify({
        payments: raw?.payments,
        order_items: raw?.order_items
      }, null, 2));
    }
  }
}

main().catch(console.error);
