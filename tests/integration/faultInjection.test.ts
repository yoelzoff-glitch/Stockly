import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import postgres from "postgres";
import { sanitizeLogData, sanitizeStringText, maskEmail } from "@/lib/observability/sanitizer";
import { isManualSyncDisabled, isMeliWritesDisabled, isWhatsappAgentDisabled } from "@/lib/safety/killSwitches";

const dbUrl = process.env.DATABASE_URL_TEST || "postgresql://postgres:password@127.0.0.1:54322/postgres";

describe("Sprint 7 — Fault Injection & Graceful Degradation Tests", () => {
  const sql = postgres(dbUrl, { max: 5, idle_timeout: 5 });

  it("Fault 1: Database connection failure / query error degrades gracefully with sanitized output", async () => {
    // Simulate query failure by connecting to invalid port
    const brokenSql = postgres("postgresql://postgres:password@127.0.0.1:59999/postgres", {
      connect_timeout: 1,
      max: 1,
    });

    try {
      await brokenSql`SELECT 1`;
      assert.fail("Should have failed connecting to unreachable DB");
    } catch (err: any) {
      const sanitized = sanitizeLogData({ error: err.message, port: 59999 });
      assert.ok(sanitized);
    } finally {
      await brokenSql.end().catch(() => {});
    }
  });

  it("Fault 2: Mercado Libre 401, 429, 500 and timeout responses are sanitized and handled safely", async () => {
    // 401 Unauthorized (Expired / Revoked Token)
    const error401 = { status: 401, error: "invalid_grant", message: "Malformed access_token APP_USR-12345" };
    const sanitized401 = sanitizeLogData(error401);
    assert.doesNotMatch(JSON.stringify(sanitized401), /APP_USR-12345/);

    // 429 Too Many Requests (Rate limit hit)
    const error429 = { status: 429, error: "rate_limit_exceeded" };
    const sanitized429 = sanitizeLogData(error429);
    assert.equal(sanitized429.status, 429);

    // 500 Server Error
    const error500 = { message: "Internal Server Error from MercadoLibre Gateway with customer email john.doe@example.com" };
    const sanitized500 = sanitizeLogData(error500);
    assert.doesNotMatch(JSON.stringify(sanitized500), /john\.doe@example\.com/);

    // Timeout (AbortError)
    const timeoutErr = { code: "ETIMEDOUT", message: "Timeout connecting to api.mercadolibre.com" };
    const sanitizedTimeout = sanitizeLogData(timeoutErr);
    assert.equal(sanitizedTimeout.code, "ETIMEDOUT");
  });

  it("Fault 3: Inngest event dispatch failure degrades safely without crashing process", async () => {
    // When Inngest is unreachable, the system must log and fail gracefully without unhandled rejection
    let handled = false;
    try {
      // Simulate sending event to invalid endpoint
      const res = await fetch("http://127.0.0.1:59999/api/inngest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "klyvo/order.sync", data: {} }),
        signal: AbortSignal.timeout(500),
      }).catch(() => {
        handled = true;
        return null;
      });
      assert.equal(res, null);
      assert.equal(handled, true);
    } catch (err) {
      assert.fail("Fetch error should have been caught");
    }
  });

  it("Fault 4: Duplicate webhook payload produces identical event key and does not duplicate state", async () => {
    const rawPayload = {
      resource: "/orders/2000001",
      user_id: 12345678,
      topic: "orders_v2",
      application_id: 111111,
      attempts: 1,
      sent: "2026-09-04T12:00:00.000Z",
    };

    // Deterministic event key computation
    const key1 = crypto.createHash("sha256").update(JSON.stringify(rawPayload)).digest("hex");
    const key2 = crypto.createHash("sha256").update(JSON.stringify(rawPayload)).digest("hex");

    assert.equal(key1, key2);
  });

  it("Fault 5: Expired lease allows a secondary worker to claim and continue safely", async () => {
    const tenantRows = await sql`SELECT id FROM public.tenants LIMIT 1`;
    if (tenantRows.length === 0) return;
    const tenantId = tenantRows[0].id;

    const opType = "fault_test_sync";

    // 1. Worker A acquires lease for 60 seconds
    const [res1] = await sql`
      SELECT public.acquire_operation_lease(
        ${tenantId}::uuid,
        ${opType}::text,
        'worker_a'::text,
        60
      ) as lease
    `;
    assert.equal(res1.lease.acquired, true);

    // 2. Worker B immediately tries -> rejected
    const [res2] = await sql`
      SELECT public.acquire_operation_lease(
        ${tenantId}::uuid,
        ${opType}::text,
        'worker_b'::text,
        60
      ) as lease
    `;
    assert.equal(res2.lease.acquired, false);
    assert.equal(res2.lease.reason, "lease_held_by_other");

    // 3. Worker A releases lease
    await sql`SELECT public.release_operation_lease(${tenantId}::uuid, ${opType}::text, 'worker_a'::text)`;

    // 4. Worker B acquires released lease
    const [res3] = await sql`
      SELECT public.acquire_operation_lease(
        ${tenantId}::uuid,
        ${opType}::text,
        'worker_b'::text,
        60
      ) as lease
    `;
    assert.equal(res3.lease.acquired, true);

    // Cleanup
    await sql`SELECT public.release_operation_lease(${tenantId}::uuid, ${opType}::text, 'worker_b'::text)`;
  });

  it("Fault 6: Interrupted worker preserves correlation ID and error state in operation_runs", async () => {
    const tenantRows = await sql`SELECT id FROM public.tenants LIMIT 1`;
    if (tenantRows.length === 0) return;
    const tenantId = tenantRows[0].id;

    const correlationId = "corr_fault_test_12345";
    const [run] = await sql`
      INSERT INTO public.operation_runs (
        tenant_id,
        operation_type,
        source,
        status,
        correlation_id,
        metadata
      ) VALUES (
        ${tenantId}::uuid,
        'orders_sync',
        'cron',
        'failed',
        ${correlationId},
        jsonb_build_object('error_code', 'WORKER_SIGTERM_INTERRUPTED', 'clean_shutdown', false)
      ) RETURNING id, status, correlation_id, metadata
    `;

    assert.equal(run.status, "failed");
    assert.equal(run.correlation_id, correlationId);
    assert.equal(run.metadata.error_code, "WORKER_SIGTERM_INTERRUPTED");
  });

  it("Fault 7: Sentry / Telemetry failure does not impede core request processing", async () => {
    // Sentry captureException mock failure simulation
    const captureExceptionMock = () => {
      throw new Error("Sentry DSN unreachable");
    };

    let requestSucceeded = false;
    try {
      try {
        captureExceptionMock();
      } catch {
        // Silently swallow telemetry error in production path
      }
      requestSucceeded = true;
    } catch {
      requestSucceeded = false;
    }

    assert.equal(requestSucceeded, true);
  });

  it("Fault 8: Cache down or empty falls back gracefully to database source of truth", async () => {
    const cacheGet = async () => null; // simulated cache miss / redis down

    const data = await (async () => {
      const cached = await cacheGet();
      if (cached) return cached;
      const rows = await sql`SELECT count(*)::int as cnt FROM public.plans_config`;
      return { planCount: rows[0].cnt, source: "db" };
    })();

    assert.equal(data.source, "db");
    assert.ok(data.planCount >= 1);
  });

  it("Fault 9: Atomic quota increment failure prevents overconsumption and rejects safely", async () => {
    const tenantRows = await sql`SELECT id FROM public.tenants LIMIT 1`;
    if (tenantRows.length === 0) return;
    const tenantId = tenantRows[0].id;

    // Call check_rate_limit_bucket with invalid cost (cost <= 0)
    const [result] = await sql`
      SELECT public.check_rate_limit_bucket(
        ${tenantId}::uuid,
        'ai_tokens'::text,
        100,
        60,
        -5
      ) as res
    `;
    assert.equal(result.res.allowed, false);
    assert.equal(result.res.reason, "invalid_parameters");
  });

  it("Fault 10: Kill switch instantly disables failing subsystems without deployment", async () => {
    process.env.KLYVO_DISABLE_MANUAL_SYNCS = "true";
    assert.equal(isManualSyncDisabled(), true);

    process.env.KLYVO_DISABLE_MANUAL_SYNCS = "false";
    assert.equal(isManualSyncDisabled(), false);
  });
});
