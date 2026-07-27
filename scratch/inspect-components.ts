import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const productsToCheck = [
  { id: '2789447b-79e8-4d35-a5ee-16c8a10e9163', title: 'Dije Angel De La Guarda Plata 925 Oro 18k Y Cadena Bautismo Largo Cadena 40 Cm', qtySold: 4 },
  { id: '50f2b6f7-ffe7-47ab-90ec-dac81769d032', title: 'Cadena Plata 925  Dije Cristal Swarovski Corazón Rojo Mujer Rojo X 40 Cm', qtySold: 1 }
];

async function main() {
  console.log("=== INSPECTING COMPONENTS ===");
  for (const prod of productsToCheck) {
    console.log(`\nProduct: "${prod.title}" (ID: ${prod.id})`);
    console.log(`Qty Sold (unmapped): ${prod.qtySold}`);

    const { data: components, error } = await supa
      .from("product_components")
      .select(`
        quantity,
        component_sku,
        inventory_items (
          sku_normalized,
          current_stock
        )
      `)
      .eq("product_id", prod.id);

    if (error) {
      console.error("Error fetching components:", error);
      continue;
    }

    if (!components || components.length === 0) {
      console.log("  No components registered for this product.");
      continue;
    }

    components.forEach((c: any) => {
      const invItem = c.inventory_items;
      const reqQty = c.quantity || 1;
      const totalMissedDeduction = reqQty * prod.qtySold;
      console.log(`  - Component SKU: "${c.component_sku}"`);
      console.log(`    Qty per Product: ${reqQty}`);
      console.log(`    Total Missed Deduction: ${totalMissedDeduction}`);
      console.log(`    Current DB Stock: ${invItem?.current_stock ?? 'N/A'}`);
    });
  }
}

main().catch(console.error);
