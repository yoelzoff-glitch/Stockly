const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
let env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      env[key] = val;
    }
  });
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supa = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: orders } = await supa
    .from("orders")
    .select("meli_order_id, total_amount, raw_data")
    .eq("tenant_id", "198b6356-4bbf-43d8-ae0e-3cc406f66f87")
    .neq("status", "cancelled")
    .gte("date_created", "2026-07-01T03:00:00.000Z")
    .lte("date_created", "2026-07-03T00:00:00.000Z")
    .order("date_created", { ascending: true });

  orders.forEach(o => {
    const raw = o.raw_data;
    console.log(`\nOrder: ${o.meli_order_id}`);
    console.log(`  DB total_amount: ${o.total_amount}`);
    console.log(`  raw.total_amount: ${raw?.total_amount}`);
    console.log(`  raw.paid_amount: ${raw?.paid_amount}`);
    
    // Items
    const items = raw?.order_items || [];
    items.forEach((item, index) => {
      console.log(`    Item ${index + 1}:`);
      console.log(`      title: ${item.item?.title}`);
      console.log(`      quantity: ${item.quantity}`);
      console.log(`      unit_price: ${item.unit_price}`);
      console.log(`      sale_fee: ${item.sale_fee}`);
      console.log(`      discounts: ${JSON.stringify(item.discounts)}`);
    });

    // Payments
    const payments = raw?.payments || [];
    payments.forEach((p, index) => {
      console.log(`    Payment ${index + 1}:`);
      console.log(`      transaction_amount: ${p.transaction_amount}`);
      console.log(`      coupon_amount: ${p.coupon_amount}`);
      console.log(`      marketplace_fee: ${p.marketplace_fee}`);
      console.log(`      net_received_amount: ${p.net_received_amount}`);
      console.log(`      taxes_amount: ${p.taxes_amount}`);
      console.log(`      shipping_cost: ${p.shipping_cost}`);
    });
  });
}

main();
