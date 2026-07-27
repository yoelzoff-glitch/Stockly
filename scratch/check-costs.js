const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const ids = [
    '9ab934b2-9197-4f9f-9e1b-ca56a003077c',
    '6d7ac9dd-8a8d-495f-9eb0-ab4c47948a96',
    '2512c48d-2e0d-4e89-af75-d4048c26aacb',
    'da6582a7-3879-48ca-bedd-9d6f65f1451a',
    '191d69ff-5682-4e28-88de-e9bb2e55289f'
  ];

  console.log("Checking product_components:");
  const { data: comps, error: compErr } = await supa
    .from('product_components')
    .select('*')
    .in('product_id', ids);

  if (compErr) {
    console.error("product_components error:", compErr);
  } else {
    console.log(comps);
  }

  console.log("\nChecking product_sku_components:");
  const { data: skuComps, error: skuErr } = await supa
    .from('product_sku_components')
    .select('*')
    .in('product_id', ids);

  if (skuErr) {
    console.error("product_sku_components error:", skuErr);
  } else {
    console.log(skuComps);
  }
}

main().catch(console.error);
