const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const { getFinancialData } = require('./src/services/finance/getFinancialData');

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const tenantId = '198b6356-4bbf-43d8-ae0e-3cc406f66f87';
const timezone = 'America/Argentina/Buenos_Aires';
const packagingCost = 0;
const ignoredOrderIds = [];

const dateFrom = new Date(Date.UTC(2026, 6, 1, 3, 0, 0)); // July 1st, 2026
const dateTo = new Date(); // now

async function main() {
  console.log(`Running financial data calculation from ${dateFrom.toISOString()} to ${dateTo.toISOString()}...`);
  const financials = await getFinancialData(
    supa,
    tenantId,
    dateFrom,
    dateTo,
    packagingCost,
    ignoredOrderIds,
    true, // disableProration
    timezone
  );

  const matchedRow = financials.tableData.find(r => r.sku.includes('D 762 Y C 206') || r.title.includes('Rosa X 40 Cm'));
  console.log("Matched Table Row in financials:", matchedRow);
  
  // Let's print all rows with zero/missing cost or Falta badge condition: row.cost === 0
  const missingCostRows = financials.tableData.filter(r => r.cost === 0);
  console.log(`\nFound ${missingCostRows.length} rows with 0 cost:`);
  missingCostRows.forEach(r => {
    console.log(`- Title: "${r.title}", SKU: "${r.sku}", Qty: ${r.qty}, Revenue: ${r.revenue}, Cost: ${r.cost}`);
  });
}

main().catch(console.error);
