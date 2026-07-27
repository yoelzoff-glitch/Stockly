import { recalculateMultipleProductsCost } from '../src/services/inventory/recalculateProductCostFromComponents';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const tenantId = '198b6356-4bbf-43d8-ae0e-3cc406f66f87';
const productId = 'da6582a7-3879-48ca-bedd-9d6f65f1451a';

async function main() {
  console.log("Starting recalculation for product:", productId);
  const results = await recalculateMultipleProductsCost(tenantId, [productId]);
  console.log("Recalculation results:");
  console.log(JSON.stringify(results, null, 2));

  // Check the product after recalculation
  const { data: p } = await supa.from('products').select('id, cost, profitability_status, updated_at').eq('id', productId).single();
  console.log("Product state in DB now:");
  console.log(p);
}

main().catch(console.error);
