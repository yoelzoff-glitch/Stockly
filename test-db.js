const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("Checking if inventory_items table exists...");
  const { data, error } = await supa.from('inventory_items').select('*').limit(1);
  if (error) {
    console.log("Error querying inventory_items:", error.message);
  } else {
    console.log("Success! inventory_items table exists.", data);
  }
}

main();
