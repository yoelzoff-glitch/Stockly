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
    .neq("status", "cancelled")
    .gte("date_created", "2026-07-01T03:00:00.000Z")
    .lte("date_created", "2026-07-03T00:00:00.000Z")
    .order("date_created", { ascending: true });

  console.log("Analyzing 10 active orders:\n");
  
  let totalAmountSum = 0;
  let totalProductRevenueSum = 0;
  let totalBuyerShippingSum = 0;

  orders.forEach(o => {
    const raw = o.raw_data;
    const amount = Number(o.total_amount) || 0;
    totalAmountSum += amount;

    // Calculate sum of item prices in raw_data.order_items
    let itemsPriceSum = 0;
    const orderItems = raw?.order_items || [];
    orderItems.forEach(item => {
      itemsPriceSum += (Number(item.unit_price) || 0) * (Number(item.quantity) || 1);
    });
    totalProductRevenueSum += itemsPriceSum;

    // Check shipping cost paid by buyer (sometimes under raw.shipping.cost or in payments)
    const buyerShipping = Number(raw?.shipping?.cost) || 0;
    totalBuyerShippingSum += buyerShipping;

    // Print details
    console.log(`Order: ${o.meli_order_id}`);
    console.log(`  total_amount (DB): ${amount}`);
    console.log(`  items price sum  : ${itemsPriceSum}`);
    console.log(`  shipping cost    : ${buyerShipping}`);
    console.log(`  coupon amount    : ${raw?.coupon?.amount || 0}`);
    console.log(`  payments         :`, raw?.payments?.map(p => ({
      transaction_amount: p.transaction_amount,
      shipping_cost: p.shipping_cost,
      coupon_amount: p.coupon_amount
    })));
  });

  console.log("\nGlobal Metrics:");
  console.log(`Total amount sum (DB total_amount): ${totalAmountSum}`);
  console.log(`Total product revenue sum (listing price * qty): ${totalProductRevenueSum}`);
  console.log(`Total buyer shipping sum: ${totalBuyerShippingSum}`);
  console.log(`Calculated difference: ${totalAmountSum - totalProductRevenueSum}`);
}

main();
