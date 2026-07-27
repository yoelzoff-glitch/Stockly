const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supa.from('monthly_expenses').select('*').limit(3);
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("monthly_expenses data:", data);
  }
}

main();
