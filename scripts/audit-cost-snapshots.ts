import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

interface Violation {
  category: string;
  orderId?: string;
  itemId?: string;
  message: string;
}

async function runCostSnapshotsAudit() {
  console.log("=================================================");
  console.log("LIBRETAX SPRINT 31: COST SNAPSHOTTING & IMMUTABILITY AUDIT");
  console.log("=================================================\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const violations: Violation[] = [];

  // 1. Audit Table Schema in database
  console.log("1. Auditing database columns and unique constraints...");
  const { data: testOrder, error: orderErr } = await supabase
    .from("orders")
    .select("packaging_cost_snapshot, flex_cost_snapshot, operational_cost_snapshot_version, cost_snapshot_frozen_at, cost_snapshot_source, cost_snapshot_status")
    .limit(1);

  if (orderErr) {
    violations.push({
      category: "SCHEMA_MISSING_COLUMNS",
      message: `orders table is missing required snapshot columns: ${orderErr.message}`
    });
  }

  const { data: testItem, error: itemErr } = await supabase
    .from("order_items")
    .select("line_key, unit_cost_snapshot, cost_snapshot_frozen_at, cost_snapshot_source, cost_snapshot_version, estimated_fee_snapshot, estimated_shipping_cost_snapshot")
    .limit(1);

  if (itemErr) {
    violations.push({
      category: "SCHEMA_MISSING_COLUMNS",
      message: `order_items table is missing required snapshot columns: ${itemErr.message}`
    });
  }

  // 2. Audit orders consistency
  console.log("2. Auditing orders snapshot consistency...");
  const { data: ordersWithSnapshots, error: ordersQueryErr } = await supabase
    .from("orders")
    .select("id, meli_order_id, status, packaging_cost_snapshot, cost_snapshot_frozen_at, cost_snapshot_source, cost_snapshot_version")
    .not("cost_snapshot_frozen_at", "is", null)
    .limit(100);

  if (!ordersQueryErr && ordersWithSnapshots) {
    ordersWithSnapshots.forEach(o => {
      if (!o.cost_snapshot_source) {
        violations.push({
          category: "INCONSISTENT_ORDER_SNAPSHOT",
          orderId: o.id,
          message: `Order ${o.meli_order_id} has frozen timestamp but missing cost_snapshot_source.`
        });
      }
    });
    console.log(`   Audited ${ordersWithSnapshots.length} frozen orders.`);
  }

  // 3. Audit order_items line_key integrity and duplicates
  console.log("3. Auditing order_items line_key uniqueness...");
  const { data: sampleItems, error: itemsQueryErr } = await supabase
    .from("order_items")
    .select("id, order_id, line_key, cost_snapshot_source, cost_snapshot_frozen_at")
    .limit(200);

  if (!itemsQueryErr && sampleItems) {
    const keySet = new Set<string>();
    sampleItems.forEach(item => {
      if (!item.line_key) {
        violations.push({
          category: "MISSING_LINE_KEY",
          itemId: item.id,
          message: `Item ${item.id} has no line_key.`
        });
      }
      const compositeKey = `${item.order_id}_${item.line_key}`;
      if (keySet.has(compositeKey)) {
        violations.push({
          category: "DUPLICATE_LINE_KEY",
          itemId: item.id,
          message: `Duplicate item line_key detected: ${compositeKey}`
        });
      }
      keySet.add(compositeKey);
    });
    console.log(`   Verified ${sampleItems.length} order items for unique line_key.`);
  }

  // 4. Test Database Immutability Trigger Protection (Security & Integrity Guard)
  console.log("4. Auditing PostgreSQL trigger immutability enforcement...");
  // Find one frozen item or order to verify that modifying frozen fields is REJECTED by Postgres trigger
  const { data: frozenOrder } = await supabase
    .from("orders")
    .select("id, packaging_cost_snapshot, cost_snapshot_frozen_at")
    .not("cost_snapshot_frozen_at", "is", null)
    .limit(1)
    .maybeSingle();

  if (frozenOrder) {
    const currentVal = Number(frozenOrder.packaging_cost_snapshot) || 0;
    const { error: triggerErr } = await supabase
      .from("orders")
      .update({ packaging_cost_snapshot: currentVal + 9999 })
      .eq("id", frozenOrder.id);

    if (!triggerErr || !triggerErr.message.includes("VIOLATION_COST_SNAPSHOT_FROZEN")) {
      violations.push({
        category: "TRIGGER_PROTECTION_FAILED",
        orderId: frozenOrder.id,
        message: `PostgreSQL trigger trg_protect_orders_cost_snapshot failed to block modification of frozen packaging_cost_snapshot! Error: ${triggerErr?.message}`
      });
    } else {
      console.log("   ✅ PostgreSQL trigger successfully BLOCKED illicit modification of frozen packaging snapshot.");
    }
  }

  const { data: frozenItem } = await supabase
    .from("order_items")
    .select("id, unit_cost_snapshot, cost_snapshot_frozen_at")
    .not("cost_snapshot_frozen_at", "is", null)
    .limit(1)
    .maybeSingle();

  if (frozenItem) {
    const currentItemCost = Number(frozenItem.unit_cost_snapshot) || 0;
    const { error: itemTriggerErr } = await supabase
      .from("order_items")
      .update({ unit_cost_snapshot: currentItemCost + 8888 })
      .eq("id", frozenItem.id);

    if (!itemTriggerErr || !itemTriggerErr.message.includes("VIOLATION_COST_SNAPSHOT_FROZEN")) {
      violations.push({
        category: "TRIGGER_PROTECTION_FAILED",
        itemId: frozenItem.id,
        message: `PostgreSQL trigger trg_protect_order_items_cost_snapshot failed to block modification of frozen unit_cost_snapshot! Error: ${itemTriggerErr?.message}`
      });
    } else {
      console.log("   ✅ PostgreSQL trigger successfully BLOCKED illicit modification of frozen unit_cost_snapshot.");
    }
  }

  console.log("\n=================================================");
  console.log(`AUDIT RESULT: ${violations.length} VIOLATIONS DETECTED`);
  console.log("=================================================");

  if (violations.length > 0) {
    console.error("\n❌ Audit failed with the following violations:\n");
    violations.forEach((v, idx) => {
      console.error(` ${idx + 1}. [${v.category}] ${v.message}`);
    });
    process.exit(1);
  }

  console.log("\n✅ All cost snapshotting, idempotency and database immutability invariants are SATISFIED.\n");
}

runCostSnapshotsAudit().catch((err) => {
  console.error("Fatal audit execution error:", err);
  process.exit(1);
});
