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
  // Get tenant id from profiles / sample orders
  const { data: profiles } = await supa.from('profiles').select('tenant_id').limit(1);
  const tenantId = profiles[0]?.tenant_id;
  console.log("Using Tenant ID:", tenantId);

  const { data: expenses, error } = await supa
    .from('monthly_expenses')
    .select('*')
    .eq('tenant_id', tenantId);

  if (error) {
    console.error("Error fetching expenses:", error);
    return;
  }

  console.log("\nMonthly Expenses:");
  console.log(JSON.stringify(expenses, null, 2));

  // Let's also check active orders for the current month
  // Date range for current month (July 2026 based on prompt metadata 2026-07-02)
  const dateFrom = new Date(Date.UTC(2026, 6, 1, 0, 0, 0));
  const dateTo = new Date(); // now

  const { data: orders } = await supa
    .from("orders")
    .select("id, total_amount, date_created, status")
    .eq("tenant_id", tenantId)
    .neq("status", "cancelled")
    .gte("date_created", dateFrom.toISOString())
    .lte("date_created", dateTo.toISOString());

  console.log(`\nActive orders from ${dateFrom.toISOString()} to ${dateTo.toISOString()}:`, orders?.length);
  const totalRevenue = orders?.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) || 0;
  console.log("Total Revenue (this month):", totalRevenue);
}

main();
