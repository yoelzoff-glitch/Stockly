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
    .gte("date_created", "2026-07-01T03:00:00.000Z")
    .lte("date_created", "2026-07-03T00:00:00.000Z")
    .order("date_created", { ascending: true });

  console.log(`Analyzing ${orders.length} orders for exact match to 733461...`);

  const target = 733461;

  // Let's generate candidates. For each order, we can have:
  // - gross (total_amount)
  // - net (total_amount - coupon_amount)
  // - item_gross (gross_price * qty)
  // - item_unit (unit_price * qty)
  // - item_unit_minus_coupon (unit_price * qty - coupon_amount)
  // And we can choose to include or exclude each order.

  const optionsPerOrder = orders.map(o => {
    const coupon = o.raw_data?.payments?.[0]?.coupon_amount || 0;
    const gross = Number(o.total_amount) || 0;
    const item = o.raw_data?.order_items?.[0] || {};
    const qty = Number(item.quantity) || 1;
    const itemGross = (Number(item.gross_price) || gross) * qty;
    const itemUnit = (Number(item.unit_price) || gross) * qty;

    return [
      { name: 'Exclude', val: 0, desc: 'Excluded' },
      { name: 'Gross', val: gross, desc: `Gross (${gross})` },
      { name: 'Net', val: gross - coupon, desc: `Net (${gross - coupon})` },
      { name: 'ItemGross', val: itemGross, desc: `ItemGross (${itemGross})` },
      { name: 'ItemUnit', val: itemUnit, desc: `ItemUnit (${itemUnit})` },
      { name: 'ItemUnitMinusCoupon', val: itemUnit - coupon, desc: `ItemUnitMinusCoupon (${itemUnit - coupon})` }
    ];
  });

  const results = [];

  function solve(orderIdx, currentSum, currentSelections) {
    if (orderIdx === orders.length) {
      if (Math.abs(currentSum - target) < 10) {
        results.push({
          sum: currentSum,
          selections: [...currentSelections]
        });
      }
      return;
    }

    const options = optionsPerOrder[orderIdx];
    for (const opt of options) {
      currentSelections.push({
        id: orders[orderIdx].meli_order_id,
        status: orders[orderIdx].status,
        date: orders[orderIdx].date_created,
        name: opt.name,
        val: opt.val,
        desc: opt.desc
      });
      solve(orderIdx + 1, currentSum + opt.val, currentSelections);
      currentSelections.pop();
    }
  }

  solve(0, 0, []);

  console.log(`\nFound ${results.length} combinations matching 733461:`);
  results.slice(0, 10).forEach((r, idx) => {
    console.log(`\nCombination #${idx + 1} (Sum = ${r.sum}):`);
    let countActive = 0;
    let countCancelled = 0;
    r.selections.forEach(sel => {
      if (sel.name !== 'Exclude') {
        console.log(`  - Order: ${sel.id} (${sel.status}) | Choice: ${sel.name} | Val: ${sel.val}`);
        if (sel.status === 'cancelled') countCancelled++;
        else countActive++;
      }
    });
    console.log(`  Summary: Active count = ${countActive}, Cancelled count = ${countCancelled}`);
  });
}

main();
