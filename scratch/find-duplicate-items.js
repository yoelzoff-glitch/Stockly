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
  const { data: orderItems, error } = await supa
    .from('order_items')
    .select('id, order_id, meli_item_id, sku, quantity, total_price');

  if (error) {
    console.error("Error fetching order items:", error);
    return;
  }

  // Group by order_id and meli_item_id (or sku)
  const itemMap = {};
  const duplicates = [];

  orderItems.forEach(item => {
    const key = `${item.order_id}-${item.meli_item_id}-${item.sku}`;
    if (!itemMap[key]) {
      itemMap[key] = [];
    }
    itemMap[key].push(item);
  });

  for (const key in itemMap) {
    if (itemMap[key].length > 1) {
      duplicates.push({
        key,
        count: itemMap[key].length,
        items: itemMap[key]
      });
    }
  }

  console.log(`Found ${duplicates.length} duplicate item sets:`);
  duplicates.slice(0, 10).forEach(d => {
    console.log(`Duplicate set: ${d.key} | count: ${d.count}`);
    d.items.forEach(item => {
      console.log(`  - id: ${item.id}, qty: ${item.quantity}, price: ${item.total_price}`);
    });
  });
}

main();
