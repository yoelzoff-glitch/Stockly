import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Let's count duplicate rows in order_items
  // A duplicate is defined by having the same order_id, meli_item_id, and sku
  const { data: duplicates, error: dupError } = await supa
    .from("order_items")
    .select("order_id, meli_item_id, sku, id")
    .order("order_id");

  if (dupError) {
    console.error("Error fetching order items:", dupError);
    return;
  }

  const seen = new Map<string, string>();
  const dupList: any[] = [];
  for (const item of (duplicates || [])) {
    const key = `${item.order_id}-${item.meli_item_id}-${item.sku || ''}`;
    if (seen.has(key)) {
      dupList.push({
        key,
        originalId: seen.get(key),
        duplicateId: item.id
      });
    } else {
      seen.set(key, item.id);
    }
  }

  console.log(`Total order items: ${duplicates?.length}`);
  console.log(`Total duplicate item rows found: ${dupList.length}`);
  if (dupList.length > 0) {
    console.log("Sample duplicates:");
    console.log(dupList.slice(0, 10));
  }
}

main().catch(console.error);
