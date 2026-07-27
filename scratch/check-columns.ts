const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: cols, error } = await supa.rpc('get_table_columns', { table_name: 'products' });
  if (error) {
    // If RPC doesn't exist, we can fetch one row and print keys
    console.log("RPC get_table_columns not found, fetching one row...");
    const { data: row } = await supa.from('products').select('*').limit(1).single();
    console.log("Products columns:", Object.keys(row));
  } else {
    console.log("Products columns:", cols);
  }

  const { data: compRow } = await supa.from('product_components').select('*').limit(1).maybeSingle();
  if (compRow) {
    console.log("product_components columns:", Object.keys(compRow));
  }
}

main().catch(console.error);
