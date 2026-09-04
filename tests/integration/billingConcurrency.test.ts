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
