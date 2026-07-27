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

// Set up TS Node register or similar, or we can just import from compile output.
// Since it is a Next.js app, we can run a simple Node script that mimics page.tsx calculations exactly using the original getMidnightInTimezone.
// Let's copy getMidnightInTimezone from src/services/ai/tools/finance.ts so it is exactly the same code.

function getMidnightInTimezone(date, timezone = 'America/Argentina/Buenos_Aires') {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = formatter.format(date); // "YYYY-MM-DD"
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
  
  // Mimic page.tsx logic
  const now = new Date();
  const tenantDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const tenantDateStr = tenantDateFormatter.format(now); // "YYYY-MM-DD"
  const [tenantYear, tenantMonth, tenantDay] = tenantDateStr.split('-').map(Number);

  console.log("Current Tenant Date in Buenos Aires:", tenantDateStr);
  console.log("tenantYear:", tenantYear, "tenantMonth:", tenantMonth, "tenantDay:", tenantDay);

  const dateFrom = getMidnightInTimezone(new Date(Date.UTC(tenantYear, tenantMonth - 1, 1, 12, 0, 0)), timezone);
  const dateTo = now;

  console.log("\nOriginal getMidnightInTimezone boundaries:");
  console.log("dateFrom:", dateFrom.toISOString(), `(${dateFrom.toLocaleString('es-AR', { timeZone: timezone })})`);
  console.log("dateTo  :", dateTo.toISOString(), `(${dateTo.toLocaleString('es-AR', { timeZone: timezone })})`);
}

main();
