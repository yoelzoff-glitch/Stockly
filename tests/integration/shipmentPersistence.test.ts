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

test("upgrade scenario: function with previous search_path -> apply new incremental migration -> verify empty search_path and execute shipment persistence", async () => {
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

    // 1. Simulate the previous configuration from existing databases (search_path = public, pg_temp)
    await db.exec(`
      CREATE OR REPLACE FUNCTION public.persist_meli_shipment(
        p_tenant_id uuid, p_order_id uuid, p_shipment jsonb
      ) RETURNS void
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
      DECLARE
        v_existing public.shipments%ROWTYPE;
        v_shipment public.shipments%ROWTYPE;
        v_meli_shipment_id text;
      BEGIN
        SELECT meli_shipment_id INTO v_meli_shipment_id
        FROM public.orders
        WHERE id = p_order_id AND tenant_id = p_tenant_id
        FOR UPDATE;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Shipment order does not belong to tenant';
        END IF;
        IF v_meli_shipment_id IS DISTINCT FROM p_shipment->>'meli_shipment_id' THEN
          RAISE EXCEPTION 'Shipment does not match current order';
        END IF;

        SELECT * INTO v_existing FROM public.shipments
        WHERE tenant_id = p_tenant_id AND order_id = p_order_id
        ORDER BY last_updated DESC NULLS LAST, created_at DESC, id
        LIMIT 1;

        IF v_existing.meli_shipment_id = v_meli_shipment_id
           AND v_existing.last_updated > (p_shipment->>'last_updated')::timestamptz THEN
          RETURN;
        END IF;
        v_shipment := jsonb_populate_record(v_existing, p_shipment);
        v_shipment.id := COALESCE(v_existing.id, gen_random_uuid());
        v_shipment.tenant_id := p_tenant_id;
        v_shipment.order_id := p_order_id;
        v_shipment.created_at := COALESCE(v_existing.created_at, now());

        INSERT INTO public.shipments SELECT v_shipment.*
        ON CONFLICT (id) DO UPDATE SET
          meli_shipment_id = EXCLUDED.meli_shipment_id,
          status = EXCLUDED.status, substatus = EXCLUDED.substatus,
          logistic_type = EXCLUDED.logistic_type, mode = EXCLUDED.mode,
          tracking_number = EXCLUDED.tracking_number,
          tracking_method = EXCLUDED.tracking_method,
          shipping_cost = EXCLUDED.shipping_cost,
          receiver_city = EXCLUDED.receiver_city, receiver_state = EXCLUDED.receiver_state,
          date_created = EXCLUDED.date_created, last_updated = EXCLUDED.last_updated,
          raw_data = EXCLUDED.raw_data;

        DELETE FROM public.shipments
        WHERE tenant_id = p_tenant_id AND order_id = p_order_id AND id <> v_shipment.id;
      END;
      $$;
      REVOKE ALL ON FUNCTION public.persist_meli_shipment(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
      GRANT EXECUTE ON FUNCTION public.persist_meli_shipment(uuid, uuid, jsonb) TO service_role;
    `);

    // Verify previous configuration has search_path set to public, pg_temp
    const prevProc: any = (await db.query(`SELECT proconfig FROM pg_proc WHERE proname = 'persist_meli_shipment'`)).rows[0];
    assert.ok(
      prevProc.proconfig && prevProc.proconfig.some((opt: string) => opt.includes("public")),
      "Previous configuration must have public in search_path"
    );

    // 2. Apply the new incremental migration: 20260922000001_harden_persist_meli_shipment_search_path.sql
    const incrementalMigration = fs.readFileSync(
      path.resolve("supabase/migrations/20260922000001_harden_persist_meli_shipment_search_path.sql"),
      "utf8"
    );
    await db.exec(incrementalMigration);

    // 3. Verify that search_path is now strictly empty ('search_path=""')
    const updatedProc: any = (await db.query(`SELECT proconfig FROM pg_proc WHERE proname = 'persist_meli_shipment'`)).rows[0];
    assert.ok(
      updatedProc.proconfig && updatedProc.proconfig.some((opt: string) => opt === 'search_path=""' || opt === "search_path="),
      "Updated configuration must strictly set search_path to empty ('')"
    );

    // 4. Verify execution of shipment persistence and permissions after the ALTER FUNCTION
    const tenant = "00000000-0000-0000-0000-000000000001";
    const order = "00000000-0000-0000-0000-000000000003";
    await db.query("INSERT INTO tenants VALUES ($1)", [tenant]);
    await db.query("INSERT INTO orders VALUES ($1, $2, '789')", [order, tenant]);

    // Persist new shipment
    await db.query("SELECT persist_meli_shipment($1, $2, $3::jsonb)", [
      tenant,
      order,
      JSON.stringify({
        meli_shipment_id: "789",
        shipping_cost: 4200,
        status: "shipped",
        receiver_city: "Rosario",
        last_updated: "2026-09-20T10:00:00Z",
      }),
    ]);

    const rows: any[] = (await db.query("SELECT * FROM shipments WHERE order_id = $1", [order])).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].meli_shipment_id, "789");
    assert.equal(Number(rows[0].shipping_cost), 4200);
    assert.equal(rows[0].receiver_city, "Rosario");

    // Verify permissions are preserved (authenticated revoked, service_role granted)
    const perms: any = (await db.query(`SELECT
      has_function_privilege('authenticated', 'persist_meli_shipment(uuid,uuid,jsonb)', 'EXECUTE') AS user_access,
      has_function_privilege('service_role', 'persist_meli_shipment(uuid,uuid,jsonb)', 'EXECUTE') AS service_access`)).rows[0];
    assert.equal(perms.user_access, false, "authenticated must not have execute permission");
    assert.equal(perms.service_access, true, "service_role must retain execute permission");
  } finally {
    await db.close();
  }
});
