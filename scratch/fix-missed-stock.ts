import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { normalizeSku } from '../src/services/products/sku/normalizeSku';

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const tenantId = '198b6356-4bbf-43d8-ae0e-3cc406f66f87';

async function main() {
  console.log("=== STARTING STOCK AND DATA FIX ===");

  // 1. Fetch the paid order items that are missing product_id
  const { data: orderItems, error: itemsError } = await supa
    .from("order_items")
    .select(`
      id,
      title,
      sku,
      quantity,
      order_id,
      orders!inner (
        id,
        meli_order_id,
        status,
        date_created
      )
    `)
    .is("product_id", null);

  if (itemsError || !orderItems) {
    console.error("Error fetching order items:", itemsError);
    return;
  }

  const paidOrderItems = orderItems.filter((oi: any) => oi.orders?.status === 'paid');
  console.log(`Found ${paidOrderItems.length} paid order items to map.`);

  // 2. Fetch all products
  const { data: products, error: prodError } = await supa
    .from("products")
    .select("id, sku, title")
    .eq("tenant_id", tenantId);

  if (prodError || !products) {
    console.error("Error fetching products:", prodError);
    return;
  }

  const productSkuMap = new Map<string, any>();
  products.forEach(p => {
    if (p.sku) {
      const norm = normalizeSku(p.sku);
      if (norm) {
        productSkuMap.set(norm, p);
      }
    }
  });

  // 3. Update order_items and perform stock deductions
  for (const item of paidOrderItems) {
    const itemSku = item.sku;
    const normSku = itemSku ? normalizeSku(itemSku) : "";
    const matchedProduct = normSku ? productSkuMap.get(normSku) : null;

    if (!matchedProduct) {
      console.log(`No matching product in catalog for SKU "${itemSku}". Skipping.`);
      continue;
    }

    console.log(`\nMapping item "${item.title}" (SKU: ${item.sku}) to product "${matchedProduct.title}" (ID: ${matchedProduct.id})...`);
    
    // Update order_item product_id
    const { error: updateItemError } = await supa
      .from("order_items")
      .update({ product_id: matchedProduct.id })
      .eq("id", item.id);

    if (updateItemError) {
      console.error(`Failed to update order item ${item.id}:`, updateItemError.message);
      continue;
    }
    console.log(`  - Link updated successfully.`);

    // Fetch the components for this product
    const { data: components, error: compsError } = await supa
      .from("product_components")
      .select(`
        id,
        quantity,
        inventory_item_id,
        component_sku,
        inventory_items (
          id,
          current_stock
        )
      `)
      .eq("product_id", matchedProduct.id);

    if (compsError || !components) {
      console.error(`Failed to fetch components for product ${matchedProduct.id}:`, compsError);
      continue;
    }

    // Deduct stock for each component
    for (const comp of components) {
      if (!comp.inventory_item_id || !comp.inventory_items) {
        console.warn(`  - Component ${comp.component_sku} has no inventory item linked. Skipping.`);
        continue;
      }

      const invItem = comp.inventory_items as any;
      const currentStock = invItem.current_stock || 0;
      const compQtyRequired = comp.quantity || 1;
      const orderQty = item.quantity || 1;
      const requiredQty = compQtyRequired * orderQty;
      const newStock = currentStock - requiredQty;

      console.log(`  - Deducting component "${comp.component_sku}": ${currentStock} -> ${newStock} (-${requiredQty})...`);

      // Update stock in database
      const { error: stockUpdateError } = await supa
        .from("inventory_items")
        .update({ current_stock: newStock, updated_at: new Date().toISOString() })
        .eq("id", invItem.id);

      if (stockUpdateError) {
        console.error(`    Failed to update stock for inventory item ${invItem.id}:`, stockUpdateError.message);
        continue;
      }

      // Record movement
      const { error: movError } = await supa
        .from("inventory_movements")
        .insert({
          tenant_id: tenantId,
          inventory_item_id: invItem.id,
          movement_type: "sale_confirmed",
          quantity_delta: -requiredQty,
          previous_stock: currentStock,
          new_stock: newStock,
          source: "mercadolibre_order",
          reference_id: item.orders.id,
          notes: `Corrección: Venta ML Orden #${item.orders.meli_order_id} - Producto: ${item.title}`
        });

      if (movError) {
        console.error("    Failed to record inventory movement:", movError.message);
      } else {
        console.log("    Movement recorded successfully.");
      }
    }
  }

  console.log("\n=== FIX COMPLETED ===");
}

main().catch(console.error);
