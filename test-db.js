const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("Checking products by status...");
  const { data, error } = await supa.from('products').select('status');
  if (error) {
    console.log("Error:", error.message);
  } else {
    console.log("Total products in database:", data.length);
    const counts = {};
    data.forEach(p => {
      counts[p.status] = (counts[p.status] || 0) + 1;
    });
    console.log("Status counts:", counts);
  }
}

main();
