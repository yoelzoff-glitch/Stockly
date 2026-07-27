import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  let log = "=== RUNNING DATABASE HEALING FOR DOUBLE DEDUCTIONS ===\n";
  console.log("Starting database healing...");

  // Fetch all inventory movements that are sales confirmations
  const { data: movements, error } = await supa
    .from("inventory_movements")
    .select("id, tenant_id, inventory_item_id, movement_type, quantity_delta, reference_id, created_at, notes")
    .eq("movement_type", "sale_confirmed");

  if (error || !movements) {
    log += `Error fetching movements: ${JSON.stringify(error)}\n`;
    fs.writeFileSync('scratch/heal_output.txt', log);
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

  let healedCount = 0;
  let totalMovementsDeleted = 0;

  for (const [key, list] of Object.entries(groups)) {
    if (list.length > 1) {
      healedCount++;
      // Sort by created_at ascending
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      // Keep the oldest one
      const keep = list[0];
      const duplicates = list.slice(1);

      log += `\nHealing Order/Item Key: ${key}\n`;
      log += `Keeping Movement ID: ${keep.id} (Created: ${keep.created_at}, Delta: ${keep.quantity_delta})\n`;

      for (const dup of duplicates) {
        log += `  - Processing duplicate Movement ID: ${dup.id} (Created: ${dup.created_at}, Delta: ${dup.quantity_delta})\n`;

        // 1. Fetch current stock of the inventory item
        const { data: invItem, error: fetchErr } = await supa
          .from("inventory_items")
          .select("id, current_stock, sku")
          .eq("id", dup.inventory_item_id)
          .single();

        if (fetchErr || !invItem) {
          log += `    Error fetching inventory item ${dup.inventory_item_id}: ${JSON.stringify(fetchErr)}\n`;
          continue;
        }

        const currentStock = invItem.current_stock || 0;
        const refundQty = -dup.quantity_delta; // e.g. -(-1) = 1
        const newStock = currentStock + refundQty;

        log += `    Refunding Component "${invItem.sku || 'N/A'}" (ID: ${invItem.id}): ${currentStock} -> ${newStock} (+${refundQty})\n`;

        // 2. Update stock in database
        const { error: updateErr } = await supa
          .from("inventory_items")
          .update({ current_stock: newStock, updated_at: new Date().toISOString() })
          .eq("id", invItem.id);

        if (updateErr) {
          log += `    Error updating stock for inventory item ${invItem.id}: ${JSON.stringify(updateErr)}\n`;
          continue;
        }

        // 3. Delete the duplicate movement
        const { error: deleteErr } = await supa
          .from("inventory_movements")
          .delete()
          .eq("id", dup.id);

        if (deleteErr) {
          log += `    Error deleting movement ${dup.id}: ${JSON.stringify(deleteErr)}\n`;
          continue;
        }

        log += `    Successfully deleted movement and restored stock.\n`;
        totalMovementsDeleted++;
      }
    }
  }

  log += `\nSummary:\n- Healed ${healedCount} groups with duplicate deductions.\n- Deleted ${totalMovementsDeleted} duplicate movements and restored stock.\n`;
  console.log("Database healing completed!");
  fs.writeFileSync('scratch/heal_output.txt', log);
}

main().catch(err => {
  fs.writeFileSync('scratch/heal_output.txt', `Fatal error: ${err.message}\n${err.stack}`);
});
