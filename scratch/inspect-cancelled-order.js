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
  const { data: order, error } = await supa
    .from('orders')
    .select('*')
    .eq('meli_order_id', '2000017613047290')
    .single();

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Order found:", {
    id: order.id,
    meli_order_id: order.meli_order_id,
    status: order.status,
    total_amount: order.total_amount,
    date_created: order.date_created,
    raw_data: {
      status: order.raw_data?.status,
      payments: order.raw_data?.payments?.map(p => ({ status: p.status, id: p.id })),
      cancel_detail: order.raw_data?.cancel_detail
    }
  });
}

main();
