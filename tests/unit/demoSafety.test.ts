import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { assertTenantWritable, isDemoTenant, DemoReadOnlyError, clearDemoTenantCache } from "../../src/lib/demo/assert-demo-write-allowed";
import { toAuthErrorResponse } from "../../src/lib/security/tenantAuth";
import { meliFetch } from "../../src/services/meli/client";
import { consumeQuota } from "../../src/lib/billing/quotaService";
import { DEMO_RANDOM_SEED } from "../../scripts/seed-private-demo";

describe("Sprint 11: Demo Account Safety & Isolation Unit Tests", () => {
  const demoTenantId = "11111111-1111-1111-1111-111111111111";
  const regularTenantId = "22222222-2222-2222-2222-222222222222";

  // Mock DB fetch for tests
  function mockSupabase(isDemo: boolean) {
    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { is_demo: isDemo }, error: null }),
            maybeSingle: async () => ({ data: { is_demo: isDemo }, error: null }),
          }),
        }),
      }),
    } as any;
  }

  test("assertTenantWritable throws DemoReadOnlyError when tenant is demo", async () => {
    clearDemoTenantCache();
    const mockClient = mockSupabase(true);

    await assert.rejects(
      async () => {
        await assertTenantWritable(demoTenantId, mockClient);
      },
      (err: any) => {
        assert.ok(err instanceof DemoReadOnlyError);
        assert.match(err.message, /cuenta de demostraci[oó]n/i);
        return true;
      }
    );
  });

  test("assertTenantWritable passes cleanly when tenant is regular (not demo)", async () => {
    clearDemoTenantCache();
    const mockClient = mockSupabase(false);

    // Should not throw
    await assertTenantWritable(regularTenantId, mockClient);
    const isDemo = await isDemoTenant(regularTenantId, mockClient);
    assert.equal(isDemo, false);
  });

  test("demo cache stores is_demo resolution to prevent repetitive DB queries", async () => {
    clearDemoTenantCache();
    let queryCount = 0;
    const trackingMock = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              queryCount++;
              return { data: { is_demo: true }, error: null };
            },
          }),
        }),
      }),
    } as any;

    const res1 = await isDemoTenant(demoTenantId, trackingMock);
    const res2 = await isDemoTenant(demoTenantId, trackingMock);
    assert.equal(res1, true);
    assert.equal(res2, true);
    assert.equal(queryCount, 1, "Expected second lookup to hit memory cache");
  });

  test("toAuthErrorResponse converts DemoReadOnlyError to 403 Forbidden with descriptive message", async () => {
    const error = new DemoReadOnlyError("Acción bloqueada en la cuenta demostrativa");
    const response = toAuthErrorResponse(error, "test-corr-id");

    assert.equal(response.status, 403);
    assert.equal(response.headers.get("x-request-id"), "test-corr-id");
    const json = await response.json();
    assert.equal(json.error, "Acción bloqueada en la cuenta demostrativa");
    assert.equal(json.code, "DEMO_READ_ONLY");
  });

  test("consumeQuota short-circuits with 0 usage and allowed=false for demo tenant", async () => {
    clearDemoTenantCache();
    // Pre-populate cache so isDemoTenant returns true
    await isDemoTenant(demoTenantId, mockSupabase(true));

    const result = await consumeQuota({
      tenantId: demoTenantId,
      metric: "ai_credits_used",
      amount: 5,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.currentUsage, 0);
    assert.equal(result.limit, 0);
    assert.equal(result.remaining, 0);
  });

  test("meliFetch blocks API calls for demo tenant with code OPERATION_BLOCKED", async () => {
    clearDemoTenantCache();
    // Pre-populate cache so isDemoTenant returns true
    await isDemoTenant(demoTenantId, mockSupabase(true));

    await assert.rejects(
      async () => {
        await meliFetch({
          tenantId: demoTenantId,
          endpoint: "/items/MLA123",
          method: "GET",
        });
      },
      (err: any) => {
        assert.equal(err.name, "AppError");
        assert.equal(err.code, "OPERATION_BLOCKED");
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /cuenta demostrativa/i);
        return true;
      }
    );
  });

  test("deterministic seed constant is defined and reproducible", () => {
    assert.equal(DEMO_RANDOM_SEED, "klyvo-casa-norte-v1");
  });
});
