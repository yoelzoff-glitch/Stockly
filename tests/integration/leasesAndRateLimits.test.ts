import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

describe("Sprint 6: Distributed Leases, Rate Limits & Scalability Integration Tests", () => {
  const testDbUrl = process.env.DATABASE_URL_TEST;
  const testSentinel = process.env.KLYVO_RLS_TEST_DB;

  if (!testDbUrl || testSentinel !== "1") {
    test.skip("Skipping Scalability integration tests: DATABASE_URL_TEST and KLYVO_RLS_TEST_DB=1 not configured in environment", () => {});
    return;
  }

  const sql = postgres(testDbUrl, { max: 1 });
  const migrationsDir = path.resolve(__dirname, "../../supabase/migrations");
  const fixturesDir = path.resolve(__dirname, "../fixtures");

  after(async () => {
    await sql.end();
  });

  test("Applies canonical schema fixture and Sprint 6 scalability migration", async () => {
    const schemaSql = fs.readFileSync(path.join(fixturesDir, "testSchema.sql"), "utf-8");
    await sql.unsafe(schemaSql);

    const migrationS6 = fs.readFileSync(
      path.join(migrationsDir, "20260906000000_sprint06_scalability.sql"),
      "utf-8"
    );
    await sql.unsafe(migrationS6);

    assert.ok(true, "Sprint 6 migration executed successfully against canonical schema");
  });

  test("Distributed Lease: 2 concurrent workers on same tenant -> only one acquires lease", async () => {
    const [tenant] = await sql`
      INSERT INTO public.tenants (name, slug, currency, plan)
      VALUES ('Lease Tenant', 'lease-tenant', 'ARS', 'pro')
      ON CONFLICT (slug) DO UPDATE SET plan = 'pro'
      RETURNING id
    `;
    const tenantId = tenant.id;

    const w1Client = postgres(testDbUrl, { max: 1 });
    const w2Client = postgres(testDbUrl, { max: 1 });

    try {
      // Worker 1 and Worker 2 try to acquire at the exact same moment
      const [w1, w2] = await Promise.all([
        w1Client`SELECT public.acquire_operation_lease(${tenantId}::uuid, 'sync_orders'::text, 'worker-1'::text, 60) as res;`,
        w2Client`SELECT public.acquire_operation_lease(${tenantId}::uuid, 'sync_orders'::text, 'worker-2'::text, 60) as res;`,
      ]);

      const res1 = w1[0].res;
      const res2 = w2[0].res;

      const acquired = [res1, res2].filter((r) => r.acquired === true);
      const rejected = [res1, res2].filter((r) => r.acquired === false);

      assert.equal(acquired.length, 1, "Exactly 1 worker must acquire the lease");
      assert.equal(rejected.length, 1, "The competing worker must be rejected");
      assert.equal(rejected[0].reason, "lease_held_by_other");

      // Winner releases lease
      const winnerOwner = acquired[0].lease_owner;
      const [rel] = await sql`
        SELECT public.release_operation_lease(${tenantId}::uuid, 'sync_orders'::text, ${winnerOwner}::text) as res;
      `;
      assert.equal(rel.res.released, true);

      // Now Worker 2 can acquire
      const [w2After] = await sql`
        SELECT public.acquire_operation_lease(${tenantId}::uuid, 'sync_orders'::text, 'worker-2'::text, 60) as res;
      `;
      assert.equal(w2After.res.acquired, true);

      // Cleanup
      await sql`SELECT public.release_operation_lease(${tenantId}::uuid, 'sync_orders'::text, 'worker-2'::text);`;
    } finally {
      await Promise.all([w1Client.end(), w2Client.end()]);
    }
  });

  test("Distributed Rate Limiter: increments correctly and returns 429 Retry-After when limit exceeded", async () => {
    const [tenant] = await sql`
      INSERT INTO public.tenants (name, slug, currency, plan)
      VALUES ('Rate Limit Tenant', 'rl-tenant', 'ARS', 'pro')
      ON CONFLICT (slug) DO UPDATE SET plan = 'pro'
      RETURNING id
    `;
    const tenantId = tenant.id;

    const maxRequests = 5;
    const windowSeconds = 60;

    // Make 5 requests (all should be allowed)
    for (let i = 1; i <= 5; i++) {
      const [res] = await sql`
        SELECT public.check_rate_limit_bucket(
          ${tenantId}::uuid,
          'sales_export'::text,
          ${maxRequests}::integer,
          ${windowSeconds}::integer,
          1::integer
        ) as res;
      `;
      assert.equal(res.res.allowed, true);
      assert.equal(res.res.current, i);
      assert.equal(res.res.remaining, maxRequests - i);
    }

    // 6th request: must be rejected
    const [rejectedRes] = await sql`
      SELECT public.check_rate_limit_bucket(
        ${tenantId}::uuid,
        'sales_export'::text,
        ${maxRequests}::integer,
        ${windowSeconds}::integer,
        1::integer
      ) as res;
    `;
    assert.equal(rejectedRes.res.allowed, false);
    assert.ok(rejectedRes.res.retry_after > 0);
    assert.equal(rejectedRes.res.remaining, 0);
  });

  test("Dashboard SQL Aggregates RPC: calculates revenue, counts, stock and unread alerts accurately", async () => {
    const [tenant] = await sql`
      INSERT INTO public.tenants (name, slug, currency, plan)
      VALUES ('Aggregates Tenant', 'aggregates-tenant', 'ARS', 'pro')
      ON CONFLICT (slug) DO UPDATE SET plan = 'pro'
      RETURNING id
    `;
    const tenantId = tenant.id;

    // Insert products (1 active with stock 2, 1 active with stock 20, 1 without cost)
    await sql`
      INSERT INTO public.products (tenant_id, meli_item_id, title, sku, available_quantity, price, cost, status)
      VALUES
        (${tenantId}, 'MLA-AGG-1', 'Prod 1', 'SKU-1', 2, 1500, 800, 'active'),
        (${tenantId}, 'MLA-AGG-2', 'Prod 2', 'SKU-2', 20, 2500, NULL, 'active')
    `;

    // Insert orders (2 paid orders total $4000)
    await sql`
      INSERT INTO public.orders (tenant_id, meli_order_id, total_amount, status, date_created)
      VALUES
        (${tenantId}, 'ORD-AGG-1', 1500, 'paid', now() - interval '2 days'),
        (${tenantId}, 'ORD-AGG-2', 2500, 'paid', now() - interval '1 hour')
    `;

    // Insert 1 unread alert
    await sql`
      INSERT INTO public.alerts (tenant_id, title, is_read, severity)
      VALUES (${tenantId}, 'Test Alert', false, 'warning');
    `;

    const [rpcRes] = await sql`
      SELECT public.get_dashboard_aggregates_v2(${tenantId}::uuid, 30) as res;
    `;

    assert.equal(rpcRes.res.tenant_id, tenantId);
    assert.equal(rpcRes.res.total_revenue, 4000);
    assert.equal(rpcRes.res.total_orders, 2);
    assert.equal(rpcRes.res.average_ticket, 2000);
    assert.equal(rpcRes.res.critical_stock_count, 1);
    assert.equal(rpcRes.res.products_without_cost, 1);
    assert.equal(rpcRes.res.active_alerts_count, 1);
  });
});
