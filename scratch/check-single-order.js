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
    .eq('meli_order_id', '2000017209055152')
    .single();

  console.log("Order details:");
  console.log("ID:", order.id);
  console.log("total_amount:", order.total_amount);
  console.log("raw_data.order_items:", JSON.stringify(order.raw_data?.order_items, null, 2));

  const { data: items } = await supa
    .from('order_items')
    .select('*')
    .eq('order_id', order.id);

  console.log("\nDatabase order_items:");
  console.log(items);
}

main();
