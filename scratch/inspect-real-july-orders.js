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

function getMidnightInTimezone(date, timezone = 'America/Argentina/Buenos_Aires') {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = formatter.format(date);
  const [year, month, day] = dateStr.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  const parts = timeFormatter.formatToParts(utcDate);
  const pYear = Number(parts.find(p => p.type === 'year')?.value || year);
  const pMonth = Number(parts.find(p => p.type === 'month')?.value || month);
  const pDay = Number(parts.find(p => p.type === 'day')?.value || day);
  const pHour = Number(parts.find(p => p.type === 'hour')?.value || 0);
  
  const localTimeAsUtc = new Date(Date.UTC(pYear, pMonth - 1, pDay, pHour, 0, 0));
  const offsetMs = utcDate.getTime() - localTimeAsUtc.getTime();
  
  return new Date(utcDate.getTime() + offsetMs);
}

async function main() {
  const timezone = 'America/Argentina/Buenos_Aires';
  const tenantYear = 2026;
  const tenantMonth = 7;
  
  const dateFrom = getMidnightInTimezone(new Date(Date.UTC(tenantYear, tenantMonth - 1, 1, 12, 0, 0)), timezone);
  const dateTo = new Date();
  
  console.log("Timezone:", timezone);
  console.log("dateFrom:", dateFrom.toISOString(), `(${dateFrom.toLocaleString('es-AR', { timeZone: timezone })})`);
  console.log("dateTo  :", dateTo.toISOString(), `(${dateTo.toLocaleString('es-AR', { timeZone: timezone })})`);

  // Fetch all orders for Nailen tenant (198b6356-4bbf-43d8-ae0e-3cc406f66f87) in range
  const { data: allOrders } = await supa
    .from("orders")
    .select("meli_order_id, total_amount, date_created, status, raw_data")
    .eq("tenant_id", "198b6356-4bbf-43d8-ae0e-3cc406f66f87")
    .gte("date_created", dateFrom.toISOString())
    .lte("date_created", dateTo.toISOString())
    .order("date_created", { ascending: true });

  console.log(`\nFound ${allOrders.length} total orders in this period:`);
  
  let activeSum = 0;
  let cancelledSum = 0;

  allOrders.forEach(o => {
    const createdLocal = new Date(o.date_created).toLocaleString('es-AR', { timeZone: timezone });
    const amount = Number(o.total_amount) || 0;
    
    console.log(`- Order: ${o.meli_order_id} | Created (Local): ${createdLocal} | Amount: ${amount} | Status: ${o.status}`);
    
    if (o.status !== 'cancelled') {
      activeSum += amount;
    } else {
      cancelledSum += amount;
    }
  });

  console.log("\nActive Orders Sum (Facturación Bruta in Dashboard):", activeSum);
  console.log("Cancelled Orders Sum:", cancelledSum);
}

main();
