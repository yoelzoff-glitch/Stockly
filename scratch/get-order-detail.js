const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
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

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials. Checked path:", envPath);
  process.exit(1);
}

const supa = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: o1 } = await supa.from('orders').select('*').eq('meli_order_id', '2000017091315330').single();
  const { data: o2 } = await supa.from('orders').select('*').eq('meli_order_id', '2000017099099854').single();

  console.log("=== ORDER #2000017091315330 (Anónimo) ===");
  console.log("Status:", o1.status);
  console.log("Status Detail:", o1.raw_data?.status_detail);
  console.log("Cancel Detail:", JSON.stringify(o1.raw_data?.cancel_detail, null, 2));
  console.log("Payments:", JSON.stringify(o1.raw_data?.payments?.map(p => ({ status: p.status, status_detail: p.status_detail, transaction_amount: p.transaction_amount })), null, 2));

  console.log("\n=== ORDER #2000017099099854 (Belen Pessolani) ===");
  console.log("Status:", o2.status);
  console.log("Status Detail:", o2.raw_data?.status_detail);
  console.log("Cancel Detail:", JSON.stringify(o2.raw_data?.cancel_detail, null, 2));
  console.log("Payments:", JSON.stringify(o2.raw_data?.payments?.map(p => ({ status: p.status, status_detail: p.status_detail, transaction_amount: p.transaction_amount })), null, 2));
}

main();
