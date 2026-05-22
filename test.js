const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '.env.local'});
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const r1 = await s.from('products').select('id, meli_item_id').or('meli_item_id.ilike.*2778889574*').limit(1);
  console.log('Without quotes:', r1.data, r1.error);
  
  const r2 = await s.from('products').select('id, meli_item_id').or('meli_item_id.ilike."*2778889574*"').limit(1);
  console.log('With quotes:', r2.data, r2.error);
}
run();
