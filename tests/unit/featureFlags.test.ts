import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  isFeatureFlagEnabled,
  getFeatureFlagConfig,
  invalidateFeatureFlagCache,
} from "../../src/lib/safety/featureFlags";

describe("Feature Flags Service Tests", () => {
  beforeEach(() => {
    invalidateFeatureFlagCache();
  });

  test("returns false when tenantId or flagKey is empty", async () => {
    assert.equal(await isFeatureFlagEnabled("", "strict_tenant_authorization"), false);
    assert.equal(await isFeatureFlagEnabled(null, "meli_client_v2"), false);
  });

  test("returns false when database throws or table is missing (safe fallback)", async () => {
    const mockErrorClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: null,
                error: { message: "relation 'tenant_feature_flags' does not exist" },
              }),
            }),
          }),
        }),
      }),
    };

    const isEnabled = await isFeatureFlagEnabled("tenant-123", "meli_client_v2", mockErrorClient);
    assert.equal(isEnabled, false);

    const config = await getFeatureFlagConfig("tenant-123", "meli_client_v2", mockErrorClient);
    assert.equal(config, null);
  });

  test("returns true and caches value when flag is active", async () => {
    let callCount = 0;
    const mockClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => {
                callCount++;
                return {
                  data: { enabled: true, configuration: { rate_limit: 50 } },
                  error: null,
                };
              },
            }),
          }),
        }),
      }),
    };

    const isEnabled1 = await isFeatureFlagEnabled("tenant-abc", "inventory_atomic_v2", mockClient);
    assert.equal(isEnabled1, true);
    assert.equal(callCount, 1);

    // Second call should hit the cache
    const isEnabled2 = await isFeatureFlagEnabled("tenant-abc", "inventory_atomic_v2", mockClient);
    assert.equal(isEnabled2, true);
    assert.equal(callCount, 1, "Should have used in-memory cache");

    // Invalidate cache and verify refetch
    invalidateFeatureFlagCache("tenant-abc");
    const isEnabled3 = await isFeatureFlagEnabled("tenant-abc", "inventory_atomic_v2", mockClient);
    assert.equal(isEnabled3, true);
    assert.equal(callCount, 2);
  });
});
