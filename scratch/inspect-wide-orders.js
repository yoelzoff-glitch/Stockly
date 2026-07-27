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
  const timezone = 'America/Argentina/Buenos_Aires';
  
  // Query all orders from June 29th to July 3rd to get a complete picture
  const { data: orders } = await supa
    .from("orders")
    .select("meli_order_id, total_amount, date_created, status, raw_data")
    .eq("tenant_id", "198b6356-4bbf-43d8-ae0e-3cc406f66f87")
    .gte("date_created", "2026-06-29T00:00:00.000Z")
    .lte("date_created", "2026-07-03T23:59:59.000Z")
    .order("date_created", { ascending: true });

  console.log(`Total orders found in wide range: ${orders.length}\n`);

  orders.forEach(o => {
    const createdLocal = new Date(o.date_created).toLocaleString('es-AR', { timeZone: timezone });
    const coupon = o.raw_data?.payments?.[0]?.coupon_amount || 0;
    const net = (Number(o.total_amount) || 0) - Number(coupon);
    console.log(`Order: ${o.meli_order_id} | UTC: ${o.date_created} | Local: ${createdLocal} | Gross: ${o.total_amount} | Coupon: ${coupon} | Net: ${net} | Status: ${o.status}`);
  });
}

main();
