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
    .from('orders')
    .select('*')
    .limit(1)
    .single();

  if (!order) {
    console.log("No orders found");
    return;
  }

  console.log("Order ID:", order.meli_order_id);
  console.log("Keys of raw_data:", Object.keys(order.raw_data));
  console.log("Payments:", order.raw_data.payments);
  console.log("Shipping:", order.raw_data.shipping);
  console.log("Coupon/Discounts if any:", order.raw_data.coupon, order.raw_data.discounts);
}

main();
