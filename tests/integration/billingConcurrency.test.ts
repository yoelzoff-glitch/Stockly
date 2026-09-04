import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

describe("Sprint 5: Billing Concurrency, Atomic Quotas & Ledger Integration Tests", () => {
  const testDbUrl = process.env.DATABASE_URL_TEST;
  const testSentinel = process.env.KLYVO_RLS_TEST_DB;

  if (!testDbUrl || testSentinel !== "1") {
    test.skip("Skipping Billing Concurrency integration tests: DATABASE_URL_TEST and KLYVO_RLS_TEST_DB=1 not configured in environment", () => {});
    return;
  }

  // Security Barrier: Strictly enforce localhost / 127.0.0.1
  try {
    const parsedUrl = new URL(testDbUrl.startsWith("postgres") ? testDbUrl.replace(/^postgresql?:\/\//, "http://") : testDbUrl);
    const hostname = parsedUrl.hostname.toLowerCase();
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "0.0.0.0";
    if (!isLocal) {
      throw new Error(`CRITICAL SECURITY VIOLATION: DATABASE_URL_TEST host '${hostname}' is NOT local.`);
    }
  } catch (e: any) {
    if (e.message.includes("CRITICAL SECURITY VIOLATION")) throw e;
  }

  const sql = postgres(testDbUrl, { max: 1 });
  const migrationsDir = path.resolve(__dirname, "../../supabase/migrations");
  const fixturesDir = path.resolve(__dirname, "../fixtures");

  after(async () => {
    await sql.end();
  });

  test("Applies canonical schema fixture and Sprint 5 migration", async () => {
    const schemaSql = fs.readFileSync(path.join(fixturesDir, "testSchema.sql"), "utf-8");
    await sql.unsafe(schemaSql);

    const migrationS5 = fs.readFileSync(
      path.join(migrationsDir, "20260905000000_sprint05_billing_integrity.sql"),
      "utf-8"
    );
    await sql.unsafe(migrationS5);

    assert.ok(true, "Sprint 5 migration executed successfully against canonical schema");
  });

  test("50 concurrent quota consumptions near limit: never exceeds limit", async () => {
    // 1. Setup Tenant with Starter plan (Limit: 500)
    const [tenant] = await sql`
      INSERT INTO public.tenants (name, slug, currency, plan)
      VALUES ('Concurrency Tenant', 'concurrency-tenant', 'ARS', 'starter')
      ON CONFLICT (slug) DO UPDATE SET plan = 'starter'
      RETURNING id
    `;
    const tenantId = tenant.id;

    await sql`
      INSERT INTO public.subscriptions (tenant_id, plan, status)
      VALUES (${tenantId}, 'starter', 'active')
      ON CONFLICT (tenant_id) DO UPDATE SET plan = 'starter', status = 'active'
    `;

    // Ensure plans_config exists for starter
    await sql`
      INSERT INTO public.plans_config (plan_key, display_name, ai_credits_limit, automation_limit, whatsapp_limit, sku_limit)
      VALUES ('starter', 'Starter', 500, 250, 300, 100)
      ON CONFLICT (plan_key) DO UPDATE SET ai_credits_limit = 500
    `;

    // Initialize current usage to 480 (leaving room for exactly 20 credits)
    const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
    await sql`
      INSERT INTO public.subscription_usage (tenant_id, month, ai_credits_used, whatsapp_messages_used, automation_actions_used)
      VALUES (${tenantId}, ${currentMonth}, 480, 0, 0)
      ON CONFLICT (tenant_id, month) DO UPDATE SET ai_credits_used = 480
    `;

    // 2. Launch 50 concurrent separate clients requesting 1 credit each
    const clients = Array.from({ length: 50 }, () => postgres(testDbUrl!, { max: 1 }));

    try {
      const concurrentCalls = clients.map((client, i) =>
        client`
          SELECT public.consume_tenant_quota(
            ${tenantId}::uuid,
            'ai_credits_used'::text,
            1::integer,
            ${'idemp-50-' + i}::text,
            'test_concurrency'::text,
            ${'corr-50-' + i}::text
          ) as res;
        `
      );

      const results = await Promise.all(concurrentCalls);
      const parsedResults = results.map((r) => r[0].res);

      const allowedRequests = parsedResults.filter((r) => r.allowed === true);
      const rejectedRequests = parsedResults.filter((r) => r.allowed === false);

      assert.equal(allowedRequests.length, 20, "Exactly 20 requests must be allowed to reach limit 500");
      assert.equal(rejectedRequests.length, 30, "Remaining 30 requests must be rejected");

      // Verify database total usage is exactly 500
      const [finalUsage] = await sql`
        SELECT ai_credits_used FROM public.subscription_usage
        WHERE tenant_id = ${tenantId} AND month = ${currentMonth}
      `;
      assert.equal(finalUsage.ai_credits_used, 500, "Database counter must be exactly 500 and never exceed limit");
    } finally {
      await Promise.all(clients.map((c) => c.end()));
    }
  });

  test("Same idempotency key repeated: increments exactly once and returns duplicate", async () => {
    const [tenant] = await sql`
      INSERT INTO public.tenants (name, slug, currency, plan)
      VALUES ('Idempotency Key Tenant', 'idemp-key-tenant', 'ARS', 'pro')
      ON CONFLICT (slug) DO UPDATE SET plan = 'pro'
      RETURNING id
    `;
    const tenantId = tenant.id;

    await sql`
      INSERT INTO public.subscriptions (tenant_id, plan, status)
      VALUES (${tenantId}, 'pro', 'active')
      ON CONFLICT (tenant_id) DO UPDATE SET plan = 'pro', status = 'active'
    `;

    const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
    await sql`
      INSERT INTO public.subscription_usage (tenant_id, month, ai_credits_used, whatsapp_messages_used, automation_actions_used)
      VALUES (${tenantId}, ${currentMonth}, 0, 0, 0)
      ON CONFLICT (tenant_id, month) DO UPDATE SET ai_credits_used = 0
    `;

    const sharedKey = `shared_idemp_${Date.now()}`;

    // First call: should be allowed and not duplicate
    const [firstCall] = await sql`
      SELECT public.consume_tenant_quota(
        ${tenantId}::uuid,
        'ai_credits_used'::text,
        5::integer,
        ${sharedKey}::text,
        'test_idemp'::text,
        'corr-1'::text
      ) as res;
    `;
    assert.equal(firstCall.res.allowed, true);
    assert.equal(firstCall.res.duplicate, false);
    assert.equal(firstCall.res.current_usage, 5);

    // Repeated 4 calls with identical idempotency key
    for (let i = 2; i <= 5; i++) {
      const [repeatCall] = await sql`
        SELECT public.consume_tenant_quota(
          ${tenantId}::uuid,
          'ai_credits_used'::text,
          5::integer,
          ${sharedKey}::text,
          'test_idemp'::text,
          ${'corr-' + i}::text
        ) as res;
      `;
      assert.equal(repeatCall.res.allowed, true, "Duplicate call returns allowed status matching original");
      assert.equal(repeatCall.res.duplicate, true, "Duplicate call must return duplicate: true");
      assert.equal(repeatCall.res.current_usage, 5, "Duplicate call must NOT increment counter");
    }

    // Check database counter is still 5
    const [usage] = await sql`
      SELECT ai_credits_used FROM public.subscription_usage
      WHERE tenant_id = ${tenantId} AND month = ${currentMonth}
    `;
    assert.equal(usage.ai_credits_used, 5, "Total usage must remain 5");
  });

  test("Rejection Idempotency: repeated rejected idempotency key remains rejected without altering counter", async () => {
    const [tenant] = await sql`
      INSERT INTO public.tenants (name, slug, currency, plan)
      VALUES ('Rejection Tenant', 'rejection-tenant', 'ARS', 'starter')
      ON CONFLICT (slug) DO UPDATE SET plan = 'starter'
      RETURNING id
    `;
    const tenantId = tenant.id;

    await sql`
      INSERT INTO public.subscriptions (tenant_id, plan, status)
      VALUES (${tenantId}, 'starter', 'active')
      ON CONFLICT (tenant_id) DO UPDATE SET plan = 'starter', status = 'active'
    `;

    const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
    // Set tenant usage exactly at limit (500)
    await sql`
      INSERT INTO public.subscription_usage (tenant_id, month, ai_credits_used, whatsapp_messages_used, automation_actions_used)
      VALUES (${tenantId}, ${currentMonth}, 500, 0, 0)
      ON CONFLICT (tenant_id, month) DO UPDATE SET ai_credits_used = 500
    `;

    const rejectKey = `idemp_reject_${Date.now()}`;

    // 1. First consumption when at limit -> rejected
    const [firstCall] = await sql`
      SELECT public.consume_tenant_quota(
        ${tenantId}::uuid,
        'ai_credits_used'::text,
        1::integer,
        ${rejectKey}::text,
        'test_reject'::text,
        'corr-rej-1'::text
      ) as res;
    `;
    assert.equal(firstCall.res.allowed, false, "First call at limit must be rejected");
    assert.equal(firstCall.res.duplicate, false);
    assert.equal(firstCall.res.current_usage, 500);
    assert.equal(firstCall.res.limit, 500);
    assert.equal(firstCall.res.remaining, 0);

    // 2. Repeat with the same idempotency key -> must continue allowed: false, duplicate: true
    const [repeatCall] = await sql`
      SELECT public.consume_tenant_quota(
        ${tenantId}::uuid,
        'ai_credits_used'::text,
        1::integer,
        ${rejectKey}::text,
        'test_reject'::text,
        'corr-rej-2'::text
      ) as res;
    `;
    assert.equal(repeatCall.res.allowed, false, "Duplicate of rejected request must NEVER be allowed");
    assert.equal(repeatCall.res.duplicate, true, "Duplicate must return duplicate: true");
    assert.equal(repeatCall.res.current_usage, 500);
    assert.equal(repeatCall.res.limit, 500);
    assert.equal(repeatCall.res.remaining, 0);

    // 3. Counter does NOT change
    const [usage] = await sql`
      SELECT ai_credits_used FROM public.subscription_usage
      WHERE tenant_id = ${tenantId} AND month = ${currentMonth}
    `;
    assert.equal(usage.ai_credits_used, 500, "Counter must remain exactly 500");
  });

  test("Month without prior row: 50 concurrent consumptions create exactly 1 row and count to 50 without constraint errors", async () => {
    const [tenant] = await sql`
      INSERT INTO public.tenants (name, slug, currency, plan)
      VALUES ('No Prior Row Tenant', 'no-prior-row-tenant', 'ARS', 'starter')
      ON CONFLICT (slug) DO UPDATE SET plan = 'starter'
      RETURNING id
    `;
    const tenantId = tenant.id;

    await sql`
      INSERT INTO public.subscriptions (tenant_id, plan, status)
      VALUES (${tenantId}, 'starter', 'active')
      ON CONFLICT (tenant_id) DO UPDATE SET plan = 'starter', status = 'active'
    `;

    const currentMonth = new Date().toISOString().slice(0, 7) + "-01";

    // Explicitly delete any prior monthly row
    await sql`
      DELETE FROM public.subscription_usage
      WHERE tenant_id = ${tenantId} AND month = ${currentMonth}
    `;

    // 50 concurrent separate clients
    const clients = Array.from({ length: 50 }, () => postgres(testDbUrl!, { max: 1 }));

    try {
      const concurrentCalls = clients.map((client, i) =>
        client`
          SELECT public.consume_tenant_quota(
            ${tenantId}::uuid,
            'ai_credits_used'::text,
            1::integer,
            ${'idemp-init-50-' + i}::text,
            'test_initial_month'::text,
            ${'corr-init-' + i}::text
          ) as res;
        `
      );

      const results = await Promise.all(concurrentCalls);
      const parsedResults = results.map((r) => r[0].res);

      assert.equal(parsedResults.filter((r) => r.allowed === true).length, 50, "All 50 initial consumptions must succeed");

      // Verify exactly 1 row exists
      const rows = await sql`
        SELECT * FROM public.subscription_usage
        WHERE tenant_id = ${tenantId} AND month = ${currentMonth}
      `;
      assert.equal(rows.length, 1, "Exactly one monthly usage row must exist for this tenant");
      assert.equal(rows[0].ai_credits_used, 50, "Total counter must be exactly 50");
    } finally {
      await Promise.all(clients.map((c) => c.end()));
    }
  });

  test("Month transition test: Month A usage remains intact when Month B is consumed", async () => {
    const [tenant] = await sql`
      INSERT INTO public.tenants (name, slug, currency, plan)
      VALUES ('Month Transition Tenant', 'month-trans-tenant', 'ARS', 'starter')
      ON CONFLICT (slug) DO UPDATE SET plan = 'starter'
      RETURNING id
    `;
    const tenantId = tenant.id;

    const monthA = "2026-01-01";
    const currentMonth = new Date().toISOString().slice(0, 7) + "-01";

    // Setup past month usage of 450
    await sql`
      INSERT INTO public.subscription_usage (tenant_id, month, ai_credits_used, whatsapp_messages_used, automation_actions_used)
      VALUES (${tenantId}, ${monthA}, 450, 0, 0)
      ON CONFLICT (tenant_id, month) DO UPDATE SET ai_credits_used = 450
    `;

    // Consume in current month
    await sql`
      SELECT public.consume_tenant_quota(
        ${tenantId}::uuid,
        'ai_credits_used'::text,
        25::integer,
        'idemp-new-month-trans'::text
      );
    `;

    const [usageA] = await sql`SELECT ai_credits_used FROM public.subscription_usage WHERE tenant_id = ${tenantId} AND month = ${monthA}`;
    const [usageB] = await sql`SELECT ai_credits_used FROM public.subscription_usage WHERE tenant_id = ${tenantId} AND month = ${currentMonth}`;

    assert.equal(usageA.ai_credits_used, 450, "Past month usage must remain unchanged");
    assert.equal(usageB.ai_credits_used, 25, "Current month usage must start fresh at 25");
  });

  test("SECURITY DEFINER protection: authenticated and anon roles cannot execute consume_tenant_quota or sync_tenant_subscription", async () => {
    // Create roles if they don't exist
    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN;
        END IF;
      END
      $$;
    `);

    // Test consume_tenant_quota with role authenticated
    await assert.rejects(
      async () => {
        await sql.begin(async (tx) => {
          await tx`SET LOCAL ROLE authenticated`;
          await tx`SELECT public.consume_tenant_quota('00000000-0000-0000-0000-000000000000'::uuid, 'ai_credits_used'::text, 1::integer)`;
        });
      },
      (err: any) => {
        return err.code === "42501" || err.message.includes("permission denied");
      },
      "authenticated role MUST be denied execute permission on consume_tenant_quota"
    );

    // Test sync_tenant_subscription with role authenticated
    await assert.rejects(
      async () => {
        await sql.begin(async (tx) => {
          await tx`SET LOCAL ROLE authenticated`;
          await tx`SELECT public.sync_tenant_subscription('00000000-0000-0000-0000-000000000000'::uuid, 'pro'::text, 'active'::text)`;
        });
      },
      (err: any) => {
        return err.code === "42501" || err.message.includes("permission denied");
      },
      "authenticated role MUST be denied execute permission on sync_tenant_subscription"
    );
  });

  test("Atomic Subscriptions RPC: sync_tenant_subscription guarantees transactional integrity, versioning and idempotent expiration", async () => {
    const [tenant] = await sql`
      INSERT INTO public.tenants (name, slug, currency, plan)
      VALUES ('Subscription Sync Tenant', 'sub-sync-tenant', 'ARS', 'starter')
      ON CONFLICT (slug) DO UPDATE SET plan = 'starter'
      RETURNING id
    `;
    const tenantId = tenant.id;

    // 1. Transactional Atomic Upgrade: Starter -> Pro
    const expDate = "2026-10-01T00:00:00.000Z";
    const eventTime1 = "2026-09-04T12:00:00.000Z";

    const [upgradeRes] = await sql`
      SELECT public.sync_tenant_subscription(
        ${tenantId}::uuid,
        'pro'::text,
        'active'::text,
        'mp-sub-123'::text,
        ${expDate}::timestamptz,
        ${eventTime1}::timestamptz
      ) as res;
    `;

    assert.equal(upgradeRes.res.success, true);
    assert.equal(upgradeRes.res.plan, "pro");

    const [subAfter1] = await sql`SELECT * FROM public.subscriptions WHERE tenant_id = ${tenantId}`;
    const [tenantAfter1] = await sql`SELECT plan FROM public.tenants WHERE id = ${tenantId}`;

    assert.equal(subAfter1.plan, "pro");
    assert.equal(subAfter1.status, "active");
    assert.equal(tenantAfter1.plan, "pro");

    // 2. Stale Event Rejection: Older event timestamp (11:00:00) must NOT overwrite newer (12:00:00)
    const staleEventTime = "2026-09-04T11:00:00.000Z";
    const [staleRes] = await sql`
      SELECT public.sync_tenant_subscription(
        ${tenantId}::uuid,
        'starter'::text,
        'active'::text,
        'mp-sub-old'::text,
        ${expDate}::timestamptz,
        ${staleEventTime}::timestamptz
      ) as res;
    `;

    assert.equal(staleRes.res.success, false);
    assert.equal(staleRes.res.reason, "stale_event");

    // Plan must remain Pro
    const [subAfterStale] = await sql`SELECT plan FROM public.subscriptions WHERE tenant_id = ${tenantId}`;
    const [tenantAfterStale] = await sql`SELECT plan FROM public.tenants WHERE id = ${tenantId}`;
    assert.equal(subAfterStale.plan, "pro");
    assert.equal(tenantAfterStale.plan, "pro");

    // 3. Duplicate event: preserves expiration date
    const [dupRes] = await sql`
      SELECT public.sync_tenant_subscription(
        ${tenantId}::uuid,
        'pro'::text,
        'active'::text,
        'mp-sub-123'::text,
        ${expDate}::timestamptz,
        ${eventTime1}::timestamptz
      ) as res;
    `;
    assert.equal(dupRes.res.success, true);
    assert.equal(new Date(dupRes.res.expires_at).toISOString(), new Date(expDate).toISOString());

    // 4. Rollback on failure: non-existent tenant throws exception, no orphan subscription created
    const fakeTenantId = "ffffffff-ffff-ffff-ffff-ffffffffffff";
    await assert.rejects(
      async () => {
        await sql`
          SELECT public.sync_tenant_subscription(
            ${fakeTenantId}::uuid,
            'ultra'::text,
            'active'::text
          );
        `;
      },
      (err: any) => err.message.includes("does not exist")
    );

    const fakeSub = await sql`SELECT * FROM public.subscriptions WHERE tenant_id = ${fakeTenantId}`;
    assert.equal(fakeSub.length, 0, "No subscription created for failed tenant sync");
  });

  test("Multi-Tenant Isolation: Tenant A does not consume Tenant B quota", async () => {
    const [tenantA] = await sql`
      INSERT INTO public.tenants (name, slug, currency, plan)
      VALUES ('Tenant A', 'tenant-a-iso', 'ARS', 'starter')
      ON CONFLICT (slug) DO UPDATE SET plan = 'starter'
      RETURNING id
    `;
    const [tenantB] = await sql`
      INSERT INTO public.tenants (name, slug, currency, plan)
      VALUES ('Tenant B', 'tenant-b-iso', 'ARS', 'starter')
      ON CONFLICT (slug) DO UPDATE SET plan = 'starter'
      RETURNING id
    `;

    const currentMonth = new Date().toISOString().slice(0, 7) + "-01";

    await sql`
      INSERT INTO public.subscription_usage (tenant_id, month, ai_credits_used)
      VALUES (${tenantA.id}, ${currentMonth}, 0)
      ON CONFLICT (tenant_id, month) DO UPDATE SET ai_credits_used = 0;
    `;
    await sql`
      INSERT INTO public.subscription_usage (tenant_id, month, ai_credits_used)
      VALUES (${tenantB.id}, ${currentMonth}, 0)
      ON CONFLICT (tenant_id, month) DO UPDATE SET ai_credits_used = 0;
    `;

    // Consume 15 for Tenant A
    await sql`
      SELECT public.consume_tenant_quota(
        ${tenantA.id}::uuid,
        'ai_credits_used'::text,
        15::integer,
        ${'idemp-iso-a'}::text
      );
    `;

    const [usageA] = await sql`SELECT ai_credits_used FROM public.subscription_usage WHERE tenant_id = ${tenantA.id} AND month = ${currentMonth}`;
    const [usageB] = await sql`SELECT ai_credits_used FROM public.subscription_usage WHERE tenant_id = ${tenantB.id} AND month = ${currentMonth}`;

    assert.equal(usageA.ai_credits_used, 15);
    assert.equal(usageB.ai_credits_used, 0, "Tenant B usage must remain 0");
  });
});
