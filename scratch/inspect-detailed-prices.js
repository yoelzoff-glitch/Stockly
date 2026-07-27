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
    .select("meli_order_id, total_amount, date_created, status, raw_data")
    .eq("tenant_id", "198b6356-4bbf-43d8-ae0e-3cc406f66f87")
    .gte("date_created", "2026-06-30T00:00:00.000Z")
    .lte("date_created", "2026-07-03T00:00:00.000Z")
    .order("date_created", { ascending: true });

  console.log(`Analyzing ${orders.length} orders:\n`);

  orders.forEach(o => {
    const raw = o.raw_data;
    console.log(`Order: ${o.meli_order_id} | UTC: ${o.date_created} | Gross: ${o.total_amount} | Status: ${o.status}`);
    const items = raw?.order_items || [];
    items.forEach((item, idx) => {
      console.log(`  Item ${idx + 1}:`);
      console.log(`    title: ${item.item?.title}`);
      console.log(`    qty: ${item.quantity}`);
      console.log(`    unit_price: ${item.unit_price}`);
      console.log(`    gross_price: ${item.gross_price}`);
      console.log(`    discounts: ${JSON.stringify(item.discounts)}`);
      console.log(`    base_exchange_rate: ${item.base_exchange_rate}`);
    });
    
    // Check payments
    const payments = raw?.payments || [];
    payments.forEach((p, idx) => {
      console.log(`  Payment ${idx + 1}:`);
      console.log(`    transaction_amount: ${p.transaction_amount}`);
      console.log(`    coupon_amount: ${p.coupon_amount}`);
      console.log(`    shipping_cost: ${p.shipping_cost}`);
      console.log(`    overpayment: ${p.overpayment}`);
    });
  });
}

main();
