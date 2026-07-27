import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const tenantId = '198b6356-4bbf-43d8-ae0e-3cc406f66f87';

async function main() {
  const { data: order } = await supa
    .from("orders")
    .select("id, total_amount, status, date_created, meli_order_id, raw_data")
    .eq("meli_order_id", "2000017301055144")
    .single();

  console.log("Order in DB:");
  console.log(JSON.stringify(order, null, 2));

  if (order) {
    const { data: items } = await supa
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);

    console.log("\nOrder Items in DB:");
    console.log(JSON.stringify(items, null, 2));
  }
}

main().catch(console.error);
