const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: firstOrder } = await supa.from('orders').select('tenant_id').limit(1).single();
  const tenantId = firstOrder.tenant_id;

  const { data: tenant } = await supa.from('tenants').select('timezone, metadata').eq('id', tenantId).single();
  const timezone = tenant?.timezone || 'America/Argentina/Buenos_Aires';
  const ignoredOrderIds = tenant?.metadata?.ignored_order_ids || [];

  console.log("Tenant Timezone:", timezone);
  console.log("Ignored orders:", ignoredOrderIds);

  const { data: dbOrders } = await supa
    .from("orders")
    .select("meli_order_id, status, total_amount, date_created, buyer_nickname")
    .eq("tenant_id", tenantId)
    .neq("status", "cancelled")
    .gte("date_created", "2026-06-11T00:00:00Z")
    .order("date_created", { ascending: false });

  console.log(`\nOrders from June 11th onwards (total count: ${dbOrders?.length || 0}):`);
  
  // Format dates in America/Argentina/Buenos_Aires
  const formatter = new Intl.DateTimeFormat('es-AR', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const activeOrders = (dbOrders || []).filter(o => !ignoredOrderIds.includes(o.meli_order_id));

  activeOrders.forEach(o => {
    const utcDate = new Date(o.date_created);
    const localDateStr = formatter.format(utcDate);
    console.log(`Order ID: ${o.meli_order_id} | Total: ${o.total_amount} | UTC Date: ${o.date_created} | AR Date: ${localDateStr} | Status: ${o.status}`);
  });

  // Calculate today's sales in Argentina timezone
  const tenantDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const tenantDateStr = tenantDateFormatter.format(new Date()); // "YYYY-MM-DD"
  const [tenantYear, tenantMonth, tenantDay] = tenantDateStr.split('-').map(Number);

  // Helper function mimicking the getMidnightInTimezone logic
  function getMidnightInTimezone(date, tz) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const dateStr = formatter.format(date);
    const [y, m, d] = dateStr.split('-').map(Number);
    const utcDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    const parts = timeFormatter.formatToParts(utcDate);
    const pYear = Number(parts.find(p => p.type === 'year')?.value || y);
    const pMonth = Number(parts.find(p => p.type === 'month')?.value || m);
    const pDay = Number(parts.find(p => p.type === 'day')?.value || d);
    const pHour = Number(parts.find(p => p.type === 'hour')?.value || 0);
    
    const localTimeAsUtc = new Date(Date.UTC(pYear, pMonth - 1, pDay, pHour, 0, 0));
    const offsetMs = utcDate.getTime() - localTimeAsUtc.getTime();
    
    return new Date(utcDate.getTime() + offsetMs);
  }

  const today = getMidnightInTimezone(new Date(tenantYear, tenantMonth - 1, tenantDay, 0, 0, 0, 0), timezone);
  console.log("\nMidnight today UTC:", today.toISOString());

  let salesToday = 0;
  activeOrders.forEach(o => {
    const orderDate = new Date(o.date_created);
    if (orderDate >= today) {
      salesToday += Number(o.total_amount) || 0;
    }
  });

  console.log(`Computed Sales Today: ${salesToday}`);
}

main();
