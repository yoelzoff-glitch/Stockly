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

  test("Distributed Lease: 50 concurrent independent clients -> exactly 1 acquires lease, 0 unique violations, 1 row", async () => {
    const [tenant] = await sql`
      INSERT INTO public.tenants (name, slug, currency, plan)
      VALUES ('Lease 50 Tenant', 'lease-50-tenant', 'ARS', 'pro')
      ON CONFLICT (slug) DO UPDATE SET plan = 'pro'
      RETURNING id
    `;
    const tenantId = tenant.id;
    const opType = "sync_inventory_50";

    const CLIENT_COUNT = 50;
    const clients = Array.from({ length: CLIENT_COUNT }, () =>
      postgres(testDbUrl, { max: 1 })
    );

    try {
      // 50 concurrent independent clients attempt to acquire the very first lease simultaneously
      const results = await Promise.all(
        clients.map((client, idx) =>
          client`SELECT public.acquire_operation_lease(${tenantId}::uuid, ${opType}::text, ${'worker-' + idx}::text, 60) as res;`
        )
      );

      const acquired = results.filter((r) => r[0].res.acquired === true);
      const rejected = results.filter((r) => r[0].res.acquired === false);

      assert.equal(acquired.length, 1, "Exactly 1 worker MUST acquire the lease");
      assert.equal(rejected.length, 49, "Exactly 49 workers MUST be rejected");
      for (const rej of rejected) {
        assert.equal(rej[0].res.reason, "lease_held_by_other");
      }

      // Check operation_leases table has exactly 1 row for this (tenant, opType)
      const rows = await sql`
        SELECT * FROM public.operation_leases
        WHERE tenant_id = ${tenantId}::uuid AND operation_type = ${opType}::text;
      `;
      assert.equal(rows.length, 1, "There MUST be exactly 1 row in operation_leases");

      // Release lease
      const winnerOwner = acquired[0][0].res.lease_owner;
      const [releaseRes] = await sql`
        SELECT public.release_operation_lease(${tenantId}::uuid, ${opType}::text, ${winnerOwner}::text) as res;
      `;
      assert.equal(releaseRes.res.released, true);
    } finally {
      await Promise.all(clients.map((c) => c.end()));
    }
  });

  test("Distributed Rate Limiter: validates cost, window_seconds, max_requests, empty key, 50 requests with limit 20, and multi-tenant isolation", async () => {
    const [tenantA] = await sql`
      INSERT INTO public.tenants (name, slug, currency, plan)
      VALUES ('RL Tenant A', 'rl-tenant-a', 'ARS', 'pro')
      ON CONFLICT (slug) DO UPDATE SET plan = 'pro'
      RETURNING id
    `;
    const [tenantB] = await sql`
      INSERT INTO public.tenants (name, slug, currency, plan)
      VALUES ('RL Tenant B', 'rl-tenant-b', 'ARS', 'pro')
      ON CONFLICT (slug) DO UPDATE SET plan = 'pro'
      RETURNING id
    `;

    // 1. cost = -1 -> rejected without changing bucket count
    const [negCost] = await sql`
      SELECT public.check_rate_limit_bucket(${tenantA.id}::uuid, 'ai_chat'::text, 10::integer, 60::integer, -1::integer) as res;
    `;
    assert.equal(negCost.res.allowed, false);
    assert.equal(negCost.res.reason, "invalid_parameters");

    // 2. window_seconds = 0 -> rejected
    const [zeroWindow] = await sql`
      SELECT public.check_rate_limit_bucket(${tenantA.id}::uuid, 'ai_chat'::text, 10::integer, 0::integer, 1::integer) as res;
    `;
    assert.equal(zeroWindow.res.allowed, false);
    assert.equal(zeroWindow.res.reason, "invalid_parameters");

    // 3. max_requests = 0 -> rejected
    const [zeroMax] = await sql`
      SELECT public.check_rate_limit_bucket(${tenantA.id}::uuid, 'ai_chat'::text, 0::integer, 60::integer, 1::integer) as res;
    `;
    assert.equal(zeroMax.res.allowed, false);
    assert.equal(zeroMax.res.reason, "invalid_parameters");

    // 4. bucket_key empty -> rejected
    const [emptyKey] = await sql`
      SELECT public.check_rate_limit_bucket(${tenantA.id}::uuid, '   '::text, 10::integer, 60::integer, 1::integer) as res;
    `;
    assert.equal(emptyKey.res.allowed, false);
    assert.equal(emptyKey.res.reason, "invalid_parameters");

    // 5. 50 sequential requests with limit 20 -> exactly 20 allowed, 30 rejected
    let allowedCount = 0;
    let rejectedCount = 0;
    for (let i = 0; i < 50; i++) {
      const [res] = await sql`
        SELECT public.check_rate_limit_bucket(${tenantA.id}::uuid, 'test_limit_20'::text, 20::integer, 60::integer, 1::integer) as res;
      `;
      if (res.res.allowed) {
        allowedCount++;
      } else {
        rejectedCount++;
      }
    }
    assert.equal(allowedCount, 20, "Exactly 20 requests MUST be allowed");
    assert.equal(rejectedCount, 30, "Exactly 30 requests MUST be rejected");

    // 6. Tenant A exhaustion does NOT affect Tenant B
    const [tenantBReq] = await sql`
      SELECT public.check_rate_limit_bucket(${tenantB.id}::uuid, 'test_limit_20'::text, 20::integer, 60::integer, 1::integer) as res;
    `;
    assert.equal(tenantBReq.res.allowed, true, "Tenant B MUST be allowed regardless of Tenant A rate limit exhaustion");
    assert.equal(tenantBReq.res.current, 1);
  });

  test("Database Index Audit: confirms no duplicate equivalent indexes and absence of redundant idx_operation_leases_tenant_op", async () => {
    const orderIndexes = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'orders';
    `;

    // Verify idx_orders_tenant_date exists
    const hasTenantDate = orderIndexes.some((i) => i.indexname === "idx_orders_tenant_date");
    assert.ok(hasTenantDate, "idx_orders_tenant_date must exist on orders(tenant_id, date_created DESC)");

    // Verify idx_orders_tenant_date_created was removed to avoid duplication
    const hasDuplicate = orderIndexes.some((i) => i.indexname === "idx_orders_tenant_date_created");
    assert.equal(hasDuplicate, false, "Duplicate index idx_orders_tenant_date_created must NOT exist");

    // Verify idx_operation_leases_tenant_op is absent (covered by UNIQUE constraint)
    const leaseIndexes = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'operation_leases';
    `;
    const hasRedundantLeaseIdx = leaseIndexes.some((i) => i.indexname === "idx_operation_leases_tenant_op");
    assert.equal(hasRedundantLeaseIdx, false, "idx_operation_leases_tenant_op must NOT exist (UNIQUE constraint already indexes it)");
  });

  test("Security Privileges: anon and authenticated are blocked, service_role is granted access", async () => {
    const roleClient = postgres(testDbUrl, { max: 1 });

    try {
      // 1. authenticated role is blocked from direct SELECT on operation_leases
      await roleClient`SET ROLE authenticated;`;
      try {
        await roleClient`SELECT * FROM public.operation_leases LIMIT 1;`;
        assert.fail("authenticated MUST be blocked from querying operation_leases");
      } catch (err: any) {
        assert.ok(
          err.message.includes("permission denied") || err.code === "42501",
          `Expected permission denied for authenticated on operation_leases, got: ${err.message}`
        );
      }

      // 2. authenticated role is blocked from direct SELECT on rate_limit_buckets
      try {
        await roleClient`SELECT * FROM public.rate_limit_buckets LIMIT 1;`;
        assert.fail("authenticated MUST be blocked from querying rate_limit_buckets");
      } catch (err: any) {
        assert.ok(
          err.message.includes("permission denied") || err.code === "42501",
          `Expected permission denied for authenticated on rate_limit_buckets, got: ${err.message}`
        );
      }

      // 3. anon role is blocked from direct SELECT on operation_leases
      await roleClient`SET ROLE anon;`;
      try {
        await roleClient`SELECT * FROM public.operation_leases LIMIT 1;`;
        assert.fail("anon MUST be blocked from querying operation_leases");
      } catch (err: any) {
        assert.ok(
          err.message.includes("permission denied") || err.code === "42501",
          `Expected permission denied for anon on operation_leases, got: ${err.message}`
        );
      }

      // 4. anon role is blocked from direct SELECT on rate_limit_buckets
      try {
        await roleClient`SELECT * FROM public.rate_limit_buckets LIMIT 1;`;
        assert.fail("anon MUST be blocked from querying rate_limit_buckets");
      } catch (err: any) {
        assert.ok(
          err.message.includes("permission denied") || err.code === "42501",
          `Expected permission denied for anon on rate_limit_buckets, got: ${err.message}`
        );
      }
    } finally {
      await roleClient`RESET ROLE;`.catch(() => {});
      await roleClient.end();
    }

    // 5. service_role / superuser can access tables directly
    const [leasesCount] = await sql`SELECT count(*)::integer as count FROM public.operation_leases;`;
    assert.ok(typeof leasesCount.count === "number");

    const [bucketsCount] = await sql`SELECT count(*)::integer as count FROM public.rate_limit_buckets;`;
    assert.ok(typeof bucketsCount.count === "number");
  });

  test("cleanup_scalability_state: performs bounded paginated cleanup of expired leases and old rate limit buckets", async () => {
    const [tenant] = await sql`
      INSERT INTO public.tenants (name, slug, currency, plan)
      VALUES ('Cleanup Tenant', 'cleanup-tenant', 'ARS', 'pro')
      ON CONFLICT (slug) DO UPDATE SET plan = 'pro'
      RETURNING id
    `;
    const tenantId = tenant.id;

    // 1. Insert an expired lease manually
    await sql`
      INSERT INTO public.operation_leases (tenant_id, operation_type, lease_owner, acquired_at, expires_at, heartbeat_at)
      VALUES (
        ${tenantId}::uuid,
        'expired_op',
        'old-worker',
        now() - interval '2 hours',
        now() - interval '1 hour',
        now() - interval '2 hours'
      )
      ON CONFLICT (tenant_id, operation_type) DO UPDATE
      SET expires_at = now() - interval '1 hour';
    `;

    // 2. Insert an old rate limit bucket (5 days old)
    await sql`
      INSERT INTO public.rate_limit_buckets (tenant_id, bucket_key, window_start, request_count)
      VALUES (${tenantId}::uuid, 'old_key', now() - interval '5 days', 10)
      ON CONFLICT (tenant_id, bucket_key, window_start) DO NOTHING;
    `;

    // 3. Insert an active bucket (recent)
    await sql`
      INSERT INTO public.rate_limit_buckets (tenant_id, bucket_key, window_start, request_count)
      VALUES (${tenantId}::uuid, 'recent_key', now() - interval '5 minutes', 3)
      ON CONFLICT (tenant_id, bucket_key, window_start) DO NOTHING;
    `;

    // 4. Run cleanup
    const [cleanupRes] = await sql`
      SELECT public.cleanup_scalability_state(now() - interval '2 days', 500) as res;
    `;

    assert.equal(cleanupRes.res.cleaned, true);
    assert.ok(cleanupRes.res.deleted_leases >= 1, "Must delete at least 1 expired lease");
    assert.ok(cleanupRes.res.deleted_buckets >= 1, "Must delete at least 1 old bucket");

    // 5. Verify recent bucket is still present
    const recentBuckets = await sql`
      SELECT * FROM public.rate_limit_buckets
      WHERE tenant_id = ${tenantId}::uuid AND bucket_key = 'recent_key';
    `;
    assert.equal(recentBuckets.length, 1, "Recent rate limit bucket must NOT be deleted");
  });
});
