import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  let log = "=== DETECTING DOUBLE DEDUCTIONS ===\n";

  // Fetch all inventory movements that are sales confirmations
  const { data: movements, error } = await supa
    .from("inventory_movements")
    .select("id, tenant_id, inventory_item_id, movement_type, quantity_delta, reference_id, created_at, notes")
    .eq("movement_type", "sale_confirmed");

  if (error || !movements) {
    log += `Error fetching movements: ${JSON.stringify(error)}\n`;
    fs.writeFileSync('scratch/output.txt', log);
    return;
  }

  log += `Total sale_confirmed movements found: ${movements.length}\n`;

  // Group by (reference_id, inventory_item_id)
  const groups: Record<string, typeof movements> = {};
  for (const m of movements) {
    if (!m.reference_id || !m.inventory_item_id) continue;
    const key = `${m.reference_id}_${m.inventory_item_id}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(m);
  }

  let doubleDeductionCount = 0;
  for (const [key, list] of Object.entries(groups)) {
    if (list.length > 1) {
      doubleDeductionCount++;
      const [refId, itemId] = key.split('_');
      log += `\nDuplicate key: ${key}\n`;
      log += `Reference (Order ID): ${refId}\n`;
      log += `Inventory Item ID: ${itemId}\n`;
      log += "Movements:\n";
      list.forEach((m, idx) => {
        log += `  ${idx + 1}. ID: ${m.id}, Created At: ${m.created_at}, Delta: ${m.quantity_delta}, Notes: ${m.notes}\n`;
      });
    }
  }

  log += `\nSummary: Found ${doubleDeductionCount} instances of double/multiple stock deductions.\n`;
  fs.writeFileSync('scratch/output.txt', log);
}

main().catch(err => {
  fs.writeFileSync('scratch/output.txt', `Fatal error: ${err.message}\n${err.stack}`);
});
