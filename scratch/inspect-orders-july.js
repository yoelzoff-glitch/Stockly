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

// We need to implement getMidnightInTimezone here
function getMidnightInTimezone(date, tz) {
  // Format target date to parts in the given timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = formatter.formatToParts(date);
  const month = parseInt(parts.find(p => p.type === 'month').value, 10);
  const day = parseInt(parts.find(p => p.type === 'day').value, 10);
  const year = parseInt(parts.find(p => p.type === 'year').value, 10);

  // Return a Date object representing midnight (00:00:00) in that timezone
  // We construct it by formatting a UTC date
  const isoStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`;
  
  // To get the exact UTC representation of that local midnight:
  // We can format it, check the offset, and subtract it.
  // A simple way is to use temporal or parse it using target timezone.
  // In Node.js, we can do this:
  const formatterWithTime = new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  // Approximate UTC time that would correspond to that local date
  let guess = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  for (let i = 0; i < 5; i++) {
    const formatted = formatterWithTime.format(guess); // "YYYY-MM-DD HH:MM:SS"
    const [gDate, gTime] = formatted.split(' ');
    const [gYear, gMonth, gDay] = gDate.split('-').map(Number);
    const [gHour, gMin, gSec] = gTime.split(':').map(Number);
    
    const diffMs = guess.getTime() - Date.UTC(gYear, gMonth - 1, gDay, gHour, gMin, gSec);
    guess = new Date(guess.getTime() + diffMs);
  }
  
  // Now guess is the exact UTC date corresponding to local midnight
  return guess;
}

async function main() {
  const timezone = 'America/Argentina/Buenos_Aires';
  
  // July 2026 dates
  const tenantYear = 2026;
  const tenantMonth = 7; // July is month 7
  
  const dateFrom = getMidnightInTimezone(new Date(Date.UTC(tenantYear, tenantMonth - 1, 1, 12, 0, 0)), timezone);
  const dateTo = new Date(); // now, which is July 2nd, 2026 19:57:14-03:00 (which is July 2nd, 22:57:14 UTC)
  
  console.log("Calculated boundaries:");
  console.log("dateFrom:", dateFrom.toISOString(), `(${dateFrom.toLocaleString('es-AR', { timeZone: timezone })})`);
  console.log("dateTo  :", dateTo.toISOString(), `(${dateTo.toLocaleString('es-AR', { timeZone: timezone })})`);

  // Fetch active orders (non-cancelled) in range
  const { data: orders } = await supa
    .from("orders")
    .select("meli_order_id, total_amount, date_created, status")
    .eq("tenant_id", "198b6356-4bbf-43d8-ae0e-3cc406f66f87") // Nailen tenant id
    .neq("status", "cancelled")
    .gte("date_created", dateFrom.toISOString())
    .lte("date_created", dateTo.toISOString())
    .order("date_created", { ascending: true });

  console.log(`\nFound ${orders.length} active orders in range:`);
  let sum = 0;
  orders.forEach(o => {
    const createdLocal = new Date(o.date_created).toLocaleString('es-AR', { timeZone: timezone });
    console.log(`- Order: ${o.meli_order_id} | Created (UTC): ${o.date_created} | Created (Local): ${createdLocal} | Amount: ${o.total_amount} | Status: ${o.status}`);
    sum += Number(o.total_amount) || 0;
  });
  console.log("Sum of these orders:", sum);

  // Let's also check if there are any orders just before or after the boundary
  const dateFromMargin = new Date(dateFrom.getTime() - 24 * 60 * 60 * 1000);
  const { data: borderOrders } = await supa
    .from("orders")
    .select("meli_order_id, total_amount, date_created, status")
    .eq("tenant_id", "198b6356-4bbf-43d8-ae0e-3cc406f66f87")
    .neq("status", "cancelled")
    .gte("date_created", dateFromMargin.toISOString())
    .lt("date_created", dateFrom.toISOString())
    .order("date_created", { ascending: true });

  console.log(`\nFound ${borderOrders?.length || 0} active orders just before dateFrom:`);
  borderOrders?.forEach(o => {
    const createdLocal = new Date(o.date_created).toLocaleString('es-AR', { timeZone: timezone });
    console.log(`- Order: ${o.meli_order_id} | Created (UTC): ${o.date_created} | Created (Local): ${createdLocal} | Amount: ${o.total_amount} | Status: ${o.status}`);
  });
}

main();
