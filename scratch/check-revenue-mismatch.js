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
  // Let's get orders from July 2026 (or just the latest 20 orders)
  const { data: orders } = await supa
    .from('orders')
    .select('id, meli_order_id, total_amount, date_created, status, raw_data')
    .neq('status', 'cancelled')
    .order('date_created', { ascending: false })
    .limit(30);

  if (!orders || orders.length === 0) {
    console.log("No orders found");
    return;
  }

  const orderIds = orders.map(o => o.id);
  const { data: orderItems } = await supa
    .from('order_items')
    .select('order_id, title, quantity, total_price, sku')
    .in('order_id', orderIds);

  console.log(`Analyzing ${orders.length} orders:`);
  let totalOrdersAmount = 0;
  let totalItemsPriceSum = 0;

  orders.forEach(o => {
    const items = (orderItems || []).filter(item => item.order_id === o.id);
    const amount = Number(o.total_amount) || 0;
    totalOrdersAmount += amount;

    const itemsSum = items.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
    totalItemsPriceSum += itemsSum;

    if (Math.abs(amount - itemsSum) > 0.01) {
      console.log(`\nMismatch in Order ${o.meli_order_id}:`);
      console.log(`  Date Created: ${o.date_created}`);
      console.log(`  Order total_amount: ${amount}`);
      console.log(`  Items total_price sum: ${itemsSum}`);
      console.log(`  Raw data coupon:`, o.raw_data?.coupon);
      console.log(`  Raw data payments:`, o.raw_data?.payments?.map(p => ({
        transaction_amount: p.transaction_amount,
        coupon_amount: p.coupon_amount,
        shipping_cost: p.shipping_cost,
        overpayment: p.overpayment
      })));
      items.forEach(item => {
        console.log(`    Item: ${item.title} | Qty: ${item.quantity} | total_price: ${item.total_price} | sku: ${item.sku}`);
      });
    }
  });

  console.log(`\nGlobal Totals for these ${orders.length} orders:`);
  console.log(`  Total orders amount (facturacionBruta): ${totalOrdersAmount}`);
  console.log(`  Total items price sum (table rows sum): ${totalItemsPriceSum}`);
}

main();
