import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';

for (const line of envFile.split('\n')) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) supabaseKey = line.split('=')[1].trim();
}

const s = createClient(supabaseUrl, supabaseKey);

async function run() {
  const query = "2778889574";
  
  const { data: tenant } = await s.from("tenants").select("id").limit(1).single();
  const tId = tenant.id;

  const { data: exactMatches, error: exactError } = await s
    .from("products")
    .select("id, title, sku, price, available_quantity, status, meli_item_id")
    .eq("tenant_id", tId)
    .or(`sku.eq."${query}",meli_item_id.ilike."*${query}*"`);

  console.log("exactMatches length:", exactMatches?.length);

  const payload = [{
    product_id: exactMatches[0].id,
    title: exactMatches[0].title,
    current_value: exactMatches[0].price,
    new_value: 100000
  }];
  
  const { data: action, error: actionErr } = await s.from("ai_actions").insert({
    tenant_id: tId,
    action_type: "update_price",
    payload,
    status: "pending"
  }).select("id").single();
  
  console.log("action inserted?", action, actionErr);
}
run();
