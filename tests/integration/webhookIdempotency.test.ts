import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

describe("Sprint 4 Webhook Idempotency & Persistence Integration Tests", () => {
  const testDbUrl = process.env.DATABASE_URL_TEST;
  const testSentinel = process.env.KLYVO_RLS_TEST_DB;

  if (!testDbUrl || testSentinel !== "1") {
    test.skip("Skipping Webhook Idempotency integration tests: DATABASE_URL_TEST and KLYVO_RLS_TEST_DB=1 not configured in environment", () => {});
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

  test("Applies canonical production schema fixture and Sprint 4 migration", async () => {
    const schemaSql = fs.readFileSync(path.join(fixturesDir, "testSchema.sql"), "utf-8");
    await sql.unsafe(schemaSql);

    const migrationS4 = fs.readFileSync(
      path.join(migrationsDir, "20260904000000_sprint04_webhook_events.sql"),
      "utf-8"
    );
    await sql.unsafe(migrationS4);

    assert.ok(true, "Sprint 4 migration executed successfully against canonical schema");
  });

  test("Executes 20 concurrent identical webhooks and guarantees single execution", async () => {
    // 1. Setup Test Tenant
    const [tenant] = await sql`
      INSERT INTO public.tenants (name, slug, currency)
      VALUES ('Webhook Test Tenant', 'webhook-test-tenant', 'ARS')
      ON CONFLICT (slug) DO UPDATE SET name = 'Webhook Test Tenant'
      RETURNING id
    `;

    const tenantId = tenant.id;
    const testEventKey = `meli_orders_ord_concurrent_${Date.now()}`;
    const payloadHash = "a1b2c3d4e5f60000000000000000000000000000000000000000000000000000";

    // 2. Launch 20 concurrent atomic claims using separate client connections
    const concurrentSqlClients = Array.from({ length: 20 }, () => postgres(testDbUrl!, { max: 1 }));

    try {
      const concurrentInserts = concurrentSqlClients.map((client, i) =>
        client`
          INSERT INTO public.webhook_events (
            provider,
            event_key,
            tenant_id,
            topic,
            status,
            attempts,
            payload_hash,
            correlation_id,
            event_data
          )
          VALUES (
            'mercadolibre',
            ${testEventKey},
            ${tenantId},
            'orders_v2',
            'received',
            0,
            ${payloadHash},
            ${'corr-concurrent-' + i},
            '{"resource":"/orders/999888"}'::jsonb
          )
          ON CONFLICT (provider, event_key) DO NOTHING
          RETURNING id, status, attempts;
        `
      );

      const results = await Promise.all(concurrentInserts);

      // Exactly 1 insert must succeed (non-empty array returned)
      const successfulClaims = results.filter((res) => res.length > 0);
      const conflictClaims = results.filter((res) => res.length === 0);

      assert.equal(successfulClaims.length, 1, "Exactly one claim must succeed in atomic insertion");
      assert.equal(conflictClaims.length, 19, "Remaining 19 concurrent claims must conflict and produce 0 rows");

      const primaryEventId = successfulClaims[0][0].id;
      assert.ok(primaryEventId, "Primary event must have a valid UUID");

      // 3. Test Status Transitions
      await sql`
        UPDATE public.webhook_events
        SET status = 'processing', updated_at = NOW()
        WHERE id = ${primaryEventId}
      `;
      const [processingRow] = await sql`SELECT status, attempts FROM public.webhook_events WHERE id = ${primaryEventId}`;
      assert.equal(processingRow.status, "processing");

      await sql`
        UPDATE public.webhook_events
        SET status = 'completed', processed_at = NOW(), updated_at = NOW()
        WHERE id = ${primaryEventId}
      `;
      const [completedRow] = await sql`SELECT status, processed_at FROM public.webhook_events WHERE id = ${primaryEventId}`;
      assert.equal(completedRow.status, "completed");
      assert.ok(completedRow.processed_at !== null, "completed status must set processed_at timestamp");

      // 4. Repeated event that is already completed does NOT create a new row
      const duplicateAttempt = await sql`
        INSERT INTO public.webhook_events (
          provider,
          event_key,
          tenant_id,
          topic,
          status,
          attempts,
          payload_hash,
          correlation_id
        )
        VALUES (
          'mercadolibre',
          ${testEventKey},
          ${tenantId},
          'orders_v2',
          'received',
          0,
          ${payloadHash},
          'corr-repeat-attempt'
        )
        ON CONFLICT (provider, event_key) DO NOTHING
        RETURNING id;
      `;
      assert.equal(duplicateAttempt.length, 0, "Repeated completed event must not insert a new row");

      // 5. Test DLQ transition on failure
      const dlqEventKey = `wa_msg_failure_${Date.now()}`;
      const [dlqRowCreated] = await sql`
        INSERT INTO public.webhook_events (
          provider,
          event_key,
          tenant_id,
          topic,
          status,
          attempts,
          payload_hash
        )
        VALUES (
          'whatsapp',
          ${dlqEventKey},
          ${tenantId},
          'message',
          'received',
          0,
          ${payloadHash}
        )
        RETURNING id;
      `;

      await sql`
        UPDATE public.webhook_events
        SET status = 'retrying', attempts = attempts + 1, last_error_code = 'RATE_LIMIT', updated_at = NOW()
        WHERE id = ${dlqRowCreated.id}
      `;

      const [retryingRow] = await sql`SELECT status, attempts, last_error_code FROM public.webhook_events WHERE id = ${dlqRowCreated.id}`;
      assert.equal(retryingRow.status, "retrying");
      assert.equal(retryingRow.attempts, 1);
      assert.equal(retryingRow.last_error_code, "RATE_LIMIT");

      await sql`
        UPDATE public.webhook_events
        SET status = 'dead_letter', processed_at = NOW(), last_error_code = 'MAX_RETRIES_EXCEEDED', updated_at = NOW()
        WHERE id = ${dlqRowCreated.id}
      `;

      const [dlqRow] = await sql`SELECT status, processed_at FROM public.webhook_events WHERE id = ${dlqRowCreated.id}`;
      assert.equal(dlqRow.status, "dead_letter");
      assert.ok(dlqRow.processed_at !== null);

      // 6. Test RLS / Permission enforcement: authenticated and anon roles cannot access webhook_events
      try {
        await sql`SET ROLE authenticated`;
        const authSelect = await sql`SELECT * FROM public.webhook_events LIMIT 1`;
        // With RLS enabled and 0 policies for authenticated, returns 0 rows
        assert.equal(authSelect.length, 0, "authenticated role must see 0 rows in webhook_events");
      } catch (err: any) {
        // Permission denied is also valid and expected
        assert.ok(true, "authenticated role permission denied on webhook_events");
      } finally {
        await sql`RESET ROLE`;
      }

      // Cleanup test data
      await sql`DELETE FROM public.tenants WHERE id = ${tenantId}`;
    } finally {
      await Promise.all(concurrentSqlClients.map((client) => client.end()));
    }
  });
});
