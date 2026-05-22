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
  const { data: product } = await s.from("products").select("raw_data").eq("meli_item_id", "MLA1642828571").single();
  console.dir(product?.raw_data?.variations, {depth: null});
}
run();
