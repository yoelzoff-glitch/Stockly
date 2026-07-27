const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supa.from('monthly_expenses').select('*').limit(1);
  if (error) {
    console.error("Error fetching monthly_expenses:", error.message);
  } else {
    console.log("Columns in monthly_expenses:", Object.keys(data[0] || {}));
  }
}

main();
