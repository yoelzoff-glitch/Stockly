import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { normalizeSku } from '../src/services/products/sku/normalizeSku';

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const tenantId = '198b6356-4bbf-43d8-ae0e-3cc406f66f87';

async function main() {
  console.log("Fetching orders from July 2026...");
  const { data: orders, error: oErr } = await supa
    .from('orders')
    .select('id, created_at, total_amount')
    .eq('tenant_id', tenantId)
    .gte('created_at', '2026-07-01T00:00:00Z')
    .lte('created_at', '2026-07-31T23:59:59Z');

  if (oErr) {
    console.error("Orders fetch error:", oErr);
    return;
  }

  console.log(`Found ${orders.length} orders in July 2026.`);
  const orderIds = orders.map(o => o.id);

  if (orderIds.length === 0) return;

  const { data: orderItems, error: oiErr } = await supa
    .from('order_items')
    .select('id, order_id, title, sku, quantity, total_price, unit_cost, meli_item_id')
    .in('order_id', orderIds);

  if (oiErr) {
    console.error("Order items fetch error:", oiErr);
    return;
  }

  const { data: products, error: pErr } = await supa
    .from('products')
    .select('id, title, sku, cost, meli_item_id')
    .eq('tenant_id', tenantId);

  if (pErr) {
    console.error("Products fetch error:", pErr);
    return;
  }

  console.log("\nAnalyzing order items with missing unit_cost:");
  let count = 0;
  for (const item of orderItems) {
    if (item.unit_cost === null || Number(item.unit_cost) <= 0) {
      count++;
      // Try to find the product using getFinancialData logic
      let p = item.meli_item_id ? products.find(prod => prod.meli_item_id === item.meli_item_id) : undefined;
      let matchType = 'meli_item_id';
      if (!p && item.sku) {
        const normItemSku = normalizeSku(item.sku);
        if (normItemSku) {
          p = products.find(prod => prod.sku && normalizeSku(prod.sku) === normItemSku);
          matchType = 'sku';
        }
      }
      if (!p && item.title) {
        p = products.find(prod => prod.title === item.title);
        matchType = 'title';
      }

      console.log(`\n[Item #${count}]`);
      console.log(`- Order Item ID: ${item.id} (Order: ${item.order_id})`);
      console.log(`- Title: "${item.title}"`);
      console.log(`- SKU: "${item.sku}"`);
      console.log(`- Meli Item ID: ${item.meli_item_id}`);
      console.log(`- Matched Product:`, p ? { id: p.id, title: p.title, sku: p.sku, cost: p.cost, meli_item_id: p.meli_item_id, matchType } : "None");
    }
  }
}

main().catch(console.error);
