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
  console.log("Fetching all order items to detect duplicates...");
  const { data: orderItems, error } = await supa
    .from('order_items')
    .select('id, order_id, meli_item_id, sku, title, quantity, unit_price');

  if (error) {
    console.error("Error fetching order items:", error);
    return;
  }

  const groups = {};
  orderItems.forEach(item => {
    // Unique key for an item inside an order
    const key = `${item.order_id}-${item.meli_item_id || 'null'}-${item.sku || 'null'}-${item.title || 'null'}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  });

  const toDelete = [];
  let duplicateSetsCount = 0;

  for (const key in groups) {
    const items = groups[key];
    if (items.length > 1) {
      duplicateSetsCount++;
      // Keep the first item, mark the rest for deletion
      const keep = items[0];
      const rest = items.slice(1);
      console.log(`Duplicate found for order_id ${keep.order_id}:`);
      console.log(`  Keeping: ID ${keep.id} - ${keep.title} (SKU: ${keep.sku})`);
      rest.forEach(r => {
        console.log(`  Deleting: ID ${r.id} - ${r.title}`);
        toDelete.push(r.id);
      });
    }
  }

  if (toDelete.length === 0) {
    console.log("No duplicates found in the database. Everything is correct.");
    return;
  }

  console.log(`\nFound ${duplicateSetsCount} duplicate item sets. Total rows to delete: ${toDelete.length}`);

  // Perform deletions in chunks of 50
  for (let i = 0; i < toDelete.length; i += 50) {
    const chunk = toDelete.slice(i, i + 50);
    const { data, error: delError } = await supa
      .from('order_items')
      .delete()
      .in('id', chunk)
      .select();

    if (delError) {
      console.error(`Error deleting chunk starting at index ${i}:`, delError);
    } else {
      console.log(`Deleted chunk ${i / 50 + 1}. Deleted row IDs:`, data.map(d => d.id));
    }
  }

  console.log("Cleanup complete!");
}

main();
