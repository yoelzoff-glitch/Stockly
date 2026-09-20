import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

// Execute the shipped migration and RPC against PostgreSQL, not a simulated map.
test("shipment RPC is atomic, idempotent, tenant isolated and rejects stale deliveries", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE tenants (id uuid PRIMARY KEY);
      CREATE TABLE orders (id uuid PRIMARY KEY, tenant_id uuid REFERENCES tenants(id), meli_shipment_id text);
    `);
    const schema = fs.readFileSync(path.resolve("supabase/sql/full_schema_setup.sql"), "utf8");
    const shipmentTable = schema.match(/CREATE TABLE IF NOT EXISTS public\.shipments \([\s\S]*?\n\);/)![0];
    await db.exec(shipmentTable);
    await db.exec(fs.readFileSync(path.resolve("supabase/migrations/20260922000000_reliable_order_shipments.sql"), "utf8"));
    const tenant = "00000000-0000-0000-0000-000000000001";
    const otherTenant = "00000000-0000-0000-0000-000000000002";
    const order = "00000000-0000-0000-0000-000000000003";
    await db.query("INSERT INTO tenants VALUES ($1), ($2)", [tenant, otherTenant]);
    await db.query("INSERT INTO orders VALUES ($1, $2, '456')", [order, tenant]);
    const persist = (patch: any, owner = tenant) => db.query("SELECT persist_meli_shipment($1, $2, $3::jsonb)", [owner, order, JSON.stringify({
      meli_shipment_id: "456", shipping_cost: 6500, status: "shipped", receiver_city: "CABA",
      last_updated: "2026-09-19T12:00:00Z", ...patch,
    })]);
    await persist({});
    const first: any = (await db.query("SELECT * FROM shipments")).rows[0];
    await persist({ status: "delivered", last_updated: "2026-09-19T13:00:00Z" });
    let rows: any[] = (await db.query("SELECT * FROM shipments")).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, first.id, "preserve row identity");
    assert.equal(rows[0].status, "delivered");
    await persist({ status: "shipped" });
    rows = (await db.query("SELECT * FROM shipments")).rows;
    assert.equal(rows[0].status, "delivered", "older webhook cannot regress status");
    await assert.rejects(persist({}, otherTenant), /does not belong/);
    await assert.rejects(persist({ meli_shipment_id: "999" }), /does not match/);

    // Inject a database write failure; the previous shipment must survive.
    await db.exec("ALTER TABLE shipments ADD CONSTRAINT test_nonnegative_cost CHECK (shipping_cost >= 0)");
    await assert.rejects(persist({ shipping_cost: -1, last_updated: "2026-09-19T14:00:00Z" }), /check constraint/);
    rows = (await db.query("SELECT * FROM shipments")).rows;
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].shipping_cost), 6500);
    assert.equal(rows[0].receiver_city, "CABA");

    // Heal an existing duplicate transactionally when the order is repaired.
    await db.query("INSERT INTO shipments (tenant_id, order_id, meli_shipment_id, last_updated) VALUES ($1, $2, '456', '2026-09-18')", [tenant, order]);
    await persist({ last_updated: "2026-09-19T14:00:00Z" });
    rows = (await db.query("SELECT * FROM shipments")).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, first.id);
    const permissions: any = (await db.query(`SELECT
      has_function_privilege('authenticated', 'persist_meli_shipment(uuid,uuid,jsonb)', 'EXECUTE') AS user_access,
      has_function_privilege('service_role', 'persist_meli_shipment(uuid,uuid,jsonb)', 'EXECUTE') AS service_access`)).rows[0];
    assert.equal(permissions.user_access, false);
    assert.equal(permissions.service_access, true);
  } finally { await db.close(); }
});
