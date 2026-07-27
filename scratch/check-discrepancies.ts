import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { normalizeSku } from '../src/services/products/sku/normalizeSku';

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log("Fetching order items with null product_id...");
  
  // Fetch order items that have no product_id and belong to paid orders
  const { data: orderItems, error: itemsError } = await supa
    .from("order_items")
    .select(`
      id,
      title,
      sku,
      quantity,
      order_id,
      orders!inner (
        meli_order_id,
        status,
        date_created,
        internal_stock_processed
      )
    `)
    .is("product_id", null);

  if (itemsError) {
    console.error("Error fetching order items:", itemsError);
    return;
  }

  // Filter to only paid orders
  const paidOrderItems = orderItems?.filter((oi: any) => oi.orders?.status === 'paid') || [];
  console.log(`Total paid order items with null product_id: ${paidOrderItems.length}`);

  if (paidOrderItems.length === 0) {
    console.log("No paid order items are missing product_id. Everything looks clean!");
    return;
  }

  console.log("Fetching all catalog products to find matches...");
  const { data: products, error: prodError } = await supa
    .from("products")
    .select("id, sku, title, meli_item_id");

  if (prodError) {
    console.error("Error fetching products:", prodError);
    return;
  }

  // Map products by normalized SKU
  const productSkuMap = new Map<string, any>();
  products?.forEach(p => {
    if (p.sku) {
      const norm = normalizeSku(p.sku);
      if (norm) {
        productSkuMap.set(norm, p);
      }
    }
  });

  console.log("\n=== DISCREPANCIES DETECTED ===");
  console.log("The following sales were processed but did NOT discount internal stock because of SKU/ID mismatch:");
  
  let matchCount = 0;
  for (const item of paidOrderItems) {
    const itemSku = item.sku;
    const normSku = itemSku ? normalizeSku(itemSku) : "";
    const matchedProduct = normSku ? productSkuMap.get(normSku) : null;

    if (matchedProduct) {
      matchCount++;
      console.log(`\nOrder: ML #${item.orders.meli_order_id} (${new Date(item.orders.date_created).toLocaleDateString()})`);
      console.log(`  - Sold Item: "${item.title}"`);
      console.log(`  - Sold SKU: "${item.sku}" (Normalized: "${normSku}")`);
      console.log(`  - Quantity: ${item.quantity}`);
      console.log(`  - Match found in Catalog: "${matchedProduct.title}" (ID: ${matchedProduct.id})`);
    } else {
      console.log(`\nOrder: ML #${item.orders.meli_order_id} (Unresolved SKU)`);
      console.log(`  - Sold Item: "${item.title}"`);
      console.log(`  - Sold SKU: "${item.sku || 'N/A'}"`);
      console.log(`  - Quantity: ${item.quantity}`);
    }
  }

  console.log(`\nSummary: Found ${paidOrderItems.length} items without product_id. ${matchCount} of them have matching SKUs in the catalog.`);
}

main().catch(console.error);
