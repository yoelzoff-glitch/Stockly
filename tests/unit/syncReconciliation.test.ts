import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reconcileTenantSyncState } from "../../src/lib/sync/reconciliation";

describe("Sprint 8 — Sync Reconciliation & Health Diagnostic Tests", () => {
  it("reconciles tenant sync state and generates a sanitized report for clean state", async () => {
    const syntheticTenantId = "00000000-0000-0000-0000-000000000001";
    const mockClient = {
      from: (table: string) => {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: table === "meli_accounts"
                  ? { status: "connected", token_expires_at: new Date(Date.now() + 3600000).toISOString() }
                  : table === "orders"
                  ? { date_created: "2026-09-04T12:00:00Z" }
                  : { updated_at: "2026-09-04T12:00:00Z" },
              }),
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: table === "orders" ? { date_created: "2026-09-04T12:00:00Z" } : { updated_at: "2026-09-04T12:00:00Z" },
                  }),
                  then: (fn: any) => Promise.resolve({ data: [] }).then(fn),
                }),
              }),
              then: (fn: any) => {
                if (table === "operation_leases") return Promise.resolve({ data: [] }).then(fn);
                if (table === "webhook_events") return Promise.resolve({ data: [{ status: "completed" }] }).then(fn);
                return Promise.resolve({ data: [] }).then(fn);
              },
            }),
          }),
        };
      },
    };

    const report = await reconcileTenantSyncState(syntheticTenantId, mockClient as any);

    assert.equal(report.tenantId, syntheticTenantId);
    assert.equal(report.accountStatus, "connected");
    assert.equal(report.tokenExpired, false);
    assert.equal(report.hasDiscrepancies, false);
    assert.equal(report.discrepancies.length, 0);

    // Ensure no raw secrets leaked
    const serialized = JSON.stringify(report);
    assert.doesNotMatch(serialized, /access_token/);
    assert.doesNotMatch(serialized, /refresh_token/);
    assert.doesNotMatch(serialized, /client_secret/);
  });

  it("detects expired tokens, zombie leases and dead letter webhooks", async () => {
    const syntheticTenantId = "00000000-0000-0000-0000-000000000002";
    const mockClient = {
      from: (table: string) => {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: table === "meli_accounts"
                  ? { status: "connected", token_expires_at: new Date(Date.now() - 3600000).toISOString() }
                  : null,
              }),
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null }),
                  then: (fn: any) => Promise.resolve({
                    data: [{
                      operation_type: "sync_orders",
                      status: "failed",
                      started_at: "2026-09-04T10:00:00Z",
                      error_code: "MELI_AUTH_EXPIRED",
                      error_message: "Token expired",
                    }],
                  }).then(fn),
                }),
              }),
              then: (fn: any) => {
                if (table === "operation_leases") {
                  return Promise.resolve({
                    data: [{
                      operation_type: "sync_orders",
                      lease_owner: "worker-1",
                      expires_at: new Date(Date.now() - 60000).toISOString(),
                    }],
                  }).then(fn);
                }
                if (table === "webhook_events") {
                  return Promise.resolve({
                    data: [
                      { status: "dead_letter" },
                      { status: "dead_letter" },
                      { status: "retrying" },
                    ],
                  }).then(fn);
                }
                return Promise.resolve({ data: [] }).then(fn);
              },
            }),
          }),
        };
      },
    };

    const report = await reconcileTenantSyncState(syntheticTenantId, mockClient as any);

    assert.equal(report.tenantId, syntheticTenantId);
    assert.equal(report.tokenExpired, true);
    assert.equal(report.hasDiscrepancies, true);
    assert.ok(report.discrepancies.some((d) => d.includes("ACCOUNT_CONNECTED_BUT_TOKEN_EXPIRED")));
    assert.ok(report.discrepancies.some((d) => d.includes("ZOMBIE_LEASES_DETECTED")));
    assert.ok(report.discrepancies.some((d) => d.includes("DEAD_LETTER_WEBHOOKS_PRESENT")));
    assert.equal(report.webhookQueueStats.dead_letter, 2);
    assert.equal(report.webhookQueueStats.retrying, 1);
  });
});

