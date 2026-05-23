import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({path: '.env.local'});
const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function main() {
  const { data } = await supa.from('products').select('title, listing_type_id, raw_data').limit(5);
  let str = '';
  for(let d of (data || [])) {
    str += d.title + ' -> ' + JSON.stringify(d.raw_data.fees) + '\n';
  }
  fs.writeFileSync('output.txt', str);
}
main();
