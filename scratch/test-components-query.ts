import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const tenantId = '198b6356-4bbf-43d8-ae0e-3cc406f66f87';
const productId = 'da6582a7-3879-48ca-bedd-9d6f65f1451a';

async function main() {
  const { data: components, error: componentsError } = await supa
    .from("product_components")
    .select(`
      id,
      product_id,
      component_sku,
      component_normalized,
      quantity,
      inventory_item_id,
      inventory_items (
        average_cost
      )
    `)
    .eq("tenant_id", tenantId)
    .in("product_id", [productId]);

  console.log("Error:", componentsError);
  console.log("Components fetched:");
  console.log(JSON.stringify(components, null, 2));
}

main().catch(console.error);
