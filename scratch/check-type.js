const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // Query table columns using Postgres RPC or catalog if possible, or we can just try to run a select on info schema via RPC?
  // Wait, Supabase doesn't let us query information_schema directly unless it's exposed. Let's try to query it using the REST API if allowed, or see.
  // Actually, we can check by inserting a test record and seeing its format, or looking at how it's used.
  // Let's see what happens if we query a list of columns by calling a select on pg_attribute or information_schema.columns.
  // Let's try it.
  const { data, error } = await supa.from('monthly_expenses').select('target_month').limit(1);
  console.log("target_month value:", data, "error:", error);
}

main();
