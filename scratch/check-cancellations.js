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
  const tenantId = 'yoelzoff-glitch/Stockly'; // Wait, let's fetch tenants first to find the correct tenant_id
  const { data: tenants } = await supa.from('tenants').select('id, name');
  console.log("Tenants:", tenants);

  const tId = tenants[0].id;
  console.log("Using tenant_id:", tId);

  // Fetch all cancellations
  const { data: cancellations, error } = await supa
    .from('order_cancellations')
    .select('*, orders(meli_order_id, total_amount, raw_data)')
    .eq('tenant_id', tId);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Total cancellations in DB: ${cancellations.length}`);
  cancellations.forEach(c => {
    const order = c.orders;
    const payments = order?.raw_data?.payments || [];
    const hasPaidOrRefunded = payments.some(p => p.status === 'approved' || p.status === 'refunded');
    console.log(`Cancel ID: ${c.id}`);
    console.log(`  Order ML ID: ${order?.meli_order_id}`);
    console.log(`  Refund Amount: ${c.refund_amount}`);
    console.log(`  Order Total Amount: ${order?.total_amount}`);
    console.log(`  Date Cancelled: ${c.date_cancelled}`);
    console.log(`  Has Paid/Refunded Payment: ${hasPaidOrRefunded}`);
  });
}

main();
