import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const tenantId = '198b6356-4bbf-43d8-ae0e-3cc406f66f87';

async function main() {
  const { data: products } = await supa
    .from('products')
    .select('id, sku, cost, status, updated_at')
    .eq('sku', 'D 762 Y C 206')
    .eq('tenant_id', tenantId);

  console.log("Current products matching SKU 'D 762 Y C 206':");
  console.log(products);

  // Check product components for each
  const ids = products?.map(p => p.id) || [];
  if (ids.length > 0) {
    const { data: comps } = await supa
      .from('product_components')
      .select('product_id, component_sku, quantity, unit_cost, total_component_cost')
      .in('product_id', ids);

    console.log("\nProduct components for these products:");
    console.log(comps);
  }
}

main().catch(console.error);
