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
  // Let's get a wide range of orders around the end of June and beginning of July 2026
  const { data: orders } = await supa
    .from("orders")
    .select("meli_order_id, total_amount, date_created, status, raw_data")
    .eq("tenant_id", "198b6356-4bbf-43d8-ae0e-3cc406f66f87")
    .gte("date_created", "2026-06-25T00:00:00.000Z")
    .lte("date_created", "2026-07-04T00:00:00.000Z");

  const activeOrders = orders.filter(o => o.status !== 'cancelled');
  
  console.log(`Analyzing ${activeOrders.length} active orders for subset sum...`);

  const target = 733461;

  // We want to find a subset of activeOrders such that either:
  // 1. The sum of their o.total_amount matches target.
  // 2. The sum of (o.total_amount - coupon) matches target.
  // We'll search for subsets of size 8 to 12.

  const candidates = activeOrders.map(o => {
    const coupon = o.raw_data?.payments?.[0]?.coupon_amount || 0;
    const gross = Number(o.total_amount) || 0;
    const net = gross - Number(coupon);
    return {
      id: o.meli_order_id,
      gross,
      net,
      coupon,
      date: o.date_created
    };
  });

  // Simple recursive subset search
  const results = [];

  function search(index, currentSubset, currentGrossSum, currentNetSum) {
    if (Math.abs(currentGrossSum - target) < 10 || Math.abs(currentNetSum - target) < 10) {
      results.push({
        subset: [...currentSubset],
        grossSum: currentGrossSum,
        netSum: currentNetSum,
        type: Math.abs(currentGrossSum - target) < 10 ? 'gross' : 'net'
      });
    }

    if (index >= candidates.length) return;

    // Option 1: Include this candidate
    currentSubset.push(candidates[index]);
    search(
      index + 1,
      currentSubset,
      currentGrossSum + candidates[index].gross,
      currentNetSum + candidates[index].net
    );
    currentSubset.pop();

    // Option 2: Exclude this candidate
    search(index + 1, currentSubset, currentGrossSum, currentNetSum);
  }

  search(0, [], 0, 0);

  console.log(`\nFound ${results.length} matching subsets:`);
  results.forEach((r, idx) => {
    console.log(`\nResult #${idx + 1} (${r.type} sum = ${r.type === 'gross' ? r.grossSum : r.netSum}):`);
    console.log(`  Count: ${r.subset.length}`);
    r.subset.forEach(item => {
      console.log(`  - Order: ${item.id} | Date: ${item.date} | Gross: ${item.gross} | Coupon: ${item.coupon} | Net: ${item.net}`);
    });
  });
}

main();
