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
  const { data: order } = await supa
    .from("orders")
    .select("*")
    .eq("meli_order_id", "2000017200142254")
    .single();

  console.log("Cancelled Order details:");
  console.log("total_amount:", order.total_amount);
  console.log("coupon_amount (raw_data):", order.raw_data?.coupon?.amount);
  console.log("payments:", order.raw_data?.payments?.map(p => ({
    transaction_amount: p.transaction_amount,
    coupon_amount: p.coupon_amount,
    shipping_cost: p.shipping_cost
  })));
}

main();
