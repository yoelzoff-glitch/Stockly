import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { parseCompositeSku } from '../src/services/products/sku/parseCompositeSku';

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const tenantId = '198b6356-4bbf-43d8-ae0e-3cc406f66f87';

async function main() {
  console.log("Fetching products...");
  const { data: products, error: pErr } = await supa
    .from('products')
    .select('id, sku, meli_item_id')
    .eq('tenant_id', tenantId);

  if (pErr) {
    console.error("Fetch products error:", pErr);
    return;
  }

  const componentsToInsert: any[] = [];
  const productIdsToClear: string[] = [];

  for (const p of (products || [])) {
    if (!p.sku) continue;
    const parsed = parseCompositeSku(p.sku);
    if (parsed.components.length > 0) {
      productIdsToClear.push(p.id);
      for (const comp of parsed.components) {
        componentsToInsert.push({
          tenant_id: tenantId,
          product_id: p.id,
          component_sku: comp,
          component_normalized: comp
        });
      }
    }
  }

  console.log(`Found ${productIdsToClear.length} products to clear/insert components for.`);
  const uniqueCompNames = Array.from(new Set(componentsToInsert.map(c => c.component_normalized)));
  console.log("Unique component names:", uniqueCompNames);

  if (uniqueCompNames.length > 0) {
    const { data: existingItems, error: itemsError } = await supa
      .from("inventory_items")
      .select("id, sku_normalized")
      .eq("tenant_id", tenantId)
      .in("sku_normalized", uniqueCompNames);

    if (itemsError) {
      console.error("Error fetching inventory items:", itemsError);
      return;
    }

    console.log(`Found ${existingItems?.length || 0} existing inventory items.`);
    
    const itemMap = new Map<string, string>();
    if (existingItems) {
      for (const item of existingItems) {
        itemMap.set(item.sku_normalized, item.id);
      }
    }

    const prodComponentsToInsert: any[] = [];
    for (const p of products) {
      if (!p.sku) continue;
      const parsed = parseCompositeSku(p.sku);
      if (parsed.components.length > 0) {
        const compCounts: Record<string, number> = {};
        for (const comp of parsed.components) {
          compCounts[comp] = (compCounts[comp] || 0) + 1;
        }

        for (const [comp, qty] of Object.entries(compCounts)) {
          const itemId = itemMap.get(comp);
          if (itemId) {
            prodComponentsToInsert.push({
              tenant_id: tenantId,
              product_id: p.id,
              inventory_item_id: itemId,
              component_sku: comp,
              component_normalized: comp,
              quantity: qty,
              unit_cost: null,
              total_component_cost: null
            });
          } else {
            console.warn(`WARNING: Component "${comp}" not found in inventory_items for product ${p.sku} (ID: ${p.id})`);
          }
        }
      }
    }

    console.log(`Attempting to insert ${prodComponentsToInsert.length} product components into product_components...`);
    
    // Let's delete existing product components for these product IDs first
    console.log("Deleting old product components...");
    const { error: delErr } = await supa.from("product_components").delete().in("product_id", productIdsToClear);
    if (delErr) {
      console.error("Delete error:", delErr);
    } else {
      console.log("Delete successful.");
    }

    // Now insert
    const { error: insErr } = await supa.from("product_components").insert(prodComponentsToInsert);
    if (insErr) {
      console.error("Insert error:", insErr);
    } else {
      console.log("Insert successful!");
    }
  }
}

main().catch(console.error);
