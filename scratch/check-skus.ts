import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: items, error } = await supa
    .from("inventory_items")
    .select("id, sku, sku_normalized, current_stock");

  if (error) {
    console.error("Error:", error);
    return;
  }

  const different = items?.filter(item => item.sku !== item.sku_normalized);
  console.log(`Total inventory items: ${items?.length}`);
  console.log(`Inventory items where sku !== sku_normalized: ${different?.length}`);
  if (different && different.length > 0) {
    console.log("Sample of items where sku !== sku_normalized:");
    different.slice(0, 20).forEach(item => {
      console.log(`- SKU: "${item.sku}", SKU_Normalized: "${item.sku_normalized}", Stock: ${item.current_stock}`);
    });
  }
}

main().catch(console.error);
