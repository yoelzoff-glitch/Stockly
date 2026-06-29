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
  console.log("=== DIAGNOSTICING DATABASE FOR JUNE 2026 ===");

  // Fetch all orders
  const { data: allOrders, error: err1 } = await supa
    .from('orders')
    .select('meli_order_id, buyer_nickname, total_amount, status, date_created, raw_data')
    .gte('date_created', '2026-06-01T00:00:00.000Z')
    .lte('date_created', '2026-06-30T23:59:59.999Z');

  if (err1) {
    console.error("Error fetching orders:", err1.message);
    return;
  }

  console.log(`\nTotal orders in DB for June 2026: ${allOrders.length}`);

  // Group by status
  const byStatus = {};
  allOrders.forEach(o => {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  });
  console.log("Orders grouped by status:", byStatus);

  // Sum active orders total_amount
  const activeOrders = allOrders.filter(o => o.status !== 'cancelled');
  const activeSum = activeOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  console.log(`Sum of non-cancelled orders: $${activeSum}`);

  // Sum cancelled orders total_amount from orders table
  const cancelledOrders = allOrders.filter(o => o.status === 'cancelled');
  const cancelledSum = cancelledOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  console.log(`Sum of cancelled orders (from orders table): $${cancelledSum}`);

  // Fetch cancellations from order_cancellations table
  const { data: cancellations, error: err2 } = await supa
    .from('order_cancellations')
    .select('*');

  if (err2) {
    console.error("Error fetching cancellations table:", err2.message);
  } else {
    console.log(`\nTotal cancellations in order_cancellations table: ${cancellations.length}`);
    const cancellationsSum = cancellations.reduce((sum, c) => sum + (Number(c.refund_amount) || 0), 0);
    console.log(`Sum of refund_amount in order_cancellations: $${cancellationsSum}`);
    
    console.log("\nDetails of cancellations table:");
    cancellations.forEach(c => {
      console.log(`- Order: #${c.meli_order_id}, Refund: $${c.refund_amount}, Reason: ${c.reason}, Date Cancelled: ${c.date_cancelled}`);
    });
  }

  console.log("\nDetails of cancelled orders in orders table:");
  cancelledOrders.forEach(o => {
    console.log(`- Order: #${o.meli_order_id}, Buyer: ${o.buyer_nickname}, Amount: $${o.total_amount}, Date Created: ${o.date_created}`);
  });
}

main();
